/**
 * Multi-income source retirement income projection engine.
 * Pure computation library -- no JSX, no side effects.
 */

import { SS_FRA, RMD_START_AGE, RMD_TABLE } from '@/lib/constants';
// SSA claiming factor — single implementation (was duplicated in 3 files).
import { ssClaimingFactor } from './ssClaiming';

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
  /** Phased retirement: spouse-side part-time / consulting income that
   *  covers the gap between full-time salary ending and full retirement. */
  partTime?: PartTimeIncome;
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

  // ── Phase F: survivor analysis ──
  /** Whether each household member is alive at the END of this projection
   *  year. We treat death as occurring at the end of the row whose age
   *  equals the member's longevityAge — that row still has the member's
   *  income; the next row has zero. */
  primaryAlive?: boolean;
  spouseAlive?: boolean;
  /** True for any year where one spouse is dead and the other lives on.
   *  Drives MFJ→single filing flip in computeProjection (with the year-
   *  of-death exception: the calendar year of death itself stays MFJ per
   *  IRS rule; the year after switches to single). */
  widowed?: boolean;
  /** Engine's recommended filing status for this year. 'mfj' while both
   *  alive (or in the year of first death). 'single' once widowed for a
   *  full calendar year. Singles plans always 'single'. Consumers may
   *  override (e.g., HoH with dependents, qualifying widow(er)). */
  filingStatusHint?: 'single' | 'mfj';
}

