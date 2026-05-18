/**
 * /api/db/preferences — user email preferences.
 *
 * GET → returns opt-in status + email for authenticated user
 * PUT → saves email + weekly_check_enabled toggle
 */

import { NextResponse } from 'next/server';
import { verifyAuth, checkRateLimit, getClientIp } from '@/lib/apiAuth';
import { getUserPreferences, upsertUserPreferences, isDbConfigured } from '@/lib/db';

export async function GET(request: Request) {
  const authResult = await verifyAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  if (!isDbConfigured()) {
    return NextResponse.json({ preferences: null, dbConfigured: false });
  }

  const ip = getClientIp(request);
  const rateLimited = checkRateLimit(`prefs-get:${ip}`, 30, 60_000);
  if (rateLimited) return rateLimited;

  const prefs = await getUserPreferences(authResult.sub);
  return NextResponse.json({
    preferences: prefs
      ? { email: prefs.email, weeklyCheckEnabled: prefs.weekly_check_enabled }
      : { email: null, weeklyCheckEnabled: false },
    dbConfigured: true,
  });
}

export async function PUT(request: Request) {
  const authResult = await verifyAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  if (!isDbConfigured()) {
    return NextResponse.json({ saved: false, dbConfigured: false });
  }

  const ip = getClientIp(request);
  const rateLimited = checkRateLimit(`prefs-put:${ip}`, 10, 60_000);
  if (rateLimited) return rateLimited;

  const body = await request.json() as {
    email?: string;
    weeklyCheckEnabled?: boolean;
  };

  await upsertUserPreferences(authResult.sub, {
    ...(body.email !== undefined ? { email: body.email } : {}),
    ...(body.weeklyCheckEnabled !== undefined
      ? { weekly_check_enabled: body.weeklyCheckEnabled }
      : {}),
  });

  return NextResponse.json({ saved: true });
}
