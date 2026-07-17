/**
 * equityComp.ts — Equity compensation engine for RSUs, ISOs, NSOs, and ESPP.
 *
 * Self-contained (no imports from other project files) so it can be unit-tested
 * in isolation and reused by the tab, the Decision Engine, and the AI agent.
 *
 * What this models (planning-grade, not tax-prep grade):
 *   • RSU vesting schedules → ordinary income at vest, the withholding gap trap,
 *     and the taxable shares (with FMV cost basis) that result.
 *   • ISO exercise → AMT preference (bargain element), the AMT crossover point
 *     ("how many shares can I exercise before I owe AMT?"), and qualifying vs.
 *     disqualifying disposition treatment.
 *   • NSO exercise → ordinary income on the spread at exercise.
 *   • ESPP → discount value, effective annualized return, and qualifying vs.
 *     disqualifying disposition ordinary-income split.
 *   • Single-stock concentration risk vs. total net worth.
 *
 * Tax constants are 2026 estimates; each is commented with its basis. These are
 * inflation-adjusted projections from the 2025 figures — refresh when the IRS
 * publishes final 2026 numbers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GrantType = 'rsu' | 'iso' | 'nso' | 'espp';
export type FilingStatus = 'single' | 'mfj';
export type VestFrequency = 'monthly' | 'quarterly' | 'annual';

export interface EquityGrant {
  id: string;
  type: GrantType;
  label: string;
  /** ISO date (YYYY-MM-DD) the grant/offering starts. */
  grantDate: string;
  /** Total shares granted (RSU/ISO/NSO) or shares purchased this period (ESPP). */
  shares: number;
  /** FMV per share at grant — reference point for growth projection. */
  grantPrice: number;

  // Options only (ISO/NSO)
  strikePrice?: number;

  // Vesting (RSU/ISO/NSO). ESPP purchases are immediate, so these are ignored.
  vestYears?: number;      // total vesting period, e.g. 4
  cliffMonths?: number;    // e.g. 12 (one-year cliff); 0 = no cliff
  vestFrequency?: VestFrequency;

  // ESPP only
  discountPct?: number;    // e.g. 15
  lookback?: boolean;      // lookback provision (price = lower of offer/purchase)
  offeringPrice?: number;  // FMV at offering start (for lookback)
}

export interface MarketAssumptions {
  /** Current FMV per share. */
  currentPrice: number;
  /** Expected annual price growth (decimal, e.g. 0.08). Can be negative. */
  annualGrowth: number;
  /** Marginal ordinary rate applied to vest/exercise income (decimal). */
  marginalRate: number;
  /** Employer supplemental withholding rate on RSU vests (decimal). Federal
   *  default is 22% (37% on supplemental wages over $1M/yr). */
  withholdingRate: number;
  filingStatus: FilingStatus;
  /** Other ordinary income for the year (salary etc.) — used for AMT. */
  otherOrdinaryIncome?: number;
  /** Long-term capital gains rate (decimal). Default 0.15. */
  ltcgRate?: number;
}

export interface VestEvent {
  date: string;          // ISO date
  year: number;          // calendar year
  monthsFromNow: number; // whole months from today (negative = already vested)
  shares: number;
  pricePerShare: number; // projected FMV at vest
  value: number;         // shares × price
  vested: boolean;       // has this event already occurred?
}

// ---------------------------------------------------------------------------
// 2026 tax constants (estimates — see file header)
// ---------------------------------------------------------------------------

/** AMT exemption amounts (2026 est., inflation-adjusted from 2025's
 *  $88,100 / $137,000). */
export const AMT_EXEMPTION: Record<FilingStatus, number> = {
  single: 90_100,
  mfj: 140_200,
};

/** AMTI at which the exemption begins to phase out at 25 cents on the dollar
 *  (2026 est., from 2025's $626,350 / $1,252,700). */
export const AMT_PHASEOUT_START: Record<FilingStatus, number> = {
  single: 639_300,
  mfj: 1_278_575,
};

/** AMTI threshold where the AMT rate steps 26% → 28% (2026 est., from 2025's
 *  $239,100; half that for MFS but we don't model MFS). */
export const AMT_RATE_THRESHOLD = 244_000;
export const AMT_RATE_LOW = 0.26;
export const AMT_RATE_HIGH = 0.28;

/** Supplemental wage withholding: flat 22%, or 37% on amounts over $1M/yr. */
export const SUPPLEMENTAL_WITHHOLDING = 0.22;
export const SUPPLEMENTAL_WITHHOLDING_HIGH = 0.37;
export const SUPPLEMENTAL_HIGH_THRESHOLD = 1_000_000;

const DEFAULT_LTCG_RATE = 0.15;
const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.4375;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_MONTH;
}

