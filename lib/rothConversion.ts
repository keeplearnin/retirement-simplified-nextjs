/**
 * rothConversion.ts — model a Roth conversion ladder strategy.
 *
 * Compares two scenarios from retirement to longevity:
 *  - baseline: no conversions, traditional balance grows and gets force-drawn
 *    via RMDs from age 73 onward.
 *  - ladder: in each year of the conversion window, convert just enough from
 *    Traditional → Roth to "fill" the user's target tax bracket. Pay tax now
 *    at a (presumably lower) rate; reduce future RMDs and the bracket creep
 *    they cause.
 *
 * Pure function. No React, no localStorage. Reuses computeTax for honest
 * federal+state+SS-taxability math.
 */

import { computeTax } from './taxEngine';
import { RMD_TABLE } from './constants';

export type Bracket = 0 | 12 | 22 | 24 | 32;
export type FilingStatus = 'single' | 'mfj';

export interface RothLadderInput {
  /** Current age = first year of the projection. */
  currentAge: number;
  /** Year the user retires from W-2 work. Conversion window typically opens here. */
  retireAge: number;
  /** Project through this age. */
  longevityAge: number;

  /** Tax-deferred balance: 401(k) + Traditional IRA (+ Pension pot if treated tax-deferred). */
  tradBalance: number;
  /** Roth balance — receives conversions, grows tax-free. */
  rothBalance: number;

  /** Annual expected return on portfolio (e.g. 0.07). Applied to both buckets in retirement. */
  expectedReturn: number;
  /** % of expectedReturn used in retirement to reflect a more conservative allocation. */
  retiredReturnPct: number;

  filingStatus: FilingStatus;
  stateCode: string;

  /** SS gross monthly benefit at the user's claim age. */
  ssMonthlyBenefit: number;
  /** Age the user starts collecting SS. */
  ssStartAge: number;
  /** Optional pension. */
  pensionMonthlyAmount?: number;
  pensionStartAge?: number;

  /** "Fill the X% bracket" — converts up to the top of this bracket. 0 = no conversion (baseline only). */
  targetBracket: Bracket;
  /** First age (inclusive) at which a conversion can happen. */
  conversionStartAge: number;
  /** Last age (inclusive) at which a conversion can happen — typically 72 (year before RMD start). */
  conversionEndAge: number;
}

export interface RothLadderYear {
  age: number;
  ordinaryIncome: number; // ordinary income BEFORE deductions (pension + RMD + conversion)
  ssGross: number;
  conversion: number;
  rmd: number;
  fedTax: number;
  stateTax: number;
  totalTax: number;
  tradBalanceEnd: number;
  rothBalanceEnd: number;
  /** True when an IRMAA surcharge fires this year (matters at 65+). */
  triggersIrmaa: boolean;
}

export interface RothLadderScenario {
  years: RothLadderYear[];
  lifetimeTax: number;
  /** First-year RMD (age 73) in this scenario. */
  rmdAt73: number;
  /** Total balance (trad + roth) at longevityAge. */
  finalBalance: number;
}

export interface RothLadderOutput {
  baseline: RothLadderScenario;
  ladder: RothLadderScenario;
  /** baseline.lifetimeTax - ladder.lifetimeTax. Positive = the ladder saved money. */
  taxSaved: number;
  /** Sum of all conversions in the ladder scenario. */
  ladderConversionTotal: number;
  /** Number of years in which a conversion actually occurred (≥ $1). */
  conversionWindowYears: number;
  /** Years (ages) where the ladder triggers IRMAA but the baseline does not. */
  irmaaTrippedAges: number[];
}

const RMD_START_AGE = 73;

// 2026 federal-bracket UPPER edges for taxable income (i.e. after std deduction).
const BRACKET_TOPS_SINGLE: Record<number, number> = {
  10: 12_400,
  12: 50_400,
  22: 105_700,
  24: 201_775,
  32: 256_225,
  35: 640_600,
};
const BRACKET_TOPS_MFJ: Record<number, number> = {
  10: 24_800,
  12: 100_800,
  22: 211_400,
  24: 403_550,
  32: 512_450,
  35: 768_700,
};
const STD_DEDUCTION_SINGLE = 16_100;
const STD_DEDUCTION_MFJ = 32_200;

function rmdDivisor(age: number): number | null {
  if (age < RMD_START_AGE) return null;
  return RMD_TABLE[Math.min(age, 110)] ?? null;
}

function ssGrossInYear(input: RothLadderInput, age: number): number {
  if (age < input.ssStartAge) return 0;
  // 2.5% COLA approximation. We don't apply a claiming-age adjustment factor —
  // the user is assumed to have entered their actual claimed monthly benefit.
  const yearsClaimed = age - input.ssStartAge;
  return input.ssMonthlyBenefit * 12 * Math.pow(1 + 0.025, yearsClaimed);
}

