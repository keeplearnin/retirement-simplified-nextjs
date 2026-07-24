/**
 * acaBridge.js — pre-65 ACA marketplace subsidy math (pure, standalone).
 *
 * The problem this models: retire before 65 and you must buy your own health
 * insurance until Medicare. Marketplace premiums are offset by the Premium
 * Tax Credit, which is keyed to MAGI as a % of the Federal Poverty Level —
 * and for 2026 the enhanced (ARPA/IRA) subsidies have EXPIRED, so the
 * 400%-of-FPL cliff is back: $1 of MAGI over the line forfeits the entire
 * year's credit. For an early-retiree couple in their 60s that cliff is
 * routinely worth $15K–$25K/yr, which makes bridge-year MAGI (Roth
 * conversions, capital gains, 401k withdrawals) a first-class planning lever.
 *
 * Constants are 2026 coverage-year figures:
 *  - FPL: 2025 HHS guidelines (contiguous 48), which govern 2026 coverage.
 *  - Applicable percentages: IRS Rev. Proc. schedule after the enhanced
 *    credits sunset (2.10% floor rising to 9.96%, cliff above 400% FPL).
 *  - Benchmark premiums: ESTIMATES from the federal 3:1 age curve — real
 *    quotes vary by state/county/plan; the UI lets users override.
 *
 * Pure module: no React, no localStorage.
 */

// 2025 HHS poverty guidelines (contiguous US) — used for 2026 coverage year.
export const FPL_2026 = { firstPerson: 15_650, perAdditional: 5_500 };

export function fplForHousehold(householdSize) {
  const n = Math.max(1, Math.round(householdSize || 1));
  return FPL_2026.firstPerson + (n - 1) * FPL_2026.perAdditional;
}

/**
 * Applicable-percentage schedule, 2026 (post-sunset). Within each band the
 * percentage rises linearly with % of FPL, per the IRS method.
 * Below 100% FPL there is NO marketplace credit (Medicaid territory in
 * expansion states; the coverage gap elsewhere). Above 400%: cliff, no credit.
 */
const PCT_BANDS = [
  { from: 1.00, to: 1.33, low: 0.0210, high: 0.0210 },
  { from: 1.33, to: 1.50, low: 0.0314, high: 0.0419 },
  { from: 1.50, to: 2.00, low: 0.0419, high: 0.0660 },
  { from: 2.00, to: 2.50, low: 0.0660, high: 0.0844 },
  { from: 2.50, to: 3.00, low: 0.0844, high: 0.0996 },
  { from: 3.00, to: 4.00, low: 0.0996, high: 0.0996 },
];

export function applicablePercentage(fplRatio) {
  if (fplRatio < 1.0 || fplRatio > 4.0) return null; // no credit
  for (const b of PCT_BANDS) {
    // Bands are [from, to) per the IRS schedule ("at least X but less than
    // Y") — exactly 133% takes the NEXT band's 3.14%, not 2.10%. The final
    // band closes at exactly 400% (inclusive).
    if (fplRatio < b.to || b.to === 4.0) {
      const t = b.to === b.from ? 0 : (fplRatio - b.from) / (b.to - b.from);
      return b.low + t * (b.high - b.low);
    }
  }
  return null;
}

/**
 * Federal default age curve (selected points; linear between). 21 = 1.000,
 * 64 = 3.000 — the statutory 3:1 limit. Children and >64 not modeled (a
 * 65+ member is on Medicare and out of this planner's scope).
 */
// Extra knots at 61-63: the real federal curve accelerates in the final
// years (61: 2.810, 62: 2.873, 63: 2.952) — linear interpolation between
// the 60 and 64 knots understated exactly the ages this planner serves
// most (~$450/yr per covered 62-year-old at base $400).
const AGE_CURVE = [
  [21, 1.000], [25, 1.004], [30, 1.135], [35, 1.222], [40, 1.278],
  [45, 1.444], [50, 1.786], [55, 2.230], [60, 2.714],
  [61, 2.810], [62, 2.873], [63, 2.952], [64, 3.000],
];

export function ageRatingFactor(age) {
  const a = Math.min(64, Math.max(21, age));
  for (let i = 1; i < AGE_CURVE.length; i++) {
    const [a1, f1] = AGE_CURVE[i - 1];
    const [a2, f2] = AGE_CURVE[i];
    if (a <= a2) return f1 + ((a - a1) / (a2 - a1)) * (f2 - f1);
  }
  return 3.0;
}

/** Estimated monthly benchmark (second-lowest-cost silver) for one person. */
export function estimateBenchmarkMonthly(age, base21Monthly = 400) {
  return base21Monthly * ageRatingFactor(age);
}

/**
 * Core subsidy computation for one coverage year.
 *
 * @param magi            household MAGI for the year
 * @param householdSize   tax-household size (drives the FPL line)
 * @param coveredAges     ages of members actually buying marketplace coverage
 *                        (each member < 65; an empty array → no premiums)
 * @param base21Monthly   age-21 benchmark premium (estimate, user-overridable)
 * @param benchmarkAnnualOverride  exact annual benchmark from a real quote —
 *                        bypasses the age-curve estimate when provided
 */
