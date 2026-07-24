import { describe, it, expect } from 'vitest';
import {
  fplForHousehold, applicablePercentage, ageRatingFactor,
  computeAcaYear, analyzeBridgeYears, compareCobra,
} from '@/lib/acaBridge';
import { computeProjection } from '@/lib/computeProjection';
import { runDecisionEngine } from '@/lib/decisionEngine';

describe('fplForHousehold — 2025 guidelines for 2026 coverage', () => {
  it('single = $15,650; couple = $21,150', () => {
    expect(fplForHousehold(1)).toBe(15_650);
    expect(fplForHousehold(2)).toBe(21_150);
  });
});

describe('applicablePercentage — post-sunset 2026 schedule', () => {
  it('floor and band edges', () => {
    expect(applicablePercentage(1.0)).toBeCloseTo(0.0210, 4);
    expect(applicablePercentage(1.33)).toBeCloseTo(0.0210, 4);
    expect(applicablePercentage(1.50)).toBeCloseTo(0.0419, 4);
    expect(applicablePercentage(2.00)).toBeCloseTo(0.0660, 4);
    expect(applicablePercentage(3.00)).toBeCloseTo(0.0996, 4);
    expect(applicablePercentage(4.00)).toBeCloseTo(0.0996, 4); // flat 300–400%
  });

  it('no credit below 100% FPL or above 400% (the cliff)', () => {
    expect(applicablePercentage(0.99)).toBeNull();
    expect(applicablePercentage(4.01)).toBeNull();
  });
});

