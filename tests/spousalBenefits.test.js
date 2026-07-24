import { describe, it, expect } from 'vitest';
import { spousalFactor, ssClaimingFactor } from '@/lib/ssClaiming';
import { projectIncome } from '@/lib/incomeEngine';
import { runDecisionEngine, sweepJointSsClaiming } from '@/lib/decisionEngine';

// ---------------------------------------------------------------------------
// spousalFactor — SSA's spousal-benefit reduction schedule
// ---------------------------------------------------------------------------

describe('ssClaimingFactor — statutory bounds (regression)', () => {
  it('caps delayed credits at 70 and early claiming at 62', () => {
    // Out-of-range plan data (agent-written or imported) must not mint
    // phantom credits: 72 → 1.24 (not 1.40), 60 → 0.70 (not lower).
    expect(ssClaimingFactor(72)).toBeCloseTo(1.24, 10);
    expect(ssClaimingFactor(60)).toBeCloseTo(0.70, 10);
  });
});

describe('projectIncome — COLA accrues from today, not from the claim age (regression)', () => {
  it('a delayed claim at 70 includes the COLAs accrued since the projection start', () => {
    // COLA-ing only after the claim age understated delayed claiming by
    // (1+cola)^(startAge − currentAge) ≈ 17% at 70 — and biased every
    // claim-age comparison (including the joint sweep) toward claiming early.
    const rows = projectIncome({
      currentAge: 62, retireAge: 62, longevityAge: 90,
      socialSecurity: { monthlyBenefitAtFRA: 2_500, startAge: 70, cola: 0.02 },
    });
    const at70 = rows.find(r => r.age === 70);
    // 2500 × 1.24 (delayed credits) × 12 × 1.02^8 (8 years of COLA since 62)
    expect(at70.socialSecurity).toBeCloseTo(2_500 * 1.24 * 12 * Math.pow(1.02, 8), 0);
  });
});

describe('spousalFactor', () => {
  it('is 1.0 at FRA', () => {
    expect(spousalFactor(67)).toBe(1);
  });

  it('earns NO delayed credits past FRA (unlike worker benefits)', () => {
    expect(spousalFactor(68)).toBe(1);
    expect(spousalFactor(70)).toBe(1);
    // Contrast: worker benefit at 70 gets +24%.
    expect(ssClaimingFactor(70)).toBeCloseTo(1.24, 10);
  });

  it('claiming at 62 with FRA 67 cuts spousal 35% (factor 0.65)', () => {
    // First 36 months: 36 × 25/36% = 25%. Months 37–60: 24 × 5/12% = 10%.
    expect(spousalFactor(62)).toBeCloseTo(0.65, 10);
  });

  it('claiming at 64 (36 months early) cuts exactly 25%', () => {
    expect(spousalFactor(64)).toBeCloseTo(0.75, 10);
  });
});

// ---------------------------------------------------------------------------
// projectIncome — spousal top-up while both alive
// ---------------------------------------------------------------------------

function couplePlan(overrides = {}) {
  return {
    currentAge: 65,
    retireAge: 65,
    longevityAge: 90,
    socialSecurity: { monthlyBenefitAtFRA: 3_000, startAge: 67, cola: 0 },
    spouse: {
      currentAge: 65,
      retireAge: 65,
      longevityAge: 90,
      socialSecurity: { monthlyBenefitAtFRA: 0, startAge: 67, cola: 0 },
    },
    ...overrides,
  };
}

