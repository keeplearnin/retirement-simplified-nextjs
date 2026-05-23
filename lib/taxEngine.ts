/**
 * taxEngine.ts — Comprehensive federal + state tax engine for retirement planning.
 * Self-contained: no imports from other project files.
 * Computes year-by-year tax liability including federal, state, capital gains, NIIT, and IRMAA.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaxInput {
  filingStatus: 'single' | 'mfj';
  ordinaryIncome: number;       // salary + pension + SS taxable + RMDs + annuity
  socialSecurityBenefit: number; // gross SS — engine computes taxable portion
  capitalGains: number;          // long-term capital gains
  stateCode: string;             // 2-letter state code
  age: number;                   // for over-65 deduction
  spouseAge?: number;
  /** Portion of `ordinaryIncome` that is retirement-derived (pension, IRA/401k
   *  withdrawals, annuity, RMDs) — i.e. everything EXCEPT salary, rental,
   *  part-time work. Used by computeStateTax to apply state-specific
   *  retirement-income exemptions (PA, IL, MS, GA, SC, NY, etc. exempt all
   *  or part of this for over-65 / over-59½ retirees). Defaults to 0 if
   *  caller doesn't break it out — no state exemption applied in that case.
   *
   *  Without this, state tax was overstated by thousands/yr for retired
   *  users in PA/IL/MS/GA/SC/NY (flagged in the Deloitte FP&A review). */
  retirementIncome?: number;
  /** Calendar year this tax year corresponds to. Used to gate temporary
   *  provisions like the OBBBA senior bonus deduction (effective 2025-2028).
   *  Defaults to 2026 if absent — matches the rest of the engine's constants. */
  taxYear?: number;
  deductions?: {
    mortgageInterest?: number;
    propertyTax?: number;
    stateLocalTax?: number;
    charitableGiving?: number;
  };
}

export interface TaxResult {
  federalTax: number;
  stateTax: number;
  capitalGainsTax: number;
  niit: number;
  irmaa: number;                // monthly Part B surcharge
  magi: number;                 // approximated AGI used for IRMAA / NIIT
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
  ssTaxablePercent: number;     // 0, 50, or 85
  standardDeduction: number;
  itemizedDeduction: number;
  deductionUsed: 'standard' | 'itemized';
  /** OBBBA senior bonus deduction (2025-2028 only) — separate line so users
   *  can see the temporary boost vs. the permanent additional 65+ deduction. */
  obbbaSeniorDeduction: number;
}

export interface IrmaaCliff {
  /** Tier index user falls in (0 = no surcharge, ascending). */
  currentTier: number;
  /** Dollars to next threshold (0 if at the highest tier). */
  distanceToNextCliff: number;
  /** Threshold dollar value of the next tier (Infinity if user is at top). */
  nextThreshold: number;
  /** Annual additional Medicare cost in current tier (per beneficiary). */
  annualSurcharge: number;
  /** True when user is within $5,000 of crossing into a higher tier. */
  atRisk: boolean;
}

/**
 * Detect whether projected MAGI is close to an IRMAA threshold. A small
 * Roth conversion or extra withdrawal can push the user across — the cost
 * is per-beneficiary, per-year, so cliffs are worth surfacing explicitly.
 */
export function detectIrmaaCliff(
  magi: number,
  filingStatus: 'single' | 'mfj',
  warnWindow: number = 5000,
): IrmaaCliff {
  const table = filingStatus === 'single' ? IRMAA_SINGLE : IRMAA_MFJ;
  let currentTier = table.length - 1;
  let nextThreshold = Infinity;
  for (let i = 0; i < table.length; i++) {
    if (magi <= table[i].magiThreshold) {
      currentTier = i;
      nextThreshold = table[i].magiThreshold;
      break;
    }
  }
  const distanceToNextCliff = isFinite(nextThreshold)
    ? Math.max(0, nextThreshold - magi)
    : 0;
  const annualSurcharge = table[currentTier].monthlyPartBSurcharge * 12;
  const atRisk = distanceToNextCliff > 0 && distanceToNextCliff < warnWindow;
  return { currentTier, distanceToNextCliff, nextThreshold, annualSurcharge, atRisk };
}

