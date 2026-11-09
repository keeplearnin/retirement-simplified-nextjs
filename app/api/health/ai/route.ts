/**
 * /api/health/ai — is the AI layer alive?
 *
 * Makes one tiny request to each configured Claude model (max_tokens 1) and
 * reports whether both answered. This is what would have caught the two
 * production outages where a retired or mistyped model ID made every AI
 * feature return 502 — for weeks, because nothing was watching.
 *
 * Polled daily by .github/workflows/ai-health.yml, which fails loudly (GitHub
 * emails the repo owner on a failed scheduled run) when this returns non-200.
 *
 * Public and unauthenticated on purpose: it reveals only the model IDs,
 * which are already in the open-source code. Rate-limited per IP so it
 * can't be used to burn API credit.
 */

import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/apiAuth';
import { CLAUDE_MODEL, CLAUDE_FAST_MODEL, claudeHeaders } from '@/lib/claude';

export const dynamic = 'force-dynamic';

const PROBE_TIMEOUT_MS = 15_000;

interface ProbeResult {
  model: string;
  ok: boolean;
  status: number | null;
  latencyMs: number;
  error?: string;
}

async function probe(model: string, apiKey: string): Promise<ProbeResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: claudeHeaders(apiKey, { fallback: false }),
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    if (resp.ok) return { model, ok: true, status: resp.status, latencyMs };
    let error = `HTTP ${resp.status}`;
    try {
      const body = (await resp.json()) as { error?: { message?: string } };
      if (body?.error?.message) error = `${error}: ${body.error.message}`;
    } catch {
      // body wasn't JSON; the status is enough
    }
    return { model, ok: false, status: resp.status, latencyMs, error };
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    return {
      model,
      ok: false,
      status: null,
      latencyMs: Date.now() - started,
      error: aborted ? `timeout after ${PROBE_TIMEOUT_MS}ms` : (err as Error).message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  // Each call costs two one-token requests. Keep it to a handful per minute.
  const limited = checkRateLimit(`health-ai:${getClientIp(request)}`, 5, 60_000);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_API_KEY not set', checkedAt: new Date().toISOString() },
      { status: 503 },
    );
  }

  const models = [...new Set([CLAUDE_MODEL, CLAUDE_FAST_MODEL])];
  const results = await Promise.all(models.map((m) => probe(m, apiKey)));
  const ok = results.every((r) => r.ok);

  return NextResponse.json(
    { ok, checkedAt: new Date().toISOString(), models: results },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
