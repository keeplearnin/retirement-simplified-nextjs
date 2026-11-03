/**
 * planOdds.js — the odds that the user's real plan lasts.
 *
 * Runs computeProjection (taxes, RMDs, healthcare, long-term care, Social
 * Security, survivor years — everything My Plan models) through many market
 * sequences instead of one steady return. My Plan's score and the Monte
 * Carlo tab both read from here, so the app gives one answer.
 *
 * Two sources of sequences:
 *   runPlanOdds    — random years around the plan's expected return
 *   runPlanHistory — every real US market sequence since 1928
 *
 * Pure module — deterministic for a given seed, no React.
 */

import { computeProjection } from './computeProjection';
import { HISTORICAL_RETURNS, HISTORICAL_START_YEAR } from './historicalReturns';

// Return / volatility of common stock-bond mixes (Ibbotson SBBI, Vanguard,
// DFA). The plan stores only an expected return, so its risk is read off
// this curve: a 7% plan is treated like a ~50/50 mix with ~9% volatility.
const MIXES = [
  { stockPct: 0.2, avgReturn: 5.0, stdDev: 5.5 },
  { stockPct: 0.4, avgReturn: 6.3, stdDev: 7.8 },
  { stockPct: 0.6, avgReturn: 7.6, stdDev: 10.3 },
  { stockPct: 0.7, avgReturn: 8.2, stdDev: 12.0 },
  { stockPct: 0.8, avgReturn: 8.8, stdDev: 13.8 },
  { stockPct: 0.9, avgReturn: 9.4, stdDev: 15.5 },
];

// One set of cut-offs for every screen that shows the odds. 80% is the
// common planner bar; below 60% the plan needs a real change.
export const ON_TRACK_ODDS = 0.8;
export function oddsLabel(rate) {
  if (rate >= 0.9) return { label: 'Strong', color: 'var(--accent)', tone: 'good' };
  if (rate >= ON_TRACK_ODDS) return { label: 'On track', color: 'var(--accent)', tone: 'good' };
  if (rate >= 0.6) return { label: 'Borderline', color: 'var(--warn)', tone: 'caution' };
  return { label: 'At risk', color: 'var(--danger)', tone: 'danger' };
}

/** Volatility (%) and stock share implied by an expected return (%). */
export function impliedMix(expectedReturnPct) {
  const r = Number.isFinite(expectedReturnPct) ? expectedReturnPct : 7;
  if (r <= MIXES[0].avgReturn) return { stdDev: MIXES[0].stdDev, stockPct: MIXES[0].stockPct };
  for (let k = 1; k < MIXES.length; k++) {
    const lo = MIXES[k - 1], hi = MIXES[k];
    if (r <= hi.avgReturn) {
      const t = (r - lo.avgReturn) / (hi.avgReturn - lo.avgReturn);
      return {
        stdDev: lo.stdDev + t * (hi.stdDev - lo.stdDev),
        stockPct: lo.stockPct + t * (hi.stockPct - lo.stockPct),
      };
    }
  }
  const top = MIXES[MIXES.length - 1];
  return { stdDev: top.stdDev, stockPct: top.stockPct };
}

// Small seeded PRNG (mulberry32) so a plan always shows the same odds —
// a score that jitters on every render reads as broken.
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function yearsInPlan(plan) {
  return computeProjection(plan).combined.length;
}

// One plan, many return sequences → success rate + balance percentiles.
function summarize(plan, shockSets, returnDrag) {
  const shortAges = [];
  const okRuns = [];
  const balances = []; // balances[run][year]
  let ages = [];
  for (const returnShocks of shockSets) {
    const p = computeProjection(plan, { returnShocks, returnDrag });
    if (!ages.length) ages = p.combined.map(r => r.age);
    okRuns.push(p.firstGapAge === undefined); // never short of money
    shortAges.push(p.firstGapAge ?? Infinity); // age it runs short, or never
    balances.push(p.combined.map(r => Math.max(0, r.availableBalance)));
  }
  const successes = okRuns.filter(Boolean).length;
  const runs = shockSets.length;
  const pct = (q) => ages.map((_, y) => {
    const col = balances.map(b => b[y]).sort((a, b) => a - b);
    return col[Math.min(col.length - 1, Math.floor(q * col.length))];
  });
  const sortedShort = [...shortAges].sort((a, b) => a - b);
  return {
    successRate: runs ? successes / runs : 0,
    runs,
    successes,
    ages,
    percentiles: { p10: pct(0.1), p25: pct(0.25), p50: pct(0.5), p75: pct(0.75), p90: pct(0.9) },
    // "In a bad market (1 in 10), money runs out at X" — null if even the
    // 10th-worst-percent market never runs short.
    p10LastsAge: Number.isFinite(sortedShort[Math.floor(0.1 * runs)]) ? sortedShort[Math.floor(0.1 * runs)] : null,
    shortAges,
    okRuns,
  };
}

