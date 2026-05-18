/**
 * db.ts — thin Supabase REST client. No SDK, no new dependencies.
 *
 * Gracefully degrades: if SUPABASE_URL / SUPABASE_SERVICE_KEY are not set,
 * every function returns null / empty without throwing.
 *
 * All calls are server-side only (route handlers). Never import this in
 * client components.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';

export function isDbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

interface SupabaseRequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  table: string;
  body?: unknown;
  filters?: Record<string, string>;  // column=value pairs for ?column=eq.value
  select?: string;
  order?: string;
  limit?: number;
  onConflict?: string; // for upsert — comma-separated column names
}

async function supabaseRequest<T>(opts: SupabaseRequestOptions): Promise<T | null> {
  if (!isDbConfigured()) return null;

  const url = new URL(`${SUPABASE_URL}/rest/v1/${opts.table}`);

  if (opts.select) url.searchParams.set('select', opts.select);
  if (opts.order) url.searchParams.set('order', opts.order);
  if (opts.limit) url.searchParams.set('limit', String(opts.limit));

  for (const [col, val] of Object.entries(opts.filters ?? {})) {
    url.searchParams.set(col, `eq.${val}`);
  }

  const headers: Record<string, string> = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  if (opts.onConflict) {
    headers['Prefer'] = `resolution=merge-duplicates,return=representation`;
    url.searchParams.set('on_conflict', opts.onConflict);
  }

  const fetchMethod = opts.onConflict ? 'POST' : opts.method;

  try {
    const resp = await fetch(url.toString(), {
      method: fetchMethod,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    if (!resp.ok) {
      console.error(`Supabase ${fetchMethod} ${opts.table} failed:`, resp.status, await resp.text());
      return null;
    }

    return resp.status === 204 ? null : (await resp.json()) as T;
  } catch (e) {
    console.error(`Supabase request error (${opts.table}):`, e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// plan_snapshots
// ---------------------------------------------------------------------------

export interface DbSnapshot {
  id: string;
  user_id: string;
  saved_at: string;
  data: Record<string, unknown>;
  created_at: string;
}

export async function getSnapshots(userId: string, limit = 90): Promise<DbSnapshot[]> {
  const rows = await supabaseRequest<DbSnapshot[]>({
    method: 'GET',
    table: 'plan_snapshots',
    filters: { user_id: userId },
    order: 'saved_at.desc',
    limit,
  });
  return rows ?? [];
}

export async function upsertSnapshot(
  userId: string,
  savedAt: string,
  data: Record<string, unknown>
): Promise<void> {
  await supabaseRequest({
    method: 'POST',
    table: 'plan_snapshots',
    body: { user_id: userId, saved_at: savedAt, data },
    onConflict: 'user_id,saved_at',
  });
}

// ---------------------------------------------------------------------------
// user_plans (current plan synced across devices)
// ---------------------------------------------------------------------------

export interface DbPlan {
  user_id: string;
  plan: Record<string, unknown>;
  updated_at: string;
}

export async function getUserPlan(userId: string): Promise<DbPlan | null> {
  const rows = await supabaseRequest<DbPlan[]>({
    method: 'GET',
    table: 'user_plans',
    filters: { user_id: userId },
    limit: 1,
  });
  return rows?.[0] ?? null;
}

export async function upsertUserPlan(
  userId: string,
  plan: Record<string, unknown>
): Promise<void> {
  await supabaseRequest({
    method: 'POST',
    table: 'user_plans',
    body: { user_id: userId, plan, updated_at: new Date().toISOString() },
    onConflict: 'user_id',
  });
}
