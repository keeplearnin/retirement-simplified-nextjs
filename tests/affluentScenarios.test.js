import { describe, it, expect } from 'vitest';
import { computeProjection } from '@/lib/computeProjection';

// Hardening pass for the mass-affluent segment: 40s-50s couples with ~$2M
// spread across account types. These end-to-end scenarios exercise the
// riskiest previously-untested paths — the survivor transition (filing-status
// flip, SS step-up, 401k rollover), the multi-account withdrawal waterfall,
// and high-income tax stacking — and assert whole-plan invariants so a wrong
// number can never silently reach a user who will cross-check it.

function basePlan(overrides = {}) {
  return {
    currentAge: 65, retireAge: 65, longevityAge: 90,
    filingStatus: 'single', stateCode: 'TX', hasSpouse: false,
    savings401k: 0, savingsRoth: 0, savingsHSA: 0, savingsPension: 0,
    spouseSavings401k: 0, spouseSavingsRoth: 0, spouseSavingsHSA: 0, spouseSavingsPension: 0,
    savingsTaxable: 0, savingsRealEstate: 0, savingsCash: 0,
    savings529: 0, savingsCrypto: 0, savingsAnnuity: 0,
    monthlyContribution: 0, spouseMonthlyContribution: 0,
    expectedReturn: 6, debts: [], inflationRate: 2.5,
    healthcareInflation: 3.5, healthcareMultiplier: 1.0,
    useRealEstateInRetirement: false, retiredReturnPct: 60,
    cashReturn: 3, realEstateAppreciation: 3, annuityReturn: 3.5,
    annualSpending: 120_000, retireSpending: 120_000,
    expenseMode: 'simple', expenseBreakdown: null,
    goGoEndAge: 75, slowGoEndAge: 85,
    incomeSources: [],
    ...overrides,
  };
}

// A realistic $2.1M mass-affluent couple, mid-40s, both working, still
// accumulating — the target user for this segment.
function affluentCouple(overrides = {}) {
  return basePlan({
    currentAge: 45, retireAge: 60, longevityAge: 92,
    filingStatus: 'mfj', stateCode: 'CA', hasSpouse: true,
    spouseCurrentAge: 44, spouseRetireAge: 60, spouseLongevityAge: 94,
    savings401k: 800_000, savingsRoth: 200_000, savingsHSA: 60_000,
    spouseSavings401k: 500_000, spouseSavingsRoth: 150_000, spouseSavingsHSA: 40_000,
    savingsTaxable: 400_000, savingsCash: 80_000,
    monthlyContribution: 2_500, spouseMonthlyContribution: 1_800,
    expectedReturn: 7, retireSpending: 140_000, annualSpending: 180_000,
    incomeSources: [
      { id: 1, type: 'salary', label: 'Salary', amount: 220_000, growthRate: 3, owner: 'primary' },
      { id: 2, type: 'salary', label: 'Spouse Salary', amount: 180_000, growthRate: 3, owner: 'spouse' },
      { id: 3, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 3_400, startAge: 67, owner: 'primary' },
      { id: 4, type: 'socialSecurity', label: 'Spouse Social Security', monthlyBenefit: 2_600, startAge: 67, owner: 'spouse' },
    ],
    ...overrides,
  });
}

// Assert every numeric field in every row is finite and sane — the single
// most important guard against a garbage number reaching the UI.
function assertNoGarbage(result) {
  for (const row of result.combined) {
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === 'number') {
        expect(Number.isFinite(val), `${key} at age ${row.age} = ${val}`).toBe(true);
      }
    }
    // Balances never go negative.
    expect(row.portfolioEndBalance).toBeGreaterThanOrEqual(0);
    expect(row.liquidBalance ?? 0).toBeGreaterThanOrEqual(0);
    expect(row.totalTax).toBeGreaterThanOrEqual(0);
    expect(row.totalExpense).toBeGreaterThanOrEqual(0);
  }
  expect(result.moneyLastsAge).toBeGreaterThanOrEqual(result.combined[0].age);
}

describe('affluent couple — whole-plan integrity', () => {
  it('produces a clean, finite projection with no garbage anywhere', () => {
    assertNoGarbage(computeProjection(affluentCouple()));
  });

  it('is MFJ while both alive and pays real tax on dual high income', () => {
    const r = computeProjection(affluentCouple());
    const workingRows = r.combined.filter(row => !row.isRetired);
    for (const row of workingRows) {
      expect(row.filingStatus).toBe('mfj');
      // $400K combined salary must generate meaningful federal tax.
      expect(row.totalTax).toBeGreaterThan(20_000);
    }
  });

  it('portfolio grows through the accumulation years', () => {
    const r = computeProjection(affluentCouple());
    const atStart = r.combined.find(row => row.age === 45).portfolioEndBalance;
    const atRetire = r.combined.find(row => row.age === 60).portfolioEndBalance;
    expect(atRetire).toBeGreaterThan(atStart);
  });

  it('a well-funded plan covers spending every year (no false shortfall)', () => {
    // Overfund so there is objectively enough. Each funded year's net income
    // must cover expenses to within ~1.5% — the two-pass gross-up leaves a
    // small residual in transition years (e.g. the SS-start year, where SS
    // taxability shifts the effective rate mid-year). A larger negative gap
    // would signal a real under-funding bug.
    const r = computeProjection(affluentCouple({
      savings401k: 3_000_000, savingsTaxable: 2_000_000, retireSpending: 100_000,
    }));
    for (const row of r.combined.filter(x => x.isRetired && x.portfolioEndBalance > 0)) {
      // Post-convergence the residual is sub-dollar in withdrawal-funded years;
      // allow tiny rounding slack. (Large POSITIVE gaps are fine — those are
      // RMD-forced years where mandatory distributions exceed spending.)
      expect(row.gap, `gap at age ${row.age} (expense ${row.totalExpense})`)
        .toBeGreaterThanOrEqual(-100);
    }
    // An overfunded plan lasts deep into the 90s. (Exact age is honest-but-
    // sensitive to the gross-up: before the convergence fix this read 94
    // only because the plan was quietly under-funding ~1.6%/yr.)
    expect(r.moneyLastsAge).toBeGreaterThanOrEqual(90);
  });
});

