import { describe, it, expect } from 'vitest';
import { computeProjection } from '@/lib/computeProjection';

// Medicare IRMAA is deducted as spending, set by MAGI two years earlier,
// with thresholds indexed to inflation and the surcharge growing with
// healthcare inflation. 2026 single tiers (SSA): ≤$109K $0, ≤$137K $81.20,
// ≤$171K $202.90, ≤$205K $324.60, ≤$500K $446.30 per month.
function plan(overrides = {}) {
  return {
    currentAge: 70, retireAge: 65, longevityAge: 85,
    filingStatus: 'single', stateCode: 'TX', hasSpouse: false,
    savings401k: 0, savingsRoth: 0, savingsHSA: 0, savingsPension: 0,
    spouseSavings401k: 0, spouseSavingsRoth: 0, spouseSavingsHSA: 0, spouseSavingsPension: 0,
    savingsTaxable: 0, savingsRealEstate: 0, savingsCash: 2_000_000,
    savings529: 0, savingsCrypto: 0, savingsAnnuity: 0,
    monthlyContribution: 0, spouseMonthlyContribution: 0,
    expectedReturn: 0, debts: [], inflationRate: 0, healthcareInflation: 0,
    healthcareMultiplier: 1, useRealEstateInRetirement: false, ltcMonthly: 0,
    retiredReturnPct: 60, cashReturn: 0, realEstateAppreciation: 0, annuityReturn: 0,
    annualSpending: 60_000, retireSpending: 60_000, expenseMode: 'simple', expenseBreakdown: null,
    goGoEndAge: 75, slowGoEndAge: 80,
    incomeSources: [{ type: 'pension', monthlyAmount: 12_500, startAge: 65, cola: false }], // $150K/yr
    ...overrides,
  };
}
const row = (p, age) => computeProjection(p).combined.find(r => r.age === age);

describe('Medicare IRMAA in the projection', () => {
  it('a $150K pension pays the $202.90/month tier, and it is real spending', () => {
    const high = row(plan(), 72);
    const low = row(plan({ incomeSources: [{ type: 'pension', monthlyAmount: 8_000, startAge: 65, cola: false }] }), 72); // $96K: no surcharge
    expect(high.irmaa).toBe(202.9);
    expect(low.irmaa).toBe(0);
    expect(high.healthcare - low.healthcare).toBe(Math.round(202.9 * 12));
    expect(high.totalExpense - low.totalExpense).toBe(Math.round(202.9 * 12));
  });

  it('thresholds rise with inflation: a flat $150K pension drops tiers; the surcharge grows with healthcare costs', () => {
    // SSA compares the lookback MAGI against the PREMIUM year's indexed
    // thresholds, so the deflator is the premium year's index (^i) — the
    // old ^(i−2) ran the thresholds two years of inflation low and held
    // this pension in higher tiers too long (audit 2026-11-11).
    const p = plan({ inflationRate: 3, healthcareInflation: 5 });
    // Premium year 4: $150K vs thresholds ×1.03^4 ⇒ $150K/1.1255 = $133.3K
    // in 2026 dollars → $81.20 tier.
    expect(row(p, 74).irmaa).toBeCloseTo(81.2 * 1.05 ** 4, 1);
    // Premium year 11: $150K/1.03^11 = $108.4K → below the first threshold.
    expect(row(p, 81).irmaa).toBe(0);
  });

  it('uses income from two years earlier: a high salary at 63–64 sets the surcharge at 65–66', () => {
    const p = plan({
      currentAge: 63, retireAge: 65,
      incomeSources: [{ type: 'salary', amount: 300_000, growthRate: 0, endAge: 65 }],
    });
    expect(row(p, 64).irmaa).toBe(0);      // not on Medicare yet
    expect(row(p, 65).irmaa).toBe(446.3);  // looks back to $300K salary at 63
    expect(row(p, 66).irmaa).toBe(446.3);  // looks back to 64
    expect(row(p, 67).irmaa).toBe(0);      // looks back to 65: living on cash, no MAGI
  });
});
