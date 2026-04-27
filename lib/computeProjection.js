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

  // Build income plan
  const salarySource = incomeSources.find(s => s.type === 'salary');
  const ssSource = incomeSources.find(s => s.type === 'socialSecurity');
  const pensionSource = incomeSources.find(s => s.type === 'pension');
  const rentalSource = incomeSources.find(s => s.type === 'rental');

  const incomePlan = {
    currentAge,
    retireAge,
    longevityAge,
    salary: salarySource ? { annualAmount: salarySource.amount, growthRate: salarySource.growthRate / 100 } : undefined,
    socialSecurity: ssSource ? { monthlyBenefitAtFRA: ssSource.monthlyBenefit, startAge: ssSource.startAge, cola: 0.02 } : undefined,
    pension: pensionSource ? { monthlyAmount: pensionSource.monthlyAmount, startAge: pensionSource.startAge, cola: pensionSource.cola ? 0.02 : 0 } : undefined,
    rental: rentalSource ? { monthlyNetIncome: rentalSource.monthlyNet, annualAppreciation: rentalSource.appreciation / 100 } : undefined,
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

  // Track account types separately for tax-aware withdrawals
  let bal401k = plan.savings401k || 0;
  let balRoth = plan.savingsRoth || 0;
  let balTaxable = plan.savingsTaxable || 0;
  let balHSA = plan.savingsHSA || 0;
  let balCash = plan.savingsCash || 0;
  let balCrypto = plan.savingsCrypto || 0;
  let balPension = plan.savingsPension || 0;
  let balAnnuity = plan.savingsAnnuity || 0;
  let balRealEstate = plan.savingsRealEstate || 0;
  let bal529 = plan.savings529 || 0;
  let portfolioBalance = bal401k + balRoth + balTaxable + balHSA + balCash + balCrypto + balPension + balAnnuity + balRealEstate + bal529;
  const startingBalance = portfolioBalance;
  const rmdDivisor = (age) => RMD_TABLE[Math.min(age, 110)] || 8.9;

  const combined = incomeProjections.map((inc, i) => {
    const exp = expenseProjections[i] || { totalExpense: 0, healthcare: 0 };
    const age = inc.age;

    // RMD calculation (age 73+ from 401k balance)
    let rmdAmount = 0;
    if (age >= RMD_START && bal401k > 0) {
      rmdAmount = Math.round(bal401k / rmdDivisor(age));
    }

    const baseOrdinaryIncome = inc.salary + inc.pension + inc.rental + inc.annuity + inc.partTime + inc.otherIncome;
    const baseIncome = baseOrdinaryIncome + inc.socialSecurity;

    const taxPass1 = computeTax({
      filingStatus, ordinaryIncome: baseOrdinaryIncome,
      socialSecurityBenefit: inc.socialSecurity, capitalGains: 0,
      stateCode, age,
    });

    const netAfterTax1 = baseIncome - taxPass1.totalTax;
    const shortfall = exp.totalExpense - netAfterTax1;

    let withdrawal401k = 0, withdrawalRoth = 0, withdrawalTaxable = 0;
    let withdrawalCash = 0, withdrawalCrypto = 0, withdrawalAnnuity = 0, withdrawalPension = 0;

    const liquidBalance = bal401k + balRoth + balTaxable + balHSA + balCash + balCrypto + balPension + balAnnuity;

    if (shortfall > 0 && inc.isRetired && liquidBalance > 0) {
      let remaining = shortfall;

      if (remaining > 0 && balCash > 0) {
        withdrawalCash = Math.min(remaining, balCash);
        remaining -= withdrawalCash;
      }
      if (remaining > 0 && balTaxable > 0) {
        withdrawalTaxable = Math.min(remaining, balTaxable);
        remaining -= withdrawalTaxable;
      }
      if (remaining > 0 && balCrypto > 0) {
        withdrawalCrypto = Math.min(remaining, balCrypto);
        remaining -= withdrawalCrypto;
      }
      if (remaining > 0 && balAnnuity > 0) {
        withdrawalAnnuity = Math.min(remaining, balAnnuity);
        remaining -= withdrawalAnnuity;
      }
      if (remaining > 0 && bal401k > 0) {
        const marginalRate = taxPass1.marginalRate || 0.22;
        const grossUp = remaining / (1 - marginalRate);
        withdrawal401k = Math.min(grossUp, bal401k);
        remaining -= withdrawal401k * (1 - marginalRate);
      }
      if (remaining > 0 && balPension > 0) {
        const marginalRate = taxPass1.marginalRate || 0.22;
        const grossUp = remaining / (1 - marginalRate);
        withdrawalPension = Math.min(grossUp, balPension);
        remaining -= withdrawalPension * (1 - marginalRate);
      }
      if (remaining > 0 && balRoth > 0) {
        withdrawalRoth = Math.min(remaining, balRoth);
        remaining -= withdrawalRoth;
      }
    }

    if (rmdAmount > 0 && withdrawal401k < rmdAmount) {
      withdrawal401k = rmdAmount;
    }

    const totalOrdinaryIncome = baseOrdinaryIncome + withdrawal401k + withdrawalPension + withdrawalCash;
    const capitalGains = (withdrawalTaxable > 0 ? Math.round(withdrawalTaxable * 0.5) : 0)
      + (withdrawalCrypto > 0 ? Math.round(withdrawalCrypto * 0.5) : 0)
      + (withdrawalAnnuity > 0 ? Math.round(withdrawalAnnuity * 0.3) : 0);

    const taxResult = computeTax({
      filingStatus, ordinaryIncome: totalOrdinaryIncome,
      socialSecurityBenefit: inc.socialSecurity, capitalGains,
      stateCode, age,
    });

    const totalIncome = baseIncome + withdrawal401k + withdrawalRoth + withdrawalTaxable
      + withdrawalCash + withdrawalCrypto + withdrawalAnnuity + withdrawalPension;
    const netAfterTax = totalIncome - taxResult.totalTax;
    const gap = netAfterTax - exp.totalExpense;

    const balanceStart = portfolioBalance;
    const retiredReturnPct = (plan.retiredReturnPct || 60) / 100;
    const retiredReturn = inc.isRetired ? returnRate * retiredReturnPct : returnRate;
    const cashRate = (plan.cashReturn || 3) / 100;
    const annuityRate = (plan.annuityReturn || 3.5) / 100;
    const reRate = (plan.realEstateAppreciation || 3) / 100;

    if (!inc.isRetired) {
      bal401k = bal401k * (1 + returnRate) + monthlyContrib * 12 * 0.6;
      balRoth = balRoth * (1 + returnRate) + monthlyContrib * 12 * 0.2;
      balTaxable = balTaxable * (1 + returnRate) + monthlyContrib * 12 * 0.2;
      balHSA = balHSA * (1 + returnRate * 0.5);
      balCash = balCash * (1 + cashRate);
      balCrypto = balCrypto * (1 + returnRate);
      balPension = balPension * (1 + returnRate * 0.6);
      balAnnuity = balAnnuity * (1 + annuityRate);
      balRealEstate = balRealEstate * (1 + reRate);
      bal529 = bal529 * (1 + returnRate * 0.8);
    } else {
      bal401k = Math.max(0, (bal401k - withdrawal401k) * (1 + retiredReturn));
      balRoth = Math.max(0, (balRoth - withdrawalRoth) * (1 + retiredReturn));
      balTaxable = Math.max(0, (balTaxable - withdrawalTaxable) * (1 + retiredReturn));
      balHSA = Math.max(0, balHSA * (1 + retiredReturn * 0.5));
      balCash = Math.max(0, (balCash - withdrawalCash) * (1 + cashRate * 0.8));
      balCrypto = Math.max(0, (balCrypto - withdrawalCrypto) * (1 + retiredReturn));
      balPension = Math.max(0, (balPension - withdrawalPension) * (1 + retiredReturn * 0.5));
      balAnnuity = Math.max(0, (balAnnuity - withdrawalAnnuity) * (1 + annuityRate));
      balRealEstate = balRealEstate * (1 + reRate);
      bal529 = bal529 * (1 + retiredReturn * 0.6);
    }
    portfolioBalance = bal401k + balRoth + balTaxable + balHSA + balCash + balCrypto + balPension + balAnnuity + balRealEstate + bal529;
    if (portfolioBalance < 0) portfolioBalance = 0;

    const totalWithdrawals = withdrawal401k + withdrawalRoth + withdrawalTaxable
      + withdrawalCash + withdrawalCrypto + withdrawalAnnuity + withdrawalPension;
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
      withdrawalCash,
      withdrawalCrypto,
      withdrawalAnnuity,
      withdrawalPension,
      totalIncome,
      totalExpense: exp.totalExpense,
      healthcare: exp.healthcare,
      federalTax: taxResult.federalTax,
      stateTax: taxResult.stateTax,
      totalTax: taxResult.totalTax,
      effectiveRate: taxResult.effectiveRate,
      irmaa: taxResult.irmaa,
      ssTaxablePercent: taxResult.ssTaxablePercent,
      netAfterTax: Math.round(netAfterTax),
      gap: Math.round(gap),
      portfolioBalance: Math.round(balanceStart),
      portfolioEndBalance: Math.round(portfolioBalance),
      portfolioGrowth: Math.round(portfolioBalance - balanceStart + totalWithdrawals),
      liquidBalance: Math.round(liquidBalanceEnd),
      isRetired: inc.isRetired,
      isRetireYear: inc.age === retireAge,
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
    if (r.isRetired && r.liquidBalance <= 0 && r.gap < 0) {
      moneyLastsAge = r.age;
      break;
    }
  }

  const yearsCovered = combined.filter(r => {
    if (r.gap >= 0) return true;
    if (r.portfolioBalance > 0) return true;
    return false;
  }).length;

  const firstGapAge = combined.find(r => r.gap < 0 && r.portfolioBalance <= 0)?.age;

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
