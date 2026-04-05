// expenseEngine.ts — Detailed expense modeling engine for retirement planning
// Inspired by Boldin's approach: phases, healthcare modeling, inflation, debt payoff

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpenseCategory {
  name: string;
  annualAmount: number;
  type: 'essential' | 'discretionary';
  startAge?: number;
  endAge?: number;
  inflationRate?: number; // defaults to general inflation
}

export interface OneTimeExpense {
  name: string;
  amount: number;
  age: number;
}

export interface DebtPayment {
  name: string;
  monthlyPayment: number;
  remainingBalance: number;
  interestRate: number;
  payoffAge: number; // when it's paid off
}

export interface HealthcarePlan {
  type: 'employer' | 'aca' | 'medicare';
  monthlyPremium: number;
  startAge: number;
  endAge: number;
}

export interface ExpensePlan {
  currentAge: number;
  retireAge: number;
  longevityAge: number;
  essentialExpenses: ExpenseCategory[];
  discretionaryExpenses: ExpenseCategory[];
  oneTimeExpenses: OneTimeExpense[];
  debts: DebtPayment[];
  healthcare: HealthcarePlan[];
  goGoEndAge: number; // default 75
  slowGoEndAge: number; // default 85
  slowGoPct: number; // default 0.85 (85% of discretionary)
  noGoPct: number; // default 0.70 (70% of discretionary)
  inflationRate: number; // default 2.5%
  healthcareInflation: number; // default 5%
}

export type RetirementPhase = 'working' | 'go-go' | 'slow-go' | 'no-go';

