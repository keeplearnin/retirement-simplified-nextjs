/**
 * healthcare.ts — pre-Medicare gap and Medicare-era cost estimates.
 *
 * Many planners ignore the healthcare bridge between retirement and Medicare
 * eligibility (age 65). For an early retiree this can be the single largest
 * line item in their first decade of retirement. This module estimates:
 *
 *   - Monthly ACA marketplace premium given age, household size, income
 *   - Subsidy under the federal premium-tax-credit formula (post-ARPA rules,
 *     subject to TCJA-style sunset noted below)
 *   - Lifetime Medicare cost (Part B base + Medigap + Part D average) from 65
 *     to longevity
 *   - Comparison vs. Fidelity's healthcare-savings benchmark
 *
 * Numbers approximated for 2026. Cited inline.
 */

// ---------------------------------------------------------------------------
// 2026 inputs
// ---------------------------------------------------------------------------

/**
 * 2026 HHS poverty guidelines (48 contiguous states + DC). Each additional
 * person adds $5,500 to the family base.
 * Source: HHS Federal Register notice for 2026.
 */
export const FPL_2026: Record<number, number> = {
  1: 15_650,
  2: 21_150,
  3: 26_650,
  4: 32_150,
  5: 37_650,
  6: 43_150,
  7: 48_650,
  8: 54_150,
};

function fplFor(householdSize: number): number {
  if (householdSize <= 8) return FPL_2026[Math.max(1, Math.round(householdSize))];
  // Each additional person above 8 adds approximately $5,500.
  return FPL_2026[8] + (householdSize - 8) * 5_500;
}

/**
 * National-average benchmark second-lowest-cost silver plan premiums by age
 * for 2026 (approximated from KFF marketplace data). State-specific values
 * vary; this is a planning estimate.
 */
const BENCHMARK_MONTHLY_PREMIUM_BY_AGE: Record<number, number> = {
  50: 580, 51: 588, 52: 601, 53: 615, 54: 631,
  55: 651, 56: 671, 57: 695, 58: 723, 59: 747,
  60: 786, 61: 821, 62: 858, 63: 896, 64: 937,
};

function benchmarkPremiumAt(age: number): number {
  if (age < 50) return BENCHMARK_MONTHLY_PREMIUM_BY_AGE[50];
  if (age >= 64) return BENCHMARK_MONTHLY_PREMIUM_BY_AGE[64];
  return BENCHMARK_MONTHLY_PREMIUM_BY_AGE[age] ?? BENCHMARK_MONTHLY_PREMIUM_BY_AGE[50];
}

/**
 * Returns the maximum % of MAGI a household must contribute toward the
 * benchmark plan, per the ACA premium-tax-credit formula. Currently uses
 * the post-ARPA / IRA schedule. NOTE: the IRA extension expires after
 * 2025 — for 2026+ projections, verify policy. As of writing, Congress
 * has signaled extension but the table below tracks the post-ARPA caps;
 * if the cliff returns, tier 5 should snap to "no subsidy" above 400% FPL.
 */
function maxContributionPct(fplPct: number): number {
  if (fplPct <= 1.5) return 0.00;
  if (fplPct <= 2.0) return 0.02;
  if (fplPct <= 2.5) return 0.04;
  if (fplPct <= 3.0) return 0.06;
  if (fplPct <= 4.0) return 0.085;
  return 0.085;
}

// ---------------------------------------------------------------------------
// 2026 Medicare constants
// ---------------------------------------------------------------------------

/**
 * 2026 base Medicare costs (CMS, December 2025 announcement).
 *   - partB_base_monthly: standard Part B premium ($202.90/mo)
 *   - medigap_planG_avg_monthly: national avg Plan G ($165/mo)
 *   - partD_avg_monthly: average Part D premium ($45/mo, per KFF)
 */
export const MEDICARE_2026 = {
  partB_base_monthly: 202.90,
  medigap_planG_avg_monthly: 165,
  partD_avg_monthly: 45,
};

/**
 * Annual baseline Medicare cost per person (Part B + Medigap + Part D),
 * assuming standard supplemental coverage. This is a baseline before IRMAA.
 */
export function annualMedicareBaseline(): number {
  return (
    MEDICARE_2026.partB_base_monthly +
    MEDICARE_2026.medigap_planG_avg_monthly +
    MEDICARE_2026.partD_avg_monthly
  ) * 12;
}

/**
 * Fidelity's commonly-cited "healthcare-in-retirement" lifetime estimate
 * for a 65-year-old in 2026 dollars.
 *   - $172,500 individual
 *   - $345,000 couple
 * Reflects out-of-pocket (premiums + cost-sharing) over a typical retirement.
 */
