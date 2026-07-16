import { describe, it, expect } from 'vitest';
import { classifyAccount, aggregateAccounts, mergeIntoPlan } from '@/lib/plaidMapping';

describe('classifyAccount — tax treatment is correct', () => {
  const cases = [
    ['investment', '401k', 'savings401k'],
    ['investment', '403b', 'savings401k'],
    ['investment', 'ira', 'savings401k'],
    ['investment', 'roth', 'savingsRoth'],
    ['investment', 'roth ira', 'savingsRoth'],
    ['investment', 'hsa', 'savingsHSA'],
    ['investment', '529', 'savings529'],
    ['investment', 'brokerage', 'savingsTaxable'],
    ['depository', 'checking', 'savingsCash'],
    ['depository', 'savings', 'savingsCash'],
    ['depository', 'money market', 'savingsCash'],
  ];
  for (const [type, subtype, bucket] of cases) {
    it(`${type}/${subtype} → ${bucket}`, () => {
      const c = classifyAccount({ type, subtype, balance: 1000 });
      expect(c.kind).toBe('bucket');
      expect(c.bucket).toBe(bucket);
    });
  }

  it('credit cards and loans are debts with the owed balance positive', () => {
    const cc = classifyAccount({ type: 'credit', subtype: 'credit card', balance: 3200 });
    expect(cc.kind).toBe('debt');
    expect(cc.balance).toBe(3200);
    const loan = classifyAccount({ type: 'loan', subtype: 'student', balance: 18000 });
    expect(loan.kind).toBe('debt');
  });

  it('unknown investment subtype falls back to taxable (conservative)', () => {
    const c = classifyAccount({ type: 'investment', subtype: 'weird_new_thing', balance: 500 });
    expect(c.bucket).toBe('savingsTaxable');
  });

  // Regression: Plaid/demo use underscore subtypes; a Roth IRA must not land
  // in taxable (the bug caught by end-to-end sync verification).
  it('handles underscore + keyword subtype variants correctly', () => {
    const cases = [
      ['roth_ira', 'savingsRoth'],
      ['roth 401k', 'savingsRoth'],
      ['sep_ira', 'savings401k'],
      ['simple_ira', 'savings401k'],
      ['traditional_401k', 'savings401k'],
      ['rollover ira', 'savings401k'],
      ['529_plan', 'savings529'],
      ['money_market', 'savingsCash'],
    ];
    for (const [subtype, bucket] of cases) {
      expect(classifyAccount({ type: 'investment', subtype, balance: 100 }).bucket, subtype).toBe(bucket);
    }
  });

  it('reads Plaid-native balances.current when balance is absent', () => {
    const c = classifyAccount({ type: 'depository', subtype: 'checking', balances: { current: 4200 } });
    expect(c.balance).toBe(4200);
  });
});

describe('aggregateAccounts — a realistic multi-institution affluent household', () => {
  const accounts = [
    { name: 'Vanguard 401k', type: 'investment', subtype: '401k', balance: 820_000 },
    { name: 'Fidelity Roth', type: 'investment', subtype: 'roth ira', balance: 190_000 },
    { name: 'Schwab Brokerage', type: 'investment', subtype: 'brokerage', balance: 410_000 },
    { name: 'HSA', type: 'investment', subtype: 'hsa', balance: 62_000 },
    { name: 'Chase Checking', type: 'depository', subtype: 'checking', balance: 22_000 },
    { name: 'Chase Savings', type: 'depository', subtype: 'savings', balance: 78_000 },
    { name: 'Sapphire Card', type: 'credit', subtype: 'credit card', balance: 4_100 },
  ];

  it('sums each bucket by tax treatment', () => {
    const { buckets } = aggregateAccounts(accounts);
    expect(buckets.savings401k).toBe(820_000);
    expect(buckets.savingsRoth).toBe(190_000);
    expect(buckets.savingsTaxable).toBe(410_000);
    expect(buckets.savingsHSA).toBe(62_000);
    expect(buckets.savingsCash).toBe(100_000); // checking + savings
  });

  it('turns credit/loan accounts into debts with sane defaults', () => {
    const { debts } = aggregateAccounts(accounts);
    expect(debts).toHaveLength(1);
    expect(debts[0].remainingBalance).toBe(4_100);
    expect(debts[0].interestRate).toBe(22);
    expect(debts[0].monthlyPayment).toBeGreaterThan(0);
  });

  it('total across buckets matches the sum of positive-asset balances', () => {
    const { buckets } = aggregateAccounts(accounts);
    const total = Object.values(buckets).reduce((s, v) => s + v, 0);
    expect(total).toBe(820_000 + 190_000 + 410_000 + 62_000 + 100_000);
  });
});

describe('mergeIntoPlan', () => {
  const plan = { savings401k: 500_000, savingsRoth: 0, savingsCash: 10_000, debts: [] };
  const aggregated = aggregateAccounts([
    { name: '401k', type: 'investment', subtype: '401k', balance: 820_000 },
    { name: 'Card', type: 'credit', subtype: 'credit card', balance: 3_000 },
  ]);

  it('replace mode overwrites manual bucket values with linked balances', () => {
    const patch = mergeIntoPlan(plan, aggregated, 'replace');
    expect(patch.savings401k).toBe(820_000); // overwritten, not added
    expect(patch.debts.some(d => d._fromPlaid)).toBe(true);
  });

  it('add mode supplements manual values', () => {
    const patch = mergeIntoPlan(plan, aggregated, 'add');
    expect(patch.savings401k).toBe(500_000 + 820_000);
  });

  it('replace mode does not zero out manual entries when a bucket is empty', () => {
    const emptyAgg = aggregateAccounts([{ name: 'Card', type: 'credit', subtype: 'credit card', balance: 3_000 }]);
    const patch = mergeIntoPlan(plan, emptyAgg, 'replace');
    // savings401k had no linked value → untouched (not set to 0)
    expect(patch.savings401k).toBeUndefined();
  });

  it('re-syncing replaces prior Plaid debts rather than duplicating them', () => {
    const planWithPlaidDebt = { ...plan, debts: [{ id: 201, name: 'Old card', remainingBalance: 2000, _fromPlaid: true }] };
    const patch = mergeIntoPlan(planWithPlaidDebt, aggregated, 'replace');
    const plaidDebts = patch.debts.filter(d => d._fromPlaid);
    expect(plaidDebts).toHaveLength(1); // old one dropped, new one added
    expect(plaidDebts[0].remainingBalance).toBe(3_000);
  });
});
