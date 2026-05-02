/**
 * monteCarloInterpret.ts — turns a percentile-band simulation result into
 * a plain-English read on the user's situation.
 *
 * The MonteCarlo tab already reports "X% success rate" — but a number
 * alone isn't actionable. This helper produces a verdict + a hint at what
 * to look at next.
 */

export interface MonteCarloSummary {
  successRate: number; // 0..1
  /** Portfolio value at the median (P50) for each year — index 0 is start. */
  p50: number[];
  /** Optional P10 path so we can describe weak-scenario depletion. */
  p10: number[];
  /** Total years simulated (working + retirement). */
  totalYears: number;
  /** Years until retirement (start of drawdown). */
  yearsToRetire: number;
  /** User-set ages so we can speak in absolute terms. */
  startAge: number;
  endAge: number;
}

export interface MonteCarloInterpretation {
  /** Single-sentence verdict suitable for a hero banner. */
  headline: string;
  /** A more detailed read — depletion age in weak scenarios, what to check next. */
  detail: string;
  /** "good" | "caution" | "danger" — for color-coding the banner. */
  tone: 'good' | 'caution' | 'danger';
}

/**
 * Find the first age at which the given path hits zero. Returns null if it
 * never depletes within the simulated horizon.
 */
function depletionAge(path: number[], startAge: number): number | null {
  for (let i = 0; i < path.length; i++) {
    if (path[i] <= 0) return startAge + i;
  }
  return null;
}

export function interpretMonteCarloResult(s: MonteCarloSummary): MonteCarloInterpretation {
  const pct = Math.round(s.successRate * 100);
  const p10Depletion = depletionAge(s.p10, s.startAge);
  const p50Depletion = depletionAge(s.p50, s.startAge);

  if (s.successRate >= 0.90) {
    return {
      headline: `Your plan has a ${pct}% probability of lasting through age ${s.endAge}.`,
      detail: p10Depletion
        ? `In the weakest 10% of return scenarios, money runs short around age ${p10Depletion}. That's the tail risk — small adjustments can push that out further.`
        : `Even in the weakest 10% of return scenarios, the portfolio holds. This is a strong plan.`,
      tone: 'good',
    };
  }

  if (s.successRate >= 0.75) {
    return {
      headline: `Your plan has a ${pct}% probability of lasting through age ${s.endAge}.`,
      detail: p10Depletion
        ? `In the weakest 10% of scenarios, money runs short around age ${p10Depletion}. Small adjustments — saving $200 more/mo, working two more years, or trimming $5K of annual spending — typically push success above 90%.`
        : `Most paths hold up, but a quarter still fall short by ${s.endAge}. Consider a small contribution bump or trimming retirement spending to firm up the plan.`,
      tone: 'caution',
    };
  }

  // Below 75% — the plan needs attention
  if (p50Depletion) {
    return {
      headline: `Your plan has a ${pct}% probability of lasting through age ${s.endAge}.`,
      detail: `Even the median path runs short around age ${p50Depletion}. This needs a real adjustment — try the levers below to see what brings success above 75%.`,
      tone: 'danger',
    };
  }

  return {
    headline: `Your plan has a ${pct}% probability of lasting through age ${s.endAge}.`,
    detail: p10Depletion
      ? `In the weakest 10% of scenarios, money runs short around age ${p10Depletion}. The plan works in the median but the tail risk is significant — pick a lever below to firm it up.`
      : `Many scenarios run short before ${s.endAge}. Use the sensitivity levers below to see which adjustments move the needle.`,
    tone: 'danger',
  };
}
