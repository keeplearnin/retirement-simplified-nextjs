/**
 * decisionEngine.js — the "Optimize my plan" engine.
 *
 * Runs the real engines (computeProjection, optimizeRothLadder,
 * detectIrmaaCliff) across the decision space and returns a ranked,
 * dollar-quantified action list. Every action carries a `math` array —
 * the chain-of-math steps that produced the number — and, where the change
 * maps to a plan field, an `apply` descriptor the UI can execute.
 *
 * Key design point vs. competitors: each lever is evaluated by re-running
 * the FULL projection (taxes, SS taxability, RMDs, withdrawal waterfall,
 * state exemptions), not by isolated rules of thumb. Changing the SS claim
 * age, for example, changes bridge-year withdrawals, which changes taxable
 * income, which changes SS taxability and IRMAA — all captured.
 *
 * Pure module: no React, no localStorage.
 */

import { computeProjection } from './computeProjection';
import { optimizeRothLadder } from './rothConversion';
import { detectIrmaaCliff } from './taxEngine';

const SS_CLAIM_AGES = [62, 63, 64, 65, 66, 67, 68, 69, 70];

function fmtUSD(n) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.round(n));
  return `${sign}$${abs.toLocaleString()}`;
}

function primarySsSource(plan) {
  return (plan.incomeSources || []).find(
    (s) => s.type === 'socialSecurity' && (s.owner || 'primary') === 'primary'
  );
}

function withSsStartAge(plan, startAge) {
  return {
    ...plan,
    incomeSources: plan.incomeSources.map((s) =>
      s.type === 'socialSecurity' && (s.owner || 'primary') === 'primary'
        ? { ...s, startAge }
        : s
    ),
  };
}

// Net lifetime resources: what the household actually gets to keep/spend.
function netLifetime(proj) {
  return (proj.totalLifetimeIncome || 0) - (proj.totalLifetimeTax || 0);
}

// ---------------------------------------------------------------------------
// Lever 1: Social Security claiming age (full-projection sweep)
// ---------------------------------------------------------------------------

function analyzeSsClaiming(plan, baseline) {
  const ssSource = primarySsSource(plan);
  if (!ssSource || !(ssSource.monthlyBenefit > 0)) return null;

  const currentClaimAge = ssSource.startAge || 67;
  const baselineNet = netLifetime(baseline);

  let best = { claimAge: currentClaimAge, net: baselineNet, proj: baseline };
  const sweep = [];
  for (const claimAge of SS_CLAIM_AGES) {
    // Can't claim in the past relative to current age.
    if (claimAge < plan.currentAge) continue;
    const proj =
      claimAge === currentClaimAge
        ? baseline
        : computeProjection(withSsStartAge(plan, claimAge));
    const net = netLifetime(proj);
    sweep.push({ claimAge, net, moneyLastsAge: proj.moneyLastsAge });
    if (net > best.net) best = { claimAge, net, proj };
  }

  const delta = best.net - baselineNet;
  if (best.claimAge === currentClaimAge || delta < 1000) return null;

  return {
    id: 'ss-claiming',
    category: 'Social Security',
    title: `Claim Social Security at ${best.claimAge} instead of ${currentClaimAge}`,
    detail:
      `Sweeping claim ages ${SS_CLAIM_AGES[0]}–70 through your full plan (benefit adjustment, ` +
      `bridge-year withdrawals, SS taxability, and taxes all included), age ${best.claimAge} ` +
      `maximizes your lifetime net resources.`,
    dollarValue: Math.round(delta),
    yearsGain: (best.proj.moneyLastsAge || 0) - (baseline.moneyLastsAge || 0),
    math: [
      `Current plan claims at ${currentClaimAge}: lifetime income minus lifetime tax = ${fmtUSD(baselineNet)}.`,
      `Each claim age 62–70 re-runs the full projection with the actuarially adjusted benefit.`,
      `Best result at ${best.claimAge}: ${fmtUSD(best.net)} net lifetime resources.`,
      `Difference: ${fmtUSD(best.net)} − ${fmtUSD(baselineNet)} = ${fmtUSD(delta)}.`,
    ],
    sweep,
    apply: { type: 'ss-start-age', sourceId: ssSource.id, startAge: best.claimAge },
  };
}

// ---------------------------------------------------------------------------
// Lever 2: Roth conversion ladder (bracket-swept, IRMAA-aware)
// ---------------------------------------------------------------------------

