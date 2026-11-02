// Single place for Claude model IDs and request defaults used by every AI
// route. Hardcoded per-route IDs drifted (four routes were still on a retired
// Sonnet 4 snapshot and failed with 502s in production) — bump models here.

export const CLAUDE_MODEL = 'claude-sonnet-5-5';
export const CLAUDE_FAST_MODEL = 'claude-haiku-5-5'; // batch/cron work

// Current models think by default, and thinking tokens count against
// max_tokens — the old 1–3K caps would cut answers off mid-tool-loop.
// Low effort keeps chat-style replies fast; raise per route if quality needs it.
export const CLAUDE_REQUEST_DEFAULTS = {
  max_tokens: 16000,
  output_config: { effort: 'low' },
} as const;

/** Headers for POST /v1/messages. `fallback` opts Sonnet requests into the
 *  server-side refusal fallback (not available on Haiku). */
export function claudeHeaders(apiKey: string, { fallback = true } = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    ...(fallback ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}),
  };
}

/** Body fields for a Sonnet request: model, defaults, and refusal fallback. */
export const CLAUDE_SONNET_BODY = {
  model: CLAUDE_MODEL,
  ...CLAUDE_REQUEST_DEFAULTS,
  fallbacks: 'default',
} as const;
