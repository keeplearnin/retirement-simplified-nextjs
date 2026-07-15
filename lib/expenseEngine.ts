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
 * We model this as a gradual ramp starting at age 85, inflated at a
 * capped LTC-specific rate, peaking in the final years before longevityAge.
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

  // Probability-weighted monthly LTC cost in today's dollars. Genworth Cost
  // of Care survey: 2026-equivalent median assisted living ~$5,500/mo,
  // private nursing home room ~$9,700/mo. Unconditional lifetime incidence
  // of needing some LTC is ~52%, but this window only fires in a person's
  // final ~5 projected years — conditional on reaching that window, the
  // incidence is materially higher (~65%), and duration/severity skew
  // toward the more expensive end (nursing home, not just home health aide).
  // Blended: 0.65 * ~$5,500 =~ $3,600/mo expected cost.
  const baseMonthlyCost = 3600;

  // Ramp: increases linearly from 50% to 100% over the LTC window
  const yearsInWindow = longevityAge - ltcStartAge;
  const yearsSinceStart = age - ltcStartAge;
  const rampFactor =
    yearsInWindow > 0
      ? 0.5 + 0.5 * (yearsSinceStart / yearsInWindow)
      : 1;

  const annualBase = baseMonthlyCost * 12 * rampFactor;
  // LTC costs have historically outpaced general inflation (custodial-care
  // labor costs, not just medical technology), so a flat general-inflation
  // rate understates real future cost — especially for young users with
  // 55+-year horizons who compound that gap for decades. Use a rate between
  // general and full healthcare inflation, capped at 4.5% so a very long
  // horizon doesn't compound into an unrealistic blow-up.
  const ltcInflationRate = Math.min(healthcareInflation, 0.045);
  return inflated(annualBase, ltcInflationRate, age - currentAge);
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
 * `annualSpend` is total current spending (what the user actually spends).
 * We split it: 60% essential, 40% discretionary.
 * Taxes are modeled separately by taxEngine — no haircut applied here.
 * Healthcare is added on top via the healthcare array.
 */
export function createDefaultExpensePlan(
  currentAge: number,
  retireAge: number,
  annualSpend: number,
): ExpensePlan {
  const longevityAge = 95;

  // Use full user-entered spending — taxes are modeled separately by taxEngine
  const spendBase = annualSpend;
  const essentialPct = 0.60; // 60% essential
  const discretionaryPct = 0.40; // 40% discretionary

  const essentialTotal = spendBase * essentialPct;
  const discretionaryTotal = spendBase * discretionaryPct;

  const essentialExpenses: ExpenseCategory[] = [
    { name: 'Housing', annualAmount: essentialTotal * 0.42, type: 'essential' },
    { name: 'Food & Groceries', annualAmount: essentialTotal * 0.18, type: 'essential' },
    { name: 'Utilities', annualAmount: essentialTotal * 0.10, type: 'essential' },
    { name: 'Transportation', annualAmount: essentialTotal * 0.13, type: 'essential' },
    { name: 'Insurance', annualAmount: essentialTotal * 0.07, type: 'essential' },
    { name: 'Personal & Misc', annualAmount: essentialTotal * 0.10, type: 'essential' },
  ];

  const discretionaryExpenses: ExpenseCategory[] = [
    { name: 'Travel', annualAmount: discretionaryTotal * 0.25, type: 'discretionary' },
    { name: 'Dining Out', annualAmount: discretionaryTotal * 0.20, type: 'discretionary' },
    { name: 'Hobbies', annualAmount: discretionaryTotal * 0.15, type: 'discretionary' },
    { name: 'Entertainment', annualAmount: discretionaryTotal * 0.15, type: 'discretionary' },
    { name: 'Gifts & Charitable', annualAmount: discretionaryTotal * 0.10, type: 'discretionary' },
    { name: 'Other Discretionary', annualAmount: discretionaryTotal * 0.15, type: 'discretionary' },
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