function analyzeRothConversions(plan, baseline) {
  const trad = (plan.savings401k || 0) + (plan.hasSpouse ? plan.spouseSavings401k || 0 : 0);
  if (trad <= 0 || plan.retireAge >= 72) return null;

  const ssSource = primarySsSource(plan);
  const pensionSource = (plan.incomeSources || []).find(
    (s) => s.type === 'pension' && (s.owner || 'primary') === 'primary'
  );

  const result = optimizeRothLadder({
    currentAge: plan.currentAge,
    retireAge: plan.retireAge,
    longevityAge: plan.longevityAge,
    tradBalance: trad,
    rothBalance: (plan.savingsRoth || 0) + (plan.hasSpouse ? plan.spouseSavingsRoth || 0 : 0),
    expectedReturn: (plan.expectedReturn || 7) / 100,
    retiredReturnPct: plan.retiredReturnPct || 60,
    filingStatus: plan.hasSpouse ? 'mfj' : (plan.filingStatus || 'single'),
    stateCode: plan.stateCode || 'CA',
    ssMonthlyBenefit: ssSource?.monthlyBenefit || 0,
    ssStartAge: ssSource?.startAge || 67,
    pensionMonthlyAmount: pensionSource?.monthlyAmount,
    pensionStartAge: pensionSource?.startAge,
    conversionStartAge: Math.max(plan.retireAge, plan.currentAge),
    conversionEndAge: 72,
  });

  const best = result.best;
  if (!best || best.netSaved < 1000) return null;

  const windowStart = best.schedule[0]?.age;
  const windowEnd = best.schedule[best.schedule.length - 1]?.age;
  const avgConversion = best.conversionYears > 0 ? best.totalConverted / best.conversionYears : 0;

  return {
    id: 'roth-ladder',
    category: 'Roth Conversions',
    title: `Convert ~${fmtUSD(avgConversion)}/yr to Roth, ages ${windowStart}–${windowEnd}, filling the ${best.targetBracket}% bracket`,
    detail:
      `Converting Traditional → Roth in your low-income window (before RMDs at 73) pays tax at ` +
      `${best.targetBracket}% now instead of a higher effective rate later. Net of the IRMAA ` +
      `surcharges the conversions trigger (${fmtUSD(best.irmaaCost)}), you keep ${fmtUSD(best.netSaved)} more.`,
    dollarValue: best.netSaved,
    math: [
      `Baseline (no conversions): ${fmtUSD(result.baselineLifetimeTax)} lifetime tax, RMDs force income from 73.`,
      `Tested filling the 12%, 22%, and 24% brackets each year from ${windowStart} to 72.`,
      `Best = ${best.targetBracket}% bracket: ${fmtUSD(best.totalConverted)} converted over ${best.conversionYears} years.`,
      `Tax saved: ${fmtUSD(best.taxSaved)}. IRMAA surcharges caused: ${fmtUSD(best.irmaaCost)}.`,
      `Net benefit: ${fmtUSD(best.taxSaved)} − ${fmtUSD(best.irmaaCost)} = ${fmtUSD(best.netSaved)}.`,
    ],
    schedule: best.schedule,
    options: result.options.map(({ output, ...rest }) => rest),
    apply: null, // conversions are an action the user executes at their brokerage
  };
}

// ---------------------------------------------------------------------------
// Lever 3: IRMAA cliff proximity (scan projected MAGI near Medicare age)
// ---------------------------------------------------------------------------

function analyzeIrmaaCliffs(plan, baseline) {
  const filing = plan.hasSpouse ? 'mfj' : (plan.filingStatus || 'single');
  const atRiskYears = [];
  for (const row of baseline.combined) {
    if (row.age < 63) continue; // IRMAA MAGI lookback is 2 years before 65
    const cliff = detectIrmaaCliff(row.magi, filing, 10_000);
    if (cliff.atRisk) {
      atRiskYears.push({ age: row.age, magi: row.magi, cliff });
    }
  }
  if (atRiskYears.length === 0) return null;

  const first = atRiskYears[0];
  const nextTierCost = first.cliff.annualSurcharge; // current tier cost; crossing adds more
  const perPerson = plan.hasSpouse ? 2 : 1;
  // Surcharge jump if they cross: approximate with the tier table step (~$81/mo → ~$975/yr/person minimum step)
  const minStepAnnual = 81.2 * 12 * perPerson;
  const totalExposure = Math.round(minStepAnnual * atRiskYears.length);

  return {
    id: 'irmaa-cliff',
    category: 'Medicare / IRMAA',
    title: `You're within ${fmtUSD(first.cliff.distanceToNextCliff)} of an IRMAA cliff at age ${first.age}`,
    detail:
      `In ${atRiskYears.length} projected year${atRiskYears.length > 1 ? 's' : ''}, your MAGI comes within ` +
      `$10,000 of the next IRMAA tier. Crossing costs at least ${fmtUSD(minStepAnnual)}/yr in Medicare ` +
      `surcharges${plan.hasSpouse ? ' (both spouses pay)' : ''}. Trimming withdrawals or shifting them to ` +
      `Roth in those years keeps you under the line.`,
    dollarValue: totalExposure,
    math: [
      `IRMAA tiers are cliffs, not phase-ins — $1 over the threshold triggers the full surcharge.`,
      `First at-risk year: age ${first.age}, projected MAGI ${fmtUSD(first.magi)}, ` +
        `threshold ${fmtUSD(first.cliff.nextThreshold)} (${fmtUSD(first.cliff.distanceToNextCliff)} away).`,
      `Minimum tier step ≈ ${fmtUSD(minStepAnnual)}/yr${plan.hasSpouse ? ' for two beneficiaries' : ''}.`,
      `${atRiskYears.length} at-risk year(s) × step = ${fmtUSD(totalExposure)} avoidable exposure.`,
    ],
    atRiskYears: atRiskYears.map((y) => ({ age: y.age, magi: Math.round(y.magi), headroom: Math.round(y.cliff.distanceToNextCliff) })),
    apply: null,
  };
}

