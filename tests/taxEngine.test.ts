import { describe, it, expect } from 'vitest';
import { computeTax, computeSSTaxable } from '@/lib/taxEngine';

describe('computeSSTaxable', () => {
  it('returns 0 below the lower threshold', () => {
    // Single, $20K benefit, no other income → provisional = $10K < $25K
    const r = computeSSTaxable(20_000, 0, 'single');
    expect(r.taxableAmount).toBe(0);
    expect(r.taxablePercent).toBe(0);
  });

  it('taxes up to 50% in the middle band', () => {
    // Single, $20K benefit, $20K other → provisional = $30K (between 25K and 34K)
    // taxable = min(0.5 * (30K - 25K), 0.5 * 20K) = $2,500
    const r = computeSSTaxable(20_000, 20_000, 'single');
    expect(r.taxableAmount).toBe(2_500);
    expect(r.taxablePercent).toBe(50);
  });

  it('caps at 85% of the benefit for high income', () => {
    const benefit = 30_000;
    const r = computeSSTaxable(benefit, 200_000, 'single');
    expect(r.taxableAmount).toBeCloseTo(0.85 * benefit, 2);
    expect(r.taxablePercent).toBe(85);
  });
});

describe('computeTax — federal', () => {
  it('owes no federal tax below the standard deduction', () => {
    const r = computeTax({
      filingStatus: 'single', ordinaryIncome: 15_000,
      socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'TX', age: 40,
    });
    expect(r.federalTax).toBe(0);
  });

  it('owes federal tax on income above the standard deduction (QA spot check)', () => {
    const r = computeTax({
      filingStatus: 'single', ordinaryIncome: 30_000,
      socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'TX', age: 40,
    });
    // Taxable = 30,000 - 16,100 = 13,900 → 12,400 * 10% + 1,500 * 12% = 1,420
    expect(r.federalTax).toBe(1_420);
    expect(r.marginalRate).toBe(0.12);
  });

  it('applies bracket math for a $100K single filer', () => {
    const r = computeTax({
      filingStatus: 'single', ordinaryIncome: 100_000,
      socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'TX', age: 40,
    });
    // Taxable = 83,900 → 1,240 + 4,560 + (83,900 - 50,400) * 22% = 13,170
    expect(r.federalTax).toBe(13_170);
    expect(r.stateTax).toBe(0); // TX has no income tax
  });

  it('is monotonic: more income never means less total tax', () => {
    let prev = 0;
    for (const income of [20_000, 50_000, 100_000, 250_000, 600_000]) {
      const r = computeTax({
        filingStatus: 'mfj', ordinaryIncome: income,
        socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'CA', age: 50,
      });
      expect(r.totalTax).toBeGreaterThanOrEqual(prev);
      prev = r.totalTax;
    }
  });
});
