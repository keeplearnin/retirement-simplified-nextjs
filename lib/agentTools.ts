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
];

export function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  plan: Record<string, unknown>
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
      default:
        return { toolName, result: null, error: `Unknown tool: ${toolName}` };
    }

    return { toolName, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { toolName, result: null, error: message };
  }
}
