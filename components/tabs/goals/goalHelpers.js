import { DEFAULT_RETURN, DEFAULT_INFLATION } from '@/lib/constants';

/* ── Goal type definitions ─────────────────────────────── */
export const GOAL_TYPES = {
  retirement: {
    icon: '🏖️', label: 'Retirement', color: 'var(--accent)', dimColor: 'var(--accent-dim)',
    defaults: { targetAge: 65, monthlySpending: 4000, ssIncome: 2000 },
  },
  home: {
    icon: '🏠', label: 'Buy a Home', color: 'var(--blue)', dimColor: 'var(--blue-dim)',
    inflationRate: 0.035, // Home price appreciation ~3.5%
    defaults: { targetYear: 2031, homePrice: 400000, downPct: 20, currentSavings: 20000 },
  },
  college: {
    icon: '🎓', label: 'College Fund', color: 'var(--purple)', dimColor: 'var(--purple-dim)',
    inflationRate: 0.05, // College tuition inflation ~5%
    defaults: { childAge: 5, annualCost: 35000, years: 4, balance529: 10000 },
  },
  travel: {
    icon: '✈️', label: 'Travel / Big Purchase', color: 'var(--warn)', dimColor: 'var(--warn-dim)',
    defaults: { targetYear: 2029, cost: 15000, currentSavings: 2000 },
  },
};

export const CURRENT_YEAR = new Date().getFullYear();
export const SAFE_WITHDRAWAL = 0.04;

/* ── Helper: future value with monthly contributions ───── */
export function fvMonthly(pv, pmt, rateAnnual, years) {
  if (years <= 0) return pv;
  const r = rateAnnual / 12;
  if (r === 0) return pv + pmt * years * 12;
  return pv * Math.pow(1 + r, years * 12) + pmt * ((Math.pow(1 + r, years * 12) - 1) / r);
}

/* ── Helper: monthly savings needed to reach target ────── */
export function pmtNeeded(pv, fv, rateAnnual, years) {
  if (years <= 0) return Math.max(0, fv - pv);
  const r = rateAnnual / 12;
  if (r === 0) return years > 0 ? Math.max(0, (fv - pv) / (years * 12)) : 0;
  const factor = (Math.pow(1 + r, years * 12) - 1) / r;
  const needed = (fv - pv * Math.pow(1 + r, years * 12)) / factor;
  return Math.max(0, needed);
}

/* ── Compute goal metrics ──────────────────────────────── */
// totalSavings is the household total passed from GoalPlanner
export function computeGoal(goal, currentAge, totalSavings = 0, goalCount = 1) {
  const generalInflRate = DEFAULT_INFLATION / 100;
  const retRate = DEFAULT_RETURN;

  let targetYear, yearsOut, futureNeed, currentFunding, monthlyNeeded;

  switch (goal.type) {
    case 'retirement': {
      targetYear = CURRENT_YEAR + (goal.params.targetAge - currentAge);
      yearsOut = Math.max(0, goal.params.targetAge - currentAge);
      const annualGap = Math.max(0, goal.params.monthlySpending - goal.params.ssIncome) * 12;
      futureNeed = (annualGap / SAFE_WITHDRAWAL) * Math.pow(1 + generalInflRate, yearsOut);
      // Retirement uses household savings (proportional share if multiple goals)
      currentFunding = goalCount > 0 ? totalSavings / goalCount : totalSavings;
      monthlyNeeded = pmtNeeded(currentFunding, futureNeed, retRate, yearsOut);
      break;
    }
    case 'home': {
      const homeInflRate = GOAL_TYPES.home.inflationRate; // 3.5%
      targetYear = goal.params.targetYear;
      yearsOut = Math.max(0, targetYear - CURRENT_YEAR);
      const inflatedPrice = goal.params.homePrice * Math.pow(1 + homeInflRate, yearsOut);
      futureNeed = inflatedPrice * (goal.params.downPct / 100);
      currentFunding = goal.params.currentSavings;
      monthlyNeeded = pmtNeeded(currentFunding, futureNeed, retRate, yearsOut);
      break;
    }
    case 'college': {
      const collegeInflRate = GOAL_TYPES.college.inflationRate; // 5%
      const yearsToCollege = Math.max(0, 18 - goal.params.childAge);
      targetYear = CURRENT_YEAR + yearsToCollege;
      yearsOut = yearsToCollege;
      futureNeed = goal.params.annualCost * goal.params.years * Math.pow(1 + collegeInflRate, yearsOut);
      currentFunding = goal.params.balance529;
      monthlyNeeded = pmtNeeded(currentFunding, futureNeed, retRate, yearsOut);
      break;
    }
    case 'travel': {
      targetYear = goal.params.targetYear;
      yearsOut = Math.max(0, targetYear - CURRENT_YEAR);
      futureNeed = goal.params.cost * Math.pow(1 + generalInflRate, yearsOut);
      currentFunding = goal.params.currentSavings;
      monthlyNeeded = pmtNeeded(currentFunding, futureNeed, retRate, yearsOut);
      break;
    }
    default:
      targetYear = CURRENT_YEAR;
      yearsOut = 0;
      futureNeed = 0;
      currentFunding = 0;
      monthlyNeeded = 0;
  }

  const projectedValue = fvMonthly(currentFunding, monthlyNeeded, retRate, yearsOut);
  const fundedPct = futureNeed > 0 ? Math.min(100, (currentFunding / futureNeed) * 100) : 0;

  return { targetYear, yearsOut, futureNeed, currentFunding, monthlyNeeded, projectedValue, fundedPct };
}
