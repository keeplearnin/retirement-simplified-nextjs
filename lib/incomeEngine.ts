/**
 * Multi-income source retirement income projection engine.
 * Pure computation library -- no JSX, no side effects.
 */

import { SS_FRA, RMD_START_AGE, RMD_TABLE } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Income source interfaces
// ---------------------------------------------------------------------------

export interface SalaryIncome {
  /** Current annual salary */
  annualAmount: number;
  /** Annual growth rate as a decimal (e.g. 0.03 for 3%) */
  growthRate: number;
  /** Age at which salary income ends (defaults to retireAge) */
  endAge?: number;
}

export interface SocialSecurityIncome {
  /** Monthly benefit amount at Full Retirement Age (FRA) */
  monthlyBenefitAtFRA: number;
  /** Age at which benefits start (62-70) */
  startAge: number;
  /** Annual cost-of-living adjustment as a decimal (default 0.02) */
  cola?: number;
}

export interface PensionIncome {
  /** Monthly pension amount */
  monthlyAmount: number;
  /** Age at which pension payments begin */
  startAge: number;
  /** Annual COLA as a decimal (0 for no COLA) */
  cola?: number;
  /** Survivor benefit percentage as a decimal (e.g. 0.5 for 50%) */
  survivorBenefitPct?: number;
}

export interface RentalIncome {
  /** Monthly net rental income */
  monthlyNetIncome: number;
  /** Annual appreciation rate as a decimal (e.g. 0.03 for 3%) */
  annualAppreciation?: number;
  /** Age at which rental income stops (optional -- continues to longevity if omitted) */
  endAge?: number;
}

export interface AnnuityIncome {
  /** Monthly annuity payout */
  monthlyPayout: number;
  /** Age at which annuity payments begin */
  startAge: number;
  /** Whether the payout adjusts for inflation */
  inflationAdjusted?: boolean;
  /** Annual inflation rate used when inflationAdjusted is true (default 0.02) */
  inflationRate?: number;
}

export interface RMDSource {
  /** Current balance of tax-deferred accounts (traditional IRA / 401(k)) */
  taxDeferredBalance: number;
  /** Expected annual growth rate on the balance as a decimal (e.g. 0.06) */
  growthRate?: number;
}

export interface PartTimeIncome {
  /** Annual part-time / side income amount */
  annualAmount: number;
  /** Age at which this income starts */
  startAge: number;
  /** Age at which this income ends */
  endAge: number;
}

export interface OtherIncome {
  /** Label / description */
  label?: string;
  /** Annual amount */
  annualAmount: number;
  /** Age at which this income starts */
  startAge: number;
  /** Age at which this income ends */
  endAge: number;
}

// ---------------------------------------------------------------------------
// Retirement plan & projection interfaces
// ---------------------------------------------------------------------------

/**
 * Optional second household member. When present, the engine projects each
 * member's salary / SS / pension keyed off their own age and retirement age,
 * sums them into the existing aggregate fields, and exposes per-member
 * breakdowns for downstream consumers that want to render couples-aware UI.
 *
 * Joint accounts (taxable, RE, cash, RMDs from joint inherited accounts) stay
 * at the top level — couples mode only splits per-person income streams.
 */
export interface SpouseMember {
  currentAge: number;
  retireAge: number;
  /** Defaults to primary's longevityAge when omitted. Survivor analysis
   *  (one outliving the other) is Phase F territory. */
  longevityAge?: number;
  salary?: SalaryIncome;
  socialSecurity?: SocialSecurityIncome;
  pension?: PensionIncome;
}

export interface RetirementPlan {
  currentAge: number;
  retireAge: number;
  /** Age through which to project (default 95) */
  longevityAge?: number;

  salary?: SalaryIncome;
  socialSecurity?: SocialSecurityIncome;
  pension?: PensionIncome;
  rental?: RentalIncome;
  annuity?: AnnuityIncome;
  rmd?: RMDSource;
  partTime?: PartTimeIncome;
  otherIncome?: OtherIncome[];

  spouse?: SpouseMember;
}

export interface YearlyProjection {
  age: number;
  year: number;
  /** Aggregate salary across both household members. */
  salary: number;
  /** Aggregate SS income across both household members. */
  socialSecurity: number;
  /** Aggregate pension income across both household members. */
  pension: number;
  rental: number;
  annuity: number;
  rmd: number;
  partTime: number;
  otherIncome: number;
  totalIncome: number;
  /** Primary member's retirement status (legacy semantics — many consumers
   *  use this as the gate for withdrawal logic). */
  isRetired: boolean;

