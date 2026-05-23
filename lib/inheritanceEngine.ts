/**
 * inheritanceEngine.ts — net-of-tax inheritance calculator.
 *
 * The HNW DIY user's central question that no other DIY tool answers well:
 *   "If I die today (or at longevity), what do my heirs actually receive
 *    after estate tax + income tax on inherited IRAs?"
 *
 * Three taxes apply to inheritance, in this order:
 *   1. Federal estate tax — only above ~$13.99M (2025), drops to ~$7M after
 *      the TCJA sunset on 2025-12-31 unless Congress extends.
 *   2. State estate tax — a dozen states tax estates at lower thresholds
 *      (MA $2M, OR $1M, NY $6.94M cliff, WA $2.193M, etc.).
 *   3. Income tax on inherited IRAs / 401(k)s — heirs must drain inherited
 *      traditional IRA/401(k) within 10 years (SECURE Act, post-2020), and
 *      pay ordinary income tax on every distribution. Roth IRAs are tax-
 *      free but the 10-year drain rule still applies.
 *
 * The KEY LEVER for HNW retirees is **step-up basis**: taxable brokerage,
 * real estate, and other appreciable assets get their cost basis reset to
 * fair market value at death. ALL embedded capital gains escape tax. This
 * is the single biggest reason to spend tax-deferred accounts FIRST and
 * preserve taxable accounts for heirs — counter to the conventional
 * "Roth last" wisdom.
 *
 * All calculations are pure functions. No React, no side effects.
 */

// ─── Constants ──────────────────────────────────────────────────────────

/** 2025 federal unified estate + gift tax exemption (per individual).
 *  Doubles for MFJ via portability. Drops to ~$7M individual after 2025
 *  sunset unless Congress acts. */
const FEDERAL_ESTATE_EXEMPTION_2025_INDIVIDUAL = 13_990_000;
/** Top federal estate tax rate above exemption. Bracketed in reality
 *  (18-40%) but >99% of estates above exemption end up at 40% top rate. */
const FEDERAL_ESTATE_TAX_RATE = 0.40;

/** State estate tax thresholds and top rates. Conservative — uses the
 *  top marginal rate above the threshold rather than full bracket math,
 *  which is fine since estate tax math is rarely the dominant figure for
 *  estates near the threshold. Updated for 2025. */
const STATE_ESTATE_TAX: Record<string, { exemption: number; topRate: number }> = {
  CT: { exemption: 13_990_000, topRate: 0.12 },  // matches federal
  DC: { exemption: 4_710_800,  topRate: 0.16 },
  HI: { exemption: 5_490_000,  topRate: 0.20 },
  IL: { exemption: 4_000_000,  topRate: 0.16 },
  ME: { exemption: 7_000_000,  topRate: 0.12 },
  MD: { exemption: 5_000_000,  topRate: 0.16 },
  MA: { exemption: 2_000_000,  topRate: 0.16 }, // famously aggressive
  MN: { exemption: 3_000_000,  topRate: 0.16 },
  NY: { exemption: 6_940_000,  topRate: 0.16 }, // cliff-edge (not phase-in)
  OR: { exemption: 1_000_000,  topRate: 0.16 }, // lowest in the country
  RI: { exemption: 1_802_431,  topRate: 0.16 },
  VT: { exemption: 5_000_000,  topRate: 0.16 },
  WA: { exemption: 2_193_000,  topRate: 0.20 }, // highest top rate
};

/** SECURE Act 2020+: non-spouse beneficiaries must drain inherited
 *  401(k) / Traditional IRA / Roth IRA within 10 years. Spread the
 *  distributions evenly for a conservative tax estimate. */
const INHERITED_IRA_SPREAD_YEARS = 10;

/** Default assumption for the cost basis ratio in a taxable brokerage
 *  account when the user hasn't told us. 60% basis = 40% embedded gains
 *  is a typical mid-career number. The UI exposes this as a slider. */
const DEFAULT_TAXABLE_BASIS_RATIO = 0.60;

// ─── Inputs / Outputs ────────────────────────────────────────────────────

