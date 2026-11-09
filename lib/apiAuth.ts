import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Auth strategy: there are no accounts.
//
// Every browser generates a random UUID on first visit (lib/auth.ts) and sends
// it as X-Device-Id. Server-side data (plan sync, chat history, weekly-email
// preferences) is keyed on `dev:<uuid>`. That is the whole identity model.
//
// What this means, stated plainly so nobody oversells it:
//   - A plan is tied to one browser. Clear site data and it is gone from that
//     browser; the server copy becomes unreachable.
//   - Anyone who obtains a device UUID can read and write that plan. The UUID
//     is random (122 bits) and never shown in a URL, so the practical exposure
//     is a shared or compromised device — the same exposure as localStorage.
//   - Per-identity and per-IP rate limits bound what a leaked UUID can do.
//
// An earlier version carried a half-wired Cognito/Google sign-in path that was
// never configured in production. It was removed rather than left as a false
// promise of account security. If real accounts are ever needed, add them as
// a separate, fully configured path — don't bolt a token check onto this one.
// ---------------------------------------------------------------------------

export interface TokenPayload {
  sub: string;
  anonymous: true;
}

// Loose UUID check — exact RFC parsing isn't worth it. We just want to reject
// obviously bogus strings (SQL, path traversal, etc.) before they reach
// DynamoDB as a partition key.
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function deviceIdentity(request: Request): TokenPayload | null {
  const deviceId = request.headers.get('X-Device-Id');
  if (!deviceId || !UUID_RE.test(deviceId)) return null;
  return { sub: `dev:${deviceId.toLowerCase()}`, anonymous: true };
}

// Per-identity rate limit. Caps what a single leaked or scripted device ID can
// do regardless of how many IPs it comes from.
const PER_IDENTITY_LIMIT = 60; // req/min/identity
const PER_IDENTITY_WINDOW_MS = 60_000;

/**
 * Resolves the caller's identity from X-Device-Id and applies the
 * per-identity rate limit. Returns a NextResponse error on any failure —
 * never throws.
 */
export async function verifyAuth(request: Request): Promise<TokenPayload | NextResponse> {
  const identity = deviceIdentity(request);
  if (!identity) {
    return NextResponse.json(
      { error: 'Unauthorized', hint: 'Provide X-Device-Id header (UUID)' },
      { status: 401 },
    );
  }

  const limited = checkRateLimit(`identity:${identity.sub}`, PER_IDENTITY_LIMIT, PER_IDENTITY_WINDOW_MS);
  if (limited) return limited;

  return identity;
}

// ---------------------------------------------------------------------------
// In-memory rate limiter. Per Lambda instance, so it is a soft cap — good
// enough to blunt abuse and runaway clients, not a billing guarantee.
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  maxRequests: number = 20,
  windowMs: number = 60_000,
): NextResponse | null {
  cleanupExpiredEntries();

  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  return null;
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
