/**
 * Quick smoke test for agentTools.ts
 * Run: npx tsx --tsconfig tsconfig.json scripts/testAgentTools.ts
 */

import { executeTool, TOOL_DEFINITIONS } from '../lib/agentTools';

// Sample plan matching the DEFAULT_PLAN shape from PlanProvider
const samplePlan = {
  currentAge: 45,
  retireAge: 65,
  longevityAge: 90,
  filingStatus: 'mfj',
  stateCode: 'CA',
  hasSpouse: false,

  savings401k: 250000,
  savingsRoth: 50000,
  savingsTaxable: 30000,
  savingsHSA: 15000,
  savingsCash: 20000,
  savingsRealEstate: 0,
  savingsCrypto: 0,
  savingsAnnuity: 0,
  spouseSavings401k: 0,
  spouseSavingsRoth: 0,
  spouseSavingsHSA: 0,

  monthlyContribution: 1500,
  spouseMonthlyContribution: 0,

  expectedReturn: 7,
  inflationRate: 2.5,
  healthcareInflation: 3.5,
  healthcareMultiplier: 1.0,
  retiredReturnPct: 60,

  annualSpending: 80000,
  retireSpending: 65000,
  goGoEndAge: 75,
  slowGoEndAge: 85,

  incomeSources: [
    { id: 1, type: 'salary', label: 'Salary', amount: 120000, growthRate: 3, owner: 'primary' },
    { id: 2, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2800, startAge: 67, owner: 'primary' },
  ],
  debts: [],
};

function pass(name: string, detail?: string) {
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, error: string) {
  console.error(`  ✗ ${name} — ${error}`);
  process.exitCode = 1;
}

function check(name: string, fn: () => void) {
  try {
    fn();
    pass(name);
  } catch (e) {
    fail(name, e instanceof Error ? e.message : String(e));
  }
}

console.log('\n=== agentTools smoke test ===\n');

// 1. Tool definitions
console.log('Tool definitions:');
check(`exports ${TOOL_DEFINITIONS.length} tools`, () => {
  if (TOOL_DEFINITIONS.length !== 10) throw new Error(`expected 10, got ${TOOL_DEFINITIONS.length}`);
});
TOOL_DEFINITIONS.forEach(t => {
  check(`${t.name} has name + description + input_schema`, () => {
    if (!t.name || !t.description || !t.input_schema) throw new Error('missing fields');
  });
});

// 2. get_plan_summary
console.log('\nget_plan_summary:');
const summaryResult = executeTool('get_plan_summary', {}, samplePlan);
check('no error', () => { if (summaryResult.error) throw new Error(summaryResult.error); });
check('returns demographics + savings + incomeSources', () => {
  const r = summaryResult.result as Record<string, unknown>;
  if (!r.demographics || !r.savings || !r.incomeSources) throw new Error('missing fields');
});
check('total savings = 365000', () => {
  const savings = (summaryResult.result as Record<string, Record<string, number>>).savings;
  if (savings.total !== 365000) throw new Error(`got ${savings.total}`);
});

// 3. run_projection (baseline)
console.log('\nrun_projection (baseline):');
const projResult = executeTool('run_projection', {}, samplePlan);
check('no error', () => { if (projResult.error) throw new Error(projResult.error); });
check('returns summary with moneyLastsAge', () => {
  const r = projResult.result as Record<string, Record<string, unknown>>;
  if (r.summary.moneyLastsAge === undefined) throw new Error('moneyLastsAge missing');
  pass('', `money lasts to age ${r.summary.moneyLastsAge}`);
});
check('yearTableSample has rows', () => {
  const r = projResult.result as Record<string, unknown[]>;
  if (!r.yearTableSample.length) throw new Error('empty table');
  pass('', `${r.yearTableSample.length} sample rows`);
});

// 4. run_projection (scenario override — retire at 60)
console.log('\nrun_projection (scenario: retire at 60):');
const projEarly = executeTool('run_projection', { retireAge: 60 }, samplePlan);
check('no error', () => { if (projEarly.error) throw new Error(projEarly.error); });
check('scenario override recorded', () => {
  const r = projEarly.result as Record<string, unknown>;
  if (!(r.scenarioOverrides as Record<string, unknown>)?.retireAge) throw new Error('override not recorded');
});
check('earlier retirement reduces money-lasts-to age', () => {
  const baseline = (projResult.result as Record<string, Record<string, unknown>>).summary.moneyLastsAge as number;
  const early = (projEarly.result as Record<string, Record<string, unknown>>).summary.moneyLastsAge as number;
  if (early >= baseline) throw new Error(`expected early (${early}) < baseline (${baseline})`);
  pass('', `retire@60 lasts to ${early} vs retire@65 lasts to ${baseline}`);
});