export function computeAcaYear({ magi, householdSize, coveredAges, base21Monthly = 400, benchmarkAnnualOverride }) {
  const fpl = fplForHousehold(householdSize);
  const fplRatio = fpl > 0 ? magi / fpl : Infinity;
  const benchmarkAnnual = benchmarkAnnualOverride ??
    coveredAges.reduce((s, a) => s + estimateBenchmarkMonthly(a, base21Monthly) * 12, 0);

  const pct = applicablePercentage(fplRatio);
  const belowFloor = fplRatio < 1.0;
  const overCliff = fplRatio > 4.0;
  const expectedContribution = pct !== null ? magi * pct : null;
  const subsidy = pct !== null ? Math.max(0, benchmarkAnnual - expectedContribution) : 0;

  // The cliff in dollars: MAGI at exactly 400% FPL and the credit there.
  const cliffMagi = fpl * 4.0;
  const subsidyAtCliff = Math.max(0, benchmarkAnnual - cliffMagi * 0.0996);

  // The floor, the mirror-image trap: MAGI UNDER 100% FPL gets no credit
  // either (Medicaid in expansion states, the coverage gap elsewhere).
  // Realizing income to a safe 150% FPL restores a near-full credit —
  // contribution there is only 4.19% of MAGI.
  const floorTargetMagi = fpl * 1.5;
  const subsidyAtFloor = Math.max(0, benchmarkAnnual - floorTargetMagi * 0.0419);

  return {
    fpl,
    fplRatio,
    benchmarkAnnual: Math.round(benchmarkAnnual),
    applicablePct: pct,
    expectedContribution: expectedContribution !== null ? Math.round(expectedContribution) : null,
    subsidy: Math.round(subsidy),
    netPremium: Math.round(benchmarkAnnual - subsidy),
    belowFloor,          // < 100% FPL — Medicaid territory, no PTC
    overCliff,           // > 400% FPL — full premium, credit forfeited
    cliffMagi: Math.round(cliffMagi),
    subsidyAtCliff: Math.round(subsidyAtCliff),
    floorTargetMagi: Math.round(floorTargetMagi),
    subsidyAtFloor: Math.round(subsidyAtFloor),
    // How much MAGI headroom (or overage) vs the cliff.
    distanceToCliff: Math.round(cliffMagi - magi),
  };
}

/**
 * Walk the plan's projection rows and price every bridge year: any year where
 * a household member is retired (no employer coverage) and under 65.
 *
 * Each member's need is judged on their own age/retirement: the primary
 * bridges [retireAge, 65) and the spouse [spouseRetireAge, 65) in their own
 * age frame. Household MAGI comes from the projection row (post-waterfall —
 * withdrawals, conversions modeled there are all reflected).
 *
 * @returns { years: [...], totals, anyBridge } — years is empty when nobody
 *          needs bridge coverage (e.g., both retire at 65+).
 */
export function analyzeBridgeYears(plan, projectionRows, { base21Monthly = 400 } = {}) {
  const hasSpouse = !!plan.hasSpouse;
  const householdSize = hasSpouse ? 2 : 1;
  const spouseOffset = hasSpouse ? (plan.spouseCurrentAge ?? plan.currentAge) - plan.currentAge : 0;
  const spouseRetire = hasSpouse ? (plan.spouseRetireAge ?? plan.retireAge) : null;

  const years = [];
  for (const row of projectionRows) {
    const primaryAge = row.age;
    const spouseAge = hasSpouse ? primaryAge + spouseOffset : null;
    const coveredAges = [];
    if (primaryAge >= plan.retireAge && primaryAge < 65) coveredAges.push(primaryAge);
    if (hasSpouse && spouseAge >= spouseRetire && spouseAge < 65) coveredAges.push(spouseAge);
    if (coveredAges.length === 0) continue;

    const year = computeAcaYear({
      magi: Math.max(0, row.magi || 0),
      householdSize,
      coveredAges,
      base21Monthly,
    });
    years.push({
      age: primaryAge,
      spouseAge,
      coveredCount: coveredAges.length,
      coveredAges: [...coveredAges],
      magi: Math.round(row.magi || 0),
      ...year,
    });
  }

  const totals = {
    benchmark: years.reduce((s, y) => s + y.benchmarkAnnual, 0),
    subsidies: years.reduce((s, y) => s + y.subsidy, 0),
    netPremiums: years.reduce((s, y) => s + y.netPremium, 0),
    cliffYears: years.filter(y => y.overCliff).length,
    // Regainable: years over the cliff where dropping MAGI to 400% FPL would
    // restore a credit — the heart of the Decision Engine lever.
    regainable: years
      .filter(y => y.overCliff)
      .reduce((s, y) => s + y.subsidyAtCliff, 0),
    floorYears: years.filter(y => y.belowFloor).length,
    // Mirror lever: below-floor years where realizing income to 150% FPL
    // would restore a credit.
    floorRegainable: years
      .filter(y => y.belowFloor)
      .reduce((s, y) => s + y.subsidyAtFloor, 0),
  };

  return { years, totals, anyBridge: years.length > 0 };
}

/**
 * COBRA comparison for the first 18 months after retirement. COBRA charges
 * the full employer-plan premium + 2% admin; it's often the better deal only
 * when subsidies are forfeited (over-cliff MAGI) or mid-treatment continuity
 * matters. Pure arithmetic — the user supplies their real COBRA quote.
 */
export function compareCobra({ cobraMonthly, bridgeYears }) {
  if (!(cobraMonthly > 0) || bridgeYears.length === 0) return null;
  const first18 = [];
  let monthsLeft = 18;
  for (const y of bridgeYears) {
    if (monthsLeft <= 0) break;
    const months = Math.min(12, monthsLeft);
    first18.push({
      age: y.age,
      months,
      cobraCost: Math.round(cobraMonthly * months),
      marketplaceCost: Math.round((y.netPremium / 12) * months),
    });
    monthsLeft -= months;
  }
  const cobraTotal = first18.reduce((s, p) => s + p.cobraCost, 0);
  const marketplaceTotal = first18.reduce((s, p) => s + p.marketplaceCost, 0);
  return {
    periods: first18,
    cobraTotal,
    marketplaceTotal,
    marketplaceSaves: cobraTotal - marketplaceTotal,
  };
}