describe('projectIncome — spousal top-up (both alive)', () => {
  it('a never-worked spouse ($0 own PIA) receives 50% of the worker PIA at FRA', () => {
    const rows = projectIncome(couplePlan());
    const at68 = rows.find(r => r.age === 68);
    // Worker: $3,000/mo at FRA = $36,000/yr. Spousal: 50% = $18,000/yr.
    expect(at68.spouseSocialSecurity).toBeCloseTo(18_000, 0);
    expect(at68.socialSecurity).toBeCloseTo(36_000 + 18_000, 0);
  });

  it('spousal claimed at 62 is reduced to 32.5% of the worker PIA', () => {
    const rows = projectIncome(couplePlan({
      currentAge: 61,
      retireAge: 61,
      socialSecurity: { monthlyBenefitAtFRA: 3_000, startAge: 62, cola: 0 },
      spouse: {
        currentAge: 61, retireAge: 61, longevityAge: 90,
        socialSecurity: { monthlyBenefitAtFRA: 0, startAge: 62, cola: 0 },
      },
    }));
    const at63 = rows.find(r => r.age === 63);
    // 50% × 0.65 = 32.5% of $36,000 = $11,700/yr.
    expect(at63.spouseSocialSecurity).toBeCloseTo(0.325 * 36_000, 0);
  });

  it('spousal cannot start until the worker files', () => {
    const rows = projectIncome(couplePlan({
      currentAge: 62,
      retireAge: 62,
      socialSecurity: { monthlyBenefitAtFRA: 3_000, startAge: 70, cola: 0 },
      spouse: {
        currentAge: 62, retireAge: 62, longevityAge: 90,
        socialSecurity: { monthlyBenefitAtFRA: 0, startAge: 62, cola: 0 },
      },
    }));
    // Worker hasn't filed until 70 — spouse collects nothing before that.
    for (const r of rows.filter(r => r.age < 70)) {
      expect(r.spouseSocialSecurity, `spouse SS at ${r.age}`).toBe(0);
    }
    const at70 = rows.find(r => r.age === 70);
    // Spousal starts at spouse-age 70 (past FRA): factor 1 → 50% of PIA.
    // No delayed credits accrue on the spousal portion despite starting at 70.
    expect(at70.spouseSocialSecurity).toBeCloseTo(18_000, 0);
  });

  it('a spouse whose own benefit exceeds 50% of the other PIA gets no top-up', () => {
    const rows = projectIncome(couplePlan({
      spouse: {
        currentAge: 65, retireAge: 65, longevityAge: 90,
        // Own PIA $2,000 > 50% of $3,000 — no spousal excess either direction.
        socialSecurity: { monthlyBenefitAtFRA: 2_000, startAge: 67, cola: 0 },
      },
    }));
    const at68 = rows.find(r => r.age === 68);
    expect(at68.spouseSocialSecurity).toBeCloseTo(24_000, 0); // own only
    expect(at68.socialSecurity).toBeCloseTo(36_000 + 24_000, 0);
  });

  it('survivor step-up replaces the spousal top-up (no double-dipping)', () => {
    const rows = projectIncome(couplePlan({
      longevityAge: 75, // primary (worker) dies at end of age-75 row
      spouse: {
        currentAge: 65, retireAge: 65, longevityAge: 95,
        socialSecurity: { monthlyBenefitAtFRA: 0, startAge: 67, cola: 0 },
      },
    }));
    const widowRow = rows.find(r => r.age === 80);
    expect(widowRow.widowed).toBe(true);
    // Survivor steps up to the deceased worker's full $36,000 — not
    // own ($0) + spousal ($18,000), and not $36,000 + $18,000.
    expect(widowRow.spouseSocialSecurity).toBeCloseTo(36_000, 0);
    expect(widowRow.socialSecurity).toBeCloseTo(36_000, 0);
  });
});

// ---------------------------------------------------------------------------
// Decision engine — joint 81-combination claiming sweep
// ---------------------------------------------------------------------------

function jointPlan(overrides = {}) {
  return {
    currentAge: 58,
    retireAge: 62,
    longevityAge: 92,
    filingStatus: 'mfj',
    stateCode: 'CA',
    hasSpouse: true,
    spouseCurrentAge: 58,
    spouseRetireAge: 62,
    spouseLongevityAge: 94,
    savings401k: 900_000, savingsRoth: 50_000, savingsHSA: 0, savingsPension: 0,
    spouseSavings401k: 400_000, spouseSavingsRoth: 0, spouseSavingsHSA: 0, spouseSavingsPension: 0,
    savingsTaxable: 300_000, savingsRealEstate: 0, savingsCash: 100_000,
    savings529: 0, savingsCrypto: 0, savingsAnnuity: 0,
    monthlyContribution: 1_000, spouseMonthlyContribution: 500,
    expectedReturn: 6,
    debts: [],
    inflationRate: 2.5,
    healthcareInflation: 3.5,
    healthcareMultiplier: 1.0,
    useRealEstateInRetirement: false,
    retiredReturnPct: 60,
    cashReturn: 3, realEstateAppreciation: 3, annuityReturn: 3.5,
    annualSpending: 110_000,
    retireSpending: 90_000,
    expenseMode: 'simple',
    expenseBreakdown: null,
    goGoEndAge: 75,
    slowGoEndAge: 85,
    incomeSources: [
      { id: 1, type: 'salary', label: 'Salary', amount: 150_000, growthRate: 3, owner: 'primary' },
      { id: 2, type: 'salary', label: 'Spouse Salary', amount: 90_000, growthRate: 3, owner: 'spouse' },
      { id: 3, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 3_200, startAge: 62, owner: 'primary' },
      { id: 4, type: 'socialSecurity', label: 'Spouse Social Security', monthlyBenefit: 1_400, startAge: 62, owner: 'spouse' },
    ],
    ...overrides,
  };
}