// 5. get_verdict
console.log('\nget_verdict:');
const verdictResult = executeTool('get_verdict', {}, samplePlan);
check('no error', () => { if (verdictResult.error) throw new Error(verdictResult.error); });
check('returns gapStatus + topActions', () => {
  const r = verdictResult.result as Record<string, unknown>;
  if (!r.gapStatus || !Array.isArray(r.topActions)) throw new Error('missing fields');
  pass('', `status=${r.gapStatus}, ${(r.topActions as unknown[]).length} actions`);
});

// 6. run_tax_estimate
console.log('\nrun_tax_estimate:');
const taxResult = executeTool('run_tax_estimate', { ordinaryIncome: 100000, age: 45 }, samplePlan);
check('no error', () => { if (taxResult.error) throw new Error(taxResult.error); });
check('returns federalTax > 0', () => {
  const r = taxResult.result as Record<string, number>;
  if (r.federalTax <= 0) throw new Error(`federalTax=${r.federalTax}`);
  pass('', `federal=$${r.federalTax.toLocaleString()}, effective=${(r.effectiveRate * 100).toFixed(1)}%`);
});

// 7. run_roth_analysis
console.log('\nrun_roth_analysis:');
const rothResult = executeTool('run_roth_analysis', { targetBracket: 22 }, samplePlan);
check('no error', () => { if (rothResult.error) throw new Error(rothResult.error); });
check('returns baselineTotalTax + ladderTotalTax', () => {
  const r = rothResult.result as Record<string, number>;
  if (r.baselineTotalTax === undefined || r.ladderTotalTax === undefined) throw new Error('missing fields');
  pass('', `saves $${r.netTaxSavings.toLocaleString()} over lifetime`);
});

// 8. compare_scenarios
console.log('\ncompare_scenarios:');
const compareResult = executeTool('compare_scenarios', {
  scenarios: [
    { label: 'Retire at 60', overrides: { retireAge: 60 } },
    { label: 'Retire at 65', overrides: { retireAge: 65 } },
    { label: 'Retire at 70', overrides: { retireAge: 70 } },
  ],
}, samplePlan);
check('no error', () => { if (compareResult.error) throw new Error(compareResult.error); });
check('returns 3 scenarios + bestScenario', () => {
  const r = compareResult.result as Record<string, unknown>;
  const scenarios = r.scenarios as unknown[];
  if (scenarios.length !== 3) throw new Error(`expected 3, got ${scenarios.length}`);
  if (!r.bestScenario) throw new Error('missing bestScenario');
  pass('', `best: ${r.bestScenario}`);
});
check('retire@70 lasts longer than retire@60', () => {
  const scenarios = (compareResult.result as Record<string, unknown[]>).scenarios as Array<Record<string, unknown>>;
  const at60 = scenarios.find(s => s.label === 'Retire at 60')!;
  const at70 = scenarios.find(s => s.label === 'Retire at 70')!;
  if ((at70.moneyLastsAge as number) <= (at60.moneyLastsAge as number)) {
    throw new Error(`expected 70 > 60: ${at70.moneyLastsAge} vs ${at60.moneyLastsAge}`);
  }
  pass('', `ages: 60→${at60.moneyLastsAge}, 65→${(scenarios.find(s=>s.label==='Retire at 65') as Record<string,unknown>).moneyLastsAge}, 70→${at70.moneyLastsAge}`);
});

// 9. optimize_ss_claiming
console.log('\noptimize_ss_claiming:');
const ssResult = executeTool('optimize_ss_claiming', { compareWithProjection: false }, samplePlan);
check('no error', () => { if (ssResult.error) throw new Error(ssResult.error); });
check('returns 4 options (62, 65, 67, 70)', () => {
  const r = ssResult.result as Record<string, unknown>;
  const opts = r.options as unknown[];
  if (opts.length !== 4) throw new Error(`expected 4 options, got ${opts.length}`);
});
check('age 70 has highest monthly benefit', () => {
  const opts = (ssResult.result as Record<string, Array<Record<string, number>>>).options;
  const at70 = opts.find(o => o.claimAge === 70)!;
  const at62 = opts.find(o => o.claimAge === 62)!;
  if (at70.monthlyBenefit <= at62.monthlyBenefit) throw new Error('70 should beat 62');
  pass('', `62→$${at62.monthlyBenefit}/mo, 70→$${at70.monthlyBenefit}/mo`);
});
check('has recommendation', () => {
  const r = ssResult.result as Record<string, unknown>;
  if (!r.recommendation) throw new Error('missing recommendation');
  pass('', r.recommendation as string);
});

