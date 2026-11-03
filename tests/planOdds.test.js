import { describe, it, expect } from 'vitest';
import { computeProjection } from '@/lib/computeProjection';
import { runPlanOdds, runPlanHistory, impliedMix, sustainableSpend } from '@/lib/planOdds';
import { HISTORICAL_RETURNS } from '@/lib/historicalReturns';

function plan(overrides = {}) {
  return {
    currentAge: 45, retireAge: 65, longevityAge: 92,
    filingStatus: 'single', stateCode: 'TX', hasSpouse: false,
    savings401k: 400_000, savingsRoth: 50_000, savingsHSA: 0, savingsPension: 0,
    spouseSavings401k: 0, spouseSavingsRoth: 0, spouseSavingsHSA: 0, spouseSavingsPension: 0,
    savingsTaxable: 100_000, savingsRealEstate: 0, savingsCash: 20_000,
    savings529: 0, savingsCrypto: 0, savingsAnnuity: 0,
    monthlyContribution: 2_000, spouseMonthlyContribution: 0,
    expectedReturn: 7, debts: [], inflationRate: 3, healthcareInflation: 5,
    healthcareMultiplier: 1.0, useRealEstateInRetirement: false,
    retiredReturnPct: 60, cashReturn: 3, realEstateAppreciation: 3, annuityReturn: 3.5,
    annualSpending: 80_000, retireSpending: 70_000,
    expenseMode: 'simple', expenseBreakdown: null,
    goGoEndAge: 75, slowGoEndAge: 85,
    incomeSources: [
      { type: 'salary', amount: 150_000, growthRate: 3, endAge: 65 },
      { type: 'socialSecurity', monthlyBenefit: 3_000, startAge: 67 },
    ],
    ...overrides,
  };
}

describe('computeProjection — return shocks', () => {
  it('zero shocks reproduce the steady projection exactly', () => {
    const steady = computeProjection(plan());
    const zero = computeProjection(plan(), { returnShocks: steady.combined.map(() => 0) });
    expect(zero.combined.map(r => r.availableBalance)).toEqual(steady.combined.map(r => r.availableBalance));
  });

  it('a crash year lowers every later balance', () => {
    const steady = computeProjection(plan());
    const shocks = steady.combined.map((_, i) => (i === 0 ? -0.4 : 0));
    const crashed = computeProjection(plan(), { returnShocks: shocks });
    expect(crashed.combined[5].availableBalance).toBeLessThan(steady.combined[5].availableBalance);
  });
});

describe('impliedMix', () => {
  it('reads volatility off the stock/bond curve', () => {
    expect(impliedMix(7).stdDev).toBeCloseTo(9.15, 1);
    expect(impliedMix(3).stdDev).toBe(5.5);   // clamps low
    expect(impliedMix(12).stdDev).toBe(15.5); // clamps high
    expect(impliedMix(undefined).stdDev).toBeCloseTo(9.15, 1);
  });
});

describe('runPlanOdds', () => {
  it('is deterministic for a seed (no jittering score)', () => {
    const a = runPlanOdds(plan(), { runs: 100, seed: 7 });
    const b = runPlanOdds(plan(), { runs: 100, seed: 7 });
    expect(a.successRate).toBe(b.successRate);
  });

  it('a plan with a huge cushion is near-certain; a hopeless one near zero', () => {
    expect(runPlanOdds(plan({ savingsTaxable: 8_000_000 }), { runs: 100 }).successRate).toBeGreaterThan(0.95);
    expect(runPlanOdds(plan({ savings401k: 0, savingsRoth: 0, savingsTaxable: 0, savingsCash: 0, monthlyContribution: 0 }), { runs: 100 }).successRate).toBeLessThan(0.05);
  });

  it('the steady path is the middle case: a borderline plan lands near even odds', () => {
    // This plan's steady projection runs out ~2 years before the end.
    const steady = computeProjection(plan());
    expect(steady.firstGapAge).toBeGreaterThan(85);
    const odds = runPlanOdds(plan(), { runs: 400 });
    expect(odds.successRate).toBeGreaterThan(0.2);
    expect(odds.successRate).toBeLessThan(0.6);
  });

  it('median balance tracks the steady projection', () => {
    const steady = computeProjection(plan());
    const odds = runPlanOdds(plan(), { runs: 400 });
    const atRetire = steady.combined.findIndex(r => r.age === 65);
    const ratio = odds.percentiles.p50[atRetire] / steady.combined[atRetire].availableBalance;
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });
});

describe('runPlanHistory', () => {
  it('tests every complete real sequence and names the failing start years', () => {
    const years = computeProjection(plan()).combined.length;
    const h = runPlanHistory(plan());
    expect(h.runs).toBe(HISTORICAL_RETURNS.length - years + 1);
    expect(h.failures.length).toBe(h.runs - h.successes);
    for (const f of h.failures) expect(f.startYear).toBeGreaterThanOrEqual(1928);
  });
});

describe('sustainableSpend', () => {
  it('finds the spending level where the odds cross 80%', () => {
    const spend = sustainableSpend(plan());
    expect(spend).toBeGreaterThan(0);
    expect(spend % 600).toBe(0);
    const at = runPlanOdds(plan({ retireSpending: spend }), { runs: 150 }).successRate;
    const above = runPlanOdds(plan({ retireSpending: spend + 1_200 }), { runs: 150 }).successRate;
    expect(at).toBeGreaterThanOrEqual(0.8);
    expect(above).toBeLessThan(0.8 + 0.05); // at most a hair above the line one step up
  });

  it('more savings allows more spending', () => {
    expect(sustainableSpend(plan({ savingsTaxable: 600_000 }))).toBeGreaterThan(sustainableSpend(plan()));
  });

  it('a plan that fails even at $0 spending returns 0', () => {
    expect(sustainableSpend(plan({ savings401k: 0, savingsRoth: 0, savingsTaxable: 0, savingsCash: 0, monthlyContribution: 0, incomeSources: [], annualSpending: 80_000 }))).toBe(0);
  });
});
