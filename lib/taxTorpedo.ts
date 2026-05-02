/**
 * taxTorpedo.ts — analyze the Social Security "tax torpedo" zone.
 *
 * In the income range where each extra $1 of ordinary income causes $0.85 of
 * Social Security to become taxable, the effective marginal rate balloons —
 * commonly to ~40% even when the user is in the 22% federal bracket. Most
 * planners aren't aware until they see it.
 *
 * Pure logic, no React.
 */

import { computeTax, computeSSTaxable } from './taxEngine';

export interface TorpedoInput {
  filingStatus: 'single' | 'mfj';
  socialSecurityBenefit: number;     // annual SS gross
  otherOrdinaryIncome: number;       // pension, salary, etc. (excluding the IRA withdrawal we're varying)
  iraWithdrawal: number;             // the variable being moved
  capitalGains: number;
  stateCode: string;
  age: number;
}

export interface TorpedoResult {
  /** Provisional income = AGI + 50% of SS + tax-exempt interest. */
  provisionalIncome: number;
  /** % of SS that becomes taxable: 0, 50, or 85. */
  ssTaxablePercent: number;
  /** Tax payable at this withdrawal level. */
  totalTax: number;
  /** Effective marginal rate on the next $1,000 of IRA withdrawal. */
  effectiveMarginalRate: number;
  /** True when extra IRA $ is dragging more SS into the taxable base. */
  inTorpedoZone: boolean;
  /** The two thresholds that bound the torpedo zone for the user's filing status. */
  torpedoZone: { start: number; end: number };
}

const STEP = 1000; // $1,000 marginal step for measuring effective rate

export function analyzeTaxTorpedo(input: TorpedoInput): TorpedoResult {
  const ordinaryIncome = input.otherOrdinaryIncome + input.iraWithdrawal;

  const taxNow = computeTax({
    filingStatus: input.filingStatus,
    ordinaryIncome,
    socialSecurityBenefit: input.socialSecurityBenefit,
    capitalGains: input.capitalGains,
    stateCode: input.stateCode,
    age: input.age,
  });

  // Probe one step up to measure the actual effective marginal rate. If the
  // step crosses the SS-taxability threshold, the rate balloons.
  const taxNext = computeTax({
    filingStatus: input.filingStatus,
    ordinaryIncome: ordinaryIncome + STEP,
    socialSecurityBenefit: input.socialSecurityBenefit,
    capitalGains: input.capitalGains,
    stateCode: input.stateCode,
    age: input.age,
  });
  const effectiveMarginalRate = (taxNext.totalTax - taxNow.totalTax) / STEP;

  // The IRS provisional income test thresholds (statutory 1983, never indexed).
  const provIncome = ordinaryIncome + input.capitalGains + input.socialSecurityBenefit * 0.5;
  const start = input.filingStatus === 'mfj' ? 32000 : 25000;
  const end = input.filingStatus === 'mfj' ? 44000 : 34000;

  // The taxable-percent of SS at this income level.
  const ssCalc = computeSSTaxable(input.socialSecurityBenefit, ordinaryIncome + input.capitalGains, input.filingStatus);

  // We're in the torpedo zone when bumping ordinary income increases the
  // taxable-SS portion (i.e., we're not yet at the 85% cap and we're past the
  // first threshold).
  const inTorpedoZone =
    provIncome > start &&
    ssCalc.taxablePercent < 85 &&
    effectiveMarginalRate > taxNow.marginalRate + 0.05;

  return {
    provisionalIncome: provIncome,
    ssTaxablePercent: ssCalc.taxablePercent,
    totalTax: taxNow.totalTax,
    effectiveMarginalRate,
    inTorpedoZone,
    torpedoZone: { start, end },
  };
}

/**
 * Sweep the IRA withdrawal axis and return a series of (withdrawal, marginal
 * rate) points. Useful for charting the torpedo zone.
 */
export function sweepTaxTorpedo(
  base: Omit<TorpedoInput, 'iraWithdrawal'>,
  maxWithdrawal: number,
  resolution: number = 50,
): { withdrawal: number; effectiveMarginalRate: number; ssTaxablePercent: number; provisionalIncome: number; }[] {
  const series = [];
  for (let i = 0; i <= resolution; i++) {
    const withdrawal = (maxWithdrawal * i) / resolution;
    const r = analyzeTaxTorpedo({ ...base, iraWithdrawal: withdrawal });
    series.push({
      withdrawal,
      effectiveMarginalRate: r.effectiveMarginalRate,
      ssTaxablePercent: r.ssTaxablePercent,
      provisionalIncome: r.provisionalIncome,
    });
  }
  return series;
}