// 10. get_plan_history — no history
console.log('\nget_plan_history (empty):');
const historyEmpty = executeTool('get_plan_history', {}, samplePlan, []);
check('no error', () => { if (historyEmpty.error) throw new Error(historyEmpty.error); });
check('returns available=false when empty', () => {
  const r = historyEmpty.result as Record<string, unknown>;
  if (r.available !== false) throw new Error(`expected false, got ${r.available}`);
});

// 11. get_plan_history — with mock snapshots
console.log('\nget_plan_history (with data):');
const mockHistory = [
  { savedAt: '2026-03-01', retireAge: 67, longevityAge: 90, totalSavings: 280000, monthlyContribution: 1200, annualSpending: 80000, retireSpending: 65000, moneyLastsAge: 82, portfolioAtRetire: 900000, gapStatus: 'behind', savingsGap: 120000, projectedBalance: 880000 },
  { savedAt: '2026-04-01', retireAge: 65, longevityAge: 90, totalSavings: 310000, monthlyContribution: 1500, annualSpending: 80000, retireSpending: 65000, moneyLastsAge: 85, portfolioAtRetire: 980000, gapStatus: 'behind', savingsGap: 90000, projectedBalance: 960000 },
  { savedAt: '2026-05-01', retireAge: 65, longevityAge: 90, totalSavings: 365000, monthlyContribution: 1500, annualSpending: 80000, retireSpending: 65000, moneyLastsAge: 87, portfolioAtRetire: 1050000, gapStatus: 'on-track', savingsGap: 10000, projectedBalance: 1040000 },
];
const historyResult = executeTool('get_plan_history', {}, samplePlan, mockHistory as never);
check('no error', () => { if (historyResult.error) throw new Error(historyResult.error); });
check('trend = improving', () => {
  const r = historyResult.result as Record<string, unknown>;
  if (r.trend !== 'improving') throw new Error(`expected improving, got ${r.trend}`);
  pass('', `trend=${r.trend}, ${(r.changes as string[]).length} changes detected`);
});
check('detects retirement age change', () => {
  const changes = (historyResult.result as Record<string, string[]>).changes;
  if (!changes.some(c => c.includes('Retirement age'))) throw new Error('expected retirement age change');
});

// 12. Unknown tool
console.log('\nunknown tool:');
const unknownResult = executeTool('nonexistent_tool', {}, samplePlan);
check('returns error string, no throw', () => {
  if (!unknownResult.error) throw new Error('expected error field');
});

// 13. analyze_withdrawal_order
console.log('\nanalyze_withdrawal_order:');
const withdrawalResult = executeTool('analyze_withdrawal_order', { conversionBracket: 22 }, samplePlan);
check('no error', () => { if (withdrawalResult.error) throw new Error(withdrawalResult.error); });
check('returns defaultWaterfall + bracketFill (no Roth-first)', () => {
  const r = withdrawalResult.result as Record<string, unknown>;
  if (!r.defaultWaterfall || !r.bracketFill) throw new Error('missing strategy fields');
  if ('strategies' in r) throw new Error('legacy strategies array should be gone');
});
check('has recommendation + note about Roth-first not modelled', () => {
  const r = withdrawalResult.result as Record<string, unknown>;
  if (!r.recommendation) throw new Error('missing recommendation');
  if (!r.note || !(r.note as string).includes('Roth-first')) throw new Error('missing note about Roth-first');
  pass('', r.recommendation as string);
});
check('bracketFill includes sanity check flag', () => {
  const bf = (withdrawalResult.result as Record<string, Record<string, unknown>>).bracketFill;
  if (!('sanityWarning' in bf)) throw new Error('missing sanityWarning field');
  // For this small-balance plan, taxSaved was ~$-38K — well within sanity bounds
  if (bf.sanityWarning !== null) throw new Error(`unexpected warning: ${bf.sanityWarning}`);
});

// 14. run_full_optimization
console.log('\nrun_full_optimization:');
const optimizeResult = executeTool('run_full_optimization', {}, samplePlan);
check('no error', () => { if (optimizeResult.error) throw new Error(optimizeResult.error); });
check('returns baseline + actions + summary', () => {
  const r = optimizeResult.result as Record<string, unknown>;
  if (!r.baseline || !Array.isArray(r.actions) || !r.summary) throw new Error('missing fields');
});
check('actions ranked by dollar value desc', () => {
  const actions = (optimizeResult.result as Record<string, Array<{ dollarValue: number; rank: number }>>).actions;
  if (actions.length > 1) {
    for (let i = 1; i < actions.length; i++) {
      if (actions[i].dollarValue > actions[i - 1].dollarValue) throw new Error('not sorted');
    }
  }
  pass('', `${actions.length} actions, top: ${(optimizeResult.result as Record<string, { summary: string }>).summary}`);
});

console.log('\n=== done ===\n');
