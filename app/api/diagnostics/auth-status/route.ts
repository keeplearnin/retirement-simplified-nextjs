/**
 * /api/diagnostics/auth-status — gated diagnostic endpoint that reports
 * what the running Lambda thinks about auth configuration.
 *
 * Returns booleans only, no secret values. Access requires the
 * DIAGNOSTICS_KEY env var passed as ?key=... — without a valid key the
 * route responds 404 so its existence is not confirmed to scanners.
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

const CODE_VERSION = 'anonymous-fallback-v1';

function notFound() {
  return new NextResponse('Not Found', { status: 404 });
}

function keyMatches(provided: string | null, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const provided = new URL(request.url).searchParams.get('key');
  if (!keyMatches(provided, process.env.DIAGNOSTICS_KEY)) {
    return notFound();
  }

  return NextResponse.json({
    codeVersion: CODE_VERSION,
    timestamp: new Date().toISOString(),
    cognito: {
      regionSet: Boolean(process.env.NEXT_PUBLIC_AWS_REGION),
      userPoolIdSet: Boolean(process.env.NEXT_PUBLIC_USER_POOL_ID),
      clientIdSet: Boolean(process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID),
      issuerComputed: Boolean(
        process.env.NEXT_PUBLIC_AWS_REGION && process.env.NEXT_PUBLIC_USER_POOL_ID,
      ),
    },
    anonymous: {
      flagPresent: process.env.ALLOW_ANONYMOUS_USERS !== undefined,
      flagValue: process.env.ALLOW_ANONYMOUS_USERS ?? null,
      enabled: process.env.ALLOW_ANONYMOUS_USERS === '1',
    },
    other: {
      anthropicKeySet: Boolean(process.env.ANTHROPIC_API_KEY),
      awsRegionSet: Boolean(process.env.AWS_REGION),
      cronSecretSet: Boolean(process.env.CRON_SECRET),
      cronDisabled: process.env.WEEKLY_CHECK_DISABLED === '1',
    },
  });
}
