import { NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

// ---------------------------------------------------------------------------
// Auth strategy
//
// 1. If Cognito env vars are present AND the request carries a Bearer token,
//    verify the JWT against Cognito's JWKS (signature, issuer, audience,
//    token_use, sub). This is the secure production path.
//
// 2. If ALLOW_ANONYMOUS_USERS=1 AND the request carries a valid X-Device-Id
//    header (UUID v4), accept it and return a synthetic identity prefixed
//    with `dev:` to keep anonymous and Cognito sub spaces disjoint. This is
//    the pilot-mode path — zero-friction onboarding, isolated per-browser
//    data, no sign-up flow.
//
// 3. Otherwise, return 401.
//
// Note: anonymous mode is NOT secure. Anyone who steals the deviceId can
// read/write that "user's" data. Acceptable for pilots, never for prod.
// ---------------------------------------------------------------------------

const COGNITO_REGION = process.env.NEXT_PUBLIC_AWS_REGION ?? '';
const USER_POOL_ID = process.env.NEXT_PUBLIC_USER_POOL_ID ?? '';
const APP_CLIENT_ID = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID ?? '';
const ALLOW_ANONYMOUS_USERS = process.env.ALLOW_ANONYMOUS_USERS === '1';

const ISSUER = COGNITO_REGION && USER_POOL_ID
  ? `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${USER_POOL_ID}`
  : '';

// createRemoteJWKSet handles caching, rotation, and cooldown automatically.
// One instance shared across requests; jose internally caches keys per kid.
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!ISSUER) return null;
  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));
  }
  return jwksCache;
}

export interface TokenPayload extends JWTPayload {
  sub: string;
  email?: string;
  token_use?: string;
  client_id?: string;
  aud?: string | string[];
  anonymous?: boolean;
}

// Loose UUID v4-ish check — exact RFC parsing isn't worth it. We just want
// to reject obviously bogus strings (SQL, path traversal, etc.) before they
// reach DynamoDB as a partition key.
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function tryAnonymousIdentity(request: Request): TokenPayload | null {
  if (!ALLOW_ANONYMOUS_USERS) return null;
  const deviceId = request.headers.get('X-Device-Id');
  if (!deviceId || !UUID_RE.test(deviceId)) return null;
  return { sub: `dev:${deviceId.toLowerCase()}`, anonymous: true };
}

/**
 * Validates the Authorization header and returns the verified token payload.
 * Returns a NextResponse error on any failure — never throws.
 *
 * Async: signature verification fetches the JWKS (cached after first call).
 */
export async function verifyAuth(request: Request): Promise<TokenPayload | NextResponse> {
  const authHeader = request.headers.get('Authorization');
  const hasBearerToken = authHeader?.startsWith('Bearer ');

  // Path 1: Cognito JWT (production)
  if (ISSUER && hasBearerToken) {
    return verifyCognitoToken(request);
  }

  // Path 2: Anonymous device-ID (pilot mode)
  const anon = tryAnonymousIdentity(request);
  if (anon) return anon;

  // Path 3: No valid path — explain what's wrong
  if (!ISSUER && !ALLOW_ANONYMOUS_USERS) {
    console.error('Neither Cognito nor anonymous mode is configured');
    return NextResponse.json(
      { error: 'Auth not configured', hint: 'Set ALLOW_ANONYMOUS_USERS=1 (pilot) or Cognito vars (prod)' },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { error: 'Unauthorized', hint: ALLOW_ANONYMOUS_USERS ? 'Provide X-Device-Id header (UUID)' : 'Provide Bearer token' },
    { status: 401 },
  );
}

async function verifyCognitoToken(request: Request): Promise<TokenPayload | NextResponse> {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.slice(7).trim();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jwks = getJwks();
  if (!jwks) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: ISSUER,
    });

    const tp = payload as TokenPayload;

    // token_use must be 'access' or 'id'. Cognito sets this on every token.
    if (tp.token_use !== 'access' && tp.token_use !== 'id') {
      return NextResponse.json({ error: 'Invalid token use' }, { status: 401 });
    }

    // When the App Client ID is configured, verify audience:
    //  - id tokens: aud === APP_CLIENT_ID
    //  - access tokens: client_id === APP_CLIENT_ID (no aud claim)
    if (APP_CLIENT_ID) {
      const matchesAud = tp.token_use === 'id'
        ? (Array.isArray(tp.aud) ? tp.aud.includes(APP_CLIENT_ID) : tp.aud === APP_CLIENT_ID)
        : tp.client_id === APP_CLIENT_ID;

      if (!matchesAud) {
        return NextResponse.json({ error: 'Invalid token audience' }, { status: 401 });
      }
    }

    if (!tp.sub) {
      return NextResponse.json({ error: 'Token missing subject' }, { status: 401 });
    }

    return tp;
  } catch (err) {
    // jose throws specific error codes. Map expiry to a clearer message;
    // collapse everything else to a generic 401 to avoid leaking which
    // check failed (signature vs. issuer vs. structure).
    const code = (err as { code?: string })?.code;
    if (code === 'ERR_JWT_EXPIRED') {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

// ---------------------------------------------------------------------------
// In-memory IP-based rate limiter (unchanged from previous implementation)
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