describe('sweepJointSsClaiming', () => {
  it('produces the full 81-cell grid with exactly one current cell', () => {
    const sweep = sweepJointSsClaiming(jointPlan());
    expect(sweep.grid).toHaveLength(81);
    expect(sweep.grid.filter(c => c.isCurrent)).toHaveLength(1);
    const ages = new Set(sweep.grid.map(c => `${c.primaryAge}-${c.spouseAge}`));
    expect(ages.size).toBe(81);
  });

  it('best cell has the maximum net of the grid', () => {
    const sweep = sweepJointSsClaiming(jointPlan());
    const maxNet = Math.max(...sweep.grid.map(c => c.net));
    expect(sweep.best.net).toBe(maxNet);
  });

  it('recommends delaying the higher earner past 62 for a long-lived couple', () => {
    // Survivor step-up means the higher earner's delayed credits pay until the
    // SECOND death (spouse lives to 94) — claiming both at 62 leaves money on
    // the table.
    const sweep = sweepJointSsClaiming(jointPlan());
    expect(sweep.best.primaryAge).toBeGreaterThan(62);
  });

  it('returns null for singles and for couples without both SS sources', () => {
    expect(sweepJointSsClaiming(jointPlan({ hasSpouse: false }))).toBeNull();
    expect(sweepJointSsClaiming(jointPlan({
      incomeSources: jointPlan().incomeSources.filter(s => s.id !== 4),
    }))).toBeNull();
  });

  it('locks members who are already claiming (the past cannot be re-decided)', () => {
    // Both claimed at 62 and are past it → nothing left to decide.
    expect(sweepJointSsClaiming(jointPlan({
      currentAge: 66, retireAge: 66, spouseCurrentAge: 64, spouseRetireAge: 64,
    }))).toBeNull();

    // Primary already claiming (66 > 62), spouse (58) still has the choice:
    // the primary's dimension collapses to their actual claim age and the
    // grid always contains the current combination.
    const sweep = sweepJointSsClaiming(jointPlan({
      currentAge: 66, retireAge: 66,
    }));
    expect(new Set(sweep.grid.map(c => c.primaryAge))).toEqual(new Set([62]));
    expect(sweep.grid.filter(c => c.isCurrent)).toHaveLength(1);
    expect(sweep.grid.length).toBe(9); // 1 locked × 9 spouse ages
  });
});

describe('runDecisionEngine — joint SS action for couples', () => {
  it('emits ss-joint-claiming (not the single sweep) with a two-source apply descriptor', () => {
    const result = runDecisionEngine(jointPlan());
    const joint = result.actions.find(a => a.id === 'ss-joint-claiming');
    expect(joint).toBeDefined();
    expect(result.actions.find(a => a.id === 'ss-claiming')).toBeUndefined();
    expect(joint.dollarValue).toBeGreaterThan(0);
    expect(joint.grid).toHaveLength(81);
    expect(joint.apply.type).toBe('ss-joint-start-age');
    expect(joint.apply.primarySourceId).toBe(3);
    expect(joint.apply.spouseSourceId).toBe(4);
    expect(joint.apply.primaryStartAge).toBeGreaterThan(62);
  });

  it('falls back to the single-person sweep when only the primary has SS', () => {
    const result = runDecisionEngine(jointPlan({
      incomeSources: jointPlan().incomeSources.filter(s => s.id !== 4),
    }));
    expect(result.actions.find(a => a.id === 'ss-joint-claiming')).toBeUndefined();
    // Single sweep may or may not clear the $1K materiality bar, but the
    // engine must not crash and must not emit the joint action.
    expect(result.baseline.moneyLastsAge).toBeGreaterThan(0);
  });
});