export interface YearlyExpense {
  age: number;
  essential: number;
  discretionary: number;
  healthcare: number;
  debtPayments: number;
  oneTime: number;
  totalExpense: number;
  phase: RetirementPhase;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inflate a base amount by `rate` compounded over `years`. */
function inflated(base: number, rate: number, years: number): number {
  if (years <= 0) return base;
  return base * Math.pow(1 + rate, years);
}

/** Determine the retirement phase for a given age. */
function getPhase(
  age: number,
  retireAge: number,
  goGoEndAge: number,
  slowGoEndAge: number,
): RetirementPhase {
  if (age < retireAge) return 'working';
  if (age < goGoEndAge) return 'go-go';
  if (age < slowGoEndAge) return 'slow-go';
  return 'no-go';
}

/** Return the discretionary spending multiplier for a phase. */
function phaseMultiplier(
  phase: RetirementPhase,
  slowGoPct: number,
  noGoPct: number,
): number {
  switch (phase) {
    case 'working':
      return 1;
    case 'go-go':
      return 1;
    case 'slow-go':
      return slowGoPct;
    case 'no-go':
      return noGoPct;
  }
}

// ---------------------------------------------------------------------------
// Long-term care cost estimate
// ---------------------------------------------------------------------------

/**
 * Average long-term care need is ~28 months at end of life.
 * We model this as a gradual ramp starting at age 85, peaking at
 * $6,000/mo (today's dollars) in the final years, inflated at
 * healthcare inflation.
 */
function longTermCareCost(
  age: number,
  longevityAge: number,
  currentAge: number,
  healthcareInflation: number,
): number {
  // Only applies in the last ~5 years of projected life
  const ltcStartAge = Math.max(85, longevityAge - 5);
  if (age < ltcStartAge) return 0;

  // Base monthly cost in today's dollars — midpoint of $4k-$8k range
  const baseMonthlyCost = 6000;

  // Ramp: increases linearly from 50% to 100% over the LTC window
  const yearsInWindow = longevityAge - ltcStartAge;
  const yearsSinceStart = age - ltcStartAge;
  const rampFactor =
    yearsInWindow > 0
      ? 0.5 + 0.5 * (yearsSinceStart / yearsInWindow)
      : 1;

  const annualBase = baseMonthlyCost * 12 * rampFactor;
  // Cap inflated LTC at 3x base to prevent unrealistic projections
  const raw = inflated(annualBase, healthcareInflation, age - currentAge);
  return Math.min(raw, annualBase * 3);
}

// ---------------------------------------------------------------------------
// Core projection
// ---------------------------------------------------------------------------

export function projectExpenses(plan: ExpensePlan): YearlyExpense[] {
  const results: YearlyExpense[] = [];

  for (let age = plan.currentAge; age <= plan.longevityAge; age++) {
    const yearsFromNow = age - plan.currentAge;
    const phase = getPhase(age, plan.retireAge, plan.goGoEndAge, plan.slowGoEndAge);
    const discMultiplier = phaseMultiplier(phase, plan.slowGoPct, plan.noGoPct);

    // --- Essential expenses ---
    let essential = 0;
    for (const exp of plan.essentialExpenses) {
      if (exp.startAge !== undefined && age < exp.startAge) continue;
      if (exp.endAge !== undefined && age > exp.endAge) continue;
      const rate = exp.inflationRate ?? plan.inflationRate;
      essential += inflated(exp.annualAmount, rate, yearsFromNow);
    }

    // --- Discretionary expenses (subject to phase multiplier) ---
    let discretionary = 0;
    for (const exp of plan.discretionaryExpenses) {
      if (exp.startAge !== undefined && age < exp.startAge) continue;
      if (exp.endAge !== undefined && age > exp.endAge) continue;
      const rate = exp.inflationRate ?? plan.inflationRate;
      discretionary += inflated(exp.annualAmount, rate, yearsFromNow) * discMultiplier;
    }

    // --- Healthcare ---
    let healthcare = 0;
    for (const hc of plan.healthcare) {
      if (age < hc.startAge || age > hc.endAge) continue;
      healthcare += inflated(
        hc.monthlyPremium * 12,
        plan.healthcareInflation,
        yearsFromNow,
      );
    }
    // Add long-term care estimate
    healthcare += longTermCareCost(
      age,
      plan.longevityAge,
      plan.currentAge,
      plan.healthcareInflation,
    );

    // --- Debt payments ---
    let debtPayments = 0;
    for (const debt of plan.debts) {
      if (age <= debt.payoffAge) {
        // Debt payments are nominal (fixed), not inflation-adjusted
        debtPayments += debt.monthlyPayment * 12;
      }
    }

    // --- One-time expenses (inflated to the year they occur) ---
    let oneTime = 0;
    for (const ot of plan.oneTimeExpenses) {
      if (ot.age === age) {
        oneTime += inflated(ot.amount, plan.inflationRate, yearsFromNow);
      }
    }

    const totalExpense =
      essential + discretionary + healthcare + debtPayments + oneTime;

    results.push({
      age,
      essential: Math.round(essential),
      discretionary: Math.round(discretionary),
      healthcare: Math.round(healthcare),
      debtPayments: Math.round(debtPayments),
      oneTime: Math.round(oneTime),
      totalExpense: Math.round(totalExpense),
      phase,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Default plan builder
// ---------------------------------------------------------------------------

/**
 * Build a sensible default ExpensePlan from minimal inputs.
 *
 * `annualSpend` is total current spending. We split it roughly:
 *   - 60% essential (housing 30%, food 12%, utilities 6%, transport 8%, insurance 4%)
 *   - 25% discretionary (travel 8%, dining 5%, hobbies 5%, entertainment 4%, gifts 3%)
 *   - 15% is assumed to be taxes/savings/debt (not modeled here as expense)
 *
 * Healthcare is handled separately via the healthcare array.
 */
export function createDefaultExpensePlan(
  currentAge: number,
  retireAge: number,
  annualSpend: number,
): ExpensePlan {
  const longevityAge = 95;

  // Allocate spending (85% of total — remaining 15% assumed taxes/savings)
  const spendBase = annualSpend * 0.85;
  const essentialPct = 0.70; // 70% of spendBase
  const discretionaryPct = 0.30; // 30% of spendBase

  const essentialTotal = spendBase * essentialPct;
  const discretionaryTotal = spendBase * discretionaryPct;

  const essentialExpenses: ExpenseCategory[] = [
    { name: 'Housing', annualAmount: essentialTotal * 0.43, type: 'essential' },
    { name: 'Food & Groceries', annualAmount: essentialTotal * 0.17, type: 'essential' },
    { name: 'Utilities', annualAmount: essentialTotal * 0.09, type: 'essential' },
    { name: 'Transportation', annualAmount: essentialTotal * 0.12, type: 'essential' },
    { name: 'Insurance', annualAmount: essentialTotal * 0.06, type: 'essential' },
    { name: 'Personal & Misc', annualAmount: essentialTotal * 0.13, type: 'essential' },
  ];

  const discretionaryExpenses: ExpenseCategory[] = [
    { name: 'Travel', annualAmount: discretionaryTotal * 0.27, type: 'discretionary' },
    { name: 'Dining Out', annualAmount: discretionaryTotal * 0.20, type: 'discretionary' },
    { name: 'Hobbies', annualAmount: discretionaryTotal * 0.17, type: 'discretionary' },
    { name: 'Entertainment', annualAmount: discretionaryTotal * 0.13, type: 'discretionary' },
    { name: 'Gifts & Charitable', annualAmount: discretionaryTotal * 0.10, type: 'discretionary' },
    { name: 'Other Discretionary', annualAmount: discretionaryTotal * 0.13, type: 'discretionary' },
  ];

  // Healthcare defaults
  const healthcare: HealthcarePlan[] = [];

  if (currentAge < 65) {
    // Pre-65: employer/ACA plan ($900/mo average)
    healthcare.push({
      type: currentAge < retireAge ? 'employer' : 'aca',
      monthlyPremium: 900,
      startAge: currentAge,
      endAge: Math.min(64, longevityAge),
    });
  }

  // 65+: Medicare
  // Part B ($185) + Medigap ($225 avg) + Part D ($40) = ~$450/mo
  if (longevityAge >= 65) {
    healthcare.push({
      type: 'medicare',
      monthlyPremium: 450,
      startAge: Math.max(65, currentAge),
      endAge: longevityAge,
    });
  }

  return {
    currentAge,
    retireAge,
    longevityAge,
    essentialExpenses,
    discretionaryExpenses,
    oneTimeExpenses: [],
    debts: [],
    healthcare,
    goGoEndAge: 75,
    slowGoEndAge: 85,
    slowGoPct: 0.85,
    noGoPct: 0.70,
    inflationRate: 0.025,
    healthcareInflation: 0.035, // 3.5% — more realistic than 5%
  };
}
