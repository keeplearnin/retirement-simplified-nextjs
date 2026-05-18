/**
 * /api/db/snapshots — plan snapshot persistence.
 *
 * GET  → returns user's snapshot history (last 90 days)
 * POST → upserts today's snapshot (conflicts on user_id + saved_at)
 *
 * Auth: Cognito JWT required. user_id = payload.sub.
 * Gracefully returns empty history if DB is not configured.
 */

import { NextResponse } from 'next/server';
import { verifyAuth, checkRateLimit, getClientIp } from '@/lib/apiAuth';
import { getSnapshots, upsertSnapshot, isDbConfigured } from '@/lib/db';

export async function GET(request: Request) {
  const authResult = await verifyAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const ip = getClientIp(request);
  const rateLimited = checkRateLimit(`snapshots-get:${ip}`, 30, 60_000);
  if (rateLimited) return rateLimited;

  if (!isDbConfigured()) {
    return NextResponse.json({ snapshots: [], dbConfigured: false });
  }

  const snapshots = await getSnapshots(authResult.sub);
  return NextResponse.json({ snapshots, dbConfigured: true });
}

export async function POST(request: Request) {
  const authResult = await verifyAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const ip = getClientIp(request);
  const rateLimited = checkRateLimit(`snapshots-post:${ip}`, 10, 60_000);
  if (rateLimited) return rateLimited;

  if (!isDbConfigured()) {
    return NextResponse.json({ saved: false, dbConfigured: false });
  }

  const body = await request.json() as { savedAt: string; data: Record<string, unknown> };
  const { savedAt, data } = body;

  if (!savedAt || !data) {
    return NextResponse.json({ error: 'savedAt and data are required' }, { status: 400 });
  }

  await upsertSnapshot(authResult.sub, savedAt, data);
  return NextResponse.json({ saved: true });
}
