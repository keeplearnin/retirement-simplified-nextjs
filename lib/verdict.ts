/**
 * verdict.ts — pure logic for the "where do I stand?" verdict screen (F-05).
 *
 * Inputs are 3 questions: age, savings, income. Outputs a verdict with a
 * specific dollar gap vs. the Fidelity age-based savings benchmark, plus
 * a small ranked list of quantified actions.
 *
 * Self-contained: no React, no localStorage. Safe to import anywhere.
 */

export interface VerdictInput {
  currentAge: number;
  retirementAge: number;
  annualIncome: number;
  currentSavings: number;
  monthlyContribution: number;
  filingStatus: 'single' | 'mfj';
}

export type GapStatus = 'ahead' | 'on-track' | 'behind' | 'significantly-behind';

export interface ActionItem {
  id: string;
  action: string;
  detail: string;
  dollarImpact: number; // 10-year FV of the change
  urgency: 'immediate' | 'this-year' | 'this-decade';
}

export interface VerdictOutput {
  benchmarkSavings: number;
  savingsGap: number; // benchmark - current. Positive = behind, negative = ahead.
  gapStatus: GapStatus;
  projectedBalance: number; // at retirement, at 7% growth, with current contributions
  estimatedNeed: number; // annualIncome * 25 (4% SWR baseline)
  shortfallAtRetirement: number; // estimatedNeed - projectedBalance. Positive = short.
  verdictText: string;
  topActions: ActionItem[];
}

// ---------------------------------------------------------------------------
// Fidelity age-based savings benchmark (multiple of annual income).
// Source: Fidelity Investments "How much should I have saved for retirement?"
// ---------------------------------------------------------------------------

const FIDELITY_BENCHMARKS: Record<number, number> = {
  30: 1,
  35: 2,
  40: 3,
  45: 4,
  50: 6,
  55: 7,
  60: 8,
  67: 10,
};

export function getBenchmarkMultiple(age: number): number {
  const ages = Object.keys(FIDELITY_BENCHMARKS).map(Number).sort((a, b) => a - b);
  if (age <= ages[0]) return FIDELITY_BENCHMARKS[ages[0]];
  if (age >= ages[ages.length - 1]) return FIDELITY_BENCHMARKS[ages[ages.length - 1]];
  // Linear interpolation between published milestones
  const lower = ages.filter(a => a <= age).pop() as number;
  const upper = ages.find(a => a > age) as number;
  const lowerMult = FIDELITY_BENCHMARKS[lower];
  const upperMult = FIDELITY_BENCHMARKS[upper];
  const progress = (age - lower) / (upper - lower);
  return lowerMult + (upperMult - lowerMult) * progress;
}

// ---------------------------------------------------------------------------
// Status thresholds (ratio of current savings to benchmark)
// ---------------------------------------------------------------------------

export function getGapStatus(currentSavings: number, benchmarkSavings: number): GapStatus {
  if (benchmarkSavings <= 0) return 'on-track';
  const ratio = currentSavings / benchmarkSavings;
  if (ratio >= 1.05) return 'ahead';
  if (ratio >= 0.90) return 'on-track';
  if (ratio >= 0.60) return 'behind';
  return 'significantly-behind';
}

// ---------------------------------------------------------------------------
// Future-value math
// ---------------------------------------------------------------------------

const DEFAULT_GROWTH_RATE = 0.07;

/** Future value of a present sum compounded annually. */
export function futureValueLump(present: number, years: number, rate: number = DEFAULT_GROWTH_RATE): number {
  if (years <= 0) return present;
  return present * Math.pow(1 + rate, years);
}

/** Future value of a stream of monthly contributions (compounded monthly). */
export function futureValueStream(monthlyAmount: number, years: number, rate: number = DEFAULT_GROWTH_RATE): number {
  if (years <= 0 || monthlyAmount <= 0) return 0;
  const r = rate / 12;
  const n = years * 12;
  return monthlyAmount * (Math.pow(1 + r, n) - 1) / r;
}

// ---------------------------------------------------------------------------
// Verdict copy
// ---------------------------------------------------------------------------

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export function generateVerdictText(out: VerdictOutput): string {
  const gap = Math.abs(out.savingsGap);
  switch (out.gapStatus) {
    case 'ahead':
      return `You're ${fmtUSD(gap)} ahead of the benchmark for your age and income. Your plan looks solid — but there are still optimizations worth knowing about.`;
    case 'on-track':
      return `You're roughly on track. The benchmark for someone your age and income is ${fmtUSD(out.benchmarkSavings)}, and you're close. Here's how to stay on track and avoid the hidden risks.`;
    case 'behind':
      return `You're ${fmtUSD(gap)} behind the benchmark for your age and income — but this gap is closeable. Here are the highest-impact moves you can make right now.`;
    case 'significantly-behind':
      return `You're ${fmtUSD(gap)} behind where you need to be. Retirement is still achievable with the right moves — the math is harder, but it's not impossible. Here's your catch-up plan.`;
  }
}