// ---------------------------------------------------------------------------
// Social Security claiming adjustment
// ---------------------------------------------------------------------------


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

  // Project until the longer-lived spouse's longevity (in primary's frame).
  const primaryLongevity = longevityAge;
  const spouseLongevity = spouse?.longevityAge ?? longevityAge;
  const projectionEndAge = spouse
    ? Math.max(primaryLongevity, currentAge + (spouseLongevity - spouse.currentAge))
    : primaryLongevity;

  // Track first-widowed-row index so we can apply IRS year-of-death rule
  // (calendar year of death = MFJ; year after = single). The first widowed
  // row stays MFJ; subsequent widowed rows flip to single.
  let firstWidowedRowIdx: number | null = null;

  for (let age = currentAge; age <= projectionEndAge; age++) {
    const year = currentYear + (age - currentAge);
    const isRetired = age >= retireAge;
    const yearsFromStart = age - currentAge;
    const spouseAge = spouse ? age + spouseAgeOffset : null;
    const spouseIsRetired = spouse && spouseAge !== null ? spouseAge >= spouse.retireAge : false;
    const isHouseholdRetired = isRetired && (!spouse || spouseIsRetired);

    // ── Phase F: alive flags ──
    // Death is treated as occurring at the END of the row whose age equals
    // longevityAge — the row at age = longevityAge still has the member's
    // income (their final year); the row after has zero.
    const primaryAlive = age <= primaryLongevity;
    const spouseAlive = spouse && spouseAge !== null
      ? spouseAge <= spouseLongevity
      : false;  // false when there's no spouse (singles plan)
    const hasSpouse = !!spouse;
    // "Widowed" = exactly one alive in a couples plan.
    const widowed = hasSpouse && primaryAlive !== spouseAlive;

    // ------ Salary (primary) — projected as-if-alive, zeroed if dead ------
    let primaryAliveSalary = 0;
    if (salary && age < (salary.endAge ?? retireAge)) {
      primaryAliveSalary = salary.annualAmount * Math.pow(1 + salary.growthRate, yearsFromStart);
    }
    let salaryAmt = primaryAlive ? primaryAliveSalary : 0;

    // ------ Salary (spouse) — same pattern ------
    let spouseAliveSalary = 0;
    if (spouse?.salary && spouseAge !== null && spouseAge < (spouse.salary.endAge ?? spouse.retireAge)) {
      spouseAliveSalary = spouse.salary.annualAmount * Math.pow(1 + spouse.salary.growthRate, yearsFromStart);
    }
    let spouseSalaryAmt = spouseAlive ? spouseAliveSalary : 0;

    // ------ Social Security (primary, as-if-alive) ------
    let primaryAliveSs = 0;
    if (socialSecurity && age >= socialSecurity.startAge) {
      const cola = socialSecurity.cola ?? 0.02;
      const factor = ssClaimingFactor(socialSecurity.startAge, SS_FRA);
      const adjustedMonthly = socialSecurity.monthlyBenefitAtFRA * factor;
      const yearsSinceStart = age - socialSecurity.startAge;
      primaryAliveSs = adjustedMonthly * 12 * Math.pow(1 + cola, yearsSinceStart);
    }
    // ------ Social Security (spouse, as-if-alive) ------
    let spouseAliveSs = 0;
    if (spouse?.socialSecurity && spouseAge !== null && spouseAge >= spouse.socialSecurity.startAge) {
      const cola = spouse.socialSecurity.cola ?? 0.02;
      const factor = ssClaimingFactor(spouse.socialSecurity.startAge, SS_FRA);
      const adjustedMonthly = spouse.socialSecurity.monthlyBenefitAtFRA * factor;
      const yearsSinceStart = spouseAge - spouse.socialSecurity.startAge;
      spouseAliveSs = adjustedMonthly * 12 * Math.pow(1 + cola, yearsSinceStart);
    }
    // SS step-up: surviving spouse can claim the higher of (their own) or
    // (the deceased's would-have-been amount). The deceased's line goes to
    // zero. This is the single most consequential survivor-analysis rule —
    // a non-working spouse with a small own-PIA can see SS jump materially.
    let ssAmt = primaryAlive ? primaryAliveSs : 0;
    let spouseSsAmt = spouseAlive ? spouseAliveSs : 0;
    if (primaryAlive && !spouseAlive && hasSpouse) {
      ssAmt = Math.max(primaryAliveSs, spouseAliveSs);
    } else if (!primaryAlive && spouseAlive && hasSpouse) {
      spouseSsAmt = Math.max(spouseAliveSs, primaryAliveSs);
    }

    // ------ Pension (primary, as-if-alive) ------
    let primaryAlivePension = 0;
    if (pension && age >= pension.startAge) {
      const cola = pension.cola ?? 0;
      const yearsSinceStart = age - pension.startAge;
      primaryAlivePension = pension.monthlyAmount * 12 * Math.pow(1 + cola, yearsSinceStart);
    }
    // ------ Pension (spouse, as-if-alive) ------
    let spouseAlivePension = 0;
    if (spouse?.pension && spouseAge !== null && spouseAge >= spouse.pension.startAge) {
      const cola = spouse.pension.cola ?? 0;
      const yearsSinceStart = spouseAge - spouse.pension.startAge;
      spouseAlivePension = spouse.pension.monthlyAmount * 12 * Math.pow(1 + cola, yearsSinceStart);
    }
    // Pension survivor benefit: when one spouse dies, the other may receive
    // a fraction (50% / 75% / 100%) of the deceased's pension if elected at
    // retirement. The PensionIncome interface carries survivorBenefitPct
    // (default 0 = single-life payout, no benefit to survivor).
    let pensionAmt = primaryAlive ? primaryAlivePension : 0;
    let spousePensionAmt = spouseAlive ? spouseAlivePension : 0;
    if (primaryAlive && !spouseAlive && hasSpouse) {
      const survivorBenefit = (spouse?.pension?.survivorBenefitPct ?? 0) * spouseAlivePension;
      pensionAmt = primaryAlivePension + survivorBenefit;
    } else if (!primaryAlive && spouseAlive && hasSpouse) {
      const survivorBenefit = (pension?.survivorBenefitPct ?? 0) * primaryAlivePension;
      spousePensionAmt = spouseAlivePension + survivorBenefit;
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

    // ------ Part-Time / Consulting / Phased Retirement ------
    // Primary's part-time, alive-gated. The age range is independent of
    // retireAge — common pattern is salary endAge == partTime startAge for
    // a clean phased transition (e.g., full-time → 60, part-time 60 → 65,
    // full retirement 65+). Income flows whether or not the user is "retired"
    // since phased retirement deliberately straddles the boundary.
    let primaryAlivePartTime = 0;
    if (partTime && age >= partTime.startAge && age <= partTime.endAge) {
      primaryAlivePartTime = partTime.annualAmount;
    }
    let partTimeAmt = primaryAlive ? primaryAlivePartTime : 0;

    // Spouse part-time, keyed on spouse's age and alive flag.
    let spouseAlivePartTime = 0;
    if (spouse?.partTime && spouseAge !== null
        && spouseAge >= spouse.partTime.startAge
        && spouseAge <= spouse.partTime.endAge) {
      spouseAlivePartTime = spouse.partTime.annualAmount;
    }
    const spousePartTimeAmt = spouseAlive ? spouseAlivePartTime : 0;

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
    const aggregatePartTime = partTimeAmt + spousePartTimeAmt;
    const totalIncome =
      aggregateSalary + aggregateSs + aggregatePension + rentalAmt + annuityAmt + rmdAmt + aggregatePartTime + otherAmt;

    // ── Phase F: filing status hint ──
    // IRS rule: in the calendar year of a spouse's death, the survivor may
    // still file MFJ. Year after death → single (or qualifying widow(er) for
    // 2 more years if dependent children, which we don't model). We track
    // the FIRST widowed row index — that row stays MFJ; subsequent widowed
    // rows flip to single.
    if (widowed && firstWidowedRowIdx === null) {
      firstWidowedRowIdx = projections.length;
    }
    let filingStatusHint: 'mfj' | 'single';
    if (!hasSpouse) {
      filingStatusHint = 'single';
    } else if (!widowed) {
      // Both alive (or both gone — same MFJ-default treatment for tax math
      // since "both gone" rows shouldn't be consumed downstream).
      filingStatusHint = 'mfj';
    } else if (firstWidowedRowIdx !== null && projections.length === firstWidowedRowIdx) {
      // Year of first death — still MFJ per IRS rule.
      filingStatusHint = 'mfj';
    } else {
      filingStatusHint = 'single';
    }

    const row: YearlyProjection = {
      age,
      year,
      salary: round2(aggregateSalary),
      socialSecurity: round2(aggregateSs),
      pension: round2(aggregatePension),
      rental: round2(rentalAmt),
      annuity: round2(annuityAmt),
      rmd: round2(rmdAmt),
      partTime: round2(aggregatePartTime),
      otherIncome: round2(otherAmt),
      totalIncome: round2(totalIncome),
      isRetired,
      filingStatusHint,
    };
    if (spouse) {
      row.spouseAge = spouseAge ?? undefined;
      row.spouseSalary = round2(spouseSalaryAmt);
      row.spouseSocialSecurity = round2(spouseSsAmt);
      row.spousePension = round2(spousePensionAmt);
      row.spouseIsRetired = spouseIsRetired;
      row.isHouseholdRetired = isHouseholdRetired;
      row.primaryAlive = primaryAlive;
      row.spouseAlive = spouseAlive;
      row.widowed = widowed;
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
