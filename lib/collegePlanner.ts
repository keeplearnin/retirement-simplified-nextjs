/**
 * collegePlanner.ts — Multi-child college funding engine (529-centric).
 *
 * Self-contained (no imports from other project files) for isolated unit
 * testing and reuse by the tab, Decision Engine, and AI agent.
 *
 * What this models:
 *   • Per-child 4-year cost of attendance by school type, inflated at a
 *     college-specific rate (~5%, well above general CPI).
 *   • A year-by-year 529 simulation: growth, contributions until college
 *     begins, and drawdowns across the four college years.
 *   • Funded % / shortfall per child and the monthly contribution needed to
 *     fully fund the covered portion.
 *   • The household "double-tuition" overlap crunch — the calendar years when
 *     more than one child is in college at once — and the peak-year outlay.
 *   • State 529 income-tax deduction value on annual contributions.
 *
 * Cost figures are 2026 estimates (total cost of attendance: tuition, fees,
 * room & board). Refresh against College Board's Trends in College Pricing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SchoolType = 'public_in_state' | 'public_out_state' | 'private' | 'custom';

export interface Child {
  id: string;
  name: string;
  currentAge: number;
  schoolType: SchoolType;
  /** Annual cost of attendance in today's dollars. Required for 'custom';
   *  otherwise defaults from SCHOOL_COSTS. */
  customAnnualCost?: number;
  /** Fraction of cost the family intends to cover (0–1). The rest is loans,
   *  scholarships, the student's own contribution, etc. */
  coveragePct: number;
  /** Current 529 (or earmarked) balance for this child. */
  balance529: number;
  /** Monthly contribution to this child's 529. */
  monthlyContribution: number;
}

export interface CollegeAssumptions {
  /** 529 investment return (decimal, e.g. 0.06). */
  returnRate: number;
  /** College cost inflation (decimal, e.g. 0.05). */
  costInflation: number;
  /** Age college begins (default 18) and number of years (default 4). */
  startAge?: number;
  years?: number;
}

export interface ChildProjection {
  id: string;
  name: string;
  yearsToCollege: number;
  annualCostToday: number;         // covered portion, today's dollars
  totalCostFuture: number;         // covered 4-year cost, inflated
  totalCovered: number;            // what the 529 actually pays
  shortfall: number;               // totalCostFuture − totalCovered
  fundedPct: number;               // totalCovered / totalCostFuture
  projectedBalanceAtStart: number; // 529 balance the September college begins
  monthlyToFullyFund: number;      // contribution that zeroes the shortfall
  collegeCalendarYears: number[];  // calendar years this child is in college
}

// ---------------------------------------------------------------------------
// 2026 cost constants (estimates — see file header)
// ---------------------------------------------------------------------------

/** Annual total cost of attendance, today's dollars. */
export const SCHOOL_COSTS: Record<Exclude<SchoolType, 'custom'>, number> = {
  public_in_state: 29_000,
  public_out_state: 49_000,
  private: 64_000,
};

export const SCHOOL_LABELS: Record<SchoolType, string> = {
  public_in_state: 'Public (in-state)',
  public_out_state: 'Public (out-of-state)',
  private: 'Private',
  custom: 'Custom',
};

/** Notable state 529 deductions: annual contribution deductible against state
 *  income tax, MFJ cap. States not listed (or with no state income tax) → 0.
 *  A handful of states (IN, UT, etc.) give a credit rather than a deduction —
 *  approximated here as a deduction for planning purposes. */
export const STATE_529_DEDUCTION_CAP: Record<string, number> = {
  NY: 10_000, IL: 20_000, PA: 34_000, OH: 4_000, VA: 4_000, GA: 8_000,
  CO: 999_999, // effectively unlimited (full deduction)
  NM: 999_999, SC: 999_999, WV: 999_999,
  MI: 10_000, WI: 4_000, MD: 5_000, MN: 3_000, MA: 2_000, CT: 10_000,
};

