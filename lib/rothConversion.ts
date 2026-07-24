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

import { computeTax, computeSSTaxable, FEDERAL_BRACKET_TOPS, STANDARD_DEDUCTIONS } from './taxEngine';
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
  /** Total IRMAA Part B surcharges paid across the projection (65+ years,
   *  BOTH beneficiaries for MFJ). IRMAA is a Medicare premium, not a tax, so
   *  it's tracked separately from lifetimeTax — but conversions that trip a
   *  tier are a real cash cost. */
  lifetimeIrmaa: number;
  /** Present-value totals discounted at the scenario's portfolio return —
   *  the honest basis for comparing tax paid now vs tax paid decades later. */
  lifetimeTaxPV: number;
  lifetimeIrmaaPV: number;
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

// Bracket tops + standard deductions come from taxEngine (single source —
// a private copy here drifted risk every January constant refresh).
const BRACKET_TOPS_SINGLE = FEDERAL_BRACKET_TOPS.single;
const BRACKET_TOPS_MFJ = FEDERAL_BRACKET_TOPS.mfj;
const STD_DEDUCTION_SINGLE = STANDARD_DEDUCTIONS.single;
const STD_DEDUCTION_MFJ = STANDARD_DEDUCTIONS.mfj;

function rmdDivisor(age: number): number | null {
  if (age < RMD_START_AGE) return null;
  return RMD_TABLE[Math.min(age, 110)] ?? null;
}

function ssGrossInYear(input: RothLadderInput, age: number): number {
  if (age < input.ssStartAge) return 0;
  // 2.0% COLA — matches computeProjection's assumption (was 2.5% here,
  // which made this module's SS diverge from the baseline projection shown
  // on the same screen). No claiming-age factor: the user is assumed to
  // have entered their actual claimed monthly benefit.
  const yearsClaimed = age - input.ssStartAge;
  return input.ssMonthlyBenefit * 12 * Math.pow(1 + 0.02, yearsClaimed);
}

function pensionInYear(input: RothLadderInput, age: number): number {
  if (!input.pensionStartAge || !input.pensionMonthlyAmount) return 0;
  if (age < input.pensionStartAge) return 0;
  return input.pensionMonthlyAmount * 12;
}

function runScenario(input: RothLadderInput, withLadder: boolean): RothLadderScenario {
  let tradBal = input.tradBalance;
  let rothBal = input.rothBalance;
  const yearReturn = input.expectedReturn * (input.retiredReturnPct / 100);
  const stdDed = input.filingStatus === 'mfj' ? STD_DEDUCTION_MFJ : STD_DEDUCTION_SINGLE;
  const bracketTops = input.filingStatus === 'mfj' ? BRACKET_TOPS_MFJ : BRACKET_TOPS_SINGLE;
  const targetTaxableTop = input.targetBracket > 0 ? bracketTops[input.targetBracket] : 0;

  const years: RothLadderYear[] = [];
  let lifetimeTax = 0;
  let lifetimeIrmaa = 0;
  let lifetimeTaxPV = 0;
  let lifetimeIrmaaPV = 0;
  let rmdAt73 = 0;

  // Both spouses pay Part B, so an IRMAA tier costs an MFJ couple 2×.
  const irmaaBeneficiaries = input.filingStatus === 'mfj' ? 2 : 1;

  // Don't re-simulate years that already happened: a 64-year-old who
  // retired at 60 starts from TODAY's balances at 64, not from a replay of
  // ages 60-63 (which also produced taxYear < 2026).
  const simStartAge = Math.max(input.retireAge, input.currentAge);

  for (let age = simStartAge; age <= input.longevityAge; age++) {
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
      // We want taxable income (= ordinary + taxable SS + conversion −
      // stdDed) to land at the top of the target bracket. Two former
      // errors here: (1) the unused standard deduction was dropped —
      // `top − max(0, ordinary − stdDed)` under-filled the classic
      // no-income window by the whole deduction ($32.2K/yr MFJ, ~$419K of
      // foregone low-bracket capacity over a 13-year ladder); (2) taxable
      // SS was ignored, overshooting the bracket top by up to 0.85×SS once
      // benefits started. Taxable SS depends on the conversion itself
      // (provisional-income feedback), so fix-point it in a few passes.
      const ordinaryBeforeConversion = pension + rmd;
      let taxableSS = 0;
      let headroom = 0;
      for (let pass = 0; pass < 3; pass++) {
        headroom = Math.max(0, targetTaxableTop + stdDed - ordinaryBeforeConversion - taxableSS);
        const tentative = Math.min(headroom, tradBal);
        taxableSS = computeSSTaxable(
          ssGross, ordinaryBeforeConversion + tentative, input.filingStatus
        ).taxableAmount;
      }
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
    // Discount factor for present-value totals: a dollar of tax paid in
    // year n, funded from money that would otherwise compound at the
    // portfolio return, costs (1+r)^-n of today's dollars. Comparing
    // NOMINAL tax sums across decades made accelerating tax always look
    // "cheaper" (the baseline's tax base grows before being RMD-taxed) —
    // the optimizer reported six-figure phantom savings even when
    // conversion-year and RMD-year marginal rates were identical.
    const discount = Math.pow(1 + yearReturn, -(age - simStartAge));
    lifetimeTaxPV += totalTax * discount;
    // IRMAA only applies once on Medicare (65+). taxResult.irmaa is the
    // monthly Part B surcharge PER BENEFICIARY; annualize it and count both
    // spouses for MFJ. (Real IRMAA keys off MAGI from two years prior —
    // same-year is the approximation used app-wide.)
    if (age >= 65) {
      const irmaaYear = taxResult.irmaa * 12 * irmaaBeneficiaries;
      lifetimeIrmaa += irmaaYear;
      lifetimeIrmaaPV += irmaaYear * discount;
    }

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
    lifetimeIrmaa,
    lifetimeTaxPV,
    lifetimeIrmaaPV,
    rmdAt73,
    finalBalance: tradBal + rothBal,
  };
}

