import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Lightweight Cognito JWT validation for Next.js API routes
// Verifies token structure, expiry, and issuer (no external deps).
// For full signature verification, add `jwks-rsa` and `jsonwebtoken`.
// ---------------------------------------------------------------------------

const COGNITO_REGION = process.env.NEXT_PUBLIC_AWS_REGION || '';
const USER_POOL_ID = process.env.NEXT_PUBLIC_USER_POOL_ID || '';

function getExpectedIssuer(): string {
  return `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${USER_POOL_ID}`;
}

interface TokenPayload {
  sub: string;
  email?: string;
  iss: string;
  exp: number;
  token_use: string;
  [key: string]: unknown;
}

function decodeJwtPayload(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Validates Authorization header and returns the user's token payload.
 * Returns a NextResponse error if auth fails, or the decoded payload on success.
 */
export function verifyAuth(request: Request): TokenPayload | NextResponse {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Check expiry
  if (payload.exp * 1000 < Date.now()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 401 });
  }

  // Check issuer matches our Cognito User Pool
  const expectedIssuer = getExpectedIssuer();
  if (expectedIssuer && payload.iss !== expectedIssuer) {
    return NextResponse.json({ error: 'Invalid token issuer' }, { status: 401 });
  }

  return payload;
}

// ---------------------------------------------------------------------------
// In-memory IP-based rate limiter (no external deps)
// Resets per window. Safe for single-instance deployments.
// For multi-instance, use Redis or Upstash.
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically to prevent memory leaks
const CLEANUP_INTERVAL = 60_000; // 1 minute
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

/**
 * Check rate limit for a given key (typically IP or user ID).
 * Returns null if within limit, or a NextResponse 429 if exceeded.
 */
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

/**
 * Extract client IP from request headers (works behind proxies).
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