// ---------------------------------------------------------------------------
// 2026 Federal Tax Brackets — IRS Rev. Proc. 2025-32
// Update each January when the IRS publishes new inflation-adjusted thresholds.
// ---------------------------------------------------------------------------

interface BracketEntry {
  min: number;
  max: number;
  rate: number;
}

const FEDERAL_BRACKETS_SINGLE: BracketEntry[] = [
  { min: 0,       max: 12_400,    rate: 0.10 },
  { min: 12_400,  max: 50_400,    rate: 0.12 },
  { min: 50_400,  max: 105_700,   rate: 0.22 },
  { min: 105_700, max: 201_775,   rate: 0.24 },
  { min: 201_775, max: 256_225,   rate: 0.32 },
  { min: 256_225, max: 640_600,   rate: 0.35 },
  { min: 640_600, max: Infinity,  rate: 0.37 },
];

const FEDERAL_BRACKETS_MFJ: BracketEntry[] = [
  { min: 0,       max: 24_800,    rate: 0.10 },
  { min: 24_800,  max: 100_800,   rate: 0.12 },
  { min: 100_800, max: 211_400,   rate: 0.22 },
  { min: 211_400, max: 403_550,   rate: 0.24 },
  { min: 403_550, max: 512_450,   rate: 0.32 },
  { min: 512_450, max: 768_700,   rate: 0.35 },
  { min: 768_700, max: Infinity,  rate: 0.37 },
];

// ---------------------------------------------------------------------------
// Standard Deductions — 2026
// ---------------------------------------------------------------------------

const STANDARD_DEDUCTION_SINGLE = 16_100;
const STANDARD_DEDUCTION_MFJ = 32_200;
const ADDITIONAL_DEDUCTION_SINGLE_65 = 2_050;
const ADDITIONAL_DEDUCTION_MFJ_65 = 1_650; // per qualifying spouse

// ---------------------------------------------------------------------------
// OBBBA Senior Bonus Deduction (One Big Beautiful Bill Act, 2025)
// ---------------------------------------------------------------------------
// Temporary $6,000 deduction per qualifying individual age 65+, on top of
// the existing additional standard deduction. Effective tax years 2025
// through 2028. Phases out 6¢ per $ of MAGI over the threshold:
//   Single:  $75,000 → $175,000 MAGI (deduction reaches $0)
//   MFJ:     $150,000 → $250,000 MAGI (per-spouse phase-out)
// Per-person: in MFJ where both spouses are 65+, household total can reach
// $12,000 (each spouse's $6,000 phased independently against household MAGI).
// Source: IRS — One, Big, Beautiful Bill Act tax deductions for working
// Americans and seniors fact sheet.
const OBBBA_SENIOR_BONUS = 6_000;
const OBBBA_PHASE_OUT_RATE = 0.06;
const OBBBA_PHASE_OUT_START_SINGLE = 75_000;
const OBBBA_PHASE_OUT_START_MFJ = 150_000;
const OBBBA_FIRST_TAX_YEAR = 2025;
const OBBBA_LAST_TAX_YEAR = 2028;

// ---------------------------------------------------------------------------
// Capital Gains Brackets (0% / 15% / 20%) — 2026
// ---------------------------------------------------------------------------

const CAP_GAINS_BRACKETS_SINGLE: BracketEntry[] = [
  { min: 0,       max: 49_450,    rate: 0.00 },
  { min: 49_450,  max: 545_500,   rate: 0.15 },
  { min: 545_500, max: Infinity,  rate: 0.20 },
];

const CAP_GAINS_BRACKETS_MFJ: BracketEntry[] = [
  { min: 0,       max: 98_900,    rate: 0.00 },
  { min: 98_900,  max: 613_700,   rate: 0.15 },
  { min: 613_700, max: Infinity,  rate: 0.20 },
];

// ---------------------------------------------------------------------------
// NIIT — Net Investment Income Tax (3.8%)
// ---------------------------------------------------------------------------

const NIIT_RATE = 0.038;
const NIIT_THRESHOLD_SINGLE = 200_000;
const NIIT_THRESHOLD_MFJ = 250_000;