// ---------------------------------------------------------------------------
// Optimizer — sweep target brackets and pick the best net outcome
// ---------------------------------------------------------------------------

export interface RothOptimizerOption {
  targetBracket: Bracket;
  /** PRESENT-VALUE lifetime tax saved vs baseline (positive = ladder better),
   *  discounted at the portfolio return. */
  taxSaved: number;
  /** PV of extra IRMAA surcharges the ladder causes vs baseline (positive = cost). */
  irmaaCost: number;
  /** taxSaved - irmaaCost — the honest number to rank on. */
  netSaved: number;
  totalConverted: number;
  conversionYears: number;
  irmaaTrippedAges: number[];
  /** Year-by-year execution schedule (only years with a conversion). */
  schedule: Array<{ age: number; conversion: number; taxThatYear: number }>;
  output: RothLadderOutput;
}

export interface RothOptimizerResult {
  options: RothOptimizerOption[];
  /** Highest netSaved option, or null if no bracket beats the baseline. */
  best: RothOptimizerOption | null;
  baselineLifetimeTax: number;
}

/**
 * optimizeRothLadder — run the ladder at each candidate bracket and rank by
 * NET savings: lifetime tax saved minus any IRMAA surcharges the conversions
 * trigger. This is the piece competitors miss — a conversion that saves
 * $30K of income tax but trips 8 years of IRMAA tiers can be a net loser.
 */
export function optimizeRothLadder(
  input: Omit<RothLadderInput, 'targetBracket'>,
  brackets: Bracket[] = [12, 22, 24],
): RothOptimizerResult {
  const baseline = runScenario({ ...input, targetBracket: 0 }, false);

  const options: RothOptimizerOption[] = brackets.map((targetBracket) => {
    const output = modelRothLadder({ ...input, targetBracket });
    // Rank on PRESENT-VALUE savings. Nominal sums compare tax dollars paid
    // decades apart at face value, which reported large phantom savings for
    // any conversion (the deferred tax base grows before being RMD-taxed) —
    // at identical marginal rates the PV difference is correctly ≈ $0.
    const taxSaved = Math.round(output.baseline.lifetimeTaxPV - output.ladder.lifetimeTaxPV);
    const irmaaCost = Math.round(output.ladder.lifetimeIrmaaPV - output.baseline.lifetimeIrmaaPV);
    return {
      targetBracket,
      taxSaved,
      irmaaCost,
      netSaved: taxSaved - irmaaCost,
      totalConverted: Math.round(output.ladderConversionTotal),
      conversionYears: output.conversionWindowYears,
      irmaaTrippedAges: output.irmaaTrippedAges,
      schedule: output.ladder.years
        .filter((y) => y.conversion > 0)
        .map((y) => ({
          age: y.age,
          conversion: Math.round(y.conversion),
          taxThatYear: Math.round(y.totalTax),
        })),
      output,
    };
  });

  const ranked = [...options].sort((a, b) => b.netSaved - a.netSaved);
  const best = ranked[0] && ranked[0].netSaved > 0 ? ranked[0] : null;

  return { options, best, baselineLifetimeTax: Math.round(baseline.lifetimeTax) };
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
