import { describe, it, expect } from 'vitest';
import {
  annualCostFor,
  projectChild,
  solveMonthlyToFund,
  summarizeHousehold,
  SCHOOL_COSTS,
  type Child,
  type CollegeAssumptions,
} from '@/lib/collegePlanner';

const assumptions: CollegeAssumptions = {
  returnRate: 0.06,
  costInflation: 0.05,
  startAge: 18,
  years: 4,
};

function child(overrides: Partial<Child> = {}): Child {
  return {
    id: 'c1',
    name: 'Kid',
    currentAge: 5,
    schoolType: 'public_in_state',
    coveragePct: 1,
    balance529: 10_000,
    monthlyContribution: 300,
    ...overrides,
  };
}

describe('annualCostFor', () => {
  it('uses the school-type preset', () => {
    expect(annualCostFor(child({ schoolType: 'private' }))).toBe(SCHOOL_COSTS.private);
  });
  it('uses the custom cost when schoolType is custom', () => {
    expect(annualCostFor(child({ schoolType: 'custom', customAnnualCost: 42_000 }))).toBe(42_000);
  });
});

describe('projectChild', () => {
  it('inflates the future cost above today\'s cost', () => {
    const p = projectChild(child(), assumptions);
    // 13 years to college, 4 years of ~5% inflation → future cost well above 4×29k.
    expect(p.totalCostFuture).toBeGreaterThan(SCHOOL_COSTS.public_in_state * 4);
    expect(p.yearsToCollege).toBe(13);
    expect(p.collegeCalendarYears).toHaveLength(4);
  });

  it('applies the coverage percentage to the cost', () => {
    const full = projectChild(child({ coveragePct: 1 }), assumptions);
    const half = projectChild(child({ coveragePct: 0.5 }), assumptions);
    expect(half.totalCostFuture).toBeCloseTo(full.totalCostFuture / 2, 4);
  });

  it('reports a shortfall when underfunded and none when overfunded', () => {
    const underfunded = projectChild(child({ balance529: 0, monthlyContribution: 0 }), assumptions);
    expect(underfunded.shortfall).toBeGreaterThan(0);
    expect(underfunded.fundedPct).toBeLessThan(1);

    const overfunded = projectChild(child({ balance529: 2_000_000, monthlyContribution: 0 }), assumptions);
    expect(overfunded.shortfall).toBe(0);
    expect(overfunded.fundedPct).toBeCloseTo(1, 5);
  });

  it('a child already past college age incurs no future cost', () => {
    const grown = projectChild(child({ currentAge: 25 }), assumptions);
    expect(grown.totalCostFuture).toBe(0);
    expect(grown.collegeCalendarYears).toHaveLength(0);
  });
});

describe('solveMonthlyToFund', () => {
  it('finds a contribution that eliminates the shortfall', () => {
    const c = child({ balance529: 0, monthlyContribution: 0 });
    const monthly = solveMonthlyToFund(c, assumptions);
    expect(monthly).toBeGreaterThan(0);
    const funded = projectChild({ ...c, monthlyContribution: monthly }, assumptions);
    expect(funded.shortfall).toBeLessThanOrEqual(1);
  });

  it('keeps the current contribution when already fully funded', () => {
    const c = child({ balance529: 2_000_000, monthlyContribution: 100 });
    expect(solveMonthlyToFund(c, assumptions)).toBe(100);
  });
});

describe('summarizeHousehold', () => {
  it('detects the double-tuition overlap for close-in-age siblings', () => {
    const kids = [
      child({ id: 'a', name: 'Ava', currentAge: 16 }),
      child({ id: 'b', name: 'Ben', currentAge: 15 }),
    ];
    const s = summarizeHousehold(kids, assumptions);
    // Ava in college ages 18–21, Ben 18–21 → overlapping calendar years exist.
    expect(s.overlapYears.length).toBeGreaterThan(0);
    expect(s.peakYear).not.toBeNull();
    // Peak year should have both children enrolled.
    expect(s.peakYear!.childrenInCollege.length).toBe(2);
  });

  it('finds no overlap for far-apart siblings', () => {
    const kids = [
      child({ id: 'a', name: 'Ava', currentAge: 17 }),
      child({ id: 'b', name: 'Ben', currentAge: 3 }),
    ];
    const s = summarizeHousehold(kids, assumptions);
    expect(s.overlapYears).toHaveLength(0);
  });

  it('values the state 529 deduction', () => {
    const kids = [child({ monthlyContribution: 500 })]; // $6,000/yr
    // NY caps at $10k MFJ; at a 6% state rate → $360/yr saved.
    const s = summarizeHousehold(kids, assumptions, 'NY', 0.06);
    expect(s.stateDeductionSavings).toBeCloseTo(6_000 * 0.06, 4);
    // A no-income-tax / non-deduction state → $0.
    const none = summarizeHousehold(kids, assumptions, 'TX', 0);
    expect(none.stateDeductionSavings).toBe(0);
  });

  it('rolls up totals across children', () => {
    const kids = [
      child({ id: 'a', monthlyContribution: 300 }),
      child({ id: 'b', monthlyContribution: 200 }),
    ];
    const s = summarizeHousehold(kids, assumptions);
    expect(s.totalMonthlyContribution).toBe(500);
    expect(s.children).toHaveLength(2);
    expect(s.overallFundedPct).toBeGreaterThan(0);
  });
});
