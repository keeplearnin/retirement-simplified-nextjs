/**
 * computeProjection.js — pure projection engine.
 *
 * Lifted verbatim from MyPlan.jsx's useMemo block so multiple views
 * (My Plan, My Plan v2, future tabs) share one source of truth for the
 * year-by-year retirement projection.
 *
 * Inputs: the full `plan` object from PlanProvider.
 * Output: same shape MyPlan.jsx previously produced inline:
 *   { combined: Row[], essentialTotal, discretionaryTotal,
 *     retireEssentialTotal, retireDiscretionaryTotal,
 *     startingBalance, portfolioAtRetire, finalBalance,
 *     totalLifetimeIncome, totalLifetimeTax, totalLifetimeExpense,
 *     totalSurplusOrShortfall, yearsCovered, avgEffectiveRate,
 *     moneyLastsAge, firstGapAge }
 *
 * Pure function — no React, no side effects, deterministic for a given plan.
 */

import { projectIncome } from '@/lib/incomeEngine';
import { projectExpenses, createDefaultExpensePlan, LTC_DEFAULT_MONTHLY } from '@/lib/expenseEngine';
import { computeTax, IRMAA_TABLES } from '@/lib/taxEngine';
import { RMD_TABLE } from '@/lib/constants';

const RMD_START = 73;

// Monthly Part B IRMAA surcharge per person for a MAGI in 2026 dollars.
const irmaaSurcharge2026 = (magi, filingStatus) => {
  const table = IRMAA_TABLES[filingStatus === 'mfj' ? 'mfj' : 'single'];
  return (table.find(t => magi <= t.magiThreshold) || table[table.length - 1]).monthlyPartBSurcharge;
};

// Fallback only when a rate is missing — `x || 7` also replaced a deliberate
// 0% (which the AI advisor's plan tools allow) with the default.
const rateOr = (value, fallback) => (Number.isFinite(value) ? value : fallback);

