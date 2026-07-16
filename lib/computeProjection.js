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
import { projectExpenses, createDefaultExpensePlan } from '@/lib/expenseEngine';
import { computeTax } from '@/lib/taxEngine';
import { RMD_TABLE } from '@/lib/constants';

const RMD_START = 73;

export function computeProjection(plan) {
  const { currentAge, retireAge, longevityAge, filingStatus, stateCode, annualSpending, goGoEndAge, slowGoEndAge, incomeSources } = plan;
  const returnRate = (plan.expectedReturn || 7) / 100;
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
  const inflationRate = (plan.inflationRate || 2.5) / 100;

  const workingExpensePlan = createDefaultExpensePlan(currentAge, retireAge, annualSpending);
  workingExpensePlan.longevityAge = longevityAge;
  workingExpensePlan.goGoEndAge = goGoEndAge;
  workingExpensePlan.slowGoEndAge = slowGoEndAge;
  workingExpensePlan.inflationRate = inflationRate;
  workingExpensePlan.healthcareInflation = (plan.healthcareInflation || 3.5) / 100;
  if (plan.debts && plan.debts.length > 0) {
    workingExpensePlan.debts = plan.debts.map(d => ({
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

  const retireExpensePlan = createDefaultExpensePlan(currentAge, retireAge, retireSpend);
  retireExpensePlan.longevityAge = longevityAge;
  retireExpensePlan.goGoEndAge = goGoEndAge;
  retireExpensePlan.slowGoEndAge = slowGoEndAge;
  retireExpensePlan.inflationRate = inflationRate;
  retireExpensePlan.healthcareInflation = (plan.healthcareInflation || 3.5) / 100;

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

  const combined = incomeProjections.map((inc, i) => {
    const exp = expenseProjections[i] || { totalExpense: 0, healthcare: 0 };
    const age = inc.age;
    const taxYear = BASE_TAX_YEAR + i;

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

    const baseOrdinaryIncome = inc.salary + inc.pension + inc.rental + inc.annuity + inc.partTime + inc.otherIncome;
    const baseIncome = baseOrdinaryIncome + inc.socialSecurity;

    const taxPass1 = computeTax({
      filingStatus: yearFilingStatus, ordinaryIncome: baseOrdinaryIncome,
      socialSecurityBenefit: inc.socialSecurity, capitalGains: 0,
      stateCode, age, taxYear,
    });

    const netAfterTax1 = baseIncome - taxPass1.totalTax;
    const shortfall = exp.totalExpense - netAfterTax1;

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

    // Run the withdrawal waterfall at a given marginal rate. Returns the per-
    // account withdrawals; gross-up only applies to ordinary-income accounts.
    const runWaterfall = (marginalRate, need = shortfall) => {
      let w401k = 0, wRoth = 0, wTaxable = 0, wHSA = 0;
      let wCash = 0, wCrypto = 0, wAnnuity = 0, wPension = 0, wRealEstate = 0;
      if (need > 0 && inc.isRetired && liquidBalance + reDrawable > 0) {
        let remaining = need;
        if (remaining > 0 && balCash > 0)    { wCash    = Math.min(remaining, balCash);    remaining -= wCash; }
        if (remaining > 0 && balTaxable > 0) { wTaxable = Math.min(remaining, balTaxable); remaining -= wTaxable; }
        if (remaining > 0 && balCrypto > 0)  { wCrypto  = Math.min(remaining, balCrypto);  remaining -= wCrypto; }
        if (remaining > 0 && balAnnuity > 0) { wAnnuity = Math.min(remaining, balAnnuity); remaining -= wAnnuity; }
        if (remaining > 0 && bal401k > 0)    {
          const grossUp = remaining / (1 - marginalRate);
          w401k = Math.min(grossUp, bal401k);
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

    let need = shortfall;
    let rate = taxPass1.marginalRate || 0.22;
    let w = runWaterfall(rate, need);

    for (let iter = 0; iter < 5; iter++) {
      withdrawal401k = w.w401k; withdrawalRoth = w.wRoth; withdrawalTaxable = w.wTaxable; withdrawalHSA = w.wHSA;
      withdrawalCash = w.wCash; withdrawalCrypto = w.wCrypto; withdrawalAnnuity = w.wAnnuity;
      withdrawalPension = w.wPension; withdrawalRealEstate = w.wRealEstate;

      // Force at least the RMD out of the tax-deferred bucket at 73+.
      if (rmdAmount > 0 && withdrawal401k < rmdAmount) withdrawal401k = rmdAmount;

      // Cash withdrawals are excluded from ordinary income (return of
      // principal; interest is modeled via cashReturn). Only tax-deferred
      // accounts (401k, pension lump) create ordinary income when drawn.
      totalOrdinaryIncome = baseOrdinaryIncome + withdrawal401k + withdrawalPension;
      capitalGains = Math.round(withdrawalTaxable * gainsRatio)
        + Math.round(withdrawalCrypto * gainsRatio)
        + Math.round(withdrawalAnnuity * 0.3);
      // Retirement income for state-exemption purposes: pension + annuity +
      // tax-deferred withdrawals. Salary, rental, part-time do NOT qualify.
      retirementIncome = (inc.pension || 0) + (inc.annuity || 0) + withdrawal401k + withdrawalPension;

      taxResult = computeTax({
        filingStatus: yearFilingStatus, ordinaryIncome: totalOrdinaryIncome,
        socialSecurityBenefit: inc.socialSecurity, capitalGains,
        stateCode, age, taxYear, retirementIncome,
      });

      totalIncome = baseIncome + withdrawal401k + withdrawalRoth + withdrawalTaxable + withdrawalHSA
        + withdrawalCash + withdrawalCrypto + withdrawalAnnuity + withdrawalPension + withdrawalRealEstate;
      netAfterTax = totalIncome - taxResult.totalTax;

      const residual = exp.totalExpense - netAfterTax;
      // Covered, or nothing left to draw (a genuine shortfall — stop).
      const totalWithdrawn = withdrawal401k + withdrawalRoth + withdrawalTaxable + withdrawalHSA
        + withdrawalCash + withdrawalCrypto + withdrawalAnnuity + withdrawalPension + withdrawalRealEstate;
      if (residual <= 1 || totalWithdrawn >= availableForDraw - 1) break;

      // Raise the target by the residual grossed at the true marginal rate.
      rate = Math.min(0.6, Math.max(rate, taxResult.marginalRate || rate));
      need += residual / (1 - rate);
      w = runWaterfall(rate, need);
    }

    const gap = netAfterTax - exp.totalExpense;

    const balanceStart = portfolioBalance;
    const retiredReturnPct = (plan.retiredReturnPct || 60) / 100;
    // Household-aware retirement allocation: shift to conservative returns
    // only once BOTH members have stopped working. For singles, isRetired
    // and isHouseholdRetired are equivalent.
    const fullyRetired = plan.hasSpouse ? !!inc.isHouseholdRetired : !!inc.isRetired;
    const yearReturn = fullyRetired ? returnRate * retiredReturnPct : returnRate;
    const cashRate = (plan.cashReturn || 3) / 100;
    const annuityRate = (plan.annuityReturn || 3.5) / 100;
    const reRate = (plan.realEstateAppreciation || 3) / 100;

    // Per-spouse contribution gating. Primary's contribution flows while
    // primary works AND is alive; spouse's contribution flows while spouse
    // works AND is alive. Death zeros out the deceased's contribution.
    const primaryWorking = !inc.isRetired && primaryAlive;
    const spouseWorking = plan.hasSpouse && inc.spouseIsRetired === false && spouseAlive;
    const primaryYearContrib = (primaryWorking ? monthlyContrib * 12 : 0);
    const spouseYearContrib = (spouseWorking ? (plan.spouseMonthlyContribution || 0) * 12 : 0);

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
    bal401kPrimary = Math.max(0, (bal401kPrimary - w401kAlloc.pPart) * (1 + yearReturn)) + primaryYearContrib * 0.6;
    bal401kSpouse  = Math.max(0, (bal401kSpouse  - w401kAlloc.sPart) * (1 + yearReturn)) + spouseYearContrib  * 0.6;
    balRothPrimary = Math.max(0, (balRothPrimary - wRothAlloc.pPart) * (1 + yearReturn)) + primaryYearContrib * 0.2;
    balRothSpouse  = Math.max(0, (balRothSpouse  - wRothAlloc.sPart) * (1 + yearReturn)) + spouseYearContrib  * 0.2;
    balHSAPrimary  = Math.max(0, (balHSAPrimary  - wHSAAlloc.pPart)  * (1 + yearReturn * 0.5));
    balHSASpouse   = Math.max(0, (balHSASpouse   - wHSAAlloc.sPart)  * (1 + yearReturn * 0.5));
    balPensionPrimary = Math.max(0, (balPensionPrimary - wPensionAlloc.pPart) * (1 + yearReturn * (fullyRetired ? 0.5 : 0.6)));
    balPensionSpouse  = Math.max(0, (balPensionSpouse  - wPensionAlloc.sPart) * (1 + yearReturn * (fullyRetired ? 0.5 : 0.6)));

    // Phase F: spousal rollover. When one spouse dies, their tax-deferred
    // and Roth balances roll into the survivor's bucket (treated as the
    // survivor's own — no immediate distribution, preserves tax-deferred
    // status). Triggered the year AFTER first death (when their alive flag
    // first flips to false). Done after the balance update so the year-of-
    // death RMD already came from the deceased's bucket.
    if (plan.hasSpouse && !primaryAlive && bal401kPrimary > 0) {
      bal401kSpouse += bal401kPrimary; bal401kPrimary = 0;
      balRothSpouse += balRothPrimary; balRothPrimary = 0;
      balHSASpouse += balHSAPrimary; balHSAPrimary = 0;
      balPensionSpouse += balPensionPrimary; balPensionPrimary = 0;
    }
    if (plan.hasSpouse && !spouseAlive && bal401kSpouse > 0) {
      bal401kPrimary += bal401kSpouse; bal401kSpouse = 0;
      balRothPrimary += balRothSpouse; balRothSpouse = 0;
      balHSAPrimary += balHSASpouse; balHSASpouse = 0;
      balPensionPrimary += balPensionSpouse; balPensionSpouse = 0;
    }

    // Joint household balances — unchanged by Phase F (taxable, cash, RE,
    // 529, crypto, annuity are owned at the household level).
    const yearContribAnnual = primaryYearContrib + spouseYearContrib;
    balTaxable = Math.max(0, (balTaxable - withdrawalTaxable) * (1 + yearReturn)) + yearContribAnnual * 0.2;
    balCash = Math.max(0, (balCash - withdrawalCash) * (1 + cashRate * (fullyRetired ? 0.8 : 1)));
    balCrypto = Math.max(0, (balCrypto - withdrawalCrypto) * (1 + yearReturn));
    balAnnuity = Math.max(0, (balAnnuity - withdrawalAnnuity) * (1 + annuityRate));
    balRealEstate = Math.max(0, (balRealEstate - withdrawalRealEstate) * (1 + reRate));
    bal529 = bal529 * (1 + yearReturn * (fullyRetired ? 0.6 : 0.8));

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
      totalExpense: exp.totalExpense,
      healthcare: exp.healthcare,
      federalTax: taxResult.federalTax,
      stateTax: taxResult.stateTax,
      totalTax: taxResult.totalTax,
      effectiveRate: taxResult.effectiveRate,
      marginalRate: taxResult.marginalRate,
      irmaa: taxResult.irmaa,
      magi: taxResult.magi,
      ssTaxablePercent: taxResult.ssTaxablePercent,
      netAfterTax: Math.round(netAfterTax),
      gap: Math.round(gap),
      portfolioBalance: Math.round(balanceStart),
      portfolioEndBalance: Math.round(portfolioBalance),
      // portfolioReturn = market return on capital, ignoring drawdowns. With
      // beginning-of-year withdrawals, this equals (end - (start - withdrawn)).
      portfolioReturn: Math.round(portfolioBalance - balanceStart + totalWithdrawals),
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

  let moneyLastsAge = longevityAge;
  for (const r of combined) {
    if (r.isRetired && r.availableBalance <= 0 && r.gap < 0) {
      moneyLastsAge = r.age;
      break;
    }
  }

  // Same liquidBalance treatment as moneyLastsAge / firstGapAge — illiquid
  // RE and 529 can't be drawn, so they shouldn't count as "covered."
  const yearsCovered = combined.filter(r => {
    if (r.gap >= 0) return true;
    if (r.liquidBalance > 0) return true;
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
  };
}

/**
 * findBreakingShock — binary-search the smallest uniform return shock (in
 * percentage points) at which the plan no longer covers the user's
 * planned longevity age.
 *
 * Returns:
 *   { shock: number, lastsAge: number, robust: boolean }
 *
 * `robust = true` means even a `maxShock` reduction in expected return
 * doesn't break the plan — money still lasts to longevityAge.
 *
 * `shock = 0` means the plan is already underwater at the user's stated
 * assumptions (no shock needed to break it).
 *
 * Cost: ~maxIter+2 calls to computeProjection (cheap; runs in useMemo).
 */
export function findBreakingShock(plan, { maxShock = 7, iterations = 7 } = {}) {
  const longevity = plan.longevityAge;
  const baseReturn = plan.expectedReturn || 7;
  // The biggest shock we can honestly apply: returns can't drop below 0.
  // If baseReturn is lower than maxShock, the deepest test we can run is
  // baseReturn itself (taking returns to 0%). Reporting the actual ceiling
  // keeps the "robust" claim honest.
  const effectiveMaxShock = Math.min(maxShock, baseReturn);

  const atMax = computeProjection({ ...plan, expectedReturn: baseReturn - effectiveMaxShock });
  if (atMax.moneyLastsAge >= longevity) {
    return { shock: effectiveMaxShock, lastsAge: atMax.moneyLastsAge, robust: true };
  }

  const atZero = computeProjection(plan);
  if (atZero.moneyLastsAge < longevity) {
    return { shock: 0, lastsAge: atZero.moneyLastsAge, robust: false };
  }

  // Plan covers at zero shock, fails at effectiveMaxShock — bisect.
  let lo = 0, hi = effectiveMaxShock;
  let breaking = { shock: effectiveMaxShock, lastsAge: atMax.moneyLastsAge };
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const r = computeProjection({ ...plan, expectedReturn: baseReturn - mid });
    if (r.moneyLastsAge < longevity) {
      breaking = { shock: mid, lastsAge: r.moneyLastsAge };
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return { ...breaking, robust: false };
}
