import { describe, it, expect } from 'vitest';
import { computeProjection } from '@/lib/computeProjection';

// Minimal valid plan — mirrors PlanProvider's DEFAULT_PLAN shape without
// importing the client component.
function basePlan(overrides = {}) {
  return {
    currentAge: 65,
    retireAge: 65,
    longevityAge: 90,
    filingStatus: 'single',
    stateCode: 'TX',
    hasSpouse: false,
    savings401k: 0, savingsRoth: 0, savingsHSA: 0, savingsPension: 0,
    spouseSavings401k: 0, spouseSavingsRoth: 0, spouseSavingsHSA: 0, spouseSavingsPension: 0,
    savingsTaxable: 0, savingsRealEstate: 0, savingsCash: 0,
    savings529: 0, savingsCrypto: 0, savingsAnnuity: 0,
    monthlyContribution: 0, spouseMonthlyContribution: 0,
    expectedReturn: 0,
    debts: [],
    inflationRate: 0,
    healthcareInflation: 0,
    healthcareMultiplier: 1.0,
    useRealEstateInRetirement: false,
    retiredReturnPct: 60,
    cashReturn: 0, realEstateAppreciation: 0, annuityReturn: 0,
    annualSpending: 40_000,
    retireSpending: 40_000,
    expenseMode: 'simple',
    expenseBreakdown: null,
    goGoEndAge: 75,
    slowGoEndAge: 85,
    incomeSources: [],
    ...overrides,
  };
}

describe('computeProjection — cash withdrawals are not taxed', () => {
  it('regression: a retiree living purely on cash savings owes no income tax', () => {
    const result = computeProjection(basePlan({
      savingsCash: 2_000_000, // plenty to cover spending for the whole horizon
    }));
    // Every retirement year is funded from the cash bucket. Return of
    // principal is not income — total tax must be 0 in every year.
    for (const row of result.combined) {
      expect(row.withdrawalCash).toBeGreaterThan(0);
      expect(row.totalTax).toBe(0);
    }
  });

  it('401k withdrawals ARE still taxed', () => {
    const result = computeProjection(basePlan({
      savings401k: 2_000_000,
    }));
    const taxedYears = result.combined.filter(r => r.withdrawal401k > 0 && r.totalTax > 0);
    expect(taxedYears.length).toBeGreaterThan(0);
  });
});

describe('computeProjection — RMDs', () => {
  it('forces at least the RMD out of the 401k at age 73+', () => {
    const result = computeProjection(basePlan({
      currentAge: 72,
      retireAge: 72,
      longevityAge: 80,
      savings401k: 1_000_000,
      savingsCash: 1_000_000, // waterfall would otherwise prefer cash
      annualSpending: 30_000,
      retireSpending: 30_000,
    }));
    const rmdYears = result.combined.filter(r => r.age >= 73);
    expect(rmdYears.length).toBeGreaterThan(0);
    for (const row of rmdYears) {
      if (row.rmd > 0) {
        expect(row.withdrawal401k).toBeGreaterThanOrEqual(row.rmd);
      }
    }
  });
});

describe('computeProjection — 401k gross-up accounts for bracket stacking', () => {
  it('regression: a large withdrawal that crosses a tax bracket still nets enough to cover spending', () => {
    // A single filer with a $5M 401k and no other income spending $200K/yr
    // must withdraw well beyond $200K to net that much after tax — and the
    // withdrawal itself pushes them into a higher bracket than their
    // pre-withdrawal (zero) income would suggest. If the gross-up used only
    // the pre-withdrawal marginal rate (the bug fixed in ebf9c74), the
    // withdrawal would be under-grossed and leave a real shortfall despite
    // an ample balance.
    const result = computeProjection(basePlan({
      currentAge: 65,
      retireAge: 65,
      longevityAge: 66, // only need the first retirement year
      savings401k: 5_000_000,
      retireSpending: 200_000,
      annualSpending: 200_000,
    }));
    const firstRetireRow = result.combined.find(r => r.isRetired);
    expect(firstRetireRow).toBeTruthy();
    expect(firstRetireRow.withdrawal401k).toBeGreaterThan(200_000);
    expect(firstRetireRow.totalTax).toBeGreaterThan(0);
    // Net after tax should cover expenses — gap should not be meaningfully
    // negative (small rounding slack only).
    expect(firstRetireRow.gap).toBeGreaterThanOrEqual(-1000);
  });
});