/** Project a share price `months` from now under compounding annual growth.
 *  Defensive: a growth rate below −100% would make the base negative and a
 *  fractional exponent yield NaN — clamp the base to 0 (price floors at $0,
 *  never goes imaginary). Non-finite inputs collapse to the current price. */
export function projectPrice(currentPrice: number, annualGrowth: number, months: number): number {
  if (!Number.isFinite(currentPrice)) return 0;
  if (!Number.isFinite(annualGrowth) || !Number.isFinite(months)) return currentPrice;
  const years = months / 12;
  const base = Math.max(0, 1 + annualGrowth);
  return currentPrice * Math.pow(base, years);
}

// ---------------------------------------------------------------------------
// Vesting schedule (RSU / ISO / NSO)
// ---------------------------------------------------------------------------

/**
 * Build the discrete vest events for a grant. A cliff releases the pro-rata
 * portion of shares that would have vested up to the cliff date in one lump;
 * the remainder vests evenly at `vestFrequency` for the rest of the term.
 * ESPP grants (immediate purchase) return a single vested event on grantDate.
 */
export function projectVesting(grant: EquityGrant, market: MarketAssumptions, now: Date = new Date()): VestEvent[] {
  const start = new Date(grant.grantDate);
  if (isNaN(start.getTime())) return [];

  const mkEvent = (date: Date, shares: number): VestEvent => {
    const m = monthsBetween(now, date);
    return {
      date: date.toISOString().slice(0, 10),
      year: date.getFullYear(),
      monthsFromNow: Math.round(m),
      shares,
      pricePerShare: projectPrice(market.currentPrice, market.annualGrowth, Math.max(0, m)),
      value: 0, // filled below
      vested: date.getTime() <= now.getTime(),
    };
  };

  if (grant.type === 'espp') {
    const ev = mkEvent(start, grant.shares);
    ev.value = ev.shares * ev.pricePerShare;
    return [ev];
  }

  const vestYears = grant.vestYears ?? 4;
  const cliffMonths = grant.cliffMonths ?? 0;
  const freq = grant.vestFrequency ?? 'monthly';
  const stepMonths = freq === 'monthly' ? 1 : freq === 'quarterly' ? 3 : 12;
  const totalMonths = Math.round(vestYears * 12);
  if (totalMonths <= 0 || grant.shares <= 0) return [];

  const events: { date: Date; shares: number }[] = [];
  const perMonth = grant.shares / totalMonths;

  if (cliffMonths > 0) {
    const cliffDate = new Date(start);
    cliffDate.setMonth(cliffDate.getMonth() + cliffMonths);
    events.push({ date: cliffDate, shares: perMonth * cliffMonths });
  }

  // Remaining vests after the cliff, stepping by frequency.
  let m = Math.max(cliffMonths, stepMonths);
  // Align the first post-cliff tranche to the next step boundary after cliff.
  if (cliffMonths > 0) m = cliffMonths + stepMonths;
  for (; m <= totalMonths; m += stepMonths) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + m);
    events.push({ date: d, shares: perMonth * stepMonths });
  }

  // Reconcile rounding so total shares are preserved exactly.
  const allocated = events.reduce((s, e) => s + e.shares, 0);
  const drift = grant.shares - allocated;
  if (events.length > 0 && Math.abs(drift) > 1e-9) {
    events[events.length - 1].shares += drift;
  }

  return events.map(e => {
    const ev = mkEvent(e.date, e.shares);
    ev.value = ev.shares * ev.pricePerShare;
    return ev;
  });
}

// ---------------------------------------------------------------------------
// RSU analysis — vest income + the withholding gap
// ---------------------------------------------------------------------------

export interface RSUYearSummary {
  year: number;
  sharesVesting: number;
  ordinaryIncome: number;   // FMV at vest = taxable comp
  taxOwed: number;          // ordinaryIncome × marginalRate
  withheld: number;         // ordinaryIncome × withholdingRate (sell-to-cover)
  withholdingGap: number;   // taxOwed − withheld (positive = you'll owe more)
}