// ---------------------------------------------------------------------------
// SALT Cap
// ---------------------------------------------------------------------------

const SALT_CAP = 10_000;
// const SALT_CAP_2026 = 40_000; // if TCJA extension passes — not yet active

// ---------------------------------------------------------------------------
// IRMAA Thresholds (2026 figures — based on MAGI from 2 years prior).
// Source: SSA POMS HI 01101.020. 2026 Part B base premium is $202.90/mo;
// the SSA table publishes total premium per tier — surcharge below = total
// minus base.
// ---------------------------------------------------------------------------

interface IrmaaEntry {
  magiThreshold: number;
  monthlyPartBSurcharge: number;
}

const IRMAA_SINGLE: IrmaaEntry[] = [
  { magiThreshold: 109_000, monthlyPartBSurcharge: 0 },
  { magiThreshold: 137_000, monthlyPartBSurcharge: 81.20 },
  { magiThreshold: 171_000, monthlyPartBSurcharge: 202.90 },
  { magiThreshold: 205_000, monthlyPartBSurcharge: 324.60 },
  { magiThreshold: 500_000, monthlyPartBSurcharge: 446.30 },
  { magiThreshold: Infinity, monthlyPartBSurcharge: 487.00 },
];

const IRMAA_MFJ: IrmaaEntry[] = [
  { magiThreshold: 218_000, monthlyPartBSurcharge: 0 },
  { magiThreshold: 274_000, monthlyPartBSurcharge: 81.20 },
  { magiThreshold: 342_000, monthlyPartBSurcharge: 202.90 },
  { magiThreshold: 410_000, monthlyPartBSurcharge: 324.60 },
  { magiThreshold: 750_000, monthlyPartBSurcharge: 446.30 },
  { magiThreshold: Infinity, monthlyPartBSurcharge: 487.00 },
];

// ---------------------------------------------------------------------------
// State Tax Rates (simplified — flat or top marginal approximation)
// States with graduated brackets use a weighted average / top-bracket approx.
// 0 = no state income tax.
// ---------------------------------------------------------------------------

const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.050,
  AK: 0,
  AZ: 0.025,
  AR: 0.044,
  CA: 0.093,  // top bracket 12.3%, but using ~9.3% as effective for typical retiree
  CO: 0.044,
  CT: 0.050,
  DE: 0.066,
  DC: 0.065,
  FL: 0,
  GA: 0.055,
  HI: 0.072,
  ID: 0.058,
  IL: 0.0495, // flat
  IN: 0.0305, // flat
  IA: 0.044,
  KS: 0.057,
  KY: 0.040,  // flat
  LA: 0.0425,
  ME: 0.0715,
  MD: 0.0575,
  MA: 0.050,  // flat (plus 4% surtax on >$1M not modeled here)
  MI: 0.0425, // flat
  MN: 0.0785,
  MS: 0.050,
  MO: 0.048,
  MT: 0.059,
  NE: 0.0564,
  NV: 0,
  NH: 0,      // no tax on earned income (interest/dividends tax repealed 2025)
  NJ: 0.0637,
  NM: 0.049,
  NY: 0.0685, // top bracket 10.9%, using ~6.85% for typical retiree
  NC: 0.045,  // flat
  ND: 0.0195,
  OH: 0.035,
  OK: 0.0475,
  OR: 0.088,
  PA: 0.0307, // flat
  RI: 0.0599,
  SC: 0.064,
  SD: 0,
  TN: 0,
  TX: 0,
  UT: 0.0465, // flat
  VT: 0.0675,
  VA: 0.0575,
  WA: 0,
  WV: 0.055,
  WI: 0.0653,
  WY: 0,
};

const DEFAULT_STATE_TAX_RATE = 0.05; // fallback

// ---------------------------------------------------------------------------
// Graduated state tax brackets (top high-graduated states)
// ---------------------------------------------------------------------------
// For states where the top bracket is materially above the flat effective
// rate, run proper bracket math. Threshold for inclusion: top marginal rate
// at least 2 pp above the flat estimate AND a population large enough that
// the inaccuracy hits a meaningful number of users. Source: state revenue
// department 2025 published brackets (used for tax year 2026 — minor index
// shifts only). Re-verify each January when states publish updated tables.
//
// For users not in this table, computeStateTax falls through to the flat
// rate above, which is accurate for non-graduated / lower-income states.
const STATE_GRADUATED_BRACKETS: Record<
  string,
  { single: BracketEntry[]; mfj: BracketEntry[] }
