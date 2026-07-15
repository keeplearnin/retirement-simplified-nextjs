/**
 * backtestEngine.js — historical-sequence retirement backtesting.
 *
 * Replays the user's accumulation + retirement plan through every actual
 * market sequence since 1928 (cFIREsim / FIRECalc style): a plan spanning
 * 40 years is tested against 1928–1967, 1929–1968, … each as one "what if
 * you had lived through exactly this" run.
 *
 * Complements Monte Carlo: random draws answer "what does the return
 * DISTRIBUTION imply?"; backtesting answers "would this plan have survived
 * every market history Americans actually lived through — 1929, the
 * stagflation 70s, 2000, 2008?" Sequence-of-returns risk is real in this
 * data, not synthesized.
 *
 * Same cash-flow conventions as monteCarloEngine.js so the two results are
 * directly comparable: contributions grow with salary during accumulation;
 * spending and Social Security are entered in today's dollars, inflated
 * from TODAY at the user's inflation assumption; SS (with COLA) is netted
 * against spending.
 *
 * Pure module — deterministic, no React.
 */

import { HISTORICAL_RETURNS, HISTORICAL_START_YEAR } from './historicalReturns';

export function runBacktest({
  savings,
  monthly,
  salaryGrowth,
  annualSpend,
  inflationPct,
  age,
  retireAge,
  endAge,
  stockPct, // 0..1 — bond share is the complement
  ssMonthly = 0,
  ssStartAge = 67,
  returns = HISTORICAL_RETURNS,
  startYearOffset = HISTORICAL_START_YEAR,
}) {
  const years = retireAge - age;
  const totalYears = endAge - age;
  const salGrowthRate = salaryGrowth / 100;
  const inflationRate = inflationPct / 100;
  const bondPct = 1 - stockPct;

  const sequenceCount = returns.length - totalYears + 1;
  if (sequenceCount < 1) {
    return { sequences: [], successRate: 0, percentiles: null, totalYears, years, sequenceCount: 0 };
  }

  const sequences = [];
  const paths = [];

  for (let s = 0; s < sequenceCount; s++) {
    let bal = savings;
    const path = [bal];
    let failed = false;
    let failedAtAge = null;

    for (let y = 1; y <= totalYears; y++) {
      const [stock, bond] = returns[s + y - 1];
      const r = stockPct * stock + bondPct * bond;
      const inflationIndex = Math.pow(1 + inflationRate, y - 1);
      if (y <= years) {
        const yearlyContrib = monthly * 12 * Math.pow(1 + salGrowthRate, y - 1);
        bal = bal * (1 + r) + yearlyContrib;
      } else {
        const ageThisYear = age + y;
        const ssIncome = ageThisYear >= ssStartAge ? ssMonthly * 12 * inflationIndex : 0;
        const netSpend = Math.max(0, annualSpend * inflationIndex - ssIncome);
        bal = bal * (1 + r) - netSpend;
      }
      if (bal < 0) {
        bal = 0;
        if (!failed) failedAtAge = age + y;
        failed = true;
      }
      path.push(bal);
    }

    paths.push(path);
    sequences.push({
      startYear: startYearOffset + s,
      success: !failed && bal > 0,
      failedAtAge,
      finalBalance: Math.round(bal),
      balanceAtRetirement: Math.round(path[years] ?? 0),
    });
  }

  // Percentile bands across sequences at each year index — same shape the
  // Monte Carlo chart consumes.
  const percentiles = { p10: [], p50: [], p90: [] };
  for (let y = 0; y <= totalYears; y++) {
    const vals = paths.map((p) => p[y]).sort((a, b) => a - b);
    const at = (f) => vals[Math.min(vals.length - 1, Math.floor(vals.length * f))];
    percentiles.p10.push(at(0.1));
    percentiles.p50.push(at(0.5));
    percentiles.p90.push(at(0.9));
  }

  const successes = sequences.filter((s) => s.success);
  const failures = sequences.filter((s) => !s.success);
  const byFinal = [...sequences].sort((a, b) => a.finalBalance - b.finalBalance);

  return {
    sequences,
    sequenceCount,
    successRate: successes.length / sequenceCount,
    successCount: successes.length,
    failures: failures.map((f) => ({ startYear: f.startYear, failedAtAge: f.failedAtAge })),
    worst: byFinal[0] ?? null,
    best: byFinal[byFinal.length - 1] ?? null,
    percentiles,
    totalYears,
    years,
  };
}
