/**
 * portfolioInsights.ts — pure portfolio recommendation engine.
 *
 * Seven account-level checks. Each returns 0 or 1 PortfolioRecommendation.
 * No LLM, no side effects, no network. Same engine is used by the
 * AI Advisor Portfolio Insights panel (non-LLM endpoint) AND surfaced
 * to Claude as a tool in the agent loop.
 */

export type RecType =
  | 'tax_diversification'
  | 'concentration'
  | 'roth_window'
  | 'contribution_destination'
  | 'return_assumption'
  | 'cash_drag'
  | 'real_estate';

export type Severity = 'high' | 'medium' | 'low';

export interface PortfolioRecommendation {
  id: string;
  type: RecType;
  severity: Severity;
  title: string;
  detail: string;
  impactLabel: string;
  dollarImpact: number;
  action: { label: string; href?: string; toolCall?: string };
}

export interface PortfolioInsightsResult {
  recommendations: PortfolioRecommendation[];
  totalDollarImpact: number;
  summary: string;
}

type PlanLike = Record<string, unknown>;
const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

// ---------------------------------------------------------------------------
// Check 1: Tax bucket diversification
// Healthy retirement plans typically have a mix across tax-deferred / Roth /
// taxable so the retiree can control their bracket year-by-year. >60%
// tax-deferred is medium, >70% is high — both leave the user exposed to
// future tax rate risk and forced RMDs.
// ---------------------------------------------------------------------------

function checkTaxDiversification(plan: PlanLike): PortfolioRecommendation | null {
  const taxDeferred = num(plan.savings401k) + num(plan.spouseSavings401k);
  const roth = num(plan.savingsRoth) + num(plan.spouseSavingsRoth);
  const taxable = num(plan.savingsTaxable);
  const liquid = taxDeferred + roth + taxable;

  if (liquid < 50_000) return null;
  const tdPct = taxDeferred / liquid;
  if (tdPct < 0.6) return null;

  // Estimate $ impact: the "excess" tax-deferred above a 50% target gets
  // taxed at ordinary rates in retirement. The user could shave ~10% off that
  // by sourcing more of it from Roth instead. Annual SWR base = 4%.
  const excess = (tdPct - 0.5) * liquid;
  const annualImpact = Math.round(excess * 0.04 * 0.10);

  return {
    id: 'tax_diversification',
    type: 'tax_diversification',
    severity: tdPct > 0.7 ? 'high' : 'medium',
    title: `${Math.round(tdPct * 100)}% of your liquid savings is in tax-deferred accounts`,
    detail: `Tax-deferred (401k / Traditional IRA) totals $${Math.round(taxDeferred / 1000)}K. A more even mix across Roth and taxable would give you flexibility to control your tax bracket in retirement — every dollar in Roth is one less RMD pushing you into a higher bracket later.`,
    impactLabel: `~$${Math.max(100, Math.round(annualImpact / 100) * 100).toLocaleString()}/yr in retirement tax savings`,
    dollarImpact: annualImpact * 25, // 25-year horizon for ranking
    action: { label: 'Direct new contributions to Roth' },
  };
}

// ---------------------------------------------------------------------------
// Check 2: Account concentration
// If a single account type holds >70% of the user's wealth, they're exposed
// to that account's specific rules (vesting, employer match limits, fund
// options, withdrawal restrictions). Soft warning — no dollar figure.
// ---------------------------------------------------------------------------

function checkConcentration(plan: PlanLike): PortfolioRecommendation | null {
  const accounts: Record<string, number> = {
    '401(k)': num(plan.savings401k) + num(plan.spouseSavings401k),
    Roth: num(plan.savingsRoth) + num(plan.spouseSavingsRoth),
    Taxable: num(plan.savingsTaxable),
    HSA: num(plan.savingsHSA) + num(plan.spouseSavingsHSA),
    'Real Estate': num(plan.savingsRealEstate),
    Crypto: num(plan.savingsCrypto),
    Annuity: num(plan.savingsAnnuity),
  };
  const total = Object.values(accounts).reduce((a, b) => a + b, 0);
  if (total < 100_000) return null;

  const entries = Object.entries(accounts).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const [topName, topVal] = entries[0];
  const topPct = topVal / total;
  if (topPct < 0.7) return null;

  // Real estate concentration is covered by its own check — skip here to
  // avoid duplicate cards.
  if (topName === 'Real Estate') return null;

  return {
    id: `concentration_${topName}`,
    type: 'concentration',
    severity: topPct > 0.85 ? 'high' : 'medium',
    title: `${Math.round(topPct * 100)}% of your wealth is in your ${topName} account`,
    detail: `Single-account concentration creates risk if that account's rules change (vesting cliffs, fund-menu changes, withdrawal restrictions, plan loans, etc.). Diversification across at least 3 account types reduces single-point-of-failure exposure.`,
    impactLabel: 'Reduces single-account risk',
    dollarImpact: 0,
    action: { label: 'Open a Roth IRA or taxable brokerage' },
  };
}