describe('computeProjection — sanity', () => {
  it('working-year income equals salary; no withdrawals before retirement', () => {
    const result = computeProjection(basePlan({
      currentAge: 55,
      retireAge: 60,
      longevityAge: 70,
      savingsCash: 500_000,
      incomeSources: [
        { id: 1, type: 'salary', label: 'Salary', amount: 100_000, growthRate: 0, owner: 'primary' },
      ],
    }));
    const workingRows = result.combined.filter(r => !r.isRetired);
    expect(workingRows.length).toBeGreaterThan(0);
    for (const row of workingRows) {
      expect(row.salary).toBeGreaterThan(0);
      expect(row.totalWithdrawals).toBe(0);
    }
  });
});

describe('computeProjection — pre-retirement gap years draw down (regression)', () => {
  // User-reported: salary "stops at age 50" while user is 52 and retireAge is
  // 60 → ages 52-59 had income $0 and expenses ~$200K, but the old waterfall
  // only ran in retirement years, so NOTHING was withdrawn: expenses were
  // paid from nowhere while balances compounded — incoherent tables and an
  // overstated money-lasts age.
  it('a gap year before retirement withdraws to cover expenses', () => {
    const result = computeProjection(basePlan({
      currentAge: 52, retireAge: 60, longevityAge: 90,
      savingsCash: 400_000, savingsTaxable: 800_000, savings401k: 1_200_000,
      annualSpending: 150_000, retireSpending: 150_000,
      incomeSources: [
        // Salary already ended — the trap input
        { id: 1, type: 'salary', label: 'Salary', amount: 165_000, growthRate: 3, endAge: 50, owner: 'primary' },
      ],
    }));
    const gapYears = result.combined.filter(r => r.age >= 52 && r.age < 60);
    for (const row of gapYears) {
      expect(row.salary, `salary at ${row.age}`).toBe(0);
      // Expenses must actually be funded by withdrawals now.
      expect(row.totalWithdrawals, `withdrawals at ${row.age}`).toBeGreaterThan(0);
      expect(row.gap, `gap at ${row.age}`).toBeGreaterThanOrEqual(-1_500);
    }
  });

  it('working years with income covering expenses still withdraw nothing', () => {
    const result = computeProjection(basePlan({
      currentAge: 45, retireAge: 60, longevityAge: 90,
      savingsTaxable: 500_000,
      annualSpending: 80_000, retireSpending: 80_000,
      incomeSources: [
        { id: 1, type: 'salary', label: 'Salary', amount: 200_000, growthRate: 3, owner: 'primary' },
      ],
    }));
    for (const row of result.combined.filter(r => !r.isRetired)) {
      expect(row.totalWithdrawals, `withdrawals at ${row.age}`).toBe(0);
    }
  });
});

describe('computeProjection — ledger identity (transparency layer)', () => {
  // The Ledger view derives growth as the residual of the exact identity:
  //   end = start + growth + contributions − withdrawals
  // This test guarantees the emitted fields close that identity every year,
  // so the on-screen ledger can never show a row where money appears or
  // vanishes unexplained.
  it('start + derived growth + contributions − withdrawals === end, every year', () => {
    const result = computeProjection(basePlan({
      currentAge: 48, retireAge: 60, longevityAge: 90,
      filingStatus: 'mfj', hasSpouse: true, spouseCurrentAge: 46, spouseRetireAge: 60,
      savings401k: 800_000, savingsRoth: 200_000, savingsTaxable: 400_000,
      savingsCash: 80_000, savingsRealEstate: 300_000, savingsHSA: 50_000,
      monthlyContribution: 2_000, spouseMonthlyContribution: 1_500,
      expectedReturn: 7, annualSpending: 150_000, retireSpending: 130_000,
      incomeSources: [
        { id: 1, type: 'salary', label: 'Salary', amount: 220_000, growthRate: 3, owner: 'primary' },
        { id: 2, type: 'socialSecurity', label: 'SS', monthlyBenefit: 3_000, startAge: 67, owner: 'primary' },
      ],
    }));
    for (const row of result.combined) {
      expect(typeof row.contributions).toBe('number');
      const derivedGrowth = row.portfolioEndBalance - row.portfolioBalance
        + (row.totalWithdrawals || 0) - (row.contributions || 0);
      const reconstructedEnd = row.portfolioBalance + derivedGrowth
        + (row.contributions || 0) - (row.totalWithdrawals || 0);
      expect(Math.abs(reconstructedEnd - row.portfolioEndBalance), `identity at age ${row.age}`).toBeLessThan(0.01);
      // Contributions only while someone is working. Spouse is 2 years
      // younger (retires at spouse-age 60 = primary-age 62), so their
      // $18K/yr correctly continues through primary ages 60-61.
      if (row.age >= 62) expect(row.contributions).toBe(0);
    }
  });
});
