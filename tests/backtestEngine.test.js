import { describe, it, expect } from 'vitest';
import { runBacktest } from '@/lib/backtestEngine';
import { HISTORICAL_RETURNS, HISTORICAL_START_YEAR } from '@/lib/historicalReturns';

const base = {
  savings: 1_000_000,
  monthly: 0,
  salaryGrowth: 0,
  annualSpend: 50_000,
  inflationPct: 0,
  age: 64,
  retireAge: 65,
  endAge: 67,
  stockPct: 1,
};

describe('runBacktest — mechanics', () => {
  it('runs one sequence per possible start year', () => {
    const totalYears = base.endAge - base.age; // 3
    const r = runBacktest(base);
    expect(r.sequenceCount).toBe(HISTORICAL_RETURNS.length - totalYears + 1);
    expect(r.sequences[0].startYear).toBe(HISTORICAL_START_YEAR);
    expect(r.sequences[r.sequenceCount - 1].startYear).toBe(
      HISTORICAL_START_YEAR + HISTORICAL_RETURNS.length - totalYears
    );
  });

  it('replays exact return sequences (deterministic on synthetic data)', () => {
    // Two synthetic years: +10% then -50% stocks; bonds flat.
    const returns = [[0.10, 0], [-0.50, 0], [0.0, 0]];
    const r = runBacktest({ ...base, endAge: 66, returns, startYearOffset: 2000 });
    // totalYears = 2 → two sequences: [y1,y2] and [y2,y3]
    expect(r.sequenceCount).toBe(2);
    // Sequence 1: 1M → accumulation year +10% = 1.1M → retirement year:
    // (1.1M * 0.5) - 50K = 500K
    expect(r.sequences[0].finalBalance).toBe(500_000);
    // Sequence 2: 1M → accumulation -50% = 500K → retirement (500K * 1) - 50K = 450K
    expect(r.sequences[1].finalBalance).toBe(450_000);
  });

  it('marks failure with the age money ran out', () => {
    const returns = [[0, 0], [0, 0], [0, 0]];
    const r = runBacktest({
      ...base, savings: 60_000, endAge: 67, returns, startYearOffset: 2000,
    });
    // 60K, spend 50K at 66 → 10K, spend 50K at 67 → broke at 67
    expect(r.sequences[0].success).toBe(false);
    expect(r.sequences[0].failedAtAge).toBe(67);
    expect(r.failures.length).toBe(r.sequenceCount);
    expect(r.successRate).toBe(0);
  });

  it('applies inflation from today and nets Social Security (parity with Monte Carlo)', () => {
    // 100% inflation, SS covers part of spending from 65.
    const returns = [[0, 0], [0, 0]];
    const r = runBacktest({
      ...base, endAge: 66, inflationPct: 100,
      ssMonthly: 2_000, ssStartAge: 65, returns, startYearOffset: 2000,
    });
    // Retirement year y=2: index 2^1=2 → spend 100K, SS 48K → net 52K
    expect(r.sequences[0].finalBalance).toBe(1_000_000 - 52_000);
  });

  it('blends stock/bond returns by stockPct', () => {
    const returns = [[0.10, 0.02], [0.10, 0.02]];
    const r = runBacktest({
      ...base, savings: 100_000, monthly: 0, annualSpend: 0,
      age: 64, retireAge: 66, endAge: 66, stockPct: 0.5, returns, startYearOffset: 2000,
    });
    // Two accumulation years at blended 6%: 100K * 1.06^2 = 112,360
    expect(r.sequences[0].finalBalance).toBe(112_360);
  });
});

describe('runBacktest — real data sanity', () => {
  it('a very over-funded plan survives every history including 1929', () => {
    const r = runBacktest({
      ...base, savings: 5_000_000, annualSpend: 50_000,
      age: 60, retireAge: 60, endAge: 90, stockPct: 0.6, inflationPct: 2.5,
    });
    expect(r.successRate).toBe(1);
  });

  it('an under-funded plan fails in the bad sequences but not all', () => {
    const r = runBacktest({
      ...base, savings: 800_000, annualSpend: 60_000,
      age: 60, retireAge: 60, endAge: 90, stockPct: 0.6, inflationPct: 2.5,
    });
    expect(r.successRate).toBeGreaterThan(0);
    expect(r.successRate).toBeLessThan(1);
    // The worst start should be a known bad era — depression or stagflation.
    expect(r.worst.success).toBe(false);
  });
});