// ---------------------------------------------------------------------------
// Check 3: Cash drag
// 6 months of expenses is a healthy emergency fund. Beyond that, cash
// earning 3% while the portfolio expects 7% is a meaningful annual drag.
// Skipped for retired users — they legitimately need more liquidity.
// ---------------------------------------------------------------------------

function checkCashDrag(plan: PlanLike): PortfolioRecommendation | null {
  const cash = num(plan.savingsCash);
  const annualSpending = num(plan.annualSpending);
  if (cash < 10_000 || annualSpending <= 0) return null;
  if (num(plan.currentAge) >= num(plan.retireAge)) return null;

  const monthsOfExpenses = (cash / annualSpending) * 12;
  if (monthsOfExpenses < 12) return null;

  const targetReserve = annualSpending * 0.5; // 6 months
  const excessCash = cash - targetReserve;
  const expectedReturn = (num(plan.expectedReturn) || 7) / 100;
  const cashReturn = (num(plan.cashReturn) || 3) / 100;
  const annualImpact = Math.round(excessCash * (expectedReturn - cashReturn));

  return {
    id: 'cash_drag',
    type: 'cash_drag',
    severity: monthsOfExpenses > 24 ? 'high' : 'medium',
    title: `$${Math.round(cash / 1000)}K in cash (${Math.round(monthsOfExpenses)} months of expenses)`,
    detail: `Cash earning ~${(cashReturn * 100).toFixed(1)}% while your portfolio expects ${(expectedReturn * 100).toFixed(0)}%. 6 months of expenses ($${Math.round(targetReserve / 1000)}K) is a healthy emergency fund — investing the excess $${Math.round(excessCash / 1000)}K compounds to materially more by retirement.`,
    impactLabel: `~$${Math.round(annualImpact / 100) * 100}/yr in foregone growth`,
    dollarImpact: annualImpact * 10,
    action: { label: 'Move excess cash to your taxable brokerage' },
  };
}

// ---------------------------------------------------------------------------
// Check 4: Real estate over-concentration
// Fires when RE is a big fraction of total wealth AND the user hasn't opted
// to use it in retirement. The main RE callout (in AIAdvisor) covers the
// "you have RE excluded" case at $100K+. This check covers the stronger
// case where RE is the dominant asset, which deserves explicit retirement
// planning even if the user wants to keep it.
// ---------------------------------------------------------------------------

function checkRealEstateConcentration(plan: PlanLike): PortfolioRecommendation | null {
  const re = num(plan.savingsRealEstate);
  if (re < 100_000) return null;
  if (plan.useRealEstateInRetirement === true) return null;

  const total =
    re +
    num(plan.savings401k) +
    num(plan.spouseSavings401k) +
    num(plan.savingsRoth) +
    num(plan.spouseSavingsRoth) +
    num(plan.savingsTaxable) +
    num(plan.savingsCash);
  if (total === 0) return null;

  const rePct = re / total;
  if (rePct < 0.4) return null;

  return {
    id: 'real_estate',
    type: 'real_estate',
    severity: rePct > 0.6 ? 'high' : 'medium',
    title: `Real estate is ${Math.round(rePct * 100)}% of your total wealth`,
    detail: `Currently excluded from your retirement projection. Concentration this high deserves an explicit plan — sell, downsize, reverse mortgage, or accept it as a legacy asset you won't draw down. Enabling "Plan to draw from real estate" extends your projection significantly.`,
    impactLabel: 'Materially extends money-lasts-to age',
    dollarImpact: re * 0.04, // SWR-equivalent annual draw if enabled
    action: { label: 'Enable "Plan to draw from real estate"' },
  };
}

// ---------------------------------------------------------------------------
// Check 5: Roth conversion window
// Only relevant in/near the window. Conservative ladder savings estimate:
// converting trad balance gradually into Roth between retirement and 73
// typically saves ~6% of the trad balance in lifetime tax (highly variable
// — the agent's run_roth_analysis tool gets the precise number).
// ---------------------------------------------------------------------------

