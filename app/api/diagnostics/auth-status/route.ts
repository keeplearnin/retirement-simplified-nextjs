/**
 * /api/diagnostics/auth-status — gated diagnostic endpoint that reports
 * what the running Lambda thinks about its configuration. Identity is
 * device-ID only (no accounts); see lib/apiAuth.ts.
 *
 * Returns booleans only, no secret values. Access requires the
 * DIAGNOSTICS_KEY env var passed as ?key=... — without a valid key the
 * route responds 404 so its existence is not confirmed to scanners.
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

const CODE_VERSION = 'device-id-only-v2';

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
    identity: {
      mode: 'device-id',
      accounts: false,
    },
    other: {
      anthropicKeySet: Boolean(process.env.ANTHROPIC_API_KEY),
      awsRegionSet: Boolean(process.env.AWS_REGION),
      cronSecretSet: Boolean(process.env.CRON_SECRET),
      cronDisabled: process.env.WEEKLY_CHECK_DISABLED === '1',
    },
  });
}