export function analyzeRSU(grant: EquityGrant, market: MarketAssumptions, now: Date = new Date()): RSUYearSummary[] {
  const events = projectVesting(grant, market, now);
  const byYear = new Map<number, VestEvent[]>();
  for (const e of events) {
    if (!byYear.has(e.year)) byYear.set(e.year, []);
    byYear.get(e.year)!.push(e);
  }
  const out: RSUYearSummary[] = [];
  for (const [year, evs] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const ordinaryIncome = evs.reduce((s, e) => s + e.value, 0);
    const sharesVesting = evs.reduce((s, e) => s + e.shares, 0);
    const whRate = ordinaryIncome > SUPPLEMENTAL_HIGH_THRESHOLD
      ? SUPPLEMENTAL_WITHHOLDING_HIGH
      : market.withholdingRate;
    const taxOwed = ordinaryIncome * market.marginalRate;
    const withheld = ordinaryIncome * whRate;
    out.push({
      year,
      sharesVesting,
      ordinaryIncome,
      taxOwed,
      withheld,
      withholdingGap: taxOwed - withheld,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// AMT — the engine behind ISO exercise planning
// ---------------------------------------------------------------------------

export interface AMTResult {
  regularTax: number;   // ordinary tax on regularTaxableIncome (approx.)
  amti: number;         // alternative minimum taxable income
  exemption: number;    // AMT exemption after phaseout
  tentativeMinTax: number;
  amtDue: number;       // amount by which AMT exceeds regular tax (>= 0)
}

/**
 * Compute AMT for a year given a regular-tax estimate and the ISO bargain
 * element (the AMT preference item). We take `regularTax` as an input rather
 * than recomputing ordinary brackets here — callers already have the main tax
 * engine for that — and focus on the AMT-specific mechanics.
 */
export function computeAMT(
  regularTaxableIncome: number,
  regularTax: number,
  isoBargainElement: number,
  filing: FilingStatus,
): AMTResult {
  const amti = Math.max(0, regularTaxableIncome + isoBargainElement);

  // Exemption phases out 25¢ per $1 of AMTI over the threshold.
  const phaseoutStart = AMT_PHASEOUT_START[filing];
  const rawExemption = AMT_EXEMPTION[filing];
  const phaseout = Math.max(0, (amti - phaseoutStart) * 0.25);
  const exemption = Math.max(0, rawExemption - phaseout);

  const amtBase = Math.max(0, amti - exemption);
  const tentativeMinTax =
    amtBase <= AMT_RATE_THRESHOLD
      ? amtBase * AMT_RATE_LOW
      : AMT_RATE_THRESHOLD * AMT_RATE_LOW + (amtBase - AMT_RATE_THRESHOLD) * AMT_RATE_HIGH;

  return {
    regularTax,
    amti,
    exemption,
    tentativeMinTax,
    amtDue: Math.max(0, tentativeMinTax - regularTax),
  };
}

// ---------------------------------------------------------------------------
// ISO exercise analysis + AMT crossover
// ---------------------------------------------------------------------------

export interface ISOAnalysis {
  vestedShares: number;
  bargainElementPerShare: number;  // currentPrice − strike
  totalBargainElement: number;
  amtDue: number;                  // AMT triggered by exercising all vested ISOs
  /** Max ISO shares exercisable this year before AMT exceeds regular tax by
   *  more than $0 — the classic "how much can I exercise AMT-free?" number. */
  amtFreeShares: number;
  amtFreeValue: number;            // amtFreeShares × currentPrice
  inTheMoney: boolean;
}

export function analyzeISO(
  grant: EquityGrant,
  market: MarketAssumptions,
  regularTax: number,
  now: Date = new Date(),
): ISOAnalysis {
  const strike = grant.strikePrice ?? 0;
  const price = market.currentPrice;
  const bargainPerShare = Math.max(0, price - strike);
  const vestedShares = projectVesting(grant, market, now)
    .filter(e => e.vested)
    .reduce((s, e) => s + e.shares, 0);
  const totalBargain = bargainPerShare * vestedShares;
  const otherIncome = market.otherOrdinaryIncome ?? 0;

  const full = computeAMT(otherIncome, regularTax, totalBargain, market.filingStatus);

  // Binary-search the largest bargain element that keeps amtDue at ~0.
  let lo = 0, hi = totalBargain;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const r = computeAMT(otherIncome, regularTax, mid, market.filingStatus);
    if (r.amtDue > 1) hi = mid; else lo = mid;
  }
  const amtFreeBargain = lo;
  const amtFreeShares = bargainPerShare > 0 ? Math.floor(amtFreeBargain / bargainPerShare) : vestedShares;

  return {
    vestedShares,
    bargainElementPerShare: bargainPerShare,
    totalBargainElement: totalBargain,
    amtDue: full.amtDue,
    amtFreeShares: Math.min(vestedShares, amtFreeShares),
    amtFreeValue: Math.min(vestedShares, amtFreeShares) * price,
    inTheMoney: price > strike,
  };
}

// ---------------------------------------------------------------------------
// ESPP analysis
// ---------------------------------------------------------------------------

export interface ESPPAnalysis {
  purchasePrice: number;     // price actually paid per share (after discount/lookback)
  marketPrice: number;       // FMV at purchase
  discountValue: number;     // (market − purchase) × shares — the "instant" gain
  discountPct: number;       // effective discount off market
  annualizedReturn: number;  // return on capital over the ~6-month offering
  qualifyingOrdinary: number;   // ordinary income if held to qualifying disposition
  disqualifyingOrdinary: number;// ordinary income if sold immediately (disqualifying)
}

/**
 * ESPP with the standard 15% discount and optional lookback. Purchase price is
 * the lower of the offering-start and purchase-date FMV (lookback) or just the
 * purchase-date FMV, times (1 − discount).
 */
export function analyzeESPP(grant: EquityGrant, market: MarketAssumptions): ESPPAnalysis {
  const discount = (grant.discountPct ?? 15) / 100;
  const marketPrice = market.currentPrice;
  const basisPrice = grant.lookback && grant.offeringPrice
    ? Math.min(grant.offeringPrice, marketPrice)
    : marketPrice;
  const purchasePrice = basisPrice * (1 - discount);
  const shares = grant.shares;

  const discountValue = (marketPrice - purchasePrice) * shares;
  const effDiscountPct = marketPrice > 0 ? (marketPrice - purchasePrice) / marketPrice : 0;

  // Return on capital over a ~6-month offering, annualized.
  const invested = purchasePrice * shares;
  const gain = discountValue;
  const periodReturn = invested > 0 ? gain / invested : 0;
  const annualizedReturn = Math.pow(1 + periodReturn, 2) - 1; // two 6-month periods

  // Disqualifying (sell right away): ordinary income = FMV@purchase − purchase price.
  const disqualifyingOrdinary = (marketPrice - purchasePrice) * shares;
  // Qualifying (held 2yr from offering + 1yr from purchase): ordinary income is
  // the lesser of the actual gain and the discount on the OFFERING price.
  const offering = grant.offeringPrice ?? marketPrice;
  const qualifyingOrdinary = Math.min(disqualifyingOrdinary, offering * discount * shares);

  return {
    purchasePrice,
    marketPrice,
    discountValue,
    discountPct: effDiscountPct,
    annualizedReturn,
    qualifyingOrdinary,
    disqualifyingOrdinary,
  };
}

// ---------------------------------------------------------------------------
// Concentration risk
// ---------------------------------------------------------------------------

export type RiskLevel = 'low' | 'moderate' | 'high' | 'severe';

export interface ConcentrationResult {
  equityValue: number;
  netWorth: number;
  pct: number;
  level: RiskLevel;
  message: string;
}

export function concentrationRisk(equityValue: number, netWorth: number): ConcentrationResult {
  const total = Math.max(equityValue, netWorth);
  const pct = total > 0 ? equityValue / total : 0;
  let level: RiskLevel;
  let message: string;
  if (pct < 0.1) {
    level = 'low';
    message = 'Company stock is a small slice of your net worth — diversification risk is low.';
  } else if (pct < 0.25) {
    level = 'moderate';
    message = 'A meaningful chunk of your wealth rides on one stock. Keep an eye on it as more vests.';
  } else if (pct < 0.5) {
    level = 'high';
    message = 'Over a quarter of your net worth is in a single stock. Consider a scheduled sell-down (e.g. a 10b5-1 plan) to diversify.';
  } else {
    level = 'severe';
    message = 'Most of your net worth is concentrated in one company. A single bad quarter could reset your retirement — diversifying should be a priority.';
  }
  return { equityValue, netWorth, pct, level, message };
}

// ---------------------------------------------------------------------------
// Portfolio-level aggregation
// ---------------------------------------------------------------------------

export interface EquitySummary {
  vestedValue: number;
  unvestedValue: number;
  totalValue: number;
  next12moVestIncome: number;   // ordinary income vesting in the next 12 months
  next12moWithholdingGap: number;
  lifetimeVestIncome: number;
  vestEvents: VestEvent[];       // all future events across grants, sorted by date
}

export function summarizeEquity(
  grants: EquityGrant[],
  market: MarketAssumptions,
  now: Date = new Date(),
): EquitySummary {
  let vestedValue = 0, unvestedValue = 0, next12moVestIncome = 0, lifetimeVestIncome = 0;
  const all: VestEvent[] = [];

  for (const grant of grants) {
    const events = projectVesting(grant, market, now);
    for (const e of events) {
      all.push(e);
      if (e.vested) {
        vestedValue += e.value;
      } else {
        unvestedValue += e.value;
        lifetimeVestIncome += e.value;
        if (e.monthsFromNow <= 12) next12moVestIncome += e.value;
      }
    }
  }

  const whRate = next12moVestIncome > SUPPLEMENTAL_HIGH_THRESHOLD
    ? SUPPLEMENTAL_WITHHOLDING_HIGH
    : market.withholdingRate;
  const next12moWithholdingGap = next12moVestIncome * (market.marginalRate - whRate);

  all.sort((a, b) => a.date.localeCompare(b.date));

  return {
    vestedValue,
    unvestedValue,
    totalValue: vestedValue + unvestedValue,
    next12moVestIncome,
    next12moWithholdingGap: Math.max(0, next12moWithholdingGap),
    lifetimeVestIncome,
    vestEvents: all,
  };
}
