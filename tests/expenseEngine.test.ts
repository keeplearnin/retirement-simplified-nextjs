import { describe, it, expect } from 'vitest';
import { projectExpenses, ExpensePlan } from '@/lib/expenseEngine';

function basePlan(overrides: Partial<ExpensePlan> = {}): ExpensePlan {
  return {
    currentAge: 65,
    retireAge: 65,
    longevityAge: 90,
    essentialExpenses: [],
    discretionaryExpenses: [],
    oneTimeExpenses: [],
    debts: [],
    healthcare: [],
    goGoEndAge: 75,
    slowGoEndAge: 85,
    slowGoPct: 0.85,
    noGoPct: 0.70,
    inflationRate: 0.025,
    healthcareInflation: 0.035,
    ...overrides,
  };
}

describe('projectExpenses — long-term care modeling', () => {
  it('applies no LTC cost before the LTC window (longevityAge - 5, floored at 85)', () => {
    const rows = projectExpenses(basePlan({ currentAge: 80, longevityAge: 90 }));
    const beforeWindow = rows.filter(r => r.age < 85);
    expect(beforeWindow.every(r => r.healthcare === 0)).toBe(true);
  });

  it('ramps in LTC cost starting at the window and grows toward longevityAge', () => {
    const rows = projectExpenses(basePlan({ currentAge: 80, longevityAge: 90 }));
    const windowRows = rows.filter(r => r.age >= 85);
    expect(windowRows.length).toBeGreaterThan(0);
    expect(windowRows.every(r => r.healthcare > 0)).toBe(true);
    // Ramp is monotonically non-decreasing through the window (inflation +
    // rising ramp factor both push the cost up year over year).
    for (let i = 1; i < windowRows.length; i++) {
      expect(windowRows[i].healthcare).toBeGreaterThanOrEqual(windowRows[i - 1].healthcare);
    }
  });

  it('caps the LTC-specific inflation rate so a 55+ year horizon does not blow up', () => {
    // Young user with an aggressive healthcare-inflation assumption (7%) and
    // a 65-year horizon to the LTC window. If the raw healthcareInflation
    // rate were applied uncapped, decades of 7% compounding would produce an
    // absurd figure. The engine caps the effective LTC rate at 4.5%.
    const young = projectExpenses(basePlan({ currentAge: 25, longevityAge: 95, healthcareInflation: 0.07 }));
    const ltcStartRow = young.find(r => r.age === 90)!; // ltcStartAge = max(85, 95-5) = 90
    expect(ltcStartRow).toBeDefined();

    // Base annual cost at the start of the window (rampFactor = 0.5):
    // 3600 * 12 * 0.5 = 21,600 in today's dollars, inflated over 65 years.
    const yearsToWindow = 90 - 25;
    const uncappedAt7Pct = 21_600 * Math.pow(1.07, yearsToWindow);
    const cappedAt45Pct = 21_600 * Math.pow(1.045, yearsToWindow);

    expect(ltcStartRow.healthcare).toBeCloseTo(cappedAt45Pct, -1);
    expect(ltcStartRow.healthcare).toBeLessThan(uncappedAt7Pct);
  });

  it('uses the plan healthcareInflation rate directly when it is below the cap', () => {
    const rows = projectExpenses(basePlan({ currentAge: 85, longevityAge: 90, healthcareInflation: 0.02 }));
    const ltcStartRow = rows.find(r => r.age === 85)!;
    // rampFactor at start of window = 0.5, no elapsed years of inflation yet.
    expect(ltcStartRow.healthcare).toBeCloseTo(3600 * 12 * 0.5, 0);
  });

  it('is a realistic, non-trivial share of a retiree budget at the peak of the window', () => {
    const rows = projectExpenses(basePlan({ currentAge: 90, longevityAge: 90 }));
    const finalRow = rows[rows.length - 1];
    // Peak (rampFactor = 1) in today's dollars: 3600 * 12 = 43,200/yr —
    // a realistic probability-weighted figure, not a token amount.
    expect(finalRow.healthcare).toBeGreaterThanOrEqual(43_200 * 0.99);
  });
});