export interface InheritanceInput {
  // Account balances at the moment of death.
  trad401k: number;
  roth: number;
  taxable: number;
  hsa: number;
  cash: number;
  realEstate: number;
  /** Embedded gains in the taxable account = taxable × (1 − basisRatio).
   *  When undefined, defaults to 40% gains. */
  taxableBasisRatio?: number;

  // Heir profile
  /** Heir's effective tax rate on inherited IRA distributions over the
   *  10-year drain window. Defaults to 22% (typical middle-income heir);
   *  HNW users with high-earning heirs should slide this to 32-37%. */
  heirEffectiveTaxRate?: number;
  /** Heir's effective state tax rate on those distributions. Defaults
   *  to 5% as a national average. */
  heirStateTaxRate?: number;

  // Estate context
  filingStatus: 'single' | 'mfj';
  stateCode: string;
  /** Year of death — used to gate the TCJA sunset (federal exemption
   *  drops to ~$7M individual on 2026-01-01 unless Congress acts).
   *  Defaults to current calendar year. */
  yearOfDeath?: number;
}

export interface AccountInheritance {
  gross: number;             // balance at death
  taxOwed: number;            // income tax (for IRAs) — estate tax allocated separately
  netToHeirs: number;         // gross − tax
  taxTreatment: string;       // plain-English label
  stepUpBenefit?: number;     // for taxable + real estate, the tax saved vs no step-up
}

export interface InheritanceResult {
  grossEstate: number;
  federalEstateTax: number;
  stateEstateTax: number;
  totalEstateTax: number;
  incomeTaxOnInheritedIRAs: number;
  netToHeirs: number;
  /** Net-of-everything per account type. */
  byAccount: {
    trad401k: AccountInheritance;
    roth: AccountInheritance;
    taxable: AccountInheritance;
    hsa: AccountInheritance;
    cash: AccountInheritance;
    realEstate: AccountInheritance;
  };
  /** Federal exemption used at this year of death — surfaces the 2026
   *  sunset so the UI can warn users planning beyond 2025. */
  federalExemptionApplied: number;
  /** True when yearOfDeath >= 2026 AND TCJA-sunset assumption applies. */
  postSunset: boolean;
}

// ─── Core calculation ────────────────────────────────────────────────────

