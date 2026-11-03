import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AI_AGENT_SYSTEM_PROMPT, AI_PRODUCT_RULES } from '@/lib/constants';

// The line the product stays on (see AI_PRODUCT_RULES): the engine
// calculates, the AI explains; no funds or products named, no buy/sell,
// no plan changes without the user's click, no "advisor" self-description.
describe('AI instructions', () => {
  it('chat prompt carries the shared rules and the engine-numbers rule', () => {
    expect(AI_AGENT_SYSTEM_PROMPT).toContain(AI_PRODUCT_RULES);
    expect(AI_AGENT_SYSTEM_PROMPT).toMatch(/must come from a tool result/);
    expect(AI_PRODUCT_RULES).toMatch(/Never name or suggest specific securities, funds, tickers/);
    expect(AI_PRODUCT_RULES).toMatch(/Never call yourself a financial advisor/);
  });

  it('no prompt steers users to named fund companies', () => {
    const constants = readFileSync('lib/constants.ts', 'utf8');
    expect(constants).not.toMatch(/index funds \((Vanguard|Fidelity|Schwab)/);
  });

  it('every AI route appends the shared rules', () => {
    for (const route of ['agent/health-check', 'agent/optimize', 'agent/quarterly-review', 'agent/onboard', 'cron/weekly-check']) {
      expect(readFileSync(`app/api/${route}/route.ts`, 'utf8'), route).toContain('${AI_PRODUCT_RULES}');
    }
  });
});