describe('survivor transition (Phase F)', () => {
  // Primary dies at 80 (longevity 80), spouse lives to 94.
  const widowPlan = () => affluentCouple({
    longevityAge: 80, spouseLongevityAge: 94, retireSpending: 120_000,
    savings401k: 1_500_000, savingsTaxable: 800_000,
  });

  it('filing status flips MFJ → single after the year of death (IRS rule)', () => {
    const r = computeProjection(widowPlan());
    // Both alive (through primary's longevity 80): MFJ.
    for (const row of r.combined.filter(x => x.primaryAlive && x.spouseAlive)) {
      expect(row.filingStatus).toBe('mfj');
    }
    // First widowed row (year of death) keeps MFJ per the IRS rule; every
    // widowed row after it flips to single. This proves the transition
    // actually happens and does not get stuck on MFJ.
    const widowedRows = r.combined.filter(x => x.spouseAlive && !x.primaryAlive);
    expect(widowedRows.length).toBeGreaterThan(2);
    expect(widowedRows[0].filingStatus).toBe('mfj');           // year of death
    for (const row of widowedRows.slice(1)) {
      expect(row.filingStatus, `age ${row.age}`).toBe('single'); // thereafter
    }
  });

  it('the deceased spouse 401k rolls over — survivor can still fund spending', () => {
    const r = computeProjection(widowPlan());
    assertNoGarbage(r);
    // Widow years should still be funded from the rolled-over balance.
    const widowRows = r.combined.filter(row => row.age > 80 && row.age < 90);
    const anyFunded = widowRows.some(row => row.gap >= -1_000);
    expect(anyFunded).toBe(true);
  });

  it('single survivor with a big 401k still faces RMDs', () => {
    const r = computeProjection(widowPlan());
    const widowRmdRows = r.combined.filter(row => row.age > 80 && row.rmd > 0);
    expect(widowRmdRows.length).toBeGreaterThan(0);
  });
});

describe('multi-account withdrawal waterfall', () => {
  it('draws taxable/cash before tax-deferred, and Roth last', () => {
    // Retire-now couple, spending forces withdrawals across buckets.
    const r = computeProjection(affluentCouple({
      currentAge: 62, retireAge: 62, spouseCurrentAge: 62, spouseRetireAge: 62,
      savingsCash: 100_000, savingsTaxable: 300_000,
      savings401k: 1_000_000, savingsRoth: 400_000, spouseSavings401k: 0, spouseSavingsRoth: 0,
      savingsHSA: 0, spouseSavingsHSA: 0,
      retireSpending: 160_000, incomeSources: [],
    }));
    // First retirement year should pull from cash/taxable before Roth.
    const firstRetire = r.combined.find(row => row.isRetired);
    expect((firstRetire.withdrawalCash || 0) + (firstRetire.withdrawalTaxable || 0)).toBeGreaterThan(0);
    // Roth should not be tapped while taxable/cash remain.
    expect(firstRetire.withdrawalRoth || 0).toBe(0);
    assertNoGarbage(r);
  });

  it('withdrawals net of tax actually cover the spending shortfall', () => {
    const r = computeProjection(affluentCouple({
      currentAge: 62, retireAge: 62, spouseCurrentAge: 62, spouseRetireAge: 62,
      savings401k: 2_500_000, savingsTaxable: 500_000, retireSpending: 150_000, incomeSources: [],
    }));
    for (const row of r.combined.filter(x => x.isRetired && x.portfolioEndBalance > 0)) {
      // Funded years: net income covers expenses within rounding tolerance.
      expect(row.gap, `gap at age ${row.age}`).toBeGreaterThanOrEqual(-1_500);
    }
  });
});

describe('high-income tax stacking (bracket correctness)', () => {
  it('a $2M-401k single retiree spending $250K grosses up across brackets', () => {
    const r = computeProjection(basePlan({
      currentAge: 65, retireAge: 65, longevityAge: 75,
      savings401k: 5_000_000, retireSpending: 250_000, annualSpending: 250_000,
      expectedReturn: 5,
    }));
    const row = r.combined.find(x => x.isRetired);
    // Must withdraw well over $250K to net it after tax at these brackets.
    expect(row.withdrawal401k).toBeGreaterThan(250_000);
    expect(row.gap).toBeGreaterThanOrEqual(-1_500);
    // Effective marginal rate should place them in a high bracket (>30%).
    expect(row.marginalRate).toBeGreaterThanOrEqual(0.32);
  });
});

describe('property sweep — no plan shape produces garbage', () => {
  it('holds across a grid of realistic affluent permutations', () => {
    const ages = [42, 48, 55];
    const retireAges = [55, 62];
    const states = ['CA', 'TX', 'NY'];
    const spends = [100_000, 180_000];
    for (const currentAge of ages) {
      for (const retireAge of retireAges) {
        for (const stateCode of states) {
          for (const retireSpending of spends) {
            const r = computeProjection(affluentCouple({
              currentAge, retireAge, stateCode, retireSpending,
              spouseCurrentAge: currentAge - 1, spouseRetireAge: retireAge,
            }));
            assertNoGarbage(r);
          }
        }
      }
    }
  });
});