  // ── Couples-mode breakdown (only present when spouse is configured) ──
  spouseAge?: number;
  spouseSalary?: number;
  spouseSocialSecurity?: number;
  spousePension?: number;
  spouseIsRetired?: boolean;
  /** True only when BOTH members have stopped working. Useful for gates that
   *  should fire only after the household stops earning wages. */
  isHouseholdRetired?: boolean;
}

// ---------------------------------------------------------------------------
// Social Security claiming adjustment
// ---------------------------------------------------------------------------

/**
 * Compute the adjustment factor for claiming Social Security at a given age
 * relative to Full Retirement Age (FRA).
 *
 * - Before FRA: reduction of 5/9 of 1% per month for first 36 months early,
 *   then 5/12 of 1% per month for additional months.
 * - After FRA: delayed retirement credits of 8% per year (2/3% per month).
 */
function ssClaimingFactor(claimAge: number, fra: number): number {
  const monthsDiff = (claimAge - fra) * 12;

  if (monthsDiff === 0) return 1;

  if (monthsDiff < 0) {
    // Early claiming -- reduction
    const monthsEarly = Math.abs(monthsDiff);
    const first36 = Math.min(monthsEarly, 36);
    const beyond36 = Math.max(monthsEarly - 36, 0);
    const reduction = first36 * (5 / 900) + beyond36 * (5 / 1200);
    return 1 - reduction;
  }

  // Delayed claiming -- credits
  const monthsLate = monthsDiff;
  const credit = monthsLate * (2 / 300); // 8% per year = 2/3% per month
  return 1 + credit;
}

// ---------------------------------------------------------------------------
// Projection engine
// ---------------------------------------------------------------------------

