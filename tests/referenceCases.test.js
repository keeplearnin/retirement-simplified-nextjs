import { describe, it, expect } from 'vitest';
import { REFERENCE_CASES, caseResult } from '@/lib/referenceCases';

// The published checks on /accuracy. Each expected value is worked out by
// hand from the cited IRS/SSA rule — if the engine drifts, this fails.
describe('reference cases (published on /accuracy)', () => {
  for (const c of REFERENCE_CASES) {
    it(`${c.area}: ${c.question}`, () => {
      expect(caseResult(c)).toBe(c.expected);
    });
  }
});