export function computeInheritance(input: InheritanceInput): InheritanceResult {
  const yearOfDeath = input.yearOfDeath ?? new Date().getFullYear();
  const postSunset = yearOfDeath >= 2026;

  // 1. Gross estate
  const grossEstate =
    (input.trad401k || 0) +
    (input.roth || 0) +
    (input.taxable || 0) +
    (input.hsa || 0) +
    (input.cash || 0) +
    (input.realEstate || 0);

  // 2. Federal estate tax — exemption is per individual; MFJ portability
  //    doubles it. Sunset cuts it roughly in half from 2026.
  const baseExemption = postSunset
    ? FEDERAL_ESTATE_EXEMPTION_2025_INDIVIDUAL / 2  // ~$7M projected
    : FEDERAL_ESTATE_EXEMPTION_2025_INDIVIDUAL;
  const federalExemptionApplied = input.filingStatus === 'mfj'
    ? baseExemption * 2
    : baseExemption;
  const federalEstateTax = Math.max(0, grossEstate - federalExemptionApplied) * FEDERAL_ESTATE_TAX_RATE;

  // 3. State estate tax — only the ~12 states that have one
  const stateRule = STATE_ESTATE_TAX[input.stateCode?.toUpperCase()];
  const stateEstateTax = stateRule
    ? Math.max(0, grossEstate - stateRule.exemption) * stateRule.topRate
    : 0;

  const totalEstateTax = federalEstateTax + stateEstateTax;

  // 4. Income tax on inherited IRAs (per SECURE Act 10-year rule).
  //    Heirs must drain within 10 years; spread evenly for a clean
  //    marginal-rate estimate. Conservative: assume the heir's bracket
  //    stays constant over the drain window.
  const heirCombinedTaxRate =
    (input.heirEffectiveTaxRate ?? 0.22) + (input.heirStateTaxRate ?? 0.05);
  const incomeTaxOnInheritedIRAs = (input.trad401k || 0) * heirCombinedTaxRate;

  // 5. Per-account inheritance breakdown.
  //    Estate tax is NOT allocated per account here — it comes off the
  //    gross at the top. The per-account numbers show INCOME-tax impact
  //    only (which is what the user has agency over via spend-order).
  const byAccount: InheritanceResult['byAccount'] = {
    trad401k: {
      gross: input.trad401k || 0,
      taxOwed: incomeTaxOnInheritedIRAs,
      netToHeirs: (input.trad401k || 0) - incomeTaxOnInheritedIRAs,
      taxTreatment: `Heirs must drain over 10 years (SECURE Act) at ~${Math.round(heirCombinedTaxRate * 100)}% combined`,
    },
    roth: {
      gross: input.roth || 0,
      taxOwed: 0,
      netToHeirs: input.roth || 0,
      taxTreatment: '10-year drain BUT tax-free distributions — Roth is the gold standard for heirs',
    },
    taxable: (() => {
      const basisRatio = input.taxableBasisRatio ?? DEFAULT_TAXABLE_BASIS_RATIO;
      const embeddedGains = (input.taxable || 0) * (1 - basisRatio);
      // 23.8% = 20% LTCG top rate + 3.8% NIIT (conservative for HNW)
      const stepUpBenefit = embeddedGains * 0.238;
      return {
        gross: input.taxable || 0,
        taxOwed: 0,
        netToHeirs: input.taxable || 0,
        taxTreatment: 'Step-up basis at death — all embedded gains escape capital gains tax',
        stepUpBenefit: Math.round(stepUpBenefit),
      };
    })(),
    hsa: {
      gross: input.hsa || 0,
      // HSA inherited by non-spouse is fully taxable as ordinary income to
      // the heir, immediately (no 10-year spread). One of the worst
      // accounts to die with from a legacy standpoint.
      taxOwed: (input.hsa || 0) * heirCombinedTaxRate,
      netToHeirs: (input.hsa || 0) * (1 - heirCombinedTaxRate),
      taxTreatment: 'Non-spouse heir owes immediate ordinary income tax — HSA is poor for legacy',
    },
    cash: {
      gross: input.cash || 0,
      taxOwed: 0,
      netToHeirs: input.cash || 0,
      taxTreatment: 'No income tax to heirs (cash already after-tax)',
    },
    realEstate: {
      gross: input.realEstate || 0,
      taxOwed: 0,
      netToHeirs: input.realEstate || 0,
      taxTreatment: 'Step-up basis at death — appreciation escapes capital gains tax',
      // Conservative: assume 40% of RE value is embedded gain
      stepUpBenefit: Math.round((input.realEstate || 0) * 0.40 * 0.238),
    },
  };

  const netToHeirs = grossEstate - totalEstateTax - incomeTaxOnInheritedIRAs;

  return {
    grossEstate,
    federalEstateTax: Math.round(federalEstateTax),
    stateEstateTax: Math.round(stateEstateTax),
    totalEstateTax: Math.round(totalEstateTax),
    incomeTaxOnInheritedIRAs: Math.round(incomeTaxOnInheritedIRAs),
    netToHeirs: Math.round(netToHeirs),
    byAccount,
    federalExemptionApplied,
    postSunset,
  };
}

// ─── Step-up lever comparison ────────────────────────────────────────────

export interface StepUpComparison {
  defaultStrategy: {
    label: string;
    description: string;
    netToHeirs: number;
    composition: {
      trad401k: number;
      roth: number;
      taxable: number;
      cash: number;
      realEstate: number;
    };
  };
  stepUpAware: {
    label: string;
    description: string;
    netToHeirs: number;
    composition: {
      trad401k: number;
      roth: number;
      taxable: number;
      cash: number;
      realEstate: number;
    };
  };
  delta: number; // stepUpAware − defaultStrategy. Positive = step-up wins.
  swingFactor: 'major' | 'moderate' | 'minor';
}