describe('ageRatingFactor — federal 3:1 curve', () => {
  it('anchors: 21 → 1.0, 64 → 3.0, monotonic between', () => {
    expect(ageRatingFactor(21)).toBe(1);
    expect(ageRatingFactor(64)).toBe(3);
    let prev = 0;
    for (let a = 21; a <= 64; a++) {
      const f = ageRatingFactor(a);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });
});

describe('computeAcaYear', () => {
  const single60 = { householdSize: 1, coveredAges: [60], base21Monthly: 400 };

  it('at 250% FPL a 60-year-old single gets a large credit', () => {
    const magi = Math.round(15_650 * 2.5);
    const r = computeAcaYear({ magi, ...single60 });
    // Benchmark ≈ $400 × 2.714 × 12 ≈ $13,027; contribution = 8.44% of MAGI.
    expect(r.benchmarkAnnual).toBeGreaterThan(12_000);
    expect(r.expectedContribution).toBeCloseTo(magi * 0.0844, -1);
    expect(r.subsidy).toBeGreaterThan(9_000);
    expect(r.overCliff).toBe(false);
  });

  it('the cliff: $1 over 400% FPL forfeits the whole credit', () => {
    const cliff = 15_650 * 4;
    const under = computeAcaYear({ magi: cliff - 100, ...single60 });
    const over = computeAcaYear({ magi: cliff + 100, ...single60 });
    expect(under.subsidy).toBeGreaterThan(5_000);
    expect(over.subsidy).toBe(0);
    expect(over.overCliff).toBe(true);
    expect(over.distanceToCliff).toBeLessThan(0);
  });

  it('below 100% FPL: Medicaid territory, no marketplace credit', () => {
    const r = computeAcaYear({ magi: 12_000, ...single60 });
    expect(r.belowFloor).toBe(true);
    expect(r.subsidy).toBe(0);
  });

  it('a real quote override bypasses the age-curve estimate', () => {
    const r = computeAcaYear({ magi: 40_000, ...single60, benchmarkAnnualOverride: 20_000 });
    expect(r.benchmarkAnnual).toBe(20_000);
  });
});

// ---------------------------------------------------------------------------
// analyzeBridgeYears — plan-driven
// ---------------------------------------------------------------------------

function basePlan(overrides = {}) {
  return {
    currentAge: 58, retireAge: 60, longevityAge: 90,
    filingStatus: 'single', stateCode: 'TX', hasSpouse: false,
    savings401k: 1_500_000, savingsRoth: 200_000, savingsHSA: 0, savingsPension: 0,
    spouseSavings401k: 0, spouseSavingsRoth: 0, spouseSavingsHSA: 0, spouseSavingsPension: 0,
    savingsTaxable: 300_000, savingsRealEstate: 0, savingsCash: 100_000,
    savings529: 0, savingsCrypto: 0, savingsAnnuity: 0,
    monthlyContribution: 1_000, spouseMonthlyContribution: 0,
    expectedReturn: 6, debts: [], inflationRate: 2.5,
    healthcareInflation: 3.5, healthcareMultiplier: 1.0,
    useRealEstateInRetirement: false, retiredReturnPct: 60,
    cashReturn: 3, realEstateAppreciation: 3, annuityReturn: 3.5,
    annualSpending: 90_000, retireSpending: 80_000, _expenseManuallySet: true,
    expenseMode: 'simple', expenseBreakdown: null, goGoEndAge: 75, slowGoEndAge: 85,
    incomeSources: [
      { id: 1, type: 'salary', label: 'Salary', amount: 150_000, growthRate: 3, owner: 'primary' },
      { id: 2, type: 'socialSecurity', label: 'SS', monthlyBenefit: 2_800, startAge: 67, owner: 'primary' },
    ],
    ...overrides,
  };
}

describe('analyzeBridgeYears', () => {
  it('retiring at 60 creates exactly 5 bridge years (60–64)', () => {
    const plan = basePlan();
    const proj = computeProjection(plan);
    const b = analyzeBridgeYears(plan, proj.combined);
    expect(b.anyBridge).toBe(true);
    expect(b.years.map(y => y.age)).toEqual([60, 61, 62, 63, 64]);
    expect(b.years.every(y => y.coveredCount === 1)).toBe(true);
  });

  it('retiring at 65+ needs no bridge', () => {
    const plan = basePlan({ retireAge: 65 });
    const proj = computeProjection(plan);
    const b = analyzeBridgeYears(plan, proj.combined);
    expect(b.anyBridge).toBe(false);
  });

  it('a younger spouse extends coverage past the primary turning 65', () => {
    const plan = basePlan({
      hasSpouse: true, filingStatus: 'mfj',
      spouseCurrentAge: 54, spouseRetireAge: 60, // 4 years younger
    });
    const proj = computeProjection(plan);
    const b = analyzeBridgeYears(plan, proj.combined);
    // Primary bridges 60–64; spouse (4 yrs younger) bridges primary-ages 64–68.
    const last = b.years[b.years.length - 1];
    expect(last.age).toBe(68);
    expect(last.coveredCount).toBe(1);
    expect(last.coveredAges).toEqual([64]); // the spouse's own age
    // While both are covered, two premiums stack.
    expect(b.years.find(y => y.age === 64).coveredCount).toBe(2);
  });

  it('totals.regainable only counts over-cliff years', () => {
    const plan = basePlan();
    const proj = computeProjection(plan);
    const b = analyzeBridgeYears(plan, proj.combined);
    const manual = b.years.filter(y => y.overCliff).reduce((s, y) => s + y.subsidyAtCliff, 0);
    expect(b.totals.regainable).toBe(manual);
  });
});

describe('compareCobra', () => {
  it('caps the comparison at 18 months across year boundaries', () => {
    const plan = basePlan();
    const proj = computeProjection(plan);
    const b = analyzeBridgeYears(plan, proj.combined);
    const c = compareCobra({ cobraMonthly: 1_800, bridgeYears: b.years });
    const months = c.periods.reduce((s, p) => s + p.months, 0);
    expect(months).toBe(18);
    expect(c.cobraTotal).toBe(1_800 * 18);
  });

  it('returns null with no quote or no bridge', () => {
    expect(compareCobra({ cobraMonthly: 0, bridgeYears: [{}] })).toBeNull();
    expect(compareCobra({ cobraMonthly: 1000, bridgeYears: [] })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Decision engine lever
// ---------------------------------------------------------------------------

describe('runDecisionEngine — ACA bridge lever', () => {
  it('flags forfeited subsidies for an early retiree whose withdrawals cross the cliff', () => {
    // High spending from a 401k-heavy portfolio → bridge-year MAGI well over
    // 400% of a single's FPL ($62,600) → subsidies forfeited.
    const result = runDecisionEngine(basePlan({ retireSpending: 110_000, annualSpending: 110_000 }));
    const aca = result.actions.find(a => a.id === 'aca-bridge');
    expect(aca).toBeDefined();
    expect(aca.dollarValue).toBeGreaterThan(1000);
    expect(aca.bridgeYears.some(y => y.overCliff)).toBe(true);
    expect(aca.apply).toBeNull();
  });

  it('emits nothing when retirement starts at 65+', () => {
    const result = runDecisionEngine(basePlan({ retireAge: 65 }));
    expect(result.actions.find(a => a.id === 'aca-bridge')).toBeUndefined();
    expect(result.actions.find(a => a.id === 'aca-floor')).toBeUndefined();
  });

  it('flags the mirror trap: MAGI too LOW for credits (below 100% FPL)', () => {
    // Bridge spending funded from cash — return of principal isn't income,
    // so MAGI ≈ 0 in the bridge years → below the 100% FPL floor → $0 credit.
    // Realizing a little income would restore it.
    const result = runDecisionEngine(basePlan({
      savings401k: 800_000, savingsTaxable: 0, savingsCash: 600_000,
      retireSpending: 60_000, annualSpending: 60_000,
    }));
    const floor = result.actions.find(a => a.id === 'aca-floor');
    expect(floor).toBeDefined();
    expect(floor.dollarValue).toBeGreaterThan(1000);
    expect(floor.bridgeYears.some(y => y.belowFloor)).toBe(true);
  });
});