const DEFAULT_START_AGE = 18;
const DEFAULT_YEARS = 4;
const CURRENT_YEAR = new Date().getFullYear();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function annualCostFor(child: Child): number {
  if (child.schoolType === 'custom') return child.customAnnualCost ?? 0;
  return SCHOOL_COSTS[child.schoolType];
}

// ---------------------------------------------------------------------------
// Per-child projection (year-by-year 529 simulation)
// ---------------------------------------------------------------------------

/**
 * Simulate the 529 from now through the end of college. Growth is applied
 * annually; contributions continue until college begins (age >= startAge),
 * then stop; the covered cost is withdrawn each of the college years.
 */
export function projectChild(
  child: Child,
  assumptions: CollegeAssumptions,
  monthlyOverride?: number,
): ChildProjection {
  const startAge = assumptions.startAge ?? DEFAULT_START_AGE;
  const years = assumptions.years ?? DEFAULT_YEARS;
  const endAge = startAge + years - 1; // last full college year
  const r = assumptions.returnRate;
  const infl = assumptions.costInflation;
  const monthly = monthlyOverride ?? child.monthlyContribution;

  const coveredToday = annualCostFor(child) * child.coveragePct;
  const yearsToCollege = Math.max(0, startAge - child.currentAge);

  let balance = child.balance529;
  let totalCostFuture = 0;
  let totalCovered = 0;
  let projectedBalanceAtStart = balance;
  const collegeCalendarYears: number[] = [];

  // Walk each year from now until the child finishes college.
  for (let y = 0; ; y++) {
    const age = child.currentAge + y;
    if (age > endAge) break;

    balance *= 1 + r;                       // grow
    if (age < startAge) balance += monthly * 12; // fund pre-college

    if (age === startAge) projectedBalanceAtStart = balance;

    if (age >= startAge && age <= endAge) {
      const inflatedCost = coveredToday * Math.pow(1 + infl, y);
      const withdrawal = Math.min(balance, inflatedCost);
      balance -= withdrawal;
      totalCostFuture += inflatedCost;
      totalCovered += withdrawal;
      collegeCalendarYears.push(CURRENT_YEAR + y);
    }
  }

  const shortfall = Math.max(0, totalCostFuture - totalCovered);
  const fundedPct = totalCostFuture > 0 ? totalCovered / totalCostFuture : 1;

  return {
    id: child.id,
    name: child.name,
    yearsToCollege,
    annualCostToday: coveredToday,
    totalCostFuture,
    totalCovered,
    shortfall,
    fundedPct,
    projectedBalanceAtStart,
    monthlyToFullyFund: solveMonthlyToFund(child, assumptions),
    collegeCalendarYears,
  };
}

/**
 * Binary-search the monthly contribution that fully funds the covered cost.
 * If already fully funded, returns the current contribution.
 */
export function solveMonthlyToFund(child: Child, assumptions: CollegeAssumptions): number {
  const base = projectChildRaw(child, assumptions, child.monthlyContribution);
  if (base.shortfall <= 1) return child.monthlyContribution;

  let lo = child.monthlyContribution;
  let hi = child.monthlyContribution + 10_000;
  // Expand hi until it fully funds (guard against pathological inputs).
  for (let i = 0; i < 8 && projectChildRaw(child, assumptions, hi).shortfall > 1; i++) hi *= 2;

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (projectChildRaw(child, assumptions, mid).shortfall > 1) lo = mid; else hi = mid;
  }
  return Math.ceil(hi);
}