function pensionInYear(input: RothLadderInput, age: number): number {
  if (!input.pensionStartAge || !input.pensionMonthlyAmount) return 0;
  if (age < input.pensionStartAge) return 0;
  return input.pensionMonthlyAmount * 12;
}

function runScenario(input: RothLadderInput, withLadder: boolean): RothLadderScenario {
  let tradBal = input.tradBalance;
  let rothBal = input.rothBalance;
  const yearReturn = input.expectedReturn * input.retiredReturnPct;
  const stdDed = input.filingStatus === 'mfj' ? STD_DEDUCTION_MFJ : STD_DEDUCTION_SINGLE;
  const bracketTops = input.filingStatus === 'mfj' ? BRACKET_TOPS_MFJ : BRACKET_TOPS_SINGLE;
  const targetTaxableTop = input.targetBracket > 0 ? bracketTops[input.targetBracket] : 0;

  const years: RothLadderYear[] = [];
  let lifetimeTax = 0;
  let rmdAt73 = 0;

  for (let age = input.retireAge; age <= input.longevityAge; age++) {
    const ssGross = ssGrossInYear(input, age);
    const pension = pensionInYear(input, age);

    // RMD if past 73 with trad balance remaining.
    const divisor = rmdDivisor(age);
    let rmd = 0;
    if (divisor && tradBal > 0) {
      rmd = tradBal / divisor;
      tradBal -= rmd;
      if (age === RMD_START_AGE) rmdAt73 = rmd;
    }

    // Roth conversion — only when ladder is on and we're inside the window.
    let conversion = 0;
    if (
      withLadder &&
      age >= input.conversionStartAge &&
      age <= input.conversionEndAge &&
      input.targetBracket > 0 &&
      tradBal > 0
    ) {
      // We want taxable income (= ordinary + conversion - stdDed) to land at
      // the top of the target bracket. SS taxability and capital gains are
      // ignored for the headroom calc — they're handled in the actual tax run.
      const ordinaryBeforeConversion = pension + rmd;
      const taxableBefore = Math.max(0, ordinaryBeforeConversion - stdDed);
      const headroom = Math.max(0, targetTaxableTop - taxableBefore);
      conversion = Math.min(headroom, tradBal);
      tradBal -= conversion;
      rothBal += conversion;
    }

    const totalOrdinary = pension + rmd + conversion;
    // Calendar year = today + (age - currentAge). Anchored to 2026 to match
    // taxEngine.ts constants. Used to gate the OBBBA senior bonus deduction
    // (effective 2025-2028 only) — relevant for users who are 65+ during
    // the conversion window.
    const taxYear = 2026 + (age - input.currentAge);
    const taxResult = computeTax({
      filingStatus: input.filingStatus,
      ordinaryIncome: totalOrdinary,
      socialSecurityBenefit: ssGross,
      capitalGains: 0,
      stateCode: input.stateCode,
      age,
      taxYear,
    });

    const totalTax = taxResult.totalTax;
    lifetimeTax += totalTax;

    // End-of-year growth on remaining balances. Both buckets share the same
    // return assumption (post-conversion the dollars sit in Roth and grow
    // tax-free, but the rate is the same).
    tradBal = Math.max(0, tradBal * (1 + yearReturn));
    rothBal = Math.max(0, rothBal * (1 + yearReturn));

    years.push({
      age,
      ordinaryIncome: totalOrdinary,
      ssGross,
      conversion,
      rmd,
      fedTax: taxResult.federalTax,
      stateTax: taxResult.stateTax,
      totalTax,
      tradBalanceEnd: tradBal,
      rothBalanceEnd: rothBal,
      triggersIrmaa: taxResult.irmaa > 0,
    });
  }

  return {
    years,
    lifetimeTax,
    rmdAt73,
    finalBalance: tradBal + rothBal,
  };
}

export function modelRothLadder(input: RothLadderInput): RothLadderOutput {
  const baseline = runScenario(input, false);
  const ladder = runScenario(input, true);

  const ladderConversionTotal = ladder.years.reduce((s, y) => s + y.conversion, 0);
  const conversionWindowYears = ladder.years.filter(y => y.conversion > 0).length;

  // Years where the ladder caused IRMAA to fire that the baseline avoided.
  const irmaaTrippedAges: number[] = [];
  for (let i = 0; i < ladder.years.length; i++) {
    if (ladder.years[i].triggersIrmaa && !baseline.years[i].triggersIrmaa) {
      irmaaTrippedAges.push(ladder.years[i].age);
    }
  }

  return {
    baseline,
    ladder,
    taxSaved: baseline.lifetimeTax - ladder.lifetimeTax,
    ladderConversionTotal,
    conversionWindowYears,
    irmaaTrippedAges,
  };
}
