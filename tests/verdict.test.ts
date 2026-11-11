import { describe, it, expect } from 'vitest';
import { getBenchmarkMultiple, getGapStatus, futureValueLump, futureValueStream, computeVerdict } from '@/lib/verdict';

// The public /verdict page and the get_verdict tool rest on Fidelity's
// published age-based savings milestones — an EXTERNAL benchmark that had
// zero tests (credibility audit 2026-11-11).
describe('verdict — Fidelity benchmark anchors', () => {
  it('matches every published Fidelity milestone exactly', () => {
    // "1x by 30, 3x by 40, 6x by 50, 8x by 60, 10x by 67" (+2x/35, 4x/45, 7x/55)
    expect(getBenchmarkMultiple(30)).toBe(1);
    expect(getBenchmarkMultiple(35)).toBe(2);
    expect(getBenchmarkMultiple(40)).toBe(3);
    expect(getBenchmarkMultiple(45)).toBe(4);
    expect(getBenchmarkMultiple(50)).toBe(6);
    expect(getBenchmarkMultiple(55)).toBe(7);
    expect(getBenchmarkMultiple(60)).toBe(8);
    expect(getBenchmarkMultiple(67)).toBe(10);
  });

  it('interpolates between milestones and clamps outside them', () => {
    expect(getBenchmarkMultiple(32.5)).toBeCloseTo(1.5, 10);
    expect(getBenchmarkMultiple(25)).toBe(1);
    expect(getBenchmarkMultiple(80)).toBe(10);
    let prev = 0;
    for (let a = 25; a <= 80; a++) {
      const m = getBenchmarkMultiple(a);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });

  it('compound growth math is exact', () => {
    // $100K at 7% for 10 years = 100000 × 1.07^10
    expect(futureValueLump(100_000, 10, 0.07)).toBeCloseTo(100_000 * 1.07 ** 10, 6);
    // Monthly stream: FV annuity at monthly rate
    const r = 0.07 / 12, n = 120;
    expect(futureValueStream(1_000, 10, 0.07)).toBeCloseTo(1_000 * ((1 + r) ** n - 1) / r, 4);
    expect(futureValueLump(100_000, 0, 0.07)).toBe(100_000);
    expect(futureValueStream(1_000, 0, 0.07)).toBe(0);
  });

  it('a 50-year-old at exactly 6x income reads on-track, far below reads behind', () => {
    expect(getGapStatus(600_000, 600_000)).toBe('on-track');
    expect(getGapStatus(150_000, 600_000)).toBe('significantly-behind');
  });

  it('computeVerdict: a 50-year-old at the 6x benchmark reports gapStatus on-track', () => {
    const v = computeVerdict({
      currentAge: 50, retirementAge: 65, annualIncome: 100_000,
      currentSavings: 600_000, monthlyContribution: 2_000, filingStatus: 'single',
    } as any);
    expect(v.gapStatus).toBe('on-track');
  });
});
