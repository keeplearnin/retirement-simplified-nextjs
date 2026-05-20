/**
 * /api/diagnostics/auth-status — public endpoint that reports what the
 * running Lambda thinks about auth configuration.
 *
 * Returns booleans only, no secret values. Safe to leave public.
 * Lets you confirm via a single curl whether your env vars actually
 * reached the SSR runtime, without redeploying or guessing.
 */

import { NextResponse } from 'next/server';

const CODE_VERSION = 'anonymous-fallback-v1';

export async function GET() {
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
