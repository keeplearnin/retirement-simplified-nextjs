import { describe, it, expect } from 'vitest';
import { migratePlan } from '@/components/PlanProvider';

describe('migratePlan — duplicate id healing', () => {
  it('reassigns fresh ids when income sources share an id (the "edit one, both change" bug)', () => {
    const plan = migratePlan({
      currentAge: 40,
      incomeSources: [
        { id: 101, type: 'salary', label: 'Salary', amount: 100_000, owner: 'primary' },
        { id: 101, type: 'salary', label: 'Spouse Salary', amount: 85_000, owner: 'spouse' },
        { id: 2, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2_500, startAge: 67, owner: 'primary' },
      ],
    });
    const ids = plan.incomeSources.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Original rows keep their data — only the colliding id changes.
    expect(plan.incomeSources.find(s => s.label === 'Salary').amount).toBe(100_000);
    expect(plan.incomeSources.find(s => s.label === 'Spouse Salary').amount).toBe(85_000);
    // First occurrence keeps its id; the duplicate gets a fresh one above max.
    expect(plan.incomeSources[0].id).toBe(101);
    expect(plan.incomeSources[1].id).toBeGreaterThan(101);
  });

  it('leaves plans with unique ids untouched (same array reference)', () => {
    const sources = [
      { id: 1, type: 'salary', label: 'Salary', amount: 100_000 },
      { id: 2, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2_500, startAge: 67 },
    ];
    const plan = migratePlan({ currentAge: 40, incomeSources: sources });
    expect(plan.incomeSources).toBe(sources);
  });

  it('dedupes debt ids too', () => {
    const plan = migratePlan({
      currentAge: 40,
      debts: [
        { id: 201, name: 'Mortgage', monthlyPayment: 2000, remainingBalance: 300000, interestRate: 6 },
        { id: 201, name: 'Car loan', monthlyPayment: 400, remainingBalance: 20000, interestRate: 7 },
      ],
    });
    const ids = plan.debts.map(d => d.id);
    expect(new Set(ids).size).toBe(2);
  });
});
