import { describe, it, expect } from 'vitest';
import { runDecisionEngine } from '@/lib/decisionEngine';
import { computeProjection } from '@/lib/computeProjection';
import { computeTax } from '@/lib/taxEngine';
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
    // $1.5M: large enough that RMDs push later years into higher brackets
    // even with federal and California brackets growing with inflation
    // (at $900K the indexed RMD-year tax leaves too little to gain).
    const result = runDecisionEngine(basePlan({ savings401k: 1_500_000 }));
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

describe('runDecisionEngine — provisional-income (SS taxability) cliff', () => {
  it('flags a retiree whose provisional income lands within $5K of the 0%->50% threshold', () => {
    // Single retiree, immediately retired at 63 (below 65, so the extra
    // 65+ standard deduction and OBBBA senior bonus don't complicate the
    // math), on Social Security + a modest pension, spending well under
    // total income (no withdrawals, so otherIncome = pension exactly and
    // provisionalIncome = pension + 0.5*benefit). $1,600/mo SS
    // ($19,200/yr) + $1,250/mo pension ($15,000/yr) -> provisionalIncome =
    // 15,000 + 9,600 = $24,600, which is $400 below the $25,000
    // single-filer threshold. The pension matters: without other taxable
    // income, the standard deduction would absorb everything and the
    // probed tax delta would be a meaningless $0.
    const plan = basePlan({
      currentAge: 63, retireAge: 63, longevityAge: 66,
      stateCode: 'TX', // no state tax, keeps the scenario simple
      savings401k: 0, savingsRoth: 0, savingsTaxable: 0, savingsCash: 500_000,
      monthlyContribution: 0,
      annualSpending: 25_000, retireSpending: 25_000,
      incomeSources: [
        { id: 1, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 1_600, startAge: 63, owner: 'primary' },
        { id: 2, type: 'pension', label: 'Pension', monthlyAmount: 1_250, startAge: 63, owner: 'primary' },
      ],
    });
    const result = runDecisionEngine(plan);
    const cliff = result.actions.find(a => a.id === 'provisional-income-cliff');
    expect(cliff).toBeDefined();
    expect(cliff.dollarValue).toBeGreaterThan(0);
    const first = cliff.atRiskYears[0];
    expect(first.provisionalIncome).toBeGreaterThan(20_000);
    expect(first.provisionalIncome).toBeLessThan(25_000);
    expect(first.headroom).toBeGreaterThan(0);
    expect(first.headroom).toBeLessThan(5_000);
  });

  it('prices a future year at that year\'s inflation-adjusted brackets', () => {
    // Same retiree as above, but planning from 55: the first at-risk year
    // (63) is 8 years out. Its cost must come from brackets and deductions
    // grown by 8 years of inflation (the SS thresholds stay fixed), not
    // from 2026 brackets applied to 2034 income.
    const plan = basePlan({
      currentAge: 55, retireAge: 63, longevityAge: 70, inflationRate: 2.5,
      stateCode: 'TX',
      savings401k: 0, savingsRoth: 0, savingsTaxable: 0, savingsCash: 500_000,
      monthlyContribution: 0,
      annualSpending: 25_000, retireSpending: 25_000,
      incomeSources: [
        { id: 1, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 1_600, startAge: 63, owner: 'primary' },
        { id: 2, type: 'pension', label: 'Pension', monthlyAmount: 1_250, startAge: 63, owner: 'primary' },
      ],
    });
    const cliff = runDecisionEngine(plan).actions.find(a => a.id === 'provisional-income-cliff');
    const first = cliff.atRiskYears[0];
    expect(first.age).toBe(63);
    const row = computeProjection(plan).combined.find(r => r.age === 63);
    const other = row.provisionalIncome - row.socialSecurity * 0.5;
    const probe = (extra) => (indexFactor) => computeTax({
      filingStatus: 'single', ordinaryIncome: other + extra, socialSecurityBenefit: row.socialSecurity,
      capitalGains: 0, stateCode: 'TX', age: 63, taxYear: 2034, indexFactor,
    }).totalTax;
    const indexed = probe(5_000)(1.025 ** 8) - probe(0)(1.025 ** 8);
    const unindexed = probe(5_000)(1) - probe(0)(1);
    expect(first.cost).toBe(Math.round(indexed));
    expect(indexed).toBeLessThan(unindexed);
  });

  it('does not fire for a retiree far from any SS-taxability threshold', () => {
    // Tiny SS benefit, no other income — provisional income nowhere near
    // $25,000, so the cliff lever should not appear at all.
    const plan = basePlan({
      currentAge: 65, retireAge: 65, longevityAge: 68,
      stateCode: 'TX',
      savings401k: 0, savingsRoth: 0, savingsTaxable: 0, savingsCash: 500_000,
      monthlyContribution: 0,
      annualSpending: 5_000, retireSpending: 5_000,
      incomeSources: [
        { id: 1, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 500, startAge: 65, owner: 'primary' },
      ],
    });
    const result = runDecisionEngine(plan);
    expect(result.actions.find(a => a.id === 'provisional-income-cliff')).toBeUndefined();
  });

  it('regression: skips at-risk years where the extra tax rounds to $0 (deductions absorb it)', () => {
    // A salaried single filer retiring at 65 with a standard $2,500/mo SS
    // benefit at 67 passes through a low-income year (age 72, right after
    // Roth/taxable buckets are drawn down and before RMDs ramp up) where
    // provisional income is within the $5K window of the 85% threshold but
    // the standard deduction fully absorbs the extra taxable SS, so a
    // $5,000 probe costs exactly $0. That year must not become the "first"
    // at-risk year — surfacing it produced a self-contradictory sentence
    // ("would cost roughly $0 ... more than it would cost outside this
    // zone") and a useless "+$0 lifetime impact" card.
    const plan = basePlan({
      currentAge: 40, retireAge: 65, longevityAge: 95,
      savings401k: 400_000, savingsRoth: 100_000, savingsTaxable: 100_000, savingsCash: 50_000,
      monthlyContribution: 1_500,
      annualSpending: 75_000, retireSpending: 60_000,
      incomeSources: [
        { id: 1, type: 'salary', label: 'Salary', amount: 100_000, growthRate: 3, owner: 'primary' },
        { id: 2, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2_500, startAge: 67, owner: 'primary' },
      ],
    });
    const result = runDecisionEngine(plan);
    const cliff = result.actions.find(a => a.id === 'provisional-income-cliff');
    if (cliff) {
      expect(cliff.dollarValue).toBeGreaterThan(0);
      for (const y of cliff.atRiskYears) {
        expect(y.cost).toBeGreaterThan(0);
      }
      expect(cliff.detail).not.toMatch(/roughly \$0\b/);
    }
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
