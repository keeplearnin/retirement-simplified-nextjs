/**
 * monteCarloEngine.js — pure Monte Carlo simulation engine.
 *
 * Extracted from MonteCarlo.jsx so the math is testable and reusable.
 *
 * Two correctness fixes vs. the original inline version:
 *   1. Inflation now compounds from TODAY, not from the retirement date.
 *      Returns are nominal, so spending must be nominal too — the old
 *      exponent (y - years - 1) started retirement spending at today's
 *      dollar value, understating it by (1+i)^yearsToRetire and inflating
 *      success rates badly for younger users (2x for a 35-year-old at 2.5%).
 *   2. Social Security is netted against spending. My Plan's projection
 *      includes SS; the simulation previously ignored it, so the two
 *      flagship numbers couldn't be reconciled. SS is COLA'd at the same
 *      inflation rate (its statutory behavior, to a first approximation).
 *
 * Pure function — no React, deterministic given a seeded RNG (pass `rng`
 * for tests; defaults to Math.random).
 */

export function runSimulation({
  savings,
  monthly,
  salaryGrowth,
  annualSpend,
  inflationPct,
  age,
  retireAge,
  endAge,
  avgReturn,
  stdDev,
  runs,
  ssMonthly = 0,
  ssStartAge = 67,
  rng = Math.random,
}) {
  const years = retireAge - age;
  const retirementYears = endAge - retireAge;
  const totalYears = years + retirementYears;
  const paths = [];
  let successes = 0;
  const percentiles = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  const salGrowthRate = salaryGrowth / 100;
  const inflationRate = inflationPct / 100;

  for (let i = 0; i < runs; i++) {
    let bal = savings;
    const path = [bal];
    let failed = false;
    for (let y = 1; y <= totalYears; y++) {
      // Box-Muller normal draw
      const u1 = Math.max(1e-10, rng()), u2 = rng();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const r = avgReturn + stdDev * z;
      // Inflation index from TODAY — keeps spending and SS in the same
      // nominal terms as the returns.
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
      if (bal < 0) { bal = 0; failed = true; }
      path.push(bal);
    }
    paths.push(path);
    if (!failed && bal > 0) successes++;
  }

  for (let y = 0; y <= totalYears; y++) {
    const vals = paths.map(p => p[y]).sort((a, b) => a - b);
    percentiles.p10.push(vals[Math.floor(runs * 0.1)]);
    percentiles.p25.push(vals[Math.floor(runs * 0.25)]);
    percentiles.p50.push(vals[Math.floor(runs * 0.5)]);
    percentiles.p75.push(vals[Math.floor(runs * 0.75)]);
    percentiles.p90.push(vals[Math.floor(runs * 0.9)]);
  }

  return { percentiles, successRate: successes / runs, totalYears, years, retirementYears };
}
