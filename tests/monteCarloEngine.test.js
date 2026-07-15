import { describe, it, expect } from 'vitest';
import { runSimulation } from '@/lib/monteCarloEngine';

// stdDev: 0 makes the Box-Muller draw irrelevant — every path is identical
// and deterministic, so we can assert exact balances.
const base = {
  savings: 1_000_000,
  monthly: 0,
  salaryGrowth: 0,
  annualSpend: 50_000,
  inflationPct: 0,
  age: 64,
  retireAge: 65,
  endAge: 67,
  avgReturn: 0,
  stdDev: 0,
  runs: 10,
};

describe('runSimulation — inflation timing (regression)', () => {
  it('inflates retirement spending from TODAY, not from the retirement date', () => {
    // 100% inflation makes the timing unmistakable. One accumulation year,
    // then retirement years y=2,3 with inflation index 2^(y-1).
    const r = runSimulation({ ...base, inflationPct: 100 });
    const path = { p50: r.percentiles.p50 };
    // y=1 (accumulation, no flows): 1,000,000
    expect(path.p50[1]).toBe(1_000_000);
    // y=2 (first retirement year): spend = 50,000 * 2^1 = 100,000
    // (the old bug spent 50,000 * 2^0 = 50,000 here)
    expect(path.p50[2]).toBe(900_000);
    // y=3: spend = 50,000 * 2^2 = 200,000
    expect(path.p50[3]).toBe(700_000);
  });

  it('with zero inflation, spends the flat amount each retirement year', () => {
    const r = runSimulation(base);
    expect(r.percentiles.p50[2]).toBe(950_000);
    expect(r.percentiles.p50[3]).toBe(900_000);
    expect(r.successRate).toBe(1);
  });
});

describe('runSimulation — Social Security netting', () => {
  it('reduces the withdrawal need by SS income once SS starts', () => {
    // $2,000/mo SS from 65 → $24,000/yr against $50,000 spending
    const r = runSimulation({ ...base, ssMonthly: 2_000, ssStartAge: 65 });
    expect(r.percentiles.p50[2]).toBe(1_000_000 - 26_000);
  });

  it('does not credit SS before its start age', () => {
    const r = runSimulation({ ...base, ssMonthly: 2_000, ssStartAge: 70 });
    // Ages during retirement years are 66, 67 — SS never starts
    expect(r.percentiles.p50[2]).toBe(950_000);
  });

  it('SS keeps pace with inflation (COLA)', () => {
    const r = runSimulation({ ...base, inflationPct: 100, ssMonthly: 2_000, ssStartAge: 65 });
    // y=2: index 2 → spend 100,000, SS 48,000 → net 52,000
    expect(r.percentiles.p50[2]).toBe(1_000_000 - 52_000);
  });

  it('a plan fully covered by SS always succeeds', () => {
    const r = runSimulation({ ...base, savings: 10_000, annualSpend: 20_000, ssMonthly: 2_000, ssStartAge: 65 });
    expect(r.successRate).toBe(1);
  });
});
