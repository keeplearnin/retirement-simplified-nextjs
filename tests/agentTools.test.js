import { describe, it, expect } from 'vitest';
import { executeTool, TOOL_DEFINITIONS } from '@/lib/agentTools';
import { computeProjection } from '@/lib/computeProjection';
import { runPlanOdds } from '@/lib/planOdds';

// The chat promises "the numbers match" the Plan screen: these tie its
// tools to the same functions the screens use.
const plan = {
  currentAge: 45, retireAge: 65, longevityAge: 92,
  filingStatus: 'single', stateCode: 'TX', hasSpouse: false,
  savings401k: 600_000, savingsRoth: 80_000, savingsHSA: 0, savingsPension: 0,
  spouseSavings401k: 0, spouseSavingsRoth: 0, spouseSavingsHSA: 0, spouseSavingsPension: 0,
  savingsTaxable: 150_000, savingsRealEstate: 0, savingsCash: 30_000,
  savings529: 0, savingsCrypto: 0, savingsAnnuity: 0,
  monthlyContribution: 2_500, spouseMonthlyContribution: 0,
  expectedReturn: 7, debts: [], inflationRate: 2.5, healthcareInflation: 3.5,
  healthcareMultiplier: 1, useRealEstateInRetirement: false,
  retiredReturnPct: 60, cashReturn: 3, realEstateAppreciation: 3, annuityReturn: 3.5,
  annualSpending: 85_000, retireSpending: 75_000, expenseMode: 'simple', expenseBreakdown: null,
  goGoEndAge: 75, slowGoEndAge: 85,
  incomeSources: [
    { type: 'salary', amount: 160_000, growthRate: 3, endAge: 65 },
    { type: 'socialSecurity', monthlyBenefit: 3_200, startAge: 67 },
  ],
};
const run = (name, input = {}) => {
  const r = executeTool(name, input, plan);
  expect(r.error).toBeUndefined();
  return r.result;
};

describe('chat tools match the screens', () => {
  it('get_plan_odds returns the Plan screen percentage', () => {
    const odds = run('get_plan_odds');
    expect(odds.chanceMoneyLastsPct).toBe(Math.round(runPlanOdds(plan).successRate * 100));
    expect(odds.marketsTested).toBe(500);
  });

  it('get_plan_odds models a what-if without touching the plan', () => {
    const later = run('get_plan_odds', { retireAge: 68 });
    expect(later.chanceMoneyLastsPct).toBeGreaterThanOrEqual(run('get_plan_odds').chanceMoneyLastsPct);
    expect(plan.retireAge).toBe(65);
  });

  it('get_verdict quotes the projection balance at retirement', () => {
    expect(run('get_verdict').projectedBalance).toBe(Math.round(computeProjection(plan).portfolioAtRetire));
  });

  it('run_projection year table carries real balances', () => {
    expect(run('run_projection').yearTableSample.every(r => r.balance > 0)).toBe(true);
  });

  it('the odds tool is offered to the chat', () => {
    expect(TOOL_DEFINITIONS.map(t => t.name)).toContain('get_plan_odds');
  });
});