/**
 * Compares two spend-down strategies for their net-to-heir outcome.
 * Uses simplified "what's left at longevity" estimates rather than
 * re-running the full projection engine (which has a hardcoded waterfall
 * we can't easily swap). Direction is right; precision is approximate.
 *
 * Strategy A — "default waterfall": engine's current behavior — spend
 *   taxable → 401(k) → Roth. Taxable gets drained first, so the step-up
 *   basis benefit is mostly forfeited.
 *
 * Strategy B — "step-up-aware": flip it — spend 401(k) first, preserve
 *   taxable for the step-up at death, preserve Roth for tax-free heirs.
 *   This is the conventional wisdom for HNW estate planning.
 */
export function compareStepUpStrategies(input: {
  trad401k: number;
  roth: number;
  taxable: number;
  cash: number;
  realEstate: number;
  totalSpending: number;  // total spending in retirement (a single number, simplified)
  filingStatus: 'single' | 'mfj';
  stateCode: string;
  heirEffectiveTaxRate?: number;
  heirStateTaxRate?: number;
}): StepUpComparison {
  // Estimate the total drawn from liquid accounts in retirement
  const totalLiquid = input.trad401k + input.roth + input.taxable + input.cash;
  const drawn = Math.min(input.totalSpending, totalLiquid);

  // Strategy A: spend taxable → cash → 401k → Roth
  const remA = { ...split(drawn, [['taxable', input.taxable], ['cash', input.cash], ['trad401k', input.trad401k], ['roth', input.roth]]) };
  const defaultBalances = {
    trad401k: input.trad401k - remA.trad401k,
    roth: input.roth - remA.roth,
    taxable: input.taxable - remA.taxable,
    cash: input.cash - remA.cash,
    realEstate: input.realEstate,
  };

  // Strategy B: spend 401k → cash → taxable → Roth
  const remB = { ...split(drawn, [['trad401k', input.trad401k], ['cash', input.cash], ['taxable', input.taxable], ['roth', input.roth]]) };
  const stepUpBalances = {
    trad401k: input.trad401k - remB.trad401k,
    roth: input.roth - remB.roth,
    taxable: input.taxable - remB.taxable,
    cash: input.cash - remB.cash,
    realEstate: input.realEstate,
  };

  // Compute net-to-heir for each ending composition
  const calcNet = (balances: typeof defaultBalances) => {
    const result = computeInheritance({
      trad401k: balances.trad401k,
      roth: balances.roth,
      taxable: balances.taxable,
      hsa: 0,
      cash: balances.cash,
      realEstate: balances.realEstate,
      filingStatus: input.filingStatus,
      stateCode: input.stateCode,
      heirEffectiveTaxRate: input.heirEffectiveTaxRate,
      heirStateTaxRate: input.heirStateTaxRate,
    });
    return result.netToHeirs;
  };

  const netDefault = calcNet(defaultBalances);
  const netStepUp = calcNet(stepUpBalances);
  const delta = netStepUp - netDefault;

  const absDelta = Math.abs(delta);
  const swingFactor: StepUpComparison['swingFactor'] =
    absDelta > 100_000 ? 'major' : absDelta > 25_000 ? 'moderate' : 'minor';

  return {
    defaultStrategy: {
      label: 'Engine default (taxable first)',
      description: "Spend taxable → cash → 401(k) → Roth. This is the engine's hardcoded waterfall — simple but forfeits the step-up basis benefit on taxable accounts.",
      netToHeirs: netDefault,
      composition: defaultBalances,
    },
    stepUpAware: {
      label: 'Step-up-aware (401k first)',
      description: 'Spend 401(k) → cash → taxable → Roth. Preserves the taxable account for the step-up at death (heirs inherit at FMV, embedded gains escape tax). The conventional wisdom for HNW estate planning.',
      netToHeirs: netStepUp,
      composition: stepUpBalances,
    },
    delta,
    swingFactor,
  };
}

/** Internal: drain `amount` from a list of [name, balance] in order. */
function split(amount: number, accounts: Array<[string, number]>): Record<string, number> {
  const drained: Record<string, number> = {};
  let remaining = amount;
  for (const [name, bal] of accounts) {
    const taken = Math.min(remaining, bal);
    drained[name] = taken;
    remaining -= taken;
    if (remaining <= 0) break;
  }
  // Fill in zero for any not-yet-set keys
  for (const [name] of accounts) {
    if (drained[name] === undefined) drained[name] = 0;
  }
  return drained;
}