> = {
  CA: {
    single: [
      { min: 0,         max: 10_756,    rate: 0.010 },
      { min: 10_756,    max: 25_499,    rate: 0.020 },
      { min: 25_499,    max: 40_245,    rate: 0.040 },
      { min: 40_245,    max: 55_866,    rate: 0.060 },
      { min: 55_866,    max: 70_606,    rate: 0.080 },
      { min: 70_606,    max: 360_659,   rate: 0.093 },
      { min: 360_659,   max: 432_787,   rate: 0.103 },
      { min: 432_787,   max: 721_314,   rate: 0.113 },
      { min: 721_314,   max: Infinity,  rate: 0.123 },
    ],
    mfj: [
      { min: 0,         max: 21_512,    rate: 0.010 },
      { min: 21_512,    max: 50_998,    rate: 0.020 },
      { min: 50_998,    max: 80_490,    rate: 0.040 },
      { min: 80_490,    max: 111_732,   rate: 0.060 },
      { min: 111_732,   max: 141_212,   rate: 0.080 },
      { min: 141_212,   max: 721_318,   rate: 0.093 },
      { min: 721_318,   max: 865_574,   rate: 0.103 },
      { min: 865_574,   max: 1_442_628, rate: 0.113 },
      { min: 1_442_628, max: Infinity,  rate: 0.123 },
    ],
  },
  NY: {
    single: [
      { min: 0,           max: 8_500,      rate: 0.0400 },
      { min: 8_500,       max: 11_700,     rate: 0.0450 },
      { min: 11_700,      max: 13_900,     rate: 0.0525 },
      { min: 13_900,      max: 80_650,     rate: 0.0550 },
      { min: 80_650,      max: 215_400,    rate: 0.0600 },
      { min: 215_400,     max: 1_077_550,  rate: 0.0685 },
      { min: 1_077_550,   max: 5_000_000,  rate: 0.0965 },
      { min: 5_000_000,   max: 25_000_000, rate: 0.1030 },
      { min: 25_000_000,  max: Infinity,   rate: 0.1090 },
    ],
    mfj: [
      { min: 0,           max: 17_150,     rate: 0.0400 },
      { min: 17_150,      max: 23_600,     rate: 0.0450 },
      { min: 23_600,      max: 27_900,     rate: 0.0525 },
      { min: 27_900,      max: 161_550,    rate: 0.0550 },
      { min: 161_550,     max: 323_200,    rate: 0.0600 },
      { min: 323_200,     max: 2_155_350,  rate: 0.0685 },
      { min: 2_155_350,   max: 5_000_000,  rate: 0.0965 },
      { min: 5_000_000,   max: 25_000_000, rate: 0.1030 },
      { min: 25_000_000,  max: Infinity,   rate: 0.1090 },
    ],
  },
  NJ: {
    single: [
      { min: 0,           max: 20_000,     rate: 0.01400 },
      { min: 20_000,      max: 35_000,     rate: 0.01750 },
      { min: 35_000,      max: 40_000,     rate: 0.03500 },
      { min: 40_000,      max: 75_000,     rate: 0.05525 },
      { min: 75_000,      max: 500_000,    rate: 0.06370 },
      { min: 500_000,     max: 1_000_000,  rate: 0.08970 },
      { min: 1_000_000,   max: Infinity,   rate: 0.10750 },
    ],
    mfj: [
      { min: 0,           max: 20_000,     rate: 0.01400 },
      { min: 20_000,      max: 50_000,     rate: 0.01750 },
      { min: 50_000,      max: 70_000,     rate: 0.02450 },
      { min: 70_000,      max: 80_000,     rate: 0.03500 },
      { min: 80_000,      max: 150_000,    rate: 0.05525 },
      { min: 150_000,     max: 500_000,    rate: 0.06370 },
      { min: 500_000,     max: 1_000_000,  rate: 0.08970 },
      { min: 1_000_000,   max: Infinity,   rate: 0.10750 },
    ],
  },
  OR: {
    // Oregon's top bracket is 9.9% over $125K single / $250K MFJ (no further
    // tiers). Including because the gap from the flat 8.8% to actual 9.9%
    // matters for Portland-area earners.
    single: [
      { min: 0,         max: 4_300,     rate: 0.0475 },
      { min: 4_300,     max: 10_750,    rate: 0.0675 },
      { min: 10_750,    max: 125_000,   rate: 0.0875 },
      { min: 125_000,   max: Infinity,  rate: 0.0990 },
    ],
    mfj: [
      { min: 0,         max: 8_600,     rate: 0.0475 },
      { min: 8_600,     max: 21_500,    rate: 0.0675 },
      { min: 21_500,    max: 250_000,   rate: 0.0875 },
      { min: 250_000,   max: Infinity,  rate: 0.0990 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Social Security Taxability
// ---------------------------------------------------------------------------

/**
 * Computes the taxable portion of Social Security benefits.
 *
 * Provisional income = other income + 50% of SS benefit.
 * Single: <$25K = 0%, $25K-$34K = 50%, >$34K = 85%
 * MFJ:   <$32K = 0%, $32K-$44K = 50%, >$44K = 85%
 */
export function computeSSTaxable(
  benefit: number,
  otherIncome: number,
  filingStatus: 'single' | 'mfj',
): { taxableAmount: number; taxablePercent: number } {
  if (benefit <= 0) {
    return { taxableAmount: 0, taxablePercent: 0 };
  }

  const provisionalIncome = otherIncome + benefit * 0.5;

  const [lowerThreshold, upperThreshold] =
    filingStatus === 'single' ? [25_000, 34_000] : [32_000, 44_000];

  let taxableAmount: number;

  if (provisionalIncome <= lowerThreshold) {
    taxableAmount = 0;
  } else if (provisionalIncome <= upperThreshold) {
    // 50% of the amount over the lower threshold, but not more than 50% of benefit
    taxableAmount = Math.min(
      0.5 * (provisionalIncome - lowerThreshold),
      0.5 * benefit,
    );
  } else {
    // 85% formula: lesser of (a) 85% of benefit or
    // (b) 50% of (upperThreshold - lowerThreshold) + 85% of (provisional - upperThreshold)
    const amountA = 0.85 * benefit;
    const amountB =
      0.5 * (upperThreshold - lowerThreshold) +
      0.85 * (provisionalIncome - upperThreshold);
    taxableAmount = Math.min(amountA, amountB);
  }

  taxableAmount = Math.max(0, taxableAmount);

  const taxablePercent =
    taxableAmount <= 0
      ? 0
      : taxableAmount <= 0.5 * benefit + 0.01
        ? 50
        : 85;

  return { taxableAmount, taxablePercent };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function applyBrackets(taxableIncome: number, brackets: BracketEntry[]): number {
  let tax = 0;
  for (const b of brackets) {
    if (taxableIncome <= b.min) break;
    const inBracket = Math.min(taxableIncome, b.max) - b.min;
    tax += inBracket * b.rate;
  }
  return tax;
}

function getMarginalRate(taxableIncome: number, brackets: BracketEntry[]): number {
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxableIncome > brackets[i].min) {
      return brackets[i].rate;
    }
  }
  return brackets[0].rate;
}

function getStandardDeduction(
  filingStatus: 'single' | 'mfj',
  age: number,
  spouseAge?: number,
): number {
  let deduction =
    filingStatus === 'single' ? STANDARD_DEDUCTION_SINGLE : STANDARD_DEDUCTION_MFJ;

  if (age >= 65) {
    deduction +=
      filingStatus === 'single'
        ? ADDITIONAL_DEDUCTION_SINGLE_65
        : ADDITIONAL_DEDUCTION_MFJ_65;
  }

  if (filingStatus === 'mfj' && spouseAge !== undefined && spouseAge >= 65) {
    deduction += ADDITIONAL_DEDUCTION_MFJ_65;
  }

  return deduction;
}

/**
 * OBBBA senior bonus deduction. Returns 0 outside the 2025-2028 window and
 * for households with no qualifying 65+ filers. Phase-out is applied per
 * qualifying spouse against household MAGI.
 */
function computeOBBBASeniorDeduction(
  magi: number,
  filingStatus: 'single' | 'mfj',
  age: number,
  spouseAge: number | undefined,
  taxYear: number,
): number {
  if (taxYear < OBBBA_FIRST_TAX_YEAR || taxYear > OBBBA_LAST_TAX_YEAR) return 0;

  const threshold =
    filingStatus === 'single' ? OBBBA_PHASE_OUT_START_SINGLE : OBBBA_PHASE_OUT_START_MFJ;
  const reduction = Math.max(0, magi - threshold) * OBBBA_PHASE_OUT_RATE;
  const perPersonBonus = Math.max(0, OBBBA_SENIOR_BONUS - reduction);

  let total = 0;
  if (age >= 65) total += perPersonBonus;
  if (filingStatus === 'mfj' && spouseAge !== undefined && spouseAge >= 65) {
    total += perPersonBonus;
  }
  return total;
}

function computeIRMAA(magi: number, filingStatus: 'single' | 'mfj'): number {
  const table = filingStatus === 'single' ? IRMAA_SINGLE : IRMAA_MFJ;
  for (const entry of table) {
    if (magi <= entry.magiThreshold) {
      return entry.monthlyPartBSurcharge;
    }
  }
  // Above all thresholds
  return table[table.length - 1].monthlyPartBSurcharge;
}

// State retirement-income exemptions. Many states fully or partially exempt
// SS / pension / 401k withdrawals for retirees — refusing to model this
// overstates state tax by thousands/yr for users in PA, IL, MS, GA, SC, NY,
// MI, IA, AL, HI, MA, and KY (Deloitte FP&A review finding).
//
// Returns the dollar amount to SUBTRACT from state taxable income.
// Conservative: when the rule depends on details we don't track (e.g.
// Alabama's distinction between defined-benefit and defined-contribution
// pensions), the more restrictive interpretation is used.
function stateRetirementExemption(
  stateCode: string,
  age: number,
  spouseAge: number | undefined,
  ssTaxable: number,
  retirementIncome: number,
  filingStatus: 'single' | 'mfj',
): number {
  if (retirementIncome <= 0 && ssTaxable <= 0) return 0;
  const code = stateCode.toUpperCase();

  switch (code) {
    // Full retirement income + SS exemption (subject to age thresholds)
    case 'IL': // SS + qualified retirement, all ages effectively
      return ssTaxable + retirementIncome;
    case 'PA': // Retirement income for 59½+; SS always exempt
      return age >= 60 ? ssTaxable + retirementIncome : ssTaxable;
    case 'MS': // SS + qualified retirement income, no age req
      return ssTaxable + retirementIncome;
    case 'IA': // SS exempt always; retirement income exempt 55+ (2023 change)
      return age >= 55 ? ssTaxable + retirementIncome : ssTaxable;

    // SS-only exemption (always)
    case 'AL': // SS always exempt; DB pensions also, but we conservatively
               // only credit SS to avoid over-exempting 401k withdrawals
    case 'HI': // SS exempt; employer-funded pensions also (conservatively SS only)
    case 'MA': // SS exempt; IRA/401k taxable
    case 'NJ':
    case 'OR':
      return ssTaxable;

    // Capped retirement exemption (Georgia — large, age-tiered)
    case 'GA': {
      if (age < 62) return ssTaxable; // SS still exempt
      const cap = age >= 65 ? 65_000 : 35_000;
      const primary = Math.min(retirementIncome, cap);
      if (filingStatus === 'mfj' && (spouseAge ?? 0) >= 62) {
        const spouseCap = (spouseAge ?? 0) >= 65 ? 65_000 : 35_000;
        return ssTaxable + Math.min(primary + spouseCap, retirementIncome);
      }
      return ssTaxable + primary;
    }

    // SC: full SS exemption, partial retirement exemption
    case 'SC': {
      const cap = age >= 65 ? 15_000 : 10_000;
      return ssTaxable + Math.min(retirementIncome, cap);
    }

    // KY: $31,110 per-person retirement income exclusion
    case 'KY': {
      const cap = 31_110;
      return ssTaxable + Math.min(retirementIncome, cap);
    }

    // NY: SS exempt; $20K retirement income exempt for 59½+
    case 'NY':
      return ssTaxable + (age >= 60 ? Math.min(retirementIncome, 20_000) : 0);

    // MI: SS exempt; $20K/$40K retirement income exempt for 67+
    case 'MI': {
      if (age < 67) return ssTaxable;
      const cap = filingStatus === 'mfj' ? 40_000 : 20_000;
      return ssTaxable + Math.min(retirementIncome, cap);
    }

    default:
      return 0;
  }
}

function computeStateTax(
  taxableIncome: number,
  stateCode: string,
  filingStatus: 'single' | 'mfj',
  options: {
    age?: number;
    spouseAge?: number;
    ssTaxable?: number;
    retirementIncome?: number;
  } = {},
): number {
  const code = stateCode.toUpperCase();

  // Apply state retirement income exemption first — this is the single
  // biggest source of state-tax accuracy improvement for retired users.
  // See stateRetirementExemption() for the per-state rules.
  const exemption =
    options.age !== undefined
      ? stateRetirementExemption(
          code,
          options.age,
          options.spouseAge,
          options.ssTaxable ?? 0,
          options.retirementIncome ?? 0,
          filingStatus,
        )
      : 0;
  const adjustedTaxable = Math.max(0, taxableIncome - exemption);

  // Prefer graduated bracket math for the high-graduated states (CA, NY, NJ,
  // OR) — closes the $5K-$15K/yr undershoot for high earners that the flat
  // estimator showed (tester report from Fisherman Investments review).
  const graduated = STATE_GRADUATED_BRACKETS[code];
  if (graduated) {
    const brackets = filingStatus === 'mfj' ? graduated.mfj : graduated.single;
    return Math.max(0, applyBrackets(adjustedTaxable, brackets));
  }
  // Fallback: flat effective rate for non-graduated / less-impactful states.
  const rate = STATE_TAX_RATES[code] ?? DEFAULT_STATE_TAX_RATE;
  return Math.max(0, adjustedTaxable * rate);
}

function computeCapitalGainsTax(
  gains: number,
  ordinaryTaxableIncome: number,
  filingStatus: 'single' | 'mfj',
): number {
  if (gains <= 0) return 0;

  const brackets =
    filingStatus === 'single' ? CAP_GAINS_BRACKETS_SINGLE : CAP_GAINS_BRACKETS_MFJ;

  // Capital gains stack on top of ordinary income for bracket purposes.
  // The "base" is the ordinary taxable income; gains fill from there upward.
  const base = Math.max(0, ordinaryTaxableIncome);
  let tax = 0;
  let remaining = gains;

  for (const b of brackets) {
    if (remaining <= 0) break;
    const bracketStart = Math.max(b.min, base);
    if (bracketStart >= b.max) continue;
    const room = b.max - bracketStart;
    const taxed = Math.min(remaining, room);
    tax += taxed * b.rate;
    remaining -= taxed;
  }

  return tax;
}

function computeNIIT(
  investmentIncome: number,
  magi: number,
  filingStatus: 'single' | 'mfj',
): number {
  const threshold =
    filingStatus === 'single' ? NIIT_THRESHOLD_SINGLE : NIIT_THRESHOLD_MFJ;
  if (magi <= threshold) return 0;

  const excess = magi - threshold;
  return NIIT_RATE * Math.min(investmentIncome, excess);
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export function computeTax(input: TaxInput): TaxResult {
  const {
    filingStatus,
    ordinaryIncome,
    socialSecurityBenefit,
    capitalGains,
    stateCode,
    age,
    spouseAge,
    taxYear = 2026,
    deductions,
  } = input;

  // 1. Compute SS taxability
  const { taxableAmount: ssTaxable, taxablePercent: ssTaxablePercent } =
    computeSSTaxable(socialSecurityBenefit, ordinaryIncome + capitalGains, filingStatus);

  // 2. Gross income for federal purposes
  const grossOrdinaryIncome = ordinaryIncome + ssTaxable;

  // MAGI is needed both for the OBBBA senior bonus phase-out below and for
  // IRMAA / NIIT later. It does not depend on deductions, so we compute it
  // once here and reuse.
  const magi = grossOrdinaryIncome + capitalGains;

  // 3. Deductions
  const standardDeduction = getStandardDeduction(filingStatus, age, spouseAge);

  // Itemized deductions with SALT cap
  const mortgageInterest = deductions?.mortgageInterest ?? 0;
  const propertyTax = deductions?.propertyTax ?? 0;
  const stateLocalTax = deductions?.stateLocalTax ?? 0;
  const charitableGiving = deductions?.charitableGiving ?? 0;

  const saltTotal = propertyTax + stateLocalTax;
  const saltCapped = Math.min(saltTotal, SALT_CAP);

  const itemizedDeduction = mortgageInterest + saltCapped + charitableGiving;

  const deductionUsed: 'standard' | 'itemized' =
    itemizedDeduction > standardDeduction ? 'itemized' : 'standard';
  const baseDeduction =
    deductionUsed === 'itemized' ? itemizedDeduction : standardDeduction;

  // OBBBA senior bonus stacks on top of standard OR itemized. Per IRS, this
  // is "in addition to" the standard deduction (and silently in addition to
  // itemized too — it's a separate allowance, not part of either). Phased
  // out by household MAGI. Returns 0 for non-65+ households or outside the
  // 2025-2028 window. See computeOBBBASeniorDeduction comment for sources.
  const obbbaSeniorDeduction = computeOBBBASeniorDeduction(
    magi,
    filingStatus,
    age,
    spouseAge,
    taxYear,
  );

  const deductionAmount = baseDeduction + obbbaSeniorDeduction;

  // 4. Federal taxable ordinary income
  const federalTaxableOrdinary = Math.max(0, grossOrdinaryIncome - deductionAmount);

  // 5. Federal ordinary income tax
  const brackets =
    filingStatus === 'single' ? FEDERAL_BRACKETS_SINGLE : FEDERAL_BRACKETS_MFJ;
  const federalTax = applyBrackets(federalTaxableOrdinary, brackets);

  // 6. Capital gains tax
  const capitalGainsTax = computeCapitalGainsTax(
    capitalGains,
    federalTaxableOrdinary,
    filingStatus,
  );

  // 7. NIIT — uses MAGI computed earlier for the OBBBA phase-out
  const niit = computeNIIT(capitalGains, magi, filingStatus);

  // 8. State tax — applies state-specific retirement income exemptions
  // (PA, IL, MS, GA, SC, NY, MI, IA, AL, HI, MA, KY, NJ, OR have them).
  // Without these, retired users in those states were over-taxed by
  // thousands/yr (Deloitte FP&A review finding).
  const stateTaxableIncome = Math.max(
    0,
    grossOrdinaryIncome + capitalGains - deductionAmount,
  );
  const stateTax = computeStateTax(stateTaxableIncome, stateCode, filingStatus, {
    age: input.age,
    spouseAge: input.spouseAge,
    ssTaxable, // already computed above (line 709)
    retirementIncome: input.retirementIncome ?? 0,
  });

  // 9. IRMAA (monthly Part B surcharge)
  const irmaa = computeIRMAA(magi, filingStatus);

  // 10. Marginal rate
  const marginalRate = getMarginalRate(federalTaxableOrdinary, brackets);

  // 11. Totals
  const totalTax = federalTax + stateTax + capitalGainsTax + niit;
  const totalGrossIncome = ordinaryIncome + socialSecurityBenefit + capitalGains;
  const effectiveRate = totalGrossIncome > 0 ? totalTax / totalGrossIncome : 0;

  return {
    federalTax: round2(federalTax),
    stateTax: round2(stateTax),
    capitalGainsTax: round2(capitalGainsTax),
    niit: round2(niit),
    irmaa: round2(irmaa),
    magi: round2(magi),
    totalTax: round2(totalTax),
    effectiveRate: round4(effectiveRate),
    marginalRate,
    ssTaxablePercent,
    standardDeduction,
    itemizedDeduction: round2(itemizedDeduction),
    deductionUsed,
    obbbaSeniorDeduction: round2(obbbaSeniorDeduction),
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
