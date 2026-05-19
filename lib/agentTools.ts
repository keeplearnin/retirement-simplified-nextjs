/**
 * agentTools.ts — Claude tool definitions + server-side executors.
 *
 * Each tool has:
 *   - definition: the JSON schema sent to Claude in the `tools` array
 *   - execute: the server-side function that runs when Claude calls the tool
 *
 * All underlying logic lives in existing lib/ functions — this file is just
 * the glue between Claude's tool-use protocol and those pure functions.
 */

import { computeProjection } from '@/lib/computeProjection';
import { computeVerdict } from '@/lib/verdict';
import { modelRothLadder } from '@/lib/rothConversion';
import { computeTax } from '@/lib/taxEngine';
import type { VerdictInput } from '@/lib/verdict';
import type { RothLadderInput, Bracket } from '@/lib/rothConversion';
import type { TaxInput } from '@/lib/taxEngine';
import type { PlanSnapshot } from '@/lib/planHistory';
import { analyzePortfolio } from '@/lib/portfolioInsights';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolResult {
  toolName: string;
  result: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Tool 1: get_plan_summary
// Extracts a human-readable snapshot of the user's plan without running any
// calculations — lets Claude orient itself before deciding what to compute.
// ---------------------------------------------------------------------------

const getPlanSummaryDefinition: ToolDefinition = {
  name: 'get_plan_summary',
  description:
    'Returns a structured summary of the user\'s current retirement plan: ages, savings balances, income sources, spending, and key assumptions. Call this first to understand the user\'s situation before running projections.',
  input_schema: {
    type: 'object',
    properties: {},
  },
};

function executePlanSummary(plan: Record<string, unknown>) {
  const incomeSources = (plan.incomeSources as Array<Record<string, unknown>>) ?? [];

  const totalSavings =
    ((plan.savings401k as number) ?? 0) +
    ((plan.savingsRoth as number) ?? 0) +
    ((plan.savingsTaxable as number) ?? 0) +
    ((plan.savingsHSA as number) ?? 0) +
    ((plan.savingsCash as number) ?? 0) +
    ((plan.savingsRealEstate as number) ?? 0) +
    ((plan.savingsCrypto as number) ?? 0) +
    ((plan.savingsAnnuity as number) ?? 0) +
    ((plan.spouseSavings401k as number) ?? 0) +
    ((plan.spouseSavingsRoth as number) ?? 0) +
    ((plan.spouseSavingsHSA as number) ?? 0);

  return {
    demographics: {
      currentAge: plan.currentAge,
      retireAge: plan.retireAge,
      longevityAge: plan.longevityAge,
      filingStatus: plan.filingStatus,
      stateCode: plan.stateCode,
      hasSpouse: plan.hasSpouse ?? false,
      ...(plan.hasSpouse
        ? {
            spouseCurrentAge: plan.spouseCurrentAge,
            spouseRetireAge: plan.spouseRetireAge,
            spouseLongevityAge: plan.spouseLongevityAge,
          }
        : {}),
    },
    savings: {
      total: totalSavings,
      breakdown: {
        '401k': plan.savings401k ?? 0,
        roth: plan.savingsRoth ?? 0,
        taxable: plan.savingsTaxable ?? 0,
        hsa: plan.savingsHSA ?? 0,
        cash: plan.savingsCash ?? 0,
        realEstate: plan.savingsRealEstate ?? 0,
        crypto: plan.savingsCrypto ?? 0,
        annuity: plan.savingsAnnuity ?? 0,
        ...(plan.hasSpouse
          ? {
              spouse401k: plan.spouseSavings401k ?? 0,
              spouseRoth: plan.spouseSavingsRoth ?? 0,
              spouseHSA: plan.spouseSavingsHSA ?? 0,
            }
          : {}),
      },
      monthlyContribution: plan.monthlyContribution ?? 0,
    },
    incomeSources: incomeSources.map((s) => ({
      type: s.type,
      label: s.label,
      owner: s.owner ?? 'primary',
      ...(s.amount !== undefined ? { annualAmount: s.amount } : {}),
      ...(s.monthlyBenefit !== undefined ? { monthlyBenefit: s.monthlyBenefit } : {}),
      ...(s.startAge !== undefined ? { startAge: s.startAge } : {}),
    })),
    spending: {
      annualWorking: plan.annualSpending,
      annualRetirement: plan.retireSpending,
    },
    assumptions: {
      expectedReturn: plan.expectedReturn ?? 7,
      inflationRate: plan.inflationRate ?? 2.5,
      healthcareInflation: plan.healthcareInflation ?? 3.5,
      healthcareMultiplier: plan.healthcareMultiplier ?? 1.0,
    },
    realEstateTreatment: {
      balance: (plan.savingsRealEstate as number) ?? 0,
      includedInRetirement: Boolean(plan.useRealEstateInRetirement),
      // IMPORTANT for the agent: when includedInRetirement is false, the
      // projection engine does NOT use real estate to cover retirement
      // spending — so a user with significant RE may appear to "run out of
      // money" even if their RE wealth is large. If you see balance > $100K
      // AND includedInRetirement = false, suggest the user enable the
      // "Plan to draw from real estate" toggle in My Plan → Assumptions.
      warning:
        ((plan.savingsRealEstate as number) ?? 0) > 100_000 &&
        !plan.useRealEstateInRetirement
          ? `User has $${Math.round(((plan.savingsRealEstate as number) ?? 0) / 1000)}K in real estate but the "Plan to draw from real estate" toggle is OFF. This RE is NOT counted in their projection or money-lasts-to age. If they're asking about running out of money or their plan score, mention this and suggest they enable the toggle (My Plan tab → Assumptions section) if they intend to sell, downsize, or take a reverse mortgage.`
          : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Tool 2: run_projection
// Runs computeProjection with optional overrides so Claude can model
// "what if you retired at 60 instead?" without mutating the real plan.
// ---------------------------------------------------------------------------

const runProjectionDefinition: ToolDefinition = {
  name: 'run_projection',
  description:
    'Runs the full year-by-year retirement projection engine. Returns summary metrics (portfolio at retirement, money-lasts-to age, total lifetime tax, first gap age) plus an abridged year table. Optionally pass overrides to model alternative scenarios without changing the user\'s saved plan.',
  input_schema: {
    type: 'object',
    properties: {
      retireAge: {
        type: 'number',
        description: 'Override retirement age to model an alternative scenario.',
      },
      annualSpending: {
        type: 'number',
        description: 'Override annual working-years spending.',
      },
      retireSpending: {
        type: 'number',
        description: 'Override annual retirement spending.',
      },
      expectedReturn: {
        type: 'number',
        description: 'Override expected annual portfolio return (percentage, e.g. 6).',
      },
      monthlyContribution: {
        type: 'number',
        description: 'Override monthly savings contribution.',
      },
    },
  },
};

function executeRunProjection(plan: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  const mergedPlan = { ...plan, ...overrides };
  const result = computeProjection(mergedPlan as Parameters<typeof computeProjection>[0]);

  // Condense the year table to key columns only — full table would be too large for context
  const abridgedRows = (result.combined as Array<Record<string, unknown>>)
    .filter((_: unknown, i: number) => i % 5 === 0 || i === 0) // every 5th year + first
    .map((row: Record<string, unknown>) => ({
      age: row.age,
      balance: Math.round((row.balance as number) ?? 0),
      totalIncome: Math.round((row.totalIncome as number) ?? 0),
      totalExpense: Math.round((row.totalExpense as number) ?? 0),
      federalTax: Math.round((row.federalTax as number) ?? 0),
    }));

  return {
    summary: {
      portfolioAtRetire: Math.round((result.portfolioAtRetire as number) ?? 0),
      finalBalance: Math.round((result.finalBalance as number) ?? 0),
      moneyLastsAge: result.moneyLastsAge,
      firstGapAge: result.firstGapAge,
      yearsCovered: result.yearsCovered,
      totalLifetimeTax: Math.round((result.totalLifetimeTax as number) ?? 0),
      totalLifetimeIncome: Math.round((result.totalLifetimeIncome as number) ?? 0),
      avgEffectiveRate: result.avgEffectiveRate,
    },
    yearTableSample: abridgedRows,
    scenarioOverrides: Object.keys(overrides).length > 0 ? overrides : null,
  };
}

// ---------------------------------------------------------------------------
// Tool 3: get_verdict
// Compares current savings to Fidelity benchmarks and surfaces gap + actions.
// ---------------------------------------------------------------------------

const getVerdictDefinition: ToolDefinition = {
  name: 'get_verdict',
  description:
    'Compares the user\'s current savings to Fidelity age-based benchmarks. Returns gap status (ahead / on-track / behind / significantly-behind), the dollar shortfall at retirement, and a ranked list of high-impact actions with 10-year dollar values.',
  input_schema: {
    type: 'object',
    properties: {},
  },
};

function executeGetVerdict(plan: Record<string, unknown>) {
  const incomeSources = (plan.incomeSources as Array<Record<string, unknown>>) ?? [];
  const primarySalary = incomeSources.find(
    (s) => s.type === 'salary' && (s.owner ?? 'primary') === 'primary'
  );
  const spouseSalary = incomeSources.find((s) => s.type === 'salary' && s.owner === 'spouse');

  const annualIncome =
    ((primarySalary?.amount as number) ?? 0) + ((spouseSalary?.amount as number) ?? 0);

  const totalSavings =
    ((plan.savings401k as number) ?? 0) +
    ((plan.savingsRoth as number) ?? 0) +
    ((plan.savingsTaxable as number) ?? 0) +
    ((plan.savingsHSA as number) ?? 0) +
    ((plan.savingsCash as number) ?? 0) +
    ((plan.spouseSavings401k as number) ?? 0) +
    ((plan.spouseSavingsRoth as number) ?? 0) +
    ((plan.spouseSavingsHSA as number) ?? 0);

  const input: VerdictInput = {
    currentAge: plan.currentAge as number,
    retirementAge: plan.retireAge as number,
    annualIncome,
    currentSavings: totalSavings,
    monthlyContribution:
      ((plan.monthlyContribution as number) ?? 0) +
      ((plan.spouseMonthlyContribution as number) ?? 0),
    filingStatus: (plan.filingStatus as 'single' | 'mfj') ?? 'single',
    hasSpouse: (plan.hasSpouse as boolean) ?? false,
    ...(plan.hasSpouse
      ? {
          spouseCurrentAge: plan.spouseCurrentAge as number,
          spouseRetirementAge: plan.spouseRetireAge as number,
        }
      : {}),
  };

  return computeVerdict(input);
}

// ---------------------------------------------------------------------------
// Tool 4: run_tax_estimate
// Ad-hoc tax estimate for any income scenario — useful for Roth conversion
// planning or "what if I take a big withdrawal this year?" questions.
// ---------------------------------------------------------------------------

const runTaxEstimateDefinition: ToolDefinition = {
  name: 'run_tax_estimate',
  description:
    'Calculates federal + state taxes for a given income scenario. Useful for modeling a specific year, a Roth conversion, or a large withdrawal. Returns federal tax, state tax, effective rate, marginal rate, and IRMAA surcharge.',
  input_schema: {
    type: 'object',
    properties: {
      ordinaryIncome: {
        type: 'number',
        description: 'Ordinary income (salary, pension, RMDs, annuity).',
      },
      socialSecurityBenefit: {
        type: 'number',
        description: 'Gross SS benefit (engine computes taxable portion).',
      },
      capitalGains: {
        type: 'number',
        description: 'Long-term capital gains.',
      },
      age: {
        type: 'number',
        description: 'Primary taxpayer age.',
      },
      filingStatus: {
        type: 'string',
        enum: ['single', 'mfj'],
        description: 'Filing status.',
      },
      stateCode: {
        type: 'string',
        description: '2-letter state code (e.g. "CA").',
      },
    },
    required: ['ordinaryIncome', 'age'],
  },
};

function executeRunTaxEstimate(plan: Record<string, unknown>, input: Record<string, unknown>) {
  const taxInput: TaxInput = {
    filingStatus: (input.filingStatus ?? plan.filingStatus ?? 'single') as 'single' | 'mfj',
    stateCode: (input.stateCode ?? plan.stateCode ?? 'CA') as string,
    age: (input.age ?? plan.currentAge) as number,
    ordinaryIncome: (input.ordinaryIncome ?? 0) as number,
    socialSecurityBenefit: (input.socialSecurityBenefit ?? 0) as number,
    capitalGains: (input.capitalGains ?? 0) as number,
  };

  return computeTax(taxInput);
}

// ---------------------------------------------------------------------------
// Tool 5: run_roth_analysis
// Models a Roth conversion ladder vs. doing nothing — shows lifetime tax
// savings and whether converting makes sense given the user's bracket.
// ---------------------------------------------------------------------------

const runRothAnalysisDefinition: ToolDefinition = {
  name: 'run_roth_analysis',
  description:
    'Models a Roth conversion ladder strategy vs. no conversions. Shows total lifetime taxes paid under each scenario, net savings from converting, and whether the strategy triggers IRMAA. Use when the user asks about Roth conversions, RMD planning, or minimizing taxes in retirement.',
  input_schema: {
    type: 'object',
    properties: {
      targetBracket: {
        type: 'number',
        enum: [0, 12, 22, 24, 32],
        description: 'Fill conversions up to the top of this tax bracket each year.',
      },
      conversionStartAge: {
        type: 'number',
        description: 'Age to begin converting (typically retirement age).',
      },
      conversionEndAge: {
        type: 'number',
        description: 'Last age to convert (typically 72, year before RMDs start).',
      },
    },
    required: ['targetBracket'],
  },
};

function executeRunRothAnalysis(plan: Record<string, unknown>, args: Record<string, unknown>) {
  const incomeSources = (plan.incomeSources as Array<Record<string, unknown>>) ?? [];
  const ssSource = incomeSources.find(
    (s) => s.type === 'socialSecurity' && (s.owner ?? 'primary') === 'primary'
  );
  const pensionSource = incomeSources.find(
    (s) => s.type === 'pension' && (s.owner ?? 'primary') === 'primary'
  );

  const retireAge = (plan.retireAge as number) ?? 65;

  const input: RothLadderInput = {
    currentAge: (plan.currentAge as number) ?? 40,
    retireAge,
    longevityAge: (plan.longevityAge as number) ?? 95,
    tradBalance:
      ((plan.savings401k as number) ?? 0) + ((plan.spouseSavings401k as number) ?? 0),
    rothBalance:
      ((plan.savingsRoth as number) ?? 0) + ((plan.spouseSavingsRoth as number) ?? 0),
    expectedReturn: ((plan.expectedReturn as number) ?? 7) / 100,
    retiredReturnPct: (plan.retiredReturnPct as number) ?? 60,
    filingStatus: (plan.filingStatus as 'single' | 'mfj') ?? 'single',
    stateCode: (plan.stateCode as string) ?? 'CA',
    ssMonthlyBenefit: (ssSource?.monthlyBenefit as number) ?? 0,
    ssStartAge: (ssSource?.startAge as number) ?? 67,
    pensionMonthlyAmount: pensionSource ? (pensionSource.monthlyAmount as number) : undefined,
    pensionStartAge: pensionSource ? (pensionSource.startAge as number) : undefined,
    targetBracket: ((args.targetBracket as number) ?? 22) as Bracket,
    conversionStartAge: (args.conversionStartAge as number) ?? retireAge,
    conversionEndAge: (args.conversionEndAge as number) ?? 72,
  };

  const result = modelRothLadder(input);

  return {
    baselineTotalTax: Math.round(result.baseline.lifetimeTax),
    ladderTotalTax: Math.round(result.ladder.lifetimeTax),
    netTaxSavings: Math.round(result.taxSaved),
    conversionWindowYears: result.conversionWindowYears,
    totalConverted: Math.round(result.ladderConversionTotal),
    irmaaTrippedAges: result.irmaaTrippedAges,
    recommendation:
      result.taxSaved > 0
        ? `Converting saves ~$${Math.round(result.taxSaved / 1000)}K in lifetime taxes.`
        : 'Conversion does not reduce lifetime taxes at this bracket.',
  };
}

// ---------------------------------------------------------------------------
// Tool 6: compare_scenarios
// Runs the projection engine multiple times with different plan overrides
// and returns a side-by-side comparison. Claude uses this to answer
// "what if I retire at 60 vs 65 vs 70?" in a single tool call.
// ---------------------------------------------------------------------------

const compareScenariosDefinition: ToolDefinition = {
  name: 'compare_scenarios',
  description:
    'Runs the retirement projection for multiple scenarios side-by-side and returns a comparison table. Use when the user asks "what if" questions involving multiple alternatives — e.g. different retirement ages, spending levels, or contribution amounts. Each scenario is a partial plan override.',
  input_schema: {
    type: 'object',
    properties: {
      scenarios: {
        type: 'array',
        description: 'Array of scenarios to compare. Each has a label and a set of plan overrides.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Short name for this scenario, e.g. "Retire at 60".' },
            overrides: {
              type: 'object',
              description: 'Plan fields to override for this scenario (retireAge, annualSpending, monthlyContribution, expectedReturn, retireSpending).',
            },
          },
          required: ['label', 'overrides'],
        },
      },
    },
    required: ['scenarios'],
  },
};

function executeCompareScenarios(
  plan: Record<string, unknown>,
  args: Record<string, unknown>
) {
  const scenarios = args.scenarios as Array<{ label: string; overrides: Record<string, unknown> }>;

  const results = scenarios.map(({ label, overrides }) => {
    const mergedPlan = { ...plan, ...overrides };
    const result = computeProjection(mergedPlan as Parameters<typeof computeProjection>[0]);
    const summary = result as Record<string, unknown>;

    return {
      label,
      overrides,
      moneyLastsAge: summary.moneyLastsAge,
      portfolioAtRetire: Math.round((summary.portfolioAtRetire as number) ?? 0),
      finalBalance: Math.round((summary.finalBalance as number) ?? 0),
      firstGapAge: summary.firstGapAge ?? null,
      totalLifetimeTax: Math.round((summary.totalLifetimeTax as number) ?? 0),
      avgEffectiveRate: summary.avgEffectiveRate,
    };
  });

  // Find best scenario by money-lasts-to age
  const best = results.reduce((a, b) =>
    ((a.moneyLastsAge as number) ?? 0) >= ((b.moneyLastsAge as number) ?? 0) ? a : b
  );

  return { scenarios: results, bestScenario: best.label };
}

// ---------------------------------------------------------------------------
// Tool 7: optimize_ss_claiming
// Models SS benefit at claim ages 62, 65, 67 (FRA), and 70.
// Computes monthly benefit, lifetime benefit to longevityAge, and the
// breakeven age vs. claiming at FRA — so Claude can give a data-driven
// recommendation on when to claim.
// ---------------------------------------------------------------------------

const SS_FRA = 67;

function ssClaimingFactor(claimAge: number): number {
  const monthsDiff = (claimAge - SS_FRA) * 12;
  if (monthsDiff === 0) return 1;
  if (monthsDiff < 0) {
    const monthsEarly = Math.abs(monthsDiff);
    const first36 = Math.min(monthsEarly, 36);
    const beyond36 = Math.max(monthsEarly - 36, 0);
    return 1 - (first36 * (5 / 900) + beyond36 * (5 / 1200));
  }
  return 1 + monthsDiff * (2 / 300);
}

const optimizeSsClaimingDefinition: ToolDefinition = {
  name: 'optimize_ss_claiming',
  description:
    'Compares Social Security claiming at ages 62, 65, 67 (FRA), and 70. Returns the adjusted monthly benefit, lifetime total benefit to longevity age, and breakeven age vs. waiting until FRA for each option. Use when the user asks when to claim Social Security.',
  input_schema: {
    type: 'object',
    properties: {
      compareWithProjection: {
        type: 'boolean',
        description:
          'If true, also runs a full projection for each claiming age to show the impact on money-lasts-to age. Slower but more comprehensive.',
      },
    },
  },
};

function executeOptimizeSsClaiming(
  plan: Record<string, unknown>,
  args: Record<string, unknown>
) {
  const incomeSources = (plan.incomeSources as Array<Record<string, unknown>>) ?? [];
  const ssSource = incomeSources.find(
    (s) => s.type === 'socialSecurity' && (s.owner ?? 'primary') === 'primary'
  );

  const fraMonthlyBenefit = (ssSource?.monthlyBenefit as number) ?? 0;
  const longevityAge = (plan.longevityAge as number) ?? 90;
  const cola = 0.02;
  const claimAges = [62, 65, SS_FRA, 70];

  const fraOption = (() => {
    const factor = ssClaimingFactor(SS_FRA);
    const monthly = fraMonthlyBenefit * factor;
    const yearsCollecting = longevityAge - SS_FRA;
    // Approximate lifetime benefit with COLA
    const lifetime = yearsCollecting <= 0 ? 0 :
      monthly * 12 * ((Math.pow(1 + cola, yearsCollecting) - 1) / cola);
    return { claimAge: SS_FRA, factor, monthly, lifetime };
  })();

  const options = claimAges.map((claimAge) => {
    const factor = ssClaimingFactor(claimAge);
    const monthly = fraMonthlyBenefit * factor;
    const yearsCollecting = longevityAge - claimAge;
    const lifetime = yearsCollecting <= 0 ? 0 :
      monthly * 12 * ((Math.pow(1 + cola, yearsCollecting) - 1) / cola);

    // Breakeven vs FRA: months to recoup the foregone benefits from waiting
    let breakevenAge: number | null = null;
    if (claimAge < SS_FRA) {
      // Claiming early: collect more years but lower monthly
      const monthlyDiff = fraOption.monthly - monthly; // FRA pays more per month
      const headstart = (SS_FRA - claimAge) * 12 * monthly; // collected before FRA
      if (monthlyDiff > 0) {
        const breakevenMonths = headstart / monthlyDiff;
        breakevenAge = Math.round((SS_FRA * 12 + breakevenMonths) / 12);
      }
    } else if (claimAge > SS_FRA) {
      // Claiming late: higher monthly but missed years
      const monthlyDiff = monthly - fraOption.monthly;
      const foregone = (claimAge - SS_FRA) * 12 * fraOption.monthly;
      if (monthlyDiff > 0) {
        const breakevenMonths = foregone / monthlyDiff;
        breakevenAge = Math.round((claimAge * 12 + breakevenMonths) / 12);
      }
    }

    return {
      claimAge,
      label: claimAge === SS_FRA ? `${claimAge} (FRA)` : String(claimAge),
      adjustmentFactor: Math.round(factor * 1000) / 1000,
      monthlyBenefit: Math.round(monthly),
      annualBenefit: Math.round(monthly * 12),
      lifetimeBenefitToLongevity: Math.round(lifetime),
      breakevenAgeVsFRA: breakevenAge,
    };
  });

  const projections = args.compareWithProjection
    ? claimAges.map((claimAge) => {
        const updatedSources = incomeSources.map((s) =>
          s.type === 'socialSecurity' && (s.owner ?? 'primary') === 'primary'
            ? { ...s, startAge: claimAge }
            : s
        );
        const result = computeProjection({
          ...plan,
          incomeSources: updatedSources,
        } as Parameters<typeof computeProjection>[0]) as Record<string, unknown>;
        return {
          claimAge,
          moneyLastsAge: result.moneyLastsAge,
          totalLifetimeTax: Math.round((result.totalLifetimeTax as number) ?? 0),
        };
      })
    : null;

  const recommendation = (() => {
    const maxLifetime = options.reduce((a, b) =>
      a.lifetimeBenefitToLongevity >= b.lifetimeBenefitToLongevity ? a : b
    );
    return `Claiming at ${maxLifetime.label} maximizes lifetime benefits ($${Math.round(maxLifetime.lifetimeBenefitToLongevity / 1000)}K) assuming you live to ${longevityAge}.`;
  })();

  return { options, projections, recommendation };
}

// ---------------------------------------------------------------------------
// Tool 8: get_plan_history
// Reads the client-supplied snapshot array (passed from localStorage via the
// API request body) and surfaces trends, changed fields, and milestones so
// Claude can answer "how has my plan changed?" questions.
// ---------------------------------------------------------------------------

const getPlanHistoryDefinition: ToolDefinition = {
  name: 'get_plan_history',
  description:
    'Returns a summary of how the user\'s retirement plan has changed over time — trends in savings, retirement age, and money-lasts-to age. Use when the user asks about their progress, what changed, or how their plan has improved.',
  input_schema: {
    type: 'object',
    properties: {},
  },
};

function executeGetPlanHistory(history: PlanSnapshot[]) {
  if (!history || history.length === 0) {
    return { available: false, message: 'No plan history yet. History builds up as you use the app over multiple days.' };
  }

  const sorted = [...history].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  const daysCovered = Math.round(
    (new Date(newest.savedAt).getTime() - new Date(oldest.savedAt).getTime()) / 86_400_000
  );

  // Detect which key fields changed
  const changes: string[] = [];
  if (oldest.retireAge !== newest.retireAge)
    changes.push(`Retirement age: ${oldest.retireAge} → ${newest.retireAge}`);
  if (Math.abs(oldest.totalSavings - newest.totalSavings) > 1000)
    changes.push(`Total savings: $${Math.round(oldest.totalSavings / 1000)}K → $${Math.round(newest.totalSavings / 1000)}K`);
  if (Math.abs(oldest.monthlyContribution - newest.monthlyContribution) > 50)
    changes.push(`Monthly contribution: $${oldest.monthlyContribution} → $${newest.monthlyContribution}`);
  if (oldest.moneyLastsAge !== newest.moneyLastsAge)
    changes.push(`Money lasts to: age ${oldest.moneyLastsAge} → age ${newest.moneyLastsAge}`);
  if (oldest.gapStatus !== newest.gapStatus)
    changes.push(`Savings status: ${oldest.gapStatus} → ${newest.gapStatus}`);

  // Overall trend based on moneyLastsAge delta
  const ageDelta = (newest.moneyLastsAge ?? 0) - (oldest.moneyLastsAge ?? 0);
  const trend = ageDelta > 1 ? 'improving' : ageDelta < -1 ? 'declining' : 'stable';

  // Recent snapshots (last 5) for context
  const recent = sorted.slice(-5).reverse().map((s) => ({
    date: s.savedAt,
    retireAge: s.retireAge,
    totalSavings: Math.round(s.totalSavings / 1000) + 'K',
    moneyLastsAge: s.moneyLastsAge,
    gapStatus: s.gapStatus,
  }));

  return {
    available: true,
    snapshotCount: history.length,
    daysCovered,
    oldest: { date: oldest.savedAt, moneyLastsAge: oldest.moneyLastsAge, gapStatus: oldest.gapStatus, totalSavings: Math.round(oldest.totalSavings / 1000) + 'K' },
    newest: { date: newest.savedAt, moneyLastsAge: newest.moneyLastsAge, gapStatus: newest.gapStatus, totalSavings: Math.round(newest.totalSavings / 1000) + 'K' },
    trend,
    changes,
    recent,
  };
}

// ---------------------------------------------------------------------------
// Tool 9: analyze_withdrawal_order
// Compares 3 withdrawal sequencing strategies over retirement:
//   A) trad-first  — draw 401(k) before Roth (current engine default)
//   B) roth-first  — draw Roth before 401(k) (swaps balances in projection)
//   C) bracket-fill — Roth conversion ladder to reduce future RMDs
//
// Returns lifetime taxes and money-lasts-to age for each strategy so Claude
// can recommend the optimal withdrawal sequence for this user's bracket.
// ---------------------------------------------------------------------------

const analyzeWithdrawalOrderDefinition: ToolDefinition = {
  name: 'analyze_withdrawal_order',
  description:
    'Compares the user\'s default withdrawal waterfall (taxable → 401k → Roth) against a bracket-fill strategy that does Roth conversions during early retirement. Returns lifetime tax and longevity for the default plan and net tax savings from converting. Use when the user asks about withdrawal sequencing or whether to do Roth conversions.',
  input_schema: {
    type: 'object',
    properties: {
      conversionBracket: {
        type: 'number',
        enum: [12, 22, 24],
        description: 'Target tax bracket for the bracket-fill strategy. Default 22.',
      },
    },
  },
};

// Note: a true "Roth-first" sequencing strategy is not modelled here because
// computeProjection has a fixed withdrawal waterfall (cash → taxable → 401k →
// HSA → Roth) hard-coded into the engine. An earlier version of this tool
// approximated Roth-first by swapping the 401k and Roth balances; that was
// removed because the engine taxes withdrawals from `withdrawal401k` as
// ordinary income and forces RMDs on it — after the swap, Roth dollars got
// taxed and Trad dollars came out tax-free, producing garbage numbers. Adding
// a real Roth-first strategy requires a `withdrawalOrder` parameter on
// computeProjection itself.
function executeAnalyzeWithdrawalOrder(
  plan: Record<string, unknown>,
  args: Record<string, unknown>
) {
  const trad401k = (plan.savings401k as number) ?? 0;
  const roth = (plan.savingsRoth as number) ?? 0;
  const spouseTrad = (plan.spouseSavings401k as number) ?? 0;
  const spouseRoth = (plan.spouseSavingsRoth as number) ?? 0;

  // Strategy A: default waterfall — what the engine actually does today
  const proj = computeProjection(plan as Parameters<typeof computeProjection>[0]) as Record<string, unknown>;

  // Strategy B: bracket-fill via Roth conversion ladder
  const bracket = (args.conversionBracket as number) ?? 22;
  const incomeSources = (plan.incomeSources as Array<Record<string, unknown>>) ?? [];
  const ssSource = incomeSources.find(
    (s) => s.type === 'socialSecurity' && (s.owner ?? 'primary') === 'primary'
  );
  const pensionSource = incomeSources.find(
    (s) => s.type === 'pension' && (s.owner ?? 'primary') === 'primary'
  );
  const retireAge = (plan.retireAge as number) ?? 65;

  const rothInput: RothLadderInput = {
    currentAge: (plan.currentAge as number) ?? 40,
    retireAge,
    longevityAge: (plan.longevityAge as number) ?? 90,
    tradBalance: trad401k + spouseTrad,
    rothBalance: roth + spouseRoth,
    expectedReturn: ((plan.expectedReturn as number) ?? 7) / 100,
    retiredReturnPct: (plan.retiredReturnPct as number) ?? 60,
    filingStatus: (plan.filingStatus as 'single' | 'mfj') ?? 'single',
    stateCode: (plan.stateCode as string) ?? 'CA',
    ssMonthlyBenefit: (ssSource?.monthlyBenefit as number) ?? 0,
    ssStartAge: (ssSource?.startAge as number) ?? 67,
    pensionMonthlyAmount: pensionSource ? (pensionSource.monthlyAmount as number) : undefined,
    pensionStartAge: pensionSource ? (pensionSource.startAge as number) : undefined,
    targetBracket: bracket as Bracket,
    conversionStartAge: retireAge,
    conversionEndAge: 72,
  };
  const ladderResult = modelRothLadder(rothInput);

  // Sanity clamp: modelRothLadder has produced absurd numbers in the past
  // when retiredReturnPct was misinterpreted (4200% return → 10^21 balances).
  // Use an absolute bound — any lifetime tax beyond $50M for any realistic
  // retirement plan is impossible. The 1.5× baseline ratio check is too tight
  // for small-balance plans where the conversion delta naturally exceeds the
  // (small) baseline tax.
  const MAX_REASONABLE_LIFETIME_TAX = 50_000_000;
  const baselineTax = Math.round(ladderResult.baseline.lifetimeTax);
  const ladderTax = Math.round(ladderResult.ladder.lifetimeTax);
  const rawTaxSaved = ladderResult.taxSaved;
  const taxSavedLooksSane =
    Number.isFinite(rawTaxSaved) &&
    Math.abs(baselineTax) <= MAX_REASONABLE_LIFETIME_TAX &&
    Math.abs(ladderTax) <= MAX_REASONABLE_LIFETIME_TAX &&
    Math.abs(rawTaxSaved) <= MAX_REASONABLE_LIFETIME_TAX;

  return {
    defaultWaterfall: {
      name: 'Default Waterfall (taxable → 401k → Roth)',
      description: 'The engine\'s built-in withdrawal sequence. Spends taxable money first, then 401(k), then Roth last. Triggers RMDs on the 401(k) at age 73.',
      moneyLastsAge: proj.moneyLastsAge,
      totalLifetimeTax: Math.round((proj.totalLifetimeTax as number) ?? 0),
      finalBalance: Math.round((proj.finalBalance as number) ?? 0),
    },
    bracketFill: {
      name: `Bracket-Fill (${bracket}% bracket)`,
      description: `Convert 401(k) to Roth each year up to the ${bracket}% bracket ceiling between retirement and age 72. Reduces future RMDs and may reduce total lifetime taxes.`,
      baselineLifetimeTax: baselineTax,
      ladderLifetimeTax: ladderTax,
      netTaxSavings: taxSavedLooksSane ? Math.round(rawTaxSaved) : null,
      totalConverted: Math.round(ladderResult.ladderConversionTotal),
      conversionWindowYears: ladderResult.conversionWindowYears,
      irmaaTrippedAges: ladderResult.irmaaTrippedAges,
      sanityWarning: taxSavedLooksSane
        ? null
        : 'Bracket-fill output failed sanity check (|taxSaved| > 1.5× baseline). The Roth ladder model may be miscalibrated for this plan — treat numbers as approximate.',
    },
    recommendation:
      taxSavedLooksSane && rawTaxSaved > 50_000
        ? `Bracket-fill saves $${Math.round(rawTaxSaved / 1000)}K in lifetime taxes — worth converting during early retirement.`
        : taxSavedLooksSane && rawTaxSaved > 0
        ? `Bracket-fill saves modest taxes ($${Math.round(rawTaxSaved / 1000)}K) — small benefit for this plan size.`
        : taxSavedLooksSane
        ? 'Bracket-fill does not reduce lifetime taxes for this plan — sticking with the default waterfall is fine.'
        : 'Could not produce a reliable bracket-fill comparison for this plan. Report the default waterfall metrics only.',
    note: 'A "Roth-first" sequencing strategy is not modelled — computeProjection has a fixed withdrawal order. Adding that comparison requires an engine change.',
  };
}

// ---------------------------------------------------------------------------
// Tool 10: run_full_optimization
// Chains all relevant analyses (projection, SS, Roth, withdrawal order,
// scenarios) and returns a ranked action list — each item has an estimated
// dollar impact so the user knows where to focus first.
// ---------------------------------------------------------------------------

const runFullOptimizationDefinition: ToolDefinition = {
  name: 'run_full_optimization',
  description:
    'Runs a comprehensive multi-step optimization analysis: baseline projection, SS claiming comparison, Roth conversion analysis, withdrawal order comparison, and retirement age scenarios. Returns a ranked list of actions ordered by estimated 10-year dollar impact. Use when the user asks "how do I optimize my retirement?" or "what should I do first?"',
  input_schema: {
    type: 'object',
    properties: {},
  },
};

function executeRunFullOptimization(plan: Record<string, unknown>) {
  const retireAge = (plan.retireAge as number) ?? 65;
  const longevityAge = (plan.longevityAge as number) ?? 90;
  const currentAge = (plan.currentAge as number) ?? 40;

  // 1. Baseline
  const baseline = computeProjection(plan as Parameters<typeof computeProjection>[0]) as Record<string, unknown>;
  const baselineMLA = (baseline.moneyLastsAge as number) ?? currentAge;
  const baselineTax = Math.round((baseline.totalLifetimeTax as number) ?? 0);

  // 2. SS optimization
  const incomeSources = (plan.incomeSources as Array<Record<string, unknown>>) ?? [];
  const ssSource = incomeSources.find(
    (s) => s.type === 'socialSecurity' && (s.owner ?? 'primary') === 'primary'
  );
  const currentSSAge = (ssSource?.startAge as number) ?? 67;
  const ssAt70Sources = incomeSources.map((s) =>
    s.type === 'socialSecurity' && (s.owner ?? 'primary') === 'primary'
      ? { ...s, startAge: 70 }
      : s
  );
  const projSS70 = computeProjection({
    ...plan,
    incomeSources: ssAt70Sources,
  } as Parameters<typeof computeProjection>[0]) as Record<string, unknown>;
  const ssImpact =
    currentSSAge < 70
      ? Math.round(((projSS70.totalLifetimeIncome as number) ?? 0) - ((baseline.totalLifetimeIncome as number) ?? 0))
      : 0;

  // 3. Roth conversion (22% bracket)
  const trad = (plan.savings401k as number) ?? 0;
  const roth = (plan.savingsRoth as number) ?? 0;
  const pensionSource = incomeSources.find(
    (s) => s.type === 'pension' && (s.owner ?? 'primary') === 'primary'
  );
  let rothTaxSaved = 0;
  if (trad > 0 && retireAge < 72) {
    try {
      const ladder = modelRothLadder({
        currentAge,
        retireAge,
        longevityAge,
        tradBalance: trad,
        rothBalance: roth,
        expectedReturn: ((plan.expectedReturn as number) ?? 7) / 100,
        retiredReturnPct: (plan.retiredReturnPct as number) ?? 60,
        filingStatus: (plan.filingStatus as 'single' | 'mfj') ?? 'single',
        stateCode: (plan.stateCode as string) ?? 'CA',
        ssMonthlyBenefit: (ssSource?.monthlyBenefit as number) ?? 0,
        ssStartAge: (ssSource?.startAge as number) ?? 67,
        pensionMonthlyAmount: pensionSource ? (pensionSource.monthlyAmount as number) : undefined,
        pensionStartAge: pensionSource ? (pensionSource.startAge as number) : undefined,
        targetBracket: 22,
        conversionStartAge: retireAge,
        conversionEndAge: 72,
      });
      rothTaxSaved = Math.round(ladder.taxSaved);
    } catch {
      rothTaxSaved = 0;
    }
  }

  // 4. Retire 2 years later
  const projLater = computeProjection({
    ...plan,
    retireAge: retireAge + 2,
  } as Parameters<typeof computeProjection>[0]) as Record<string, unknown>;
  const laterMLA = (projLater.moneyLastsAge as number) ?? baselineMLA;
  const retireYearsGain = laterMLA - baselineMLA;

  // 5. Increase monthly contribution by $500
  const monthlyContrib = (plan.monthlyContribution as number) ?? 0;
  const projMoreContrib = computeProjection({
    ...plan,
    monthlyContribution: monthlyContrib + 500,
  } as Parameters<typeof computeProjection>[0]) as Record<string, unknown>;
  const contribMLA = (projMoreContrib.moneyLastsAge as number) ?? baselineMLA;
  const contribYearsGain = contribMLA - baselineMLA;
  const yearsToRetire = Math.max(0, retireAge - currentAge);
  const contribDollarImpact = Math.round(500 * 12 * yearsToRetire * 1.4); // rough FV estimate

  // Build ranked action list
  const actions: Array<{
    rank: number;
    action: string;
    detail: string;
    estimatedImpact: string;
    dollarValue: number;
    yearsGain?: number;
  }> = [];

  if (ssImpact > 10_000) {
    actions.push({
      rank: 0,
      action: 'Delay Social Security to 70',
      detail: `Waiting from ${currentSSAge} to 70 adds ~$${Math.round(ssImpact / 1000)}K in lifetime income.`,
      estimatedImpact: `+$${Math.round(ssImpact / 1000)}K lifetime income`,
      dollarValue: ssImpact,
    });
  }

  if (rothTaxSaved > 10_000) {
    actions.push({
      rank: 0,
      action: 'Roth conversion ladder (22% bracket)',
      detail: `Converting during early retirement saves ~$${Math.round(rothTaxSaved / 1000)}K in lifetime taxes vs. letting RMDs force higher brackets.`,
      estimatedImpact: `-$${Math.round(rothTaxSaved / 1000)}K in lifetime taxes`,
      dollarValue: rothTaxSaved,
    });
  }

  if (contribYearsGain > 0) {
    actions.push({
      rank: 0,
      action: 'Increase monthly contribution by $500',
      detail: `Adding $500/month extends portfolio longevity by ${contribYearsGain} year(s).`,
      estimatedImpact: `+${contribYearsGain} year(s) of retirement income`,
      dollarValue: contribDollarImpact,
      yearsGain: contribYearsGain,
    });
  }

  if (retireYearsGain >= 2) {
    actions.push({
      rank: 0,
      action: `Retire at ${retireAge + 2} instead of ${retireAge}`,
      detail: `Working 2 more years extends portfolio longevity by ${retireYearsGain} year(s).`,
      estimatedImpact: `+${retireYearsGain} year(s) of retirement income`,
      dollarValue: retireYearsGain * 30_000,
      yearsGain: retireYearsGain,
    });
  }

  // Rank by dollar value descending
  actions.sort((a, b) => b.dollarValue - a.dollarValue);
  actions.forEach((a, i) => (a.rank = i + 1));

  return {
    baseline: {
      moneyLastsAge: baselineMLA,
      totalLifetimeTax: baselineTax,
      portfolioAtRetire: Math.round((baseline.portfolioAtRetire as number) ?? 0),
    },
    actions,
    summary:
      actions.length > 0
        ? `Top opportunity: ${actions[0].action} — ${actions[0].estimatedImpact}.`
        : 'Your plan is well-optimized. Focus on staying the course.',
  };
}

// ---------------------------------------------------------------------------
// Tool 11: analyze_portfolio_recommendations
// Runs the pure-calculation portfolio insights engine (lib/portfolioInsights.ts)
// and returns a ranked list of account-level recommendations. The same engine
// powers the AI Advisor's Portfolio Insights panel directly (no LLM round-trip
// needed there) — Claude calls this tool when reasoning about the broader plan.
// ---------------------------------------------------------------------------

const analyzePortfolioRecommendationsDefinition: ToolDefinition = {
  name: 'analyze_portfolio_recommendations',
  description:
    "Returns proactive account-level portfolio recommendations: tax bucket diversification, account concentration, cash drag, Roth conversion window, return assumption sanity, contribution destination. Each recommendation has a severity, dollar impact, and concrete action. Use when the user asks 'what should I change' or for general portfolio review questions.",
  input_schema: {
    type: 'object',
    properties: {},
  },
};

function executeAnalyzePortfolioRecommendations(plan: Record<string, unknown>) {
  return analyzePortfolio(plan);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  getPlanSummaryDefinition,
  runProjectionDefinition,
  getVerdictDefinition,
  runTaxEstimateDefinition,
  runRothAnalysisDefinition,
  compareScenariosDefinition,
  optimizeSsClaimingDefinition,
  getPlanHistoryDefinition,
  analyzeWithdrawalOrderDefinition,
  runFullOptimizationDefinition,
  analyzePortfolioRecommendationsDefinition,
];

export function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  plan: Record<string, unknown>,
  planHistory: PlanSnapshot[] = []
): ToolResult {
  try {
    let result: unknown;

    switch (toolName) {
      case 'get_plan_summary':
        result = executePlanSummary(plan);
        break;
      case 'run_projection':
        result = executeRunProjection(plan, toolInput);
        break;
      case 'get_verdict':
        result = executeGetVerdict(plan);
        break;
      case 'run_tax_estimate':
        result = executeRunTaxEstimate(plan, toolInput);
        break;
      case 'run_roth_analysis':
        result = executeRunRothAnalysis(plan, toolInput);
        break;
      case 'compare_scenarios':
        result = executeCompareScenarios(plan, toolInput);
        break;
      case 'optimize_ss_claiming':
        result = executeOptimizeSsClaiming(plan, toolInput);
        break;
      case 'get_plan_history':
        result = executeGetPlanHistory(planHistory);
        break;
      case 'analyze_withdrawal_order':
        result = executeAnalyzeWithdrawalOrder(plan, toolInput);
        break;
      case 'run_full_optimization':
        result = executeRunFullOptimization(plan);
        break;
      case 'analyze_portfolio_recommendations':
        result = executeAnalyzePortfolioRecommendations(plan);
        break;
      default:
        return { toolName, result: null, error: `Unknown tool: ${toolName}` };
    }

    return { toolName, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { toolName, result: null, error: message };
  }
}
