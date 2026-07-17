import { describe, it, expect } from 'vitest';
import { migratePlan, mintId } from '@/components/PlanProvider';

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

describe('mintId — collision-free id minting', () => {
  it('returns max existing id + 1 (never length + 1)', () => {
    // length+1 would return 3 here and collide with the id-100 item.
    const items = [{ id: 1 }, { id: 100 }];
    expect(mintId(items)).toBe(101);
  });

  it('does not collide after a middle item is removed', () => {
    const items = [{ id: 1 }, { id: 3 }]; // id 2 was removed
    const next = mintId(items);
    expect(items.some(i => i.id === next)).toBe(false);
    expect(next).toBe(4);
  });

  it('respects the floor for empty lists', () => {
    expect(mintId([], 100)).toBe(101);
    expect(mintId(undefined, 200)).toBe(201);
    expect(mintId([])).toBe(1);
  });

  it('ignores stray non-numeric ids instead of poisoning the max', () => {
    const items = [{ id: 5 }, { id: 'abc' }, { id: undefined }];
    expect(mintId(items)).toBe(6);
  });
});