function checkRothWindow(plan: PlanLike): PortfolioRecommendation | null {
  const currentAge = num(plan.currentAge);
  const retireAge = num(plan.retireAge) || 65;
  const trad = num(plan.savings401k) + num(plan.spouseSavings401k);

  if (currentAge < retireAge - 5 || currentAge >= 73) return null;
  if (trad < 100_000) return null;

  const estimatedSavings = Math.round(trad * 0.06);

  return {
    id: 'roth_window',
    type: 'roth_window',
    severity: currentAge >= retireAge ? 'high' : 'medium',
    title:
      currentAge >= retireAge
        ? 'Roth conversion window is open right now'
        : `Roth conversion window opens in ${retireAge - currentAge} year(s)`,
    detail: `You have $${Math.round(trad / 1000)}K in tax-deferred accounts. The years between retirement and 73 (RMD start) are typically your lowest-income years — converting up to a target bracket each year reduces future RMDs and total lifetime tax.`,
    impactLabel: `~$${Math.round(estimatedSavings / 1000)}K lifetime tax savings (estimated)`,
    dollarImpact: estimatedSavings,
    action: { label: 'Ask the advisor about a Roth ladder', toolCall: 'run_roth_analysis' },
  };
}

// ---------------------------------------------------------------------------
// Check 6: Return assumption sanity
// Glide paths typically reduce equity exposure (and expected return) as the
// user approaches retirement. >8% expected return at age 55+ is aggressive;
// >10% is unrealistic for a balanced portfolio.
// ---------------------------------------------------------------------------

function checkReturnAssumption(plan: PlanLike): PortfolioRecommendation | null {
  const age = num(plan.currentAge);
  const ret = num(plan.expectedReturn) || 7;
  if (age < 55) return null;
  if (ret <= 8) return null;

  return {
    id: 'return_assumption',
    type: 'return_assumption',
    severity: ret > 10 ? 'high' : 'medium',
    title: `Your ${ret}% expected return is aggressive for age ${age}`,
    detail: `Glide paths reduce equity exposure (and expected return) as you approach retirement. At age ${age}, a typical balanced allocation expects 6–7%. Stress-testing your plan at a lower rate gives a more honest picture of your downside.`,
    impactLabel: 'Stress test for downside scenarios',
    dollarImpact: 0,
    action: { label: 'Run the Stress Test tab' },
  };
}

// ---------------------------------------------------------------------------
// Check 7: Contribution destination
// If the user is actively contributing but has no Roth account, flag it —
// Roth contributions are a hedge against future tax rate increases. Annual
// 401k + IRA contribution limits keep this manageable.
// ---------------------------------------------------------------------------

function checkContributionDestination(plan: PlanLike): PortfolioRecommendation | null {
  const monthly = num(plan.monthlyContribution);
  if (monthly < 200) return null;

  const has401k = num(plan.savings401k) > 0;
  const hasRoth = num(plan.savingsRoth) > 0;
  const hasTaxable = num(plan.savingsTaxable) > 0;

  if (!(has401k && (hasTaxable || true) && !hasRoth)) return null;

  return {
    id: 'contribution_destination',
    type: 'contribution_destination',
    severity: 'medium',
    title: 'You have no Roth account',
    detail: `You're contributing $${monthly}/month. Adding a Roth IRA (up to $7K/yr) gives you tax-free withdrawals in retirement — a direct hedge against future tax rate increases and a flexible bracket-control lever.`,
    impactLabel: 'Tax-rate diversification',
    dollarImpact: Math.round(monthly * 12 * 0.15),
    action: { label: 'Open a Roth IRA (Vanguard, Fidelity, Schwab)' },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyzePortfolio(plan: PlanLike): PortfolioInsightsResult {
  const allChecks = [
    checkTaxDiversification(plan),
    checkConcentration(plan),
    checkCashDrag(plan),
    checkRealEstateConcentration(plan),
    checkRothWindow(plan),
    checkReturnAssumption(plan),
    checkContributionDestination(plan),
  ];

  const recs = allChecks.filter((r): r is PortfolioRecommendation => r !== null);

  // Rank: severity (high > medium > low), then dollarImpact desc
  const severityOrder: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => {
    const sDelta = severityOrder[a.severity] - severityOrder[b.severity];
    if (sDelta !== 0) return sDelta;
    return b.dollarImpact - a.dollarImpact;
  });

  const top = recs.slice(0, 5);
  const totalImpact = top.reduce((sum, r) => sum + r.dollarImpact, 0);

  const summary =
    top.length === 0
      ? 'Your portfolio looks well-balanced. No high-impact changes recommended right now.'
      : `${top.length} opportunit${top.length === 1 ? 'y' : 'ies'} found${
          totalImpact > 0 ? ` — top recommendation worth ~$${Math.round((top[0]?.dollarImpact || 0) / 1000)}K` : ''
        }.`;

  return { recommendations: top, totalDollarImpact: totalImpact, summary };
}