export const FIDELITY_HEALTHCARE_BENCHMARK = {
  individual: 172_500,
  couple: 345_000,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface HealthcareInput {
  currentAge: number;
  retirementAge: number;
  longevityAge: number;
  annualIncome: number;       // MAGI proxy for ACA subsidy
  householdSize: number;      // 1 = single, 2 = couple
  filingStatus: 'single' | 'mfj';
}

export interface HealthcareOutput {
  preMedicareYears: number;
  annualAcaGrossPremium: number;
  annualAcaSubsidy: number;
  annualAcaNetPremium: number;
  preMedicareTotalCost: number;
  medicareYears: number;
  annualMedicareCost: number;     // base + medigap + part D, no IRMAA
  medicareTotalCost: number;
  lifetimeHealthcareCost: number;
  fidelityBenchmark: number;
  vsBenchmark: number;            // lifetime - benchmark (positive = above avg)
}

export function estimateAcaPremium(
  age: number,
  annualIncome: number,
  householdSize: number = 1,
): { gross: number; subsidy: number; net: number; fplPct: number } {
  // Scale benchmark to household. Real ACA marketplace plans for a couple
  // price roughly 2x single coverage at the same age; modelling as a flat
  // householdSize multiplier is a simplification but captures the right
  // first-order effect (without it, subsidy is computed against a single
  // person's gross and the household ends up massively under-billed before
  // a downstream multiplier applied a second time).
  const grossMonthly = benchmarkPremiumAt(age);
  const grossAnnual = grossMonthly * 12 * householdSize;
  const fpl = fplFor(householdSize);
  const fplPct = annualIncome / fpl;
  const cap = annualIncome * maxContributionPct(fplPct);
  const subsidy = Math.max(0, grossAnnual - cap);
  const net = Math.max(0, grossAnnual - subsidy);
  return { gross: grossAnnual, subsidy, net, fplPct };
}

export function computeHealthcare(input: HealthcareInput): HealthcareOutput {
  const preMedicareYears = Math.max(0, Math.min(65, input.longevityAge) - input.retirementAge);
  const medicareYears = Math.max(0, input.longevityAge - Math.max(input.retirementAge, 65));

  // Pre-Medicare ACA cost — average premium across the bridge years using
  // the user's age at the midpoint. Cheap approximation; close enough.
  let preMedicareTotalCost = 0;
  let aggregatedGross = 0;
  let aggregatedSubsidy = 0;
  let aggregatedNet = 0;
  if (preMedicareYears > 0) {
    for (let y = 0; y < preMedicareYears; y++) {
      const ageThisYear = input.retirementAge + y;
      const { gross, subsidy, net } = estimateAcaPremium(
        ageThisYear,
        input.annualIncome,
        input.householdSize,
      );
      aggregatedGross += gross;
      aggregatedSubsidy += subsidy;
      aggregatedNet += net;
      // gross/subsidy/net are already household-scaled by estimateAcaPremium.
      preMedicareTotalCost += net;
    }
  }
  // Per-year averages — already household-scaled.
  const annualAcaGrossPremium = preMedicareYears > 0 ? aggregatedGross / preMedicareYears : 0;
  const annualAcaSubsidy = preMedicareYears > 0 ? aggregatedSubsidy / preMedicareYears : 0;
  const annualAcaNetPremium = preMedicareYears > 0 ? aggregatedNet / preMedicareYears : 0;

  const annualMedicareCost = annualMedicareBaseline();
  // Medicare baseline is per-person; for couples each beneficiary pays.
  const medicareTotalCost = annualMedicareCost * medicareYears * input.householdSize;
  const lifetimeHealthcareCost = preMedicareTotalCost + medicareTotalCost;
  const fidelityBenchmark = input.householdSize >= 2
    ? FIDELITY_HEALTHCARE_BENCHMARK.couple
    : FIDELITY_HEALTHCARE_BENCHMARK.individual;

  return {
    preMedicareYears,
    annualAcaGrossPremium: Math.round(annualAcaGrossPremium),
    annualAcaSubsidy: Math.round(annualAcaSubsidy),
    annualAcaNetPremium: Math.round(annualAcaNetPremium),
    preMedicareTotalCost: Math.round(preMedicareTotalCost),
    medicareYears,
    annualMedicareCost: Math.round(annualMedicareCost),
    medicareTotalCost: Math.round(medicareTotalCost),
    lifetimeHealthcareCost: Math.round(lifetimeHealthcareCost),
    fidelityBenchmark,
    vsBenchmark: Math.round(lifetimeHealthcareCost - fidelityBenchmark),
  };
}