// ---------------------------------------------------------------------------
// Top actions — quantified, ranked
// ---------------------------------------------------------------------------

function rankActions(input: VerdictInput): ActionItem[] {
  const yearsToRetirement = Math.max(0, input.retirementAge - input.currentAge);
  const tenYears = Math.min(10, yearsToRetirement);

  const actions: ActionItem[] = [];

  // Action: bump 401(k) by 4% of salary
  const bump = (input.annualIncome * 0.04) / 12;
  actions.push({
    id: '401k-bump-4',
    action: 'Increase 401(k) contribution by 4%',
    detail: `Adds ${fmtUSD(futureValueStream(bump, tenYears))} to your balance over the next ${tenYears} years.`,
    dollarImpact: futureValueStream(bump, tenYears),
    urgency: 'this-year',
  });

  // Action: max age-50+ catch-up (only relevant if age >= 50)
  if (input.currentAge >= 50) {
    const catchUp = 8000 / 12; // 2026 catch-up = $8,000
    actions.push({
      id: 'catchup-50plus',
      action: 'Max age-50+ catch-up contributions',
      detail: `Add $8,000/yr in catch-up. Adds ${fmtUSD(futureValueStream(catchUp, tenYears))} over the next ${tenYears} years.`,
      dollarImpact: futureValueStream(catchUp, tenYears),
      urgency: 'this-year',
    });
  }

  // Action: delay SS from 67 to 70 (24% lifetime benefit increase)
  // Approximate value: 24% * estimated SS at FRA * ~17 yrs of post-70 collection
  // Rule of thumb monthly SS at FRA: 40% replacement of pre-retirement income
  const estMonthlySSAtFRA = (input.annualIncome * 0.40) / 12;
  const ssDelayValue = estMonthlySSAtFRA * 0.24 * 12 * 17;
  actions.push({
    id: 'delay-ss-70',
    action: 'Delay Social Security to age 70',
    detail: `Increases monthly benefit by 24% permanently — roughly ${fmtUSD(ssDelayValue)} more over a typical retirement.`,
    dollarImpact: ssDelayValue,
    urgency: 'this-decade',
  });

  // Action: reduce annual expenses by $5K (compound benefit on portfolio + lower need)
  const expenseReduction = 5000;
  const portfolioBoost = futureValueStream(expenseReduction / 12, tenYears);
  actions.push({
    id: 'reduce-expenses-5k',
    action: 'Reduce annual expenses by $5,000',
    detail: `Frees ${fmtUSD(expenseReduction)}/yr for savings. Compounds to ${fmtUSD(portfolioBoost)} over ${tenYears} years.`,
    dollarImpact: portfolioBoost,
    urgency: 'this-year',
  });

  return actions.sort((a, b) => b.dollarImpact - a.dollarImpact).slice(0, 3);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function computeVerdict(input: VerdictInput): VerdictOutput {
  const yearsToRetirement = Math.max(0, input.retirementAge - input.currentAge);
  const benchmarkSavings = Math.round(input.annualIncome * getBenchmarkMultiple(input.currentAge));
  const savingsGap = benchmarkSavings - input.currentSavings;
  const gapStatus = getGapStatus(input.currentSavings, benchmarkSavings);

  const projectedFromCurrent = futureValueLump(input.currentSavings, yearsToRetirement);
  const projectedFromContrib = futureValueStream(input.monthlyContribution, yearsToRetirement);
  const projectedBalance = Math.round(projectedFromCurrent + projectedFromContrib);

  const estimatedNeed = input.annualIncome * 25; // 4% SWR baseline
  const shortfallAtRetirement = Math.max(0, estimatedNeed - projectedBalance);

  const topActions = rankActions(input);

  // Build skeleton, then fill verdictText (depends on output values)
  const out: VerdictOutput = {
    benchmarkSavings,
    savingsGap,
    gapStatus,
    projectedBalance,
    estimatedNeed,
    shortfallAtRetirement,
    verdictText: '',
    topActions,
  };
  out.verdictText = generateVerdictText(out);
  return out;
}
