/**
 * /api/db/plan — current plan persistence (cross-device sync).
 *
 * GET → returns user's saved plan from DB
 * PUT → saves current plan to DB
 *
 * Auth: Cognito JWT required.
 */

import { NextResponse } from 'next/server';
import { verifyAuth, checkRateLimit, getClientIp } from '@/lib/apiAuth';
import { getUserPlan, upsertUserPlan, isDbConfigured } from '@/lib/db';

export async function GET(request: Request) {
  const authResult = await verifyAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  if (!isDbConfigured()) {
    return NextResponse.json({ plan: null, dbConfigured: false });
  }

  const ip = getClientIp(request);
  const rateLimited = checkRateLimit(`plan-get:${ip}`, 30, 60_000);
  if (rateLimited) return rateLimited;

  const row = await getUserPlan(authResult.sub);
  return NextResponse.json({ plan: row?.plan ?? null, updatedAt: row?.updated_at ?? null, dbConfigured: true });
}

export async function PUT(request: Request) {
  const authResult = await verifyAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  if (!isDbConfigured()) {
    return NextResponse.json({ saved: false, dbConfigured: false });
  }

  const ip = getClientIp(request);
  const rateLimited = checkRateLimit(`plan-put:${ip}`, 20, 60_000);
  if (rateLimited) return rateLimited;

  const body = await request.json() as { plan: Record<string, unknown> };
  if (!body.plan) {
    return NextResponse.json({ error: 'plan is required' }, { status: 400 });
  }

  await upsertUserPlan(authResult.sub, body.plan);
  return NextResponse.json({ saved: true });
}