// ---------------------------------------------------------------------------
// Levers 4 & 5: work longer / save more (only surfaced when the plan needs it)
// ---------------------------------------------------------------------------

function analyzePlanRescue(plan, baseline) {
  const actions = [];
  const gapYears = (plan.longevityAge || 95) - (baseline.moneyLastsAge || 0);
  if (gapYears <= 0) return actions; // plan already covers longevity

  // Retire later
  for (const extra of [1, 2, 3]) {
    const proj = computeProjection({ ...plan, retireAge: plan.retireAge + extra });
    const gain = (proj.moneyLastsAge || 0) - (baseline.moneyLastsAge || 0);
    if (gain > 0) {
      actions.push({
        id: `retire-later-${extra}`,
        category: 'Plan Repair',
        title: `Work ${extra} more year${extra > 1 ? 's' : ''} (retire at ${plan.retireAge + extra})`,
        detail: `Your money currently lasts to ${baseline.moneyLastsAge} vs a plan to ${plan.longevityAge}. Each extra working year adds contributions, delays withdrawals, and shortens the drawdown period.`,
        dollarValue: Math.round(netLifetime(proj) - netLifetime(baseline)),
        yearsGain: gain,
        math: [
          `Baseline: money lasts to ${baseline.moneyLastsAge}.`,
          `Retiring at ${plan.retireAge + extra}: money lasts to ${proj.moneyLastsAge} (+${gain} years).`,
          `Net lifetime resources change: ${fmtUSD(netLifetime(proj) - netLifetime(baseline))}.`,
        ],
        apply: { type: 'plan-field', key: 'retireAge', value: plan.retireAge + extra },
      });
      break; // surface the smallest sufficient step, not all three
    }
  }

  // Save more
  const bump = 500;
  const proj = computeProjection({ ...plan, monthlyContribution: (plan.monthlyContribution || 0) + bump });
  const gain = (proj.moneyLastsAge || 0) - (baseline.moneyLastsAge || 0);
  if (gain > 0) {
    actions.push({
      id: 'save-more',
      category: 'Plan Repair',
      title: `Save $${bump} more per month`,
      detail: `Raising contributions from ${fmtUSD((plan.monthlyContribution || 0))} to ${fmtUSD((plan.monthlyContribution || 0) + bump)}/mo extends your money from age ${baseline.moneyLastsAge} to ${proj.moneyLastsAge}.`,
      dollarValue: Math.round(netLifetime(proj) - netLifetime(baseline)),
      yearsGain: gain,
      math: [
        `Extra ${fmtUSD(bump)}/mo invested until retirement at ${plan.retireAge}.`,
        `Money-lasts age: ${baseline.moneyLastsAge} → ${proj.moneyLastsAge} (+${gain} years).`,
      ],
      apply: { type: 'plan-field', key: 'monthlyContribution', value: (plan.monthlyContribution || 0) + bump },
    });
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function runDecisionEngine(plan) {
  const baseline = computeProjection(plan);

  const actions = [
    analyzeSsClaiming(plan, baseline),
    analyzeRothConversions(plan, baseline),
    analyzeIrmaaCliffs(plan, baseline),
    ...analyzePlanRescue(plan, baseline),
  ]
    .filter(Boolean)
    .sort((a, b) => (b.dollarValue || 0) - (a.dollarValue || 0));

  return {
    baseline: {
      moneyLastsAge: baseline.moneyLastsAge,
      longevityAge: plan.longevityAge,
      lifetimeTax: Math.round(baseline.totalLifetimeTax || 0),
      lifetimeIncome: Math.round(baseline.totalLifetimeIncome || 0),
      netLifetime: Math.round(netLifetime(baseline)),
      portfolioAtRetire: Math.round(baseline.portfolioAtRetire || 0),
    },
    actions,
    totalOpportunity: Math.round(actions.reduce((s, a) => s + Math.max(0, a.dollarValue || 0), 0)),
  };
}