/** Internal: projection without the recursive monthlyToFullyFund solve. */
function projectChildRaw(child: Child, assumptions: CollegeAssumptions, monthly: number) {
  const startAge = assumptions.startAge ?? DEFAULT_START_AGE;
  const years = assumptions.years ?? DEFAULT_YEARS;
  const endAge = startAge + years - 1;
  const r = assumptions.returnRate;
  const infl = assumptions.costInflation;
  const coveredToday = annualCostFor(child) * child.coveragePct;

  let balance = child.balance529;
  let totalCostFuture = 0;
  let totalCovered = 0;
  for (let y = 0; ; y++) {
    const age = child.currentAge + y;
    if (age > endAge) break;
    balance *= 1 + r;
    if (age < startAge) balance += monthly * 12;
    if (age >= startAge && age <= endAge) {
      const inflatedCost = coveredToday * Math.pow(1 + infl, y);
      const withdrawal = Math.min(balance, inflatedCost);
      balance -= withdrawal;
      totalCostFuture += inflatedCost;
      totalCovered += withdrawal;
    }
  }
  return { shortfall: Math.max(0, totalCostFuture - totalCovered) };
}

// ---------------------------------------------------------------------------
// Household roll-up + overlap crunch
// ---------------------------------------------------------------------------

export interface OverlapYear {
  year: number;
  childrenInCollege: string[];   // names
  totalCost: number;             // covered cost that calendar year (inflated)
}

export interface HouseholdSummary {
  children: ChildProjection[];
  totalMonthlyContribution: number;
  totalMonthlyToFullyFund: number;
  totalShortfall: number;
  totalFutureCost: number;
  overallFundedPct: number;
  /** Calendar years with 2+ kids in college simultaneously. */
  overlapYears: OverlapYear[];
  peakYear: OverlapYear | null;  // highest single-year covered outlay
  stateDeductionSavings: number; // annual state tax saved on 529 contributions
}

export function summarizeHousehold(
  children: Child[],
  assumptions: CollegeAssumptions,
  stateCode = '',
  stateMarginalRate = 0,
): HouseholdSummary {
  const projections = children.map(c => projectChild(c, assumptions));
  const startAge = assumptions.startAge ?? DEFAULT_START_AGE;
  const infl = assumptions.costInflation;

  // Build a per-calendar-year cost map to find overlaps and the peak outlay.
  const yearCost = new Map<number, { names: string[]; cost: number }>();
  for (const c of children) {
    const coveredToday = annualCostFor(c) * c.coveragePct;
    for (let y = 0; ; y++) {
      const age = c.currentAge + y;
      if (age > startAge + (assumptions.years ?? DEFAULT_YEARS) - 1) break;
      if (age >= startAge) {
        const cal = CURRENT_YEAR + y;
        const inflatedCost = coveredToday * Math.pow(1 + infl, y);
        const entry = yearCost.get(cal) ?? { names: [], cost: 0 };
        entry.names.push(c.name);
        entry.cost += inflatedCost;
        yearCost.set(cal, entry);
      }
    }
  }

  const allYears: OverlapYear[] = [...yearCost.entries()]
    .map(([year, v]) => ({ year, childrenInCollege: v.names, totalCost: v.cost }))
    .sort((a, b) => a.year - b.year);
  const overlapYears = allYears.filter(y => y.childrenInCollege.length >= 2);
  const peakYear = allYears.reduce<OverlapYear | null>(
    (max, y) => (!max || y.totalCost > max.totalCost ? y : max), null);

  const totalMonthlyContribution = children.reduce((s, c) => s + c.monthlyContribution, 0);
  const totalMonthlyToFullyFund = projections.reduce((s, p) => s + p.monthlyToFullyFund, 0);
  const totalShortfall = projections.reduce((s, p) => s + p.shortfall, 0);
  const totalFutureCost = projections.reduce((s, p) => s + p.totalCostFuture, 0);
  const totalCovered = projections.reduce((s, p) => s + p.totalCovered, 0);

  const annualContrib = totalMonthlyContribution * 12;
  const cap = STATE_529_DEDUCTION_CAP[stateCode.toUpperCase()] ?? 0;
  const stateDeductionSavings = Math.min(annualContrib, cap) * stateMarginalRate;

  return {
    children: projections,
    totalMonthlyContribution,
    totalMonthlyToFullyFund,
    totalShortfall,
    totalFutureCost,
    overallFundedPct: totalFutureCost > 0 ? totalCovered / totalFutureCost : 1,
    overlapYears,
    peakYear,
    stateDeductionSavings,
  };
}
