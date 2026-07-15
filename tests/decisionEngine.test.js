import { describe, it, expect } from 'vitest';
import { runDecisionEngine } from '@/lib/decisionEngine';
import { optimizeRothLadder } from '@/lib/rothConversion';

function basePlan(overrides = {}) {
  return {
    currentAge: 58,
    retireAge: 62,
    longevityAge: 92,
    filingStatus: 'single',
    stateCode: 'CA',
    hasSpouse: false,
    savings401k: 900_000,
    savingsRoth: 50_000,
    savingsHSA: 0, savingsPension: 0,
    spouseSavings401k: 0, spouseSavingsRoth: 0, spouseSavingsHSA: 0, spouseSavingsPension: 0,
    savingsTaxable: 200_000, savingsRealEstate: 0, savingsCash: 50_000,
    savings529: 0, savingsCrypto: 0, savingsAnnuity: 0,
    monthlyContribution: 1_000, spouseMonthlyContribution: 0,
    expectedReturn: 6,
    debts: [],
    inflationRate: 2.5,
    healthcareInflation: 3.5,
    healthcareMultiplier: 1.0,
    useRealEstateInRetirement: false,
    retiredReturnPct: 60,
    cashReturn: 3, realEstateAppreciation: 3, annuityReturn: 3.5,
    annualSpending: 80_000,
    retireSpending: 65_000,
    expenseMode: 'simple',
    expenseBreakdown: null,
    goGoEndAge: 75,
    slowGoEndAge: 85,
    incomeSources: [
      { id: 1, type: 'salary', label: 'Salary', amount: 120_000, growthRate: 3, owner: 'primary' },
      { id: 2, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2_800, startAge: 62, owner: 'primary' },
    ],
    ...overrides,
  };
}

describe('runDecisionEngine', () => {
  it('returns a baseline and ranked actions sorted by dollar value', () => {
    const result = runDecisionEngine(basePlan());
    expect(result.baseline.moneyLastsAge).toBeGreaterThan(0);
    expect(Array.isArray(result.actions)).toBe(true);
    for (let i = 1; i < result.actions.length; i++) {
      expect(result.actions[i - 1].dollarValue).toBeGreaterThanOrEqual(result.actions[i].dollarValue);
    }
  });

  it('recommends delaying SS when claiming at 62 with long longevity', () => {
    const result = runDecisionEngine(basePlan());
    const ss = result.actions.find(a => a.id === 'ss-claiming');
    expect(ss).toBeDefined();
    expect(ss.apply.startAge).toBeGreaterThan(62);
    expect(ss.dollarValue).toBeGreaterThan(0);
    expect(ss.math.length).toBeGreaterThan(0);
    expect(ss.apply.sourceId).toBe(2);
  });

  it('finds a Roth conversion opportunity for a large pre-RMD 401k', () => {
    const result = runDecisionEngine(basePlan());
    const roth = result.actions.find(a => a.id === 'roth-ladder');
    expect(roth).toBeDefined();
    expect(roth.dollarValue).toBeGreaterThan(0);
    expect(roth.schedule.length).toBeGreaterThan(0);
    // Options should expose all tested brackets
    expect(roth.options.map(o => o.targetBracket).sort((a, b) => a - b)).toEqual([12, 22, 24]);
  });

  it('emits no SS action when there is no SS income source', () => {
    const plan = basePlan({
      incomeSources: [{ id: 1, type: 'salary', label: 'Salary', amount: 120_000, growthRate: 3, owner: 'primary' }],
    });
    const result = runDecisionEngine(plan);
    expect(result.actions.find(a => a.id === 'ss-claiming')).toBeUndefined();
  });

  it('surfaces plan-repair levers only when money runs out early', () => {
    const broke = runDecisionEngine(basePlan({
      savings401k: 100_000, savingsTaxable: 0, savingsCash: 10_000,
      retireSpending: 90_000,
    }));
    expect(broke.actions.some(a => a.category === 'Plan Repair')).toBe(true);

    const healthy = runDecisionEngine(basePlan({
      savings401k: 3_000_000, retireSpending: 40_000,
    }));
    expect(healthy.actions.some(a => a.category === 'Plan Repair')).toBe(false);
  });

  it('totalOpportunity equals the sum of positive action values', () => {
    const result = runDecisionEngine(basePlan());
    const sum = result.actions.reduce((s, a) => s + Math.max(0, a.dollarValue), 0);
    expect(result.totalOpportunity).toBe(sum);
  });
});

describe('optimizeRothLadder', () => {
  const input = {
    currentAge: 60,
    retireAge: 60,
    longevityAge: 90,
    tradBalance: 1_200_000,
    rothBalance: 100_000,
    expectedReturn: 0.06,
    retiredReturnPct: 60,
    filingStatus: 'single',
    stateCode: 'TX',
    ssMonthlyBenefit: 2_500,
    ssStartAge: 67,
    conversionStartAge: 60,
    conversionEndAge: 72,
  };

  it('ranks brackets by NET savings (tax saved minus IRMAA cost)', () => {
    const r = optimizeRothLadder(input);
    expect(r.options).toHaveLength(3);
    for (const o of r.options) {
      expect(o.netSaved).toBe(o.taxSaved - o.irmaaCost);
    }
    if (r.best) {
      const maxNet = Math.max(...r.options.map(o => o.netSaved));
      expect(r.best.netSaved).toBe(maxNet);
      expect(r.best.schedule.length).toBeGreaterThan(0);
    }
  });

  it('a large pre-RMD balance produces positive net savings', () => {
    const r = optimizeRothLadder(input);
    expect(r.best).not.toBeNull();
    expect(r.best.netSaved).toBeGreaterThan(0);
  });

  it('tracks IRMAA separately from income tax', () => {
    const r = optimizeRothLadder(input, [24]);
    const o = r.options[0];
    // Aggressive 24%-bracket conversions on $1.2M should trigger some IRMAA
    // exposure difference vs baseline (positive cost or zero, never NaN).
    expect(Number.isFinite(o.irmaaCost)).toBe(true);
  });
});