/** Odds across random market years around the plan's expected return. */
export function runPlanOdds(plan, { runs = 500, seed = 1 } = {}) {
  const { stdDev } = impliedMix(plan.expectedReturn);
  const sd = stdDev / 100;
  const n = yearsInPlan(plan);
  const rng = makeRng(seed);
  const shockSets = [];
  for (let k = 0; k < runs; k++) {
    const shocks = new Array(n);
    for (let y = 0; y < n; y += 2) {
      // Box-Muller gives two independent normals per draw.
      const u1 = Math.max(1e-10, rng()), u2 = rng();
      const m = Math.sqrt(-2 * Math.log(u1));
      shocks[y] = sd * m * Math.cos(2 * Math.PI * u2);
      if (y + 1 < n) shocks[y + 1] = sd * m * Math.sin(2 * Math.PI * u2);
    }
    shockSets.push(shocks);
  }
  // The plan's return is a long-run compound rate, so the steady path My
  // Plan draws is the middle case; returnDrag keeps volatility from
  // dragging that middle below it (see computeProjection).
  return { ...summarize(plan, shockSets, (sd * sd) / 2), stdDev };
}

/**
 * "How much can I spend?" — the highest everyday retirement spending (today's
 * dollars a year; healthcare and long-term care are added on top) that keeps
 * the plan's odds at `target`. Binary search, since spending more never
 * raises the odds. Fewer runs per step than the headline keep it to ~0.5s,
 * so the result is "about" the target, rounded down to $50 a month.
 */
export function sustainableSpend(plan, { target = ON_TRACK_ODDS, runs = 150, step = 600 } = {}) {
  const odds = (spend) => runPlanOdds({ ...plan, retireSpending: Math.max(1, spend) }, { runs }).successRate;
  if (odds(0) < target) return 0; // even no spending misses the target
  const current = plan.retireSpending || Math.round((plan.annualSpending || 0) * 0.8);
  let lo = 0;
  let hi = Math.max(24_000, current * 2);
  while (odds(hi) >= target && hi < 5_000_000) { lo = hi; hi *= 2; }
  while (hi - lo > step) {
    const mid = (lo + hi) / 2;
    if (odds(mid) >= target) lo = mid; else hi = mid;
  }
  return Math.floor(lo / step) * step;
}

// Balances that swing with a stock/bond portfolio. Cash, pensions,
// annuities, real estate and 529s don't move with the market.
const MARKET_BALANCES = [
  'savings401k', 'savingsRoth', 'savingsHSA', 'savingsTaxable', 'savingsCrypto',
  'spouseSavings401k', 'spouseSavingsRoth', 'spouseSavingsHSA',
];
export const MARKET_MOVE = 0.2;

/**
 * Guardrails for "You can spend": what it becomes if invested balances fall
 * or rise 20% today. A plan for what to do after a big market move, not a
 * forecast. { low, high } a year in today's dollars; low is 0 when the
 * fall would put 80% odds out of reach.
 */
export function spendingRange(plan, opts) {
  const moved = (f) => ({
    ...plan,
    ...Object.fromEntries(MARKET_BALANCES.map(k => [k, (plan[k] || 0) * f])),
  });
  return {
    low: sustainableSpend(moved(1 - MARKET_MOVE), opts),
    high: sustainableSpend(moved(1 + MARKET_MOVE), opts),
  };
}

/**
 * Replays the plan through every complete real sequence since 1928, using
 * a stock/bond blend matched to the plan's expected return. Each year keeps
 * its real size and order (1929, the 1970s, 2008), re-centered on the
 * plan's own return the same way as runPlanOdds — so history tests the
 * timing of bad years, not a different average. Inflation stays the plan's.
 */
export function runPlanHistory(plan) {
  const { stockPct } = impliedMix(plan.expectedReturn);
  const n = yearsInPlan(plan);
  const blended = HISTORICAL_RETURNS.map(([s, b]) => stockPct * s + (1 - stockPct) * b);
  const mean = blended.reduce((a, r) => a + r, 0) / blended.length;
  const variance = blended.reduce((a, r) => a + (r - mean) ** 2, 0) / blended.length;
  const shockSets = [];
  const startYears = [];
  for (let start = 0; start + n <= blended.length; start++) {
    shockSets.push(blended.slice(start, start + n).map(r => r - mean));
    startYears.push(HISTORICAL_START_YEAR + start);
  }
  const summary = summarize(plan, shockSets, variance / 2);
  const failures = startYears
    .map((startYear, k) => ({ startYear, shortAge: summary.shortAges[k], ok: summary.okRuns[k] }))
    .filter(o => !o.ok);
  return { ...summary, stockPct, failures };
}