export function projectIncome(plan: RetirementPlan): YearlyProjection[] {
  const {
    currentAge,
    retireAge,
    longevityAge = 95,
    salary,
    socialSecurity,
    pension,
    rental,
    annuity,
    rmd,
    partTime,
    otherIncome,
    spouse,
  } = plan;

  const currentYear = new Date().getFullYear();
  const projections: YearlyProjection[] = [];

  // Track mutable balances across years
  let taxDeferredBalance = rmd?.taxDeferredBalance ?? 0;
  const rmdGrowthRate = rmd?.growthRate ?? 0.06;

  // The age gap stays constant across the projection — spouse's age in any
  // given year of the loop is just (yearsFromStart + spouse.currentAge).
  const spouseAgeOffset = spouse ? spouse.currentAge - currentAge : 0;

  for (let age = currentAge; age <= longevityAge; age++) {
    const year = currentYear + (age - currentAge);
    const isRetired = age >= retireAge;
    const yearsFromStart = age - currentAge;
    const spouseAge = spouse ? age + spouseAgeOffset : null;
    const spouseIsRetired = spouse && spouseAge !== null ? spouseAge >= spouse.retireAge : false;
    const isHouseholdRetired = isRetired && (!spouse || spouseIsRetired);

    // ------ Salary (primary) ------
    let salaryAmt = 0;
    if (salary && age < (salary.endAge ?? retireAge)) {
      salaryAmt = salary.annualAmount * Math.pow(1 + salary.growthRate, yearsFromStart);
    }
    // ------ Salary (spouse) — keyed off spouse's age and retire age ------
    let spouseSalaryAmt = 0;
    if (spouse?.salary && spouseAge !== null && spouseAge < (spouse.salary.endAge ?? spouse.retireAge)) {
      spouseSalaryAmt = spouse.salary.annualAmount * Math.pow(1 + spouse.salary.growthRate, yearsFromStart);
    }

    // ------ Social Security (primary) ------
    let ssAmt = 0;
    if (socialSecurity && age >= socialSecurity.startAge) {
      const cola = socialSecurity.cola ?? 0.02;
      const factor = ssClaimingFactor(socialSecurity.startAge, SS_FRA);
      const adjustedMonthly = socialSecurity.monthlyBenefitAtFRA * factor;
      const yearsSinceStart = age - socialSecurity.startAge;
      ssAmt = adjustedMonthly * 12 * Math.pow(1 + cola, yearsSinceStart);
    }
    // ------ Social Security (spouse) — keyed off spouse's claim age ------
    let spouseSsAmt = 0;
    if (spouse?.socialSecurity && spouseAge !== null && spouseAge >= spouse.socialSecurity.startAge) {
      const cola = spouse.socialSecurity.cola ?? 0.02;
      const factor = ssClaimingFactor(spouse.socialSecurity.startAge, SS_FRA);
      const adjustedMonthly = spouse.socialSecurity.monthlyBenefitAtFRA * factor;
      const yearsSinceStart = spouseAge - spouse.socialSecurity.startAge;
      spouseSsAmt = adjustedMonthly * 12 * Math.pow(1 + cola, yearsSinceStart);
    }

    // ------ Pension (primary) ------
    let pensionAmt = 0;
    if (pension && age >= pension.startAge) {
      const cola = pension.cola ?? 0;
      const yearsSinceStart = age - pension.startAge;
      pensionAmt = pension.monthlyAmount * 12 * Math.pow(1 + cola, yearsSinceStart);
    }
    // ------ Pension (spouse) — keyed off spouse's pension start age ------
    let spousePensionAmt = 0;
    if (spouse?.pension && spouseAge !== null && spouseAge >= spouse.pension.startAge) {
      const cola = spouse.pension.cola ?? 0;
      const yearsSinceStart = spouseAge - spouse.pension.startAge;
      spousePensionAmt = spouse.pension.monthlyAmount * 12 * Math.pow(1 + cola, yearsSinceStart);
    }

    // ------ Rental Income ------
    let rentalAmt = 0;
    if (rental) {
      const endAge = rental.endAge ?? longevityAge;
      if (age <= endAge) {
        const appreciation = rental.annualAppreciation ?? 0.03;
        rentalAmt = rental.monthlyNetIncome * 12 * Math.pow(1 + appreciation, yearsFromStart);
      }
    }

    // ------ Annuity ------
    let annuityAmt = 0;
    if (annuity && age >= annuity.startAge) {
      if (annuity.inflationAdjusted) {
        const rate = annuity.inflationRate ?? 0.02;
        const yearsSinceStart = age - annuity.startAge;
        annuityAmt = annuity.monthlyPayout * 12 * Math.pow(1 + rate, yearsSinceStart);
      } else {
        annuityAmt = annuity.monthlyPayout * 12;
      }
    }

    // ------ RMDs ------
    let rmdAmt = 0;
    if (rmd && age >= RMD_START_AGE && taxDeferredBalance > 0) {
      // Use the divisor from the table; for ages beyond the table, use the last value
      const maxTableAge = 110;
      const lookupAge = Math.min(age, maxTableAge);
      const divisor = RMD_TABLE[lookupAge] ?? RMD_TABLE[maxTableAge];
      if (divisor && divisor > 0) {
        rmdAmt = taxDeferredBalance / divisor;
      }
      // Update balance: grow then subtract distribution
      taxDeferredBalance = (taxDeferredBalance - rmdAmt) * (1 + rmdGrowthRate);
    } else if (rmd && taxDeferredBalance > 0) {
      // Pre-RMD years: just grow the balance
      taxDeferredBalance = taxDeferredBalance * (1 + rmdGrowthRate);
    }

    // ------ Part-Time / Side Income ------
    let partTimeAmt = 0;
    if (partTime && age >= partTime.startAge && age <= partTime.endAge) {
      partTimeAmt = partTime.annualAmount;
    }

    // ------ Other Income ------
    let otherAmt = 0;
    if (otherIncome) {
      for (const src of otherIncome) {
        if (age >= src.startAge && age <= src.endAge) {
          otherAmt += src.annualAmount;
        }
      }
    }

    // ------ Totals ------
    // Aggregate fields are household totals (primary + spouse) so existing
    // consumers reading `salary`, `socialSecurity`, `pension` see the full
    // household-level number without changes.
    const aggregateSalary = salaryAmt + spouseSalaryAmt;
    const aggregateSs = ssAmt + spouseSsAmt;
    const aggregatePension = pensionAmt + spousePensionAmt;
    const totalIncome =
      aggregateSalary + aggregateSs + aggregatePension + rentalAmt + annuityAmt + rmdAmt + partTimeAmt + otherAmt;

    const row: YearlyProjection = {
      age,
      year,
      salary: round2(aggregateSalary),
      socialSecurity: round2(aggregateSs),
      pension: round2(aggregatePension),
      rental: round2(rentalAmt),
      annuity: round2(annuityAmt),
      rmd: round2(rmdAmt),
      partTime: round2(partTimeAmt),
      otherIncome: round2(otherAmt),
      totalIncome: round2(totalIncome),
      isRetired,
    };
    if (spouse) {
      row.spouseAge = spouseAge ?? undefined;
      row.spouseSalary = round2(spouseSalaryAmt);
      row.spouseSocialSecurity = round2(spouseSsAmt);
      row.spousePension = round2(spousePensionAmt);
      row.spouseIsRetired = spouseIsRetired;
      row.isHouseholdRetired = isHouseholdRetired;
    }
    projections.push(row);
  }

  return projections;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
