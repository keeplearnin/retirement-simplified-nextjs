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