// `returnShocks` (optional): per-year deviations from the expected return,
// indexed like `combined` (planOdds draws them for Monte Carlo), with
// `returnDrag` = their variance / 2. Omitted = the single steady-return
// path every screen has always shown.
// `spendTrim` (optional): guardrails-style flexible spending for odds runs.
//   { refBalances, cut = 0.15, trigger = 0.85, resume = 1.0 }
// refBalances = the STEADY path's start-of-year portfolio balance per row.
// In any retirement year where this path's balance has fallen below
// `trigger` × the steady path's, everyday spending is cut by `cut`
// (healthcare and long-term care are never trimmed); full spending resumes
// once the balance catches back up to `resume` × the reference. Models the
// adjustment real retirees make in a bad market instead of marching
// expressionless into ruin — the difference between "odds if you never
// adapt" and "odds if you can trim when it matters".
export function computeProjection(plan, { returnShocks, returnDrag = 0, spendTrim } = {}) {
  const { currentAge, retireAge, longevityAge, filingStatus, stateCode, annualSpending, goGoEndAge, slowGoEndAge, incomeSources } = plan;
  const returnRate = rateOr(plan.expectedReturn, 7) / 100;
  const monthlyContrib = plan.monthlyContribution || 0;

  // Build income plan. Each lookup respects the optional `owner` tag added in
  // Phase A — absence implies primary so legacy single-user plans keep working.
  const isPrimaryOwner = (s) => (s.owner || 'primary') === 'primary';
  const salarySource = incomeSources.find(s => s.type === 'salary' && isPrimaryOwner(s));
  const ssSource = incomeSources.find(s => s.type === 'socialSecurity' && isPrimaryOwner(s));
  const pensionSource = incomeSources.find(s => s.type === 'pension' && isPrimaryOwner(s));
  const partTimeSource = incomeSources.find(s => s.type === 'partTime' && isPrimaryOwner(s));
  const rentalSource = incomeSources.find(s => s.type === 'rental');

  // Spouse income lookups (Phase C). Only consulted when hasSpouse is true.
  const spouseSalarySource = plan.hasSpouse ? incomeSources.find(s => s.type === 'salary' && s.owner === 'spouse') : undefined;
  const spouseSsSource = plan.hasSpouse ? incomeSources.find(s => s.type === 'socialSecurity' && s.owner === 'spouse') : undefined;
  const spousePensionSource = plan.hasSpouse ? incomeSources.find(s => s.type === 'pension' && s.owner === 'spouse') : undefined;
  const spousePartTimeSource = plan.hasSpouse ? incomeSources.find(s => s.type === 'partTime' && s.owner === 'spouse') : undefined;

  const incomePlan = {
    currentAge,
    retireAge,
    longevityAge,
    salary: salarySource ? { annualAmount: salarySource.amount, growthRate: salarySource.growthRate / 100, endAge: salarySource.endAge } : undefined,
    socialSecurity: ssSource ? { monthlyBenefitAtFRA: ssSource.monthlyBenefit, startAge: ssSource.startAge, cola: 0.02 } : undefined,
    pension: pensionSource ? { monthlyAmount: pensionSource.monthlyAmount, startAge: pensionSource.startAge, cola: pensionSource.cola ? 0.02 : 0 } : undefined,
    partTime: partTimeSource ? { annualAmount: partTimeSource.annualAmount, startAge: partTimeSource.startAge, endAge: partTimeSource.endAge } : undefined,
    rental: rentalSource ? { monthlyNetIncome: rentalSource.monthlyNet, annualAppreciation: rentalSource.appreciation / 100 } : undefined,
    spouse: plan.hasSpouse ? {
      currentAge: plan.spouseCurrentAge ?? currentAge,
      retireAge: plan.spouseRetireAge ?? retireAge,
      longevityAge: plan.spouseLongevityAge ?? longevityAge,
      salary: spouseSalarySource ? { annualAmount: spouseSalarySource.amount, growthRate: spouseSalarySource.growthRate / 100, endAge: spouseSalarySource.endAge } : undefined,
      socialSecurity: spouseSsSource ? { monthlyBenefitAtFRA: spouseSsSource.monthlyBenefit, startAge: spouseSsSource.startAge, cola: 0.02 } : undefined,
      pension: spousePensionSource ? { monthlyAmount: spousePensionSource.monthlyAmount, startAge: spousePensionSource.startAge, cola: spousePensionSource.cola ? 0.02 : 0 } : undefined,
      partTime: spousePartTimeSource ? { annualAmount: spousePartTimeSource.annualAmount, startAge: spousePartTimeSource.startAge, endAge: spousePartTimeSource.endAge } : undefined,
    } : undefined,
  };

  const incomeProjections = projectIncome(incomePlan);

  // Build TWO expense plans: working years vs retirement
  const retireSpend = plan.retireSpending || Math.round(annualSpending * 0.8);
  const inflationRate = rateOr(plan.inflationRate, 2.5) / 100;

  // Expense rows must span the WHOLE household horizon, not just the
  // primary's longevity. Income rows (projectIncome) run to the younger
  // spouse's longevity in the primary's age frame; when expense rows ended
  // at the primary's longevityAge, every survivor year past it fell into
  // the `|| { totalExpense: 0 }` default — the surviving spouse lived
  // expense-free and plan solvency was drastically overstated for any
  // couple with an age gap.
  const expenseHorizonAge = plan.hasSpouse
    ? Math.max(
        longevityAge,
        currentAge + ((plan.spouseLongevityAge ?? longevityAge) - (plan.spouseCurrentAge ?? currentAge))
      )
    : longevityAge;

  const workingExpensePlan = createDefaultExpensePlan(currentAge, retireAge, annualSpending, expenseHorizonAge);
  workingExpensePlan.longevityAge = expenseHorizonAge;
  workingExpensePlan.goGoEndAge = goGoEndAge;
  workingExpensePlan.slowGoEndAge = slowGoEndAge;
  workingExpensePlan.inflationRate = inflationRate;
  workingExpensePlan.healthcareInflation = rateOr(plan.healthcareInflation, 3.5) / 100;
  let mappedDebts = [];
  if (plan.debts && plan.debts.length > 0) {
    mappedDebts = plan.debts.map(d => ({
      name: d.name,
      monthlyPayment: d.monthlyPayment,
      remainingBalance: d.remainingBalance,
      interestRate: d.interestRate / 100,
      payoffAge: (() => {
        const mr = (d.interestRate || 0) / 100 / 12;
        if (d.monthlyPayment <= 0 || d.remainingBalance <= 0) return currentAge;
        // If monthly interest meets or exceeds the payment, the balance never
        // shrinks — the debt is unpayable at this rate, so it persists for the
        // entire projection. Don't collapse to currentAge (instant payoff).
        if (mr > 0 && mr * d.remainingBalance >= d.monthlyPayment) return longevityAge;
        const months = mr > 0
          ? Math.ceil(-Math.log(1 - mr * d.remainingBalance / d.monthlyPayment) / Math.log(1 + mr))
          : Math.ceil(d.remainingBalance / d.monthlyPayment);
        return currentAge + Math.ceil((isFinite(months) && months > 0 ? months : 0) / 12);
      })(),
    }));
  }
  // Debts belong on BOTH plans. They were previously attached only to the
  // working plan; the row merge takes retirement rows from retireProjections,
  // so a mortgage with a payoff age of 77 silently stopped costing anything
  // the day the user retired at 62 — hundreds of thousands of understated
  // retirement expenses.
  workingExpensePlan.debts = mappedDebts;

  const retireExpensePlan = createDefaultExpensePlan(currentAge, retireAge, retireSpend, expenseHorizonAge);
  retireExpensePlan.longevityAge = expenseHorizonAge;
  retireExpensePlan.goGoEndAge = goGoEndAge;
  retireExpensePlan.slowGoEndAge = slowGoEndAge;
  retireExpensePlan.inflationRate = inflationRate;
  retireExpensePlan.healthcareInflation = rateOr(plan.healthcareInflation, 3.5) / 100;
  retireExpensePlan.debts = mappedDebts;
  // Long-term care: shown and editable in My Plan → Expenses. 0 = off.
  workingExpensePlan.ltcMonthly = retireExpensePlan.ltcMonthly = rateOr(plan.ltcMonthly, LTC_DEFAULT_MONTHLY);

  // Apply user's healthcare multiplier to all healthcare line items in both
  // expense plans. Default 1.0 = no change. Users with chronic conditions
  // bump to 1.5-3.0; very healthy retirees can drop to 0.7-0.9.
  const healthcareMultiplier = plan.healthcareMultiplier || 1.0;
  if (healthcareMultiplier !== 1.0) {
    [workingExpensePlan, retireExpensePlan].forEach(p => {
      p.healthcare = p.healthcare.map(hc => ({
        ...hc,
        monthlyPremium: hc.monthlyPremium * healthcareMultiplier,
      }));
    });
  }

  const workingProjections = projectExpenses(workingExpensePlan);
  const retireProjections = projectExpenses(retireExpensePlan);

  const expenseProjections = workingProjections.map((wp, i) => {
    const rp = retireProjections[i];
    if (wp.phase === 'working') return wp;
    return rp || wp;
  });

  const essentialTotal = workingExpensePlan.essentialExpenses.reduce((s, e) => s + e.annualAmount, 0);
  const discretionaryTotal = workingExpensePlan.discretionaryExpenses.reduce((s, e) => s + e.annualAmount, 0);
  const retireScale = annualSpending > 0 ? retireSpend / annualSpending : 1;
  const retireEssentialTotal = Math.round(essentialTotal * retireScale);
  const retireDiscretionaryTotal = Math.round(discretionaryTotal * retireScale);

  // Per-spouse 401(k) / Roth / HSA tracking — required for correct RMD math
  // when one spouse hits 73 before the other. Closes the AUDIT.md known
  // limitation: the previous combined-pool approach used primary's age as
  // the RMD divisor on the entire household 401(k), over-RMDing when the
  // spouse was younger and not yet 73. Pension stays per-spouse as well
  // because Phase F applies survivor benefit % to the deceased's pension.
  const spouseFactor = plan.hasSpouse ? 1 : 0;
  let bal401kPrimary = plan.savings401k || 0;
  let bal401kSpouse = spouseFactor * (plan.spouseSavings401k || 0);
  let balRothPrimary = plan.savingsRoth || 0;
  let balRothSpouse = spouseFactor * (plan.spouseSavingsRoth || 0);
  let balHSAPrimary = plan.savingsHSA || 0;
  let balHSASpouse = spouseFactor * (plan.spouseSavingsHSA || 0);
  let balPensionPrimary = plan.savingsPension || 0;
  let balPensionSpouse = spouseFactor * (plan.spouseSavingsPension || 0);
  // Combined views maintained for the existing waterfall/portfolio math.
  // Updated in lockstep with per-spouse buckets at end of each year.
  let bal401k = bal401kPrimary + bal401kSpouse;
  let balRoth = balRothPrimary + balRothSpouse;
  let balHSA = balHSAPrimary + balHSASpouse;
  let balPension = balPensionPrimary + balPensionSpouse;
  // Joint household accounts — already at household level.
  let balTaxable = plan.savingsTaxable || 0;
  let balCash = plan.savingsCash || 0;
  let balCrypto = plan.savingsCrypto || 0;
  let balAnnuity = plan.savingsAnnuity || 0;
  let balRealEstate = plan.savingsRealEstate || 0;
  let bal529 = plan.savings529 || 0;
  // Combined monthly contribution while either spouse is still working.
  const householdMonthlyContrib = monthlyContrib + spouseFactor * (plan.spouseMonthlyContribution || 0);
  let portfolioBalance = bal401k + balRoth + balTaxable + balHSA + balCash + balCrypto + balPension + balAnnuity + balRealEstate + bal529;
  const startingBalance = portfolioBalance;
  const rmdDivisor = (age) => RMD_TABLE[Math.min(age, 110)] || 8.9;

  // Anchor calendar year to 2026 — matches IRS Rev. Proc. 2025-32 figures
  // baked into taxEngine.ts. Row i corresponds to taxYear = BASE_TAX_YEAR + i.
  // Used to gate the OBBBA senior bonus deduction (effective 2025-2028 only).
  // When constants update to 2027, bump this in lockstep.
  const BASE_TAX_YEAR = 2026;
  const healthcareInflationRate = rateOr(plan.healthcareInflation, 3.5) / 100;
  const magiHistory = []; // { magi, filingStatus } per row, for the IRMAA lookback
  let trimLevel = 0; // spendTrim state: current cut fraction, carried across years

  const combined = incomeProjections.map((inc, i) => {
    const exp = expenseProjections[i] || { totalExpense: 0, healthcare: 0 };
    const age = inc.age;
    const taxYear = BASE_TAX_YEAR + i;
    // Income here grows with inflation, so the 2026 brackets and deductions
    // must too (the IRS indexes them yearly). Without this a steady real
    // income crept into higher brackets: ~$25K/yr of phantom federal tax by
    // age 80 on a $125K-in-today's-dollars retirement income.
    const indexFactor = Math.pow(1 + inflationRate, i);

    // RMD calculation — per-spouse, keyed on each spouse's age and their
    // own 401(k) balance. Closes the previous over-RMD bug where combined-
    // pool RMD was forced on the younger spouse via primary's divisor.
    // Deceased spouses don't RMD in years they're not alive (their balance
    // rolls into survivor's bucket — see balance update below).
    const spouseAge = inc.spouseAge;
    const primaryAlive = inc.primaryAlive !== false; // singles plans = true
    const spouseAlive = !!inc.spouseAlive;
    let rmdPrimary = 0;
    if (primaryAlive && age >= RMD_START && bal401kPrimary > 0) {
      rmdPrimary = bal401kPrimary / rmdDivisor(age);
    }
    let rmdSpouse = 0;
    if (plan.hasSpouse && spouseAlive && spouseAge != null && spouseAge >= RMD_START && bal401kSpouse > 0) {
      rmdSpouse = bal401kSpouse / rmdDivisor(spouseAge);
    }
    const rmdAmount = Math.round(rmdPrimary + rmdSpouse);

    // Per-year filing status — flips MFJ→single in the year AFTER first
    // spouse death (calendar year of death stays MFJ per IRS rule, handled
    // in incomeEngine.filingStatusHint).
    const yearFilingStatus = inc.filingStatusHint || filingStatus;

    // Per-spouse contribution gating — needed BEFORE the tax passes because
    // the traditional-401(k) share (60%) of Monthly Investing is a PRE-TAX
    // deferral that reduces taxable wages. Taxing the full salary while also
    // crediting the deferral to the 401(k) overstated working-year tax by
    // the deferral × marginal rate (e.g. $3.4K/yr on $150K + $2K/mo).
    const primaryWorking = !inc.isRetired && primaryAlive;
    const spouseWorking = plan.hasSpouse && inc.spouseIsRetired === false && spouseAlive;
    const primaryYearContrib = (primaryWorking ? monthlyContrib * 12 : 0);
    const spouseYearContrib = (spouseWorking ? (plan.spouseMonthlyContribution || 0) * 12 : 0);
    const deferral401k = Math.min(inc.salary || 0, (primaryYearContrib + spouseYearContrib) * 0.6);

    const baseOrdinaryIncome = inc.salary + inc.pension + inc.rental + inc.annuity + inc.partTime + inc.otherIncome;
    // Taxable base excludes the pre-tax deferral; cash-flow figures
    // (baseIncome/totalIncome) keep the full salary.
    const taxableOrdinaryBase = Math.max(0, baseOrdinaryIncome - deferral401k);
    const baseIncome = baseOrdinaryIncome + inc.socialSecurity;

    // The forced RMD is INCOME in pass 1, not an afterthought. Bolting it
    // onto the 401(k) withdrawal after the waterfall ran meant the waterfall
    // never knew the RMD existed: a retiree whose RMD alone covered spending
    // still sold taxable/crypto (realizing phantom capital gains) to cover
    // the same need twice.
    const taxPass1 = computeTax({
      filingStatus: yearFilingStatus, ordinaryIncome: taxableOrdinaryBase + rmdAmount,
      socialSecurityBenefit: inc.socialSecurity, capitalGains: 0,
      stateCode, age, taxYear, indexFactor,
      spouseAge: plan.hasSpouse && spouseAlive ? spouseAge : undefined,
      // State retirement-income exemptions apply to pension/annuity income
      // even before any withdrawals — omitting this overstated pass-1 state
      // tax in exempt states and inflated the initial withdrawal target.
      retirementIncome: (inc.pension || 0) + (inc.annuity || 0) + rmdAmount,
    });

    // Medicare IRMAA is real spending for each person on Medicare. SSA sets
    // it from MAGI two years earlier, against thresholds indexed to inflation
    // (so compare in 2026 dollars), and the surcharge grows like Part B
    // premiums (healthcare inflation). Using the lookback year also keeps
    // this year's withdrawals from feeding back into this year's surcharge.
    // The first two years have no projected lookback, so they use this
    // year's income before withdrawals.
    const onMedicare = (primaryAlive && age >= 65 ? 1 : 0)
      + (plan.hasSpouse && spouseAlive && spouseAge != null && spouseAge >= 65 ? 1 : 0);
    const lookback = magiHistory[i - 2] || { magi: taxPass1.magi, filingStatus: yearFilingStatus, index: i };
    const lookbackIndex = lookback.index ?? i - 2;
    const irmaaMonthly = onMedicare
      ? irmaaSurcharge2026(lookback.magi / Math.pow(1 + inflationRate, lookbackIndex), lookback.filingStatus)
        * Math.pow(1 + healthcareInflationRate, i)
      : 0;
    // Guardrails trim (odds runs only): hysteresis on the balance vs the
    // steady path at the same age. Trims everyday spending; healthcare and
    // long-term care (exp.healthcare) are never trimmed.
    let trimApplied = 0;
    if (spendTrim && (plan.hasSpouse ? inc.isHouseholdRetired : inc.isRetired)) {
      const trigger = spendTrim.trigger ?? 0.85;
      const resume = spendTrim.resume ?? 1.0;
      const maxCut = spendTrim.cut ?? 0.25;
      const step = spendTrim.step ?? 0.05;
      // PROGRESSIVE Guyton-style trims: each year the balance sits below
      // `trigger` × the steady path's, the cut deepens by `step`, up to
      // `maxCut`; each year at/above `resume` × plan, it eases back by one
      // step. One fixed small trim barely moved the odds (failures run
      // years deep); what rescues a path is cuts that stack while trouble
      // persists — which is also what retirees actually do.
      // The reference is floored at 15% of the starting balance: late in a
      // knife-edge plan the steady reference itself approaches $0, and a
      // bare ratio test would disengage the guardrail exactly when the
      // path is gliding into failure.
      const floor = 0.15 * (spendTrim.refBalances?.[0] || 0);
      const ref = Math.max(spendTrim.refBalances?.[i] ?? 0, floor);
      if (ref > 0) {
        if (portfolioBalance < trigger * ref) trimLevel = Math.min(maxCut, trimLevel + step);
        else if (portfolioBalance >= resume * ref) trimLevel = Math.max(0, trimLevel - step);
      }
      if (trimLevel > 0) {
        // Healthcare and long-term care never trim.
        const trimmable = Math.max(0, exp.totalExpense - (exp.healthcare || 0));
        trimApplied = trimmable * trimLevel;
      }
    }
    const yearExpense = exp.totalExpense - trimApplied + irmaaMonthly * 12 * onMedicare;

    // The RMD is cash in hand this year, so it nets against spending before
    // the waterfall decides what else to sell.
    const netAfterTax1 = baseIncome + rmdAmount - taxPass1.totalTax;
    const shortfall = yearExpense - netAfterTax1;

    // Contributions must be FUNDED by this year's own cash flow. Crediting
    // planned Monthly Investing unconditionally minted money in gap years:
    // salary ended, income $0, withdrawals covered expenses — and $24K/yr of
    // "contributions" still appeared in the balances from nowhere,
    // compounding for decades. Savings only happen out of income left after
    // taxes and spending; when the surplus covers part of the plan, that
    // part happens. (The pre-tax deferral above is computed from PLANNED
    // contributions — in the rare partially-funded year the deduction is
    // slightly overstated for one tax pass; the dominant error was the
    // phantom principal, which this closes exactly.)
    const plannedContrib = primaryYearContrib + spouseYearContrib;
    const contribRatio = plannedContrib > 0
      ? Math.min(1, Math.max(0, netAfterTax1 - yearExpense) / plannedContrib)
      : 0;
    const primaryContribFunded = primaryYearContrib * contribRatio;
    const spouseContribFunded = spouseYearContrib * contribRatio;

    const liquidBalance = bal401k + balRoth + balTaxable + balHSA + balCash + balCrypto + balPension + balAnnuity;

    // Embedded gains in taxable brokerage / crypto grow over time as
    // appreciation compounds — matches the curve used in WithdrawalStrategy.
    // Annuities are kept at a separate 30% (exclusion-ratio approximation).
    const yearsRetired = Math.max(0, age - retireAge);
    const gainsRatio = Math.min(0.8, 0.3 + yearsRetired * 0.02);

    // When the user opted in, real estate is drawable as the LAST resort —
    // modeling downsizing, a sale, or a reverse mortgage. Without this, RE
    // sat in net worth forever while the plan reported shortfalls: a user
    // could show a $1.5M portfolio at 100 (mostly home equity compounding)
    // and still be "short" because the waterfall never touched it.
    const reDrawable = plan.useRealEstateInRetirement ? balRealEstate : 0;

    // 401(k) capacity available for EXTRA draws beyond the forced RMD —
    // the RMD portion is already income in pass 1.
    const bal401kForDraw = Math.max(0, bal401k - rmdAmount);

    // Run the withdrawal waterfall at a given marginal rate. Returns the per-
    // account withdrawals; gross-up only applies to ordinary-income accounts.
    const runWaterfall = (marginalRate, need = shortfall) => {
      let w401k = 0, wRoth = 0, wTaxable = 0, wHSA = 0;
      let wCash = 0, wCrypto = 0, wAnnuity = 0, wPension = 0, wRealEstate = 0;
      // Any year with a shortfall draws down — NOT just retirement years.
      // Previously gated on inc.isRetired, which made pre-retirement gap
      // years (salary ended early, sabbatical, laid off) spend money from
      // nowhere: expenses went unpaid while balances compounded untouched,
      // producing incoherent tables (income $0, expenses $200K, withdrawals
      // $0, portfolio UP) and overstating how long money lasts. Working
      // years where income covers expenses have need <= 0 and still draw
      // nothing, so normal accumulation is unaffected.
      if (need > 0 && liquidBalance + reDrawable > 0) {
        let remaining = need;
        if (remaining > 0 && balCash > 0)    { wCash    = Math.min(remaining, balCash);    remaining -= wCash; }
        if (remaining > 0 && balTaxable > 0) { wTaxable = Math.min(remaining, balTaxable); remaining -= wTaxable; }
        if (remaining > 0 && balCrypto > 0)  { wCrypto  = Math.min(remaining, balCrypto);  remaining -= wCrypto; }
        if (remaining > 0 && balAnnuity > 0) { wAnnuity = Math.min(remaining, balAnnuity); remaining -= wAnnuity; }
        if (remaining > 0 && bal401kForDraw > 0) {
          const grossUp = remaining / (1 - marginalRate);
          w401k = Math.min(grossUp, bal401kForDraw);
          remaining -= w401k * (1 - marginalRate);
        }
        if (remaining > 0 && balPension > 0) {
          const grossUp = remaining / (1 - marginalRate);
          wPension = Math.min(grossUp, balPension);
          remaining -= wPension * (1 - marginalRate);
        }
        // HSA — assumes withdrawals offset qualified medical expenses (tax-free).
        // Drawn before Roth: HSAs lose tax-free status for non-spouse heirs.
        if (remaining > 0 && balHSA > 0)     { wHSA     = Math.min(remaining, balHSA);     remaining -= wHSA; }
        if (remaining > 0 && balRoth > 0)    { wRoth    = Math.min(remaining, balRoth);    remaining -= wRoth; }
        // Real estate last: selling the home is the biggest life decision on
        // the list. Proceeds modeled tax-free — primary-home gains are largely
        // §121-excluded ($250K/$500K) and reverse-mortgage draws are loan
        // proceeds, not income.
        if (remaining > 0 && reDrawable > 0) { wRealEstate = Math.min(remaining, reDrawable); remaining -= wRealEstate; }
      }
      return { w401k, wRoth, wTaxable, wHSA, wCash, wCrypto, wAnnuity, wPension, wRealEstate };
    };

    // Iterative gross-up. A single marginal-rate gross-up under-covers the
    // withdrawal whenever it drags more Social Security into the taxable base
    // (the SS "tax torpedo" feedback) — the affluent dual-SS couple ends up
    // ~1-2% short every retirement year, which silently overstates depletion.
    // Solve it: withdraw to cover the current target, compute the REAL tax
    // (incl. SS taxability + state exemptions), and if net still falls short,
    // raise the target by the residual grossed at the actual marginal rate and
    // repeat. Converges in 2-3 passes; the cap bounds genuinely-broke years.
    // runWaterfall recomputes from the full start-of-year balances each call,
    // so repeated calls are idempotent (no double-withdrawal).
    const availableForDraw =
      balCash + balTaxable + balCrypto + balAnnuity + bal401k + balPension + balHSA + balRoth + reDrawable;

    let withdrawal401k, withdrawalRoth, withdrawalTaxable, withdrawalHSA;
    let withdrawalCash, withdrawalCrypto, withdrawalAnnuity, withdrawalPension, withdrawalRealEstate;
    let totalOrdinaryIncome, capitalGains, retirementIncome, taxResult, totalIncome, netAfterTax;

    // Evaluate one candidate withdrawal target end to end: run the
    // waterfall, add the forced RMD into the 401(k) draw, compute the REAL
    // tax (SS taxability, state exemptions, gains stacking), and return the
    // residual (unmet spending; negative = overshoot). Idempotent — every
    // call recomputes from start-of-year balances.
    const applyNeed = (needVal, marginalRate) => {
      const w = runWaterfall(marginalRate, needVal);
      withdrawal401k = w.w401k + rmdAmount; // forced RMD + any extra draw
      withdrawalRoth = w.wRoth; withdrawalTaxable = w.wTaxable; withdrawalHSA = w.wHSA;
      withdrawalCash = w.wCash; withdrawalCrypto = w.wCrypto; withdrawalAnnuity = w.wAnnuity;
      withdrawalPension = w.wPension; withdrawalRealEstate = w.wRealEstate;

      // Cash withdrawals are excluded from ordinary income (return of
      // principal; interest is modeled via cashReturn). Only tax-deferred
      // accounts (401k, pension lump) create ordinary income when drawn.
      totalOrdinaryIncome = taxableOrdinaryBase + withdrawal401k + withdrawalPension;
      capitalGains = Math.round(withdrawalTaxable * gainsRatio)
        + Math.round(withdrawalCrypto * gainsRatio)
        + Math.round(withdrawalAnnuity * 0.3);
      // Retirement income for state-exemption purposes: pension + annuity +
      // tax-deferred withdrawals. Salary, rental, part-time do NOT qualify.
      retirementIncome = (inc.pension || 0) + (inc.annuity || 0) + withdrawal401k + withdrawalPension;

      taxResult = computeTax({
        filingStatus: yearFilingStatus, ordinaryIncome: totalOrdinaryIncome,
        socialSecurityBenefit: inc.socialSecurity, capitalGains,
        stateCode, age, taxYear, indexFactor, retirementIncome,
        // MFJ 65+ extras (additional deduction, OBBBA senior bonus, GA-style
        // per-spouse caps) key off the spouse's age too — omitting it
        // overtaxed every 65+ couple ~$900+/yr.
        spouseAge: plan.hasSpouse && spouseAlive ? spouseAge : undefined,
      });

      totalIncome = baseIncome + withdrawal401k + withdrawalRoth + withdrawalTaxable + withdrawalHSA
        + withdrawalCash + withdrawalCrypto + withdrawalAnnuity + withdrawalPension + withdrawalRealEstate;
      netAfterTax = totalIncome - taxResult.totalTax;
      return yearExpense - netAfterTax;
    };
    const totalWithdrawn = () => withdrawal401k + withdrawalRoth + withdrawalTaxable + withdrawalHSA
      + withdrawalCash + withdrawalCrypto + withdrawalAnnuity + withdrawalPension + withdrawalRealEstate;

    let need = shortfall;
    let rate = taxPass1.marginalRate || 0.22;
    let residual = applyNeed(need, rate);

    for (let iter = 0; iter < 5; iter++) {
      // Covered, or nothing left to draw (a genuine shortfall — stop).
      if (residual <= 1 || totalWithdrawn() >= availableForDraw - 1) break;
      // Raise the target by the residual grossed at the true marginal rate.
      rate = Math.min(0.6, Math.max(rate, taxResult.marginalRate || rate));
      need += residual / (1 - rate);
      residual = applyNeed(need, rate);
    }

    // Downward correction. When the marginal rate RISES mid-loop, the bump
    // above regrosses the whole accumulated need at the higher rate — a
    // single 65-year-old on a $4M 401(k) was over-drawn ~19% every year
    // ($226K for a $155K spend), paying ~$9K/yr of avoidable tax and
    // crossing IRMAA tiers the correct draw never touches. Near the
    // solution, net-after-tax moves ≈ 1-for-1 with the target (that's what
    // the gross-up is for), so damped Newton steps converge in 2-3 passes
    // where a bisection needed dozens. Finish covering: never leave
    // spending unmet to shave a surplus.
    if (-residual > 50) {
      for (let k = 0; k < 6 && -residual > 50; k++) {
        need = Math.max(0, need + residual * 0.9); // residual < 0 shrinks the target
        residual = applyNeed(need, rate);
      }
      if (residual > 1 && totalWithdrawn() < availableForDraw - 1) {
        need += residual / (1 - rate);
        residual = applyNeed(need, rate);
      }
    }

    magiHistory.push({ magi: taxResult.magi, filingStatus: yearFilingStatus });
    const gap = netAfterTax - yearExpense;

    const balanceStart = portfolioBalance;
    const retiredReturnPct = rateOr(plan.retiredReturnPct, 60) / 100;
    // Household-aware retirement allocation: shift to conservative returns
    // only once BOTH members have stopped working. For singles, isRetired
    // and isHouseholdRetired are equivalent.
    const fullyRetired = plan.hasSpouse ? !!inc.isHouseholdRetired : !!inc.isRetired;
    // A shock scales with the retired allocation like the mean does — the
    // conservative retirement mix is both lower-return and lower-risk. The
    // drag term (scaled by the square, as variance is) lifts the average
    // year so a volatile path compounds at the plan's rate in the middle
    // case rather than below it.
    const allocation = fullyRetired ? retiredReturnPct : 1;
    // Per-bucket return with the volatility-drag correction scaled by the
    // SQUARE of the bucket's total exposure (f × allocation) — variance
    // scales with the square of exposure, so a bucket at half the return
    // (HSA, pension, 529) needs a quarter of the drag. Scaling the drag
    // linearly (the old `yearReturn × f`) over-corrected those buckets and
    // drifted HSA/pension-heavy odds up ~0.08%/yr of phantom growth.
    const shockedReturn = (f = 1) => returnShocks
      ? f * allocation * (returnRate + (returnShocks[i] ?? 0)) + (f * allocation) ** 2 * returnDrag
      : f * allocation * returnRate;
    const yearReturn = shockedReturn(1);
    const cashRate = rateOr(plan.cashReturn, 3) / 100;
    const annuityRate = rateOr(plan.annuityReturn, 3.5) / 100;
    const reRate = rateOr(plan.realEstateAppreciation, 3) / 100;

    // Retirement surplus is REAL money and must land somewhere. Forced RMDs
    // beyond spending, pension/SS above expenses, and gross-up overshoot all
    // produce gap > 0 in retirement — previously that cash simply evaporated
    // from the ledger (a wealthy retiree's projection bled the entire excess
    // RMD stream, hundreds of thousands over 20 years). Sweep it into the
    // taxable account. Working-year salary surplus intentionally still
    // evaporates: Monthly Investing already models deliberate saving, and
    // auto-investing the rest would double-count lifestyle spending slack.
    const surplusReinvested = fullyRetired && gap > 0 ? gap : 0;

    // Allocate withdrawals per-spouse: per-spouse RMD comes from each
    // spouse's own bucket; any extra 401(k) withdrawal comes from primary
    // first (matches the convention used elsewhere — primary "leads" the
    // drawdown waterfall). Same convention for Roth and HSA.
    const allocate = (total, primaryBal, spouseBal, primaryForced, spouseForced) => {
      let pPart = Math.min(primaryForced, primaryBal);
      let sPart = Math.min(spouseForced, spouseBal);
      let extra = Math.max(0, total - pPart - sPart);
      const fromPrimary = Math.min(extra, primaryBal - pPart);
      pPart += fromPrimary;
      extra -= fromPrimary;
      sPart += Math.min(extra, spouseBal - sPart);
      return { pPart, sPart };
    };
    const w401kAlloc = allocate(withdrawal401k, bal401kPrimary, bal401kSpouse, rmdPrimary, rmdSpouse);
    const wRothAlloc = allocate(withdrawalRoth, balRothPrimary, balRothSpouse, 0, 0);
    const wHSAAlloc = allocate(withdrawalHSA, balHSAPrimary, balHSASpouse, 0, 0);
    const wPensionAlloc = allocate(withdrawalPension, balPensionPrimary, balPensionSpouse, 0, 0);

    // Per-spouse 401(k)/Roth/HSA balance update. Each spouse's bucket grows
    // independently and accepts only that spouse's contribution share.
    bal401kPrimary = Math.max(0, (bal401kPrimary - w401kAlloc.pPart) * (1 + yearReturn)) + primaryContribFunded * 0.6;
    bal401kSpouse  = Math.max(0, (bal401kSpouse  - w401kAlloc.sPart) * (1 + yearReturn)) + spouseContribFunded * 0.6;
    balRothPrimary = Math.max(0, (balRothPrimary - wRothAlloc.pPart) * (1 + yearReturn)) + primaryContribFunded * 0.2;
    balRothSpouse  = Math.max(0, (balRothSpouse  - wRothAlloc.sPart) * (1 + yearReturn)) + spouseContribFunded * 0.2;
    balHSAPrimary  = Math.max(0, (balHSAPrimary  - wHSAAlloc.pPart)  * (1 + shockedReturn(0.5)));
    balHSASpouse   = Math.max(0, (balHSASpouse   - wHSAAlloc.sPart)  * (1 + shockedReturn(0.5)));
    balPensionPrimary = Math.max(0, (balPensionPrimary - wPensionAlloc.pPart) * (1 + shockedReturn(fullyRetired ? 0.5 : 0.6)));
    balPensionSpouse  = Math.max(0, (balPensionSpouse  - wPensionAlloc.sPart) * (1 + shockedReturn(fullyRetired ? 0.5 : 0.6)));

    // Phase F: spousal rollover. When one spouse dies, their tax-deferred
    // and Roth balances roll into the survivor's bucket (treated as the
    // survivor's own — no immediate distribution, preserves tax-deferred
    // status). Triggered the year AFTER first death (when their alive flag
    // first flips to false). Done after the balance update so the year-of-
    // death RMD already came from the deceased's bucket.
    // Gate on ANY nonzero bucket, not just the 401(k) — a deceased spouse
    // with $0 401(k) but a Roth/HSA/pension balance must still roll over.
    if (plan.hasSpouse && !primaryAlive
        && (bal401kPrimary > 0 || balRothPrimary > 0 || balHSAPrimary > 0 || balPensionPrimary > 0)) {
      bal401kSpouse += bal401kPrimary; bal401kPrimary = 0;
      balRothSpouse += balRothPrimary; balRothPrimary = 0;
      balHSASpouse += balHSAPrimary; balHSAPrimary = 0;
      balPensionSpouse += balPensionPrimary; balPensionPrimary = 0;
    }
    if (plan.hasSpouse && !spouseAlive
        && (bal401kSpouse > 0 || balRothSpouse > 0 || balHSASpouse > 0 || balPensionSpouse > 0)) {
      bal401kPrimary += bal401kSpouse; bal401kSpouse = 0;
      balRothPrimary += balRothSpouse; balRothSpouse = 0;
      balHSAPrimary += balHSASpouse; balHSASpouse = 0;
      balPensionPrimary += balPensionSpouse; balPensionSpouse = 0;
    }

    // Joint household balances — unchanged by Phase F (taxable, cash, RE,
    // 529, crypto, annuity are owned at the household level).
    // FUNDED contributions only — see the funding gate above.
    const yearContribAnnual = primaryContribFunded + spouseContribFunded;
    balTaxable = Math.max(0, (balTaxable - withdrawalTaxable) * (1 + yearReturn)) + yearContribAnnual * 0.2 + surplusReinvested;
    balCash = Math.max(0, (balCash - withdrawalCash) * (1 + cashRate * (fullyRetired ? 0.8 : 1)));
    balCrypto = Math.max(0, (balCrypto - withdrawalCrypto) * (1 + yearReturn));
    balAnnuity = Math.max(0, (balAnnuity - withdrawalAnnuity) * (1 + annuityRate));
    balRealEstate = Math.max(0, (balRealEstate - withdrawalRealEstate) * (1 + reRate));
    bal529 = bal529 * (1 + shockedReturn(fullyRetired ? 0.6 : 0.8));

    // Sync combined views from per-spouse buckets — used by next year's
    // waterfall and portfolioBalance metric.
    bal401k = bal401kPrimary + bal401kSpouse;
    balRoth = balRothPrimary + balRothSpouse;
    balHSA = balHSAPrimary + balHSASpouse;
    balPension = balPensionPrimary + balPensionSpouse;
    portfolioBalance = bal401k + balRoth + balTaxable + balHSA + balCash + balCrypto + balPension + balAnnuity + balRealEstate + bal529;
    if (portfolioBalance < 0) portfolioBalance = 0;

    const totalWithdrawals = withdrawal401k + withdrawalRoth + withdrawalTaxable + withdrawalHSA
      + withdrawalCash + withdrawalCrypto + withdrawalAnnuity + withdrawalPension + withdrawalRealEstate;
    const ssAndOther = inc.socialSecurity + inc.pension + inc.rental + inc.annuity;
    const liquidBalanceEnd = bal401k + balRoth + balTaxable + balHSA + balCash + balCrypto + balPension + balAnnuity;

    return {
      age: inc.age,
      year: inc.year,
      salary: inc.salary,
      socialSecurity: inc.socialSecurity,
      pension: inc.pension,
      rental: inc.rental,
      ssAndOther,
      totalWithdrawals,
      rmd: rmdAmount,
      withdrawal401k,
      withdrawalRoth,
      withdrawalTaxable,
      withdrawalHSA,
      withdrawalCash,
      withdrawalCrypto,
      withdrawalAnnuity,
      withdrawalPension,
      withdrawalRealEstate,
      totalIncome,
      totalExpense: Math.round(yearExpense),
      healthcare: Math.round(exp.healthcare + irmaaMonthly * 12 * onMedicare),
      federalTax: taxResult.federalTax,
      stateTax: taxResult.stateTax,
      totalTax: taxResult.totalTax,
      effectiveRate: taxResult.effectiveRate,
      marginalRate: taxResult.marginalRate,
      // Monthly IRMAA surcharge per person on Medicare (see yearExpense);
      // 0 until someone in the household is 65+.
      irmaa: Math.round(irmaaMonthly * 100) / 100,
      magi: taxResult.magi,
      ssTaxablePercent: taxResult.ssTaxablePercent,
      provisionalIncome: taxResult.provisionalIncome,
      netAfterTax: Math.round(netAfterTax),
      gap: Math.round(gap),
      portfolioBalance: Math.round(balanceStart),
      portfolioEndBalance: Math.round(portfolioBalance),
      // portfolioReturn = market return on capital, ignoring drawdowns and
      // net deposits. With beginning-of-year withdrawals this equals
      // (end − (start − withdrawn) − new money in).
      portfolioReturn: Math.round(portfolioBalance - balanceStart + totalWithdrawals - yearContribAnnual - surplusReinvested),
      // Total new money credited to balances this year: the 401k/Roth/taxable
      // split of both members' Monthly Investing, plus retirement surplus
      // swept into taxable. Emitted so the ledger view can close the
      // identity: end = start + growth + contributions − withdrawals, with
      // growth derived (bucket rates differ, so growth is the residual of
      // the exact identity, not one blended rate).
      contributions: Math.round(yearContribAnnual + surplusReinvested),
      liquidBalance: Math.round(liquidBalanceEnd),
      // Real estate balance and "available wealth" — when the user opts to
      // draw from RE in retirement (plan.useRealEstateInRetirement), RE
      // counts as spendable for broke-age detection. The chart's "Liquid
      // (spendable)" line still uses liquidBalance — true cash today.
      realEstateBalance: Math.round(balRealEstate),
      availableBalance: Math.round(
        liquidBalanceEnd + (plan.useRealEstateInRetirement ? balRealEstate : 0)
      ),
      isRetired: inc.isRetired,
      isRetireYear: inc.age === retireAge,
      // Phase F survivor flags — surfaced for UI banners and the
      // year-by-year filing-status indicator (MyPlan consumes these).
      primaryAlive,
      spouseAlive,
      widowed: inc.widowed,
      filingStatus: yearFilingStatus,
      spouseAge: inc.spouseAge,
    };
  });

  const retireRowData = combined.find(r => r.age === retireAge);
  const portfolioAtRetire = retireRowData ? retireRowData.portfolioBalance : 0;

  const totalLifetimeIncome = combined.reduce((s, r) => s + r.totalIncome, 0);
  const totalLifetimeTax = combined.reduce((s, r) => s + r.totalTax, 0);
  const totalLifetimeExpense = combined.reduce((s, r) => s + r.totalExpense, 0);
  const totalSurplusOrShortfall = combined.reduce((s, r) => s + r.gap, 0);
  const avgEffectiveRate = totalLifetimeIncome > 0 ? totalLifetimeTax / totalLifetimeIncome : 0;

  // Default = the LAST projected age (the younger spouse's horizon for
  // couples), not the primary's longevityAge — otherwise survivor-period
  // solvency could never be reported past the primary's death.
  let moneyLastsAge = combined.length ? combined[combined.length - 1].age : longevityAge;
  for (const r of combined) {
    // Broke is broke in any year — a pre-retirement gap year that exhausts
    // the portfolio counts (matches the waterfall change above).
    if (r.availableBalance <= 0 && r.gap < 0) {
      moneyLastsAge = r.age;
      break;
    }
  }

  // Same availableBalance treatment as moneyLastsAge / firstGapAge — one
  // consistent "broke" definition (RE counts only when the user opted in
  // to drawing it; 529 never counts).
  const yearsCovered = combined.filter(r => {
    if (r.gap >= 0) return true;
    if (r.availableBalance > 0) return true;
    return false;
  }).length;

  // Use liquidBalance — illiquid RE and 529 can't be drawn, matches moneyLastsAge logic.
  const firstGapAge = combined.find(r => r.gap < 0 && r.availableBalance <= 0)?.age;

  return {
    combined,
    essentialTotal,
    discretionaryTotal,
    retireEssentialTotal,
    retireDiscretionaryTotal,
    startingBalance,
    portfolioAtRetire,
    finalBalance: Math.round(portfolioBalance),
    totalLifetimeIncome,
    totalLifetimeTax,
    totalLifetimeExpense,
    totalSurplusOrShortfall,
    yearsCovered,
    avgEffectiveRate,
    moneyLastsAge,
    firstGapAge,
    // The HOUSEHOLD horizon in the primary's age frame — the last projected
    // row, which for couples runs past the primary's longevityAge into the
    // younger spouse's survivor years. "Does the plan last?" must compare
    // moneyLastsAge against THIS, not plan.longevityAge: a 50/43 couple
    // planning to 95/95 projects to primary-age 102, and a steady path that
    // goes broke at 97 left the survivor penniless for five years while
    // every screen still said "lasts the whole way".
    horizonAge: combined.length ? combined[combined.length - 1].age : longevityAge,
  };
}
