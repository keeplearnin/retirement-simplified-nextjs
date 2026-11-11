import { describe, it, expect } from 'vitest';
import { computeProjection } from '@/lib/computeProjection';
import { runPlanOdds, runFlexOdds, runPlanHistory, impliedMix, sustainableSpend, spendingRange } from '@/lib/planOdds';
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

describe('spendingRange', () => {
  it('brackets "You can spend": less after a 20% fall, more after a 20% rise', () => {
    const p = plan();
    const spend = sustainableSpend(p);
    const { low, high } = spendingRange(p);
    expect(low).toBeLessThan(spend);
    expect(high).toBeGreaterThan(spend);
  });

  it('is the same as moving the invested balances by hand', () => {
    const p = plan();
    const { low } = spendingRange(p);
    const fallen = { ...p, savings401k: p.savings401k * 0.8, savingsRoth: p.savingsRoth * 0.8, savingsTaxable: p.savingsTaxable * 0.8 };
    expect(low).toBe(sustainableSpend(fallen));
  });

  it('leaves cash alone: an all-cash plan has no range', () => {
    const p = plan({ savings401k: 0, savingsRoth: 0, savingsTaxable: 0, savingsCash: 1_500_000 });
    const { low, high } = spendingRange(p);
    expect(low).toBe(sustainableSpend(p));
    expect(high).toBe(low);
  });
});

describe('runFlexOdds — flexible-spending guardrails', () => {
  // A knife-edge plan: tight enough that volatility produces plenty of
  // failures for the trim to rescue.
  const knifeEdge = () => plan({ retireSpending: 86_000 });

  it('adapting never hurts: flexible odds >= strict odds on the same markets', () => {
    const strict = runPlanOdds(knifeEdge(), { runs: 200 });
    const flex = runFlexOdds(knifeEdge(), { runs: 200 });
    expect(flex.runs).toBe(strict.runs);
    expect(flex.successRate).toBeGreaterThanOrEqual(strict.successRate);
  });

  it('the trim materially improves OUTCOMES: later bad-market broke age, smaller typical shortfall', () => {
    // On long horizons, binary success barely moves (a path pushed from 9
    // unfunded years to 3 still "fails") — the honest wins are the p10
    // broke age and the failure magnitude. Same seed → same sequences; the
    // only difference is the behavior.
    const strict = runPlanOdds(knifeEdge(), { runs: 200 });
    const flex = runFlexOdds(knifeEdge(), { runs: 200 });
    expect(flex.p10LastsAge).toBeGreaterThan(strict.p10LastsAge);
    expect(flex.medianYearsShort).toBeLessThan(strict.medianYearsShort);
  });

  it('a zero cut reproduces the strict odds exactly (same sequences)', () => {
    const strict = runPlanOdds(knifeEdge(), { runs: 100 });
    const flex = runFlexOdds(knifeEdge(), { runs: 100, cut: 0 });
    expect(flex.successRate).toBe(strict.successRate);
  });

  it('reports failure magnitude: median short age inside the plan, years short >= 1', () => {
    const strict = runPlanOdds(knifeEdge(), { runs: 200 });
    if (strict.successRate < 1) {
      expect(strict.medianShortAge).toBeGreaterThan(knifeEdge().retireAge);
      expect(strict.medianShortAge).toBeLessThanOrEqual(strict.horizonAge);
      expect(strict.medianYearsShort).toBeGreaterThanOrEqual(1);
    }
  });

  it('spendTrim never fires on a healthy steady path (never behind its own reference or near the floor)', () => {
    // A comfortably-funded plan: the zero-shock path tracks its own
    // reference exactly and never nears the 15%-of-start danger floor, so
    // no year trims. (A knife-edge steady path CAN trim near the end — by
    // design: circling $0 is the danger zone whether or not it was planned.)
    const healthy = plan({ retireSpending: 40_000 });
    const steady = computeProjection(healthy);
    const ref = steady.combined.map(r => r.portfolioBalance);
    const trimmed = computeProjection(healthy, {
      returnShocks: steady.combined.map(() => 0),
      spendTrim: { refBalances: ref, cut: 0.25 },
    });
    expect(trimmed.combined.map(r => r.totalExpense)).toEqual(steady.combined.map(r => r.totalExpense));
  });
});
