import { describe, it, expect } from 'vitest';
import { runDecisionEngine } from '@/lib/decisionEngine';

// IRMAA tiers rise with inflation, so the cliff warning compares each
// year's MAGI in 2026 dollars. A flat $104K pension sits $5K under the
// $109K single tier today, but inflation shrinks it in real terms every
// year: at 3%, $104K / 1.03 = $101K (still within $10K), then $98K.
function plan(overrides = {}) {
  return {
    currentAge: 70, retireAge: 65, longevityAge: 85,
    filingStatus: 'single', stateCode: 'TX', hasSpouse: false,
    savings401k: 0, savingsRoth: 0, savingsHSA: 0, savingsPension: 0,
    spouseSavings401k: 0, spouseSavingsRoth: 0, spouseSavingsHSA: 0, spouseSavingsPension: 0,
    savingsTaxable: 0, savingsRealEstate: 0, savingsCash: 2_000_000,
    savings529: 0, savingsCrypto: 0, savingsAnnuity: 0,
    monthlyContribution: 0, spouseMonthlyContribution: 0,
    expectedReturn: 0, debts: [], inflationRate: 3, healthcareInflation: 0,
    healthcareMultiplier: 1, useRealEstateInRetirement: false, ltcMonthly: 0,
    retiredReturnPct: 60, cashReturn: 0, realEstateAppreciation: 0, annuityReturn: 0,
    annualSpending: 60_000, retireSpending: 60_000, expenseMode: 'simple', expenseBreakdown: null,
    goGoEndAge: 75, slowGoEndAge: 80,
    incomeSources: [{ type: 'pension', monthlyAmount: 104_000 / 12, startAge: 65, cola: false }],
    ...overrides,
  };
}
const cliffMove = (p) => runDecisionEngine(p).actions.find(a => a.id === 'irmaa-cliff');

describe('IRMAA cliff warning in today’s dollars', () => {
  it('flags only the years still within $10K of the tier in real terms', () => {
    const move = cliffMove(plan());
    expect(move.atRiskYears.map(y => y.age)).toEqual([70, 71]);
    expect(move.atRiskYears[1].magi).toBe(Math.round(104_000 / 1.03));
  });

  it('with no inflation every year stays at risk', () => {
    expect(cliffMove(plan({ inflationRate: 0 })).atRiskYears).toHaveLength(16);
  });
});
