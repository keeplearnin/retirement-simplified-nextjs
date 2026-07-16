import { describe, it, expect } from 'vitest';
import { computeProjection } from '@/lib/computeProjection';

function basePlan(overrides = {}) {
  return {
    currentAge: 65, retireAge: 65, longevityAge: 100,
    filingStatus: 'single', stateCode: 'TX', hasSpouse: false,
    savings401k: 0, savingsRoth: 0, savingsHSA: 0, savingsPension: 0,
    spouseSavings401k: 0, spouseSavingsRoth: 0, spouseSavingsHSA: 0, spouseSavingsPension: 0,
    savingsTaxable: 0, savingsRealEstate: 0, savingsCash: 0,
    savings529: 0, savingsCrypto: 0, savingsAnnuity: 0,
    monthlyContribution: 0, spouseMonthlyContribution: 0,
    expectedReturn: 0, debts: [], inflationRate: 0, healthcareInflation: 0,
    healthcareMultiplier: 1.0, useRealEstateInRetirement: false,
    retiredReturnPct: 60, cashReturn: 0, realEstateAppreciation: 0, annuityReturn: 0,
    annualSpending: 40_000, retireSpending: 40_000,
    expenseMode: 'simple', expenseBreakdown: null,
    goGoEndAge: 75, slowGoEndAge: 85,
    incomeSources: [],
    ...overrides,
  };
}

// The user-reported scenario: a retiree whose wealth is mostly home equity.
// $200K cash runs out in ~5 years; $1.5M of real estate sits untouched.
const reHeavy = {
  savingsCash: 200_000,
  savingsRealEstate: 1_500_000,
};

describe('real estate drawdown (useRealEstateInRetirement)', () => {
  it('toggle OFF: liquid runs out and the plan reports short, despite RE net worth', () => {
    const r = computeProjection(basePlan(reHeavy));
    expect(r.moneyLastsAge).toBeLessThan(100);
    // RE never touched — it only appreciates (engine floors appreciation at
    // the 3% default; `0` is swallowed by the `|| 3` fallback).
    const last = r.combined[r.combined.length - 1];
    expect(last.realEstateBalance).toBeGreaterThanOrEqual(1_500_000);
    expect(r.combined.every(row => (row.withdrawalRealEstate || 0) === 0)).toBe(true);
  });

  it('toggle ON: the waterfall actually draws from real estate and the plan holds', () => {
    const r = computeProjection(basePlan({ ...reHeavy, useRealEstateInRetirement: true }));
    expect(r.moneyLastsAge).toBe(100);
    // RE is consumed after cash runs out
    const reDraws = r.combined.filter(row => row.withdrawalRealEstate > 0);
    expect(reDraws.length).toBeGreaterThan(0);
    const last = r.combined[r.combined.length - 1];
    expect(last.realEstateBalance).toBeLessThan(1_500_000);
    // No unpaid years: every retired year's expenses are covered
    for (const row of r.combined) {
      expect(row.gap).toBeGreaterThanOrEqual(-1); // rounding slack
    }
  });

  it('toggle ON: RE draws are tax-free (home equity, §121 / reverse-mortgage model)', () => {
    // Cash exhausted immediately: spending funded purely by RE from year 1.
    const r = computeProjection(basePlan({
      savingsCash: 0, savingsRealEstate: 2_000_000, useRealEstateInRetirement: true,
    }));
    const reYears = r.combined.filter(row => row.withdrawalRealEstate > 0);
    expect(reYears.length).toBeGreaterThan(0);
    for (const row of reYears) {
      expect(row.totalTax).toBe(0);
    }
  });

  it('RE is drawn LAST — liquid accounts are exhausted first', () => {
    const r = computeProjection(basePlan({ ...reHeavy, useRealEstateInRetirement: true }));
    const firstREYear = r.combined.find(row => row.withdrawalRealEstate > 0);
    // Cash was being drawn before RE was ever tapped…
    const priorYears = r.combined.filter(row => row.age < firstREYear.age && row.isRetired);
    expect(priorYears.some(row => row.withdrawalCash > 0)).toBe(true);
    // …and the year RE is first tapped, the liquid bucket ends empty (the
    // transition year spends the last cash dollars and the first RE dollars).
    expect(firstREYear.liquidBalance).toBe(0);
  });
});
