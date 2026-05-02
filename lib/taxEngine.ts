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
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
  ssTaxablePercent: number;     // 0, 50, or 85
  standardDeduction: number;
  itemizedDeduction: number;
  deductionUsed: 'standard' | 'itemized';
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

function computeStateTax(taxableIncome: number, stateCode: string): number {
  const code = stateCode.toUpperCase();
  const rate = STATE_TAX_RATES[code] ?? DEFAULT_STATE_TAX_RATE;
  return Math.max(0, taxableIncome * rate);
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
    deductions,
  } = input;

  // 1. Compute SS taxability
  const { taxableAmount: ssTaxable, taxablePercent: ssTaxablePercent } =
    computeSSTaxable(socialSecurityBenefit, ordinaryIncome + capitalGains, filingStatus);

  // 2. Gross income for federal purposes
  const grossOrdinaryIncome = ordinaryIncome + ssTaxable;

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
  const deductionAmount =
    deductionUsed === 'itemized' ? itemizedDeduction : standardDeduction;

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

  // 7. NIIT
  const magi = grossOrdinaryIncome + capitalGains;
  const niit = computeNIIT(capitalGains, magi, filingStatus);

  // 8. State tax (applied to ordinary income + capital gains, simplified)
  const stateTaxableIncome = Math.max(
    0,
    grossOrdinaryIncome + capitalGains - deductionAmount,
  );
  const stateTax = computeStateTax(stateTaxableIncome, stateCode);

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
    totalTax: round2(totalTax),
    effectiveRate: round4(effectiveRate),
    marginalRate,
    ssTaxablePercent,
    standardDeduction,
    itemizedDeduction: round2(itemizedDeduction),
    deductionUsed,
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
