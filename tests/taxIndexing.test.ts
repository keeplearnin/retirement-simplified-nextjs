import { describe, it, expect } from 'vitest';
import { computeTax } from '@/lib/taxEngine';
import { modelRothLadder } from '@/lib/rothConversion';

// Future tax years: brackets and deductions grow with inflation (the IRS
// indexes them every year); the thresholds the law never indexes stay put.
const base = { capitalGains: 0, stateCode: 'TX', socialSecurityBenefit: 0, age: 50 } as const;

describe('computeTax indexFactor', () => {
  it('taxes a grown income the same in real terms', () => {
    // 2026, single, $60K: taxable 60,000 − 16,100 = 43,900
    //   10% × 12,400 = 1,240; 12% × 31,500 = 3,780 → $5,020
    const today = computeTax({ ...base, filingStatus: 'single', ordinaryIncome: 60_000 });
    expect(today.federalTax).toBe(5_020);
    // Prices up 50%: the same real income is $90K and every edge is 1.5×,
    // so the tax is exactly 1.5 × $5,020.
    const later = computeTax({ ...base, filingStatus: 'single', ordinaryIncome: 90_000, indexFactor: 1.5 });
    expect(later.federalTax).toBe(7_530);
    expect(later.marginalRate).toBe(0.12);
    // Without indexing the same $90K would reach the 22% bracket.
    const unindexed = computeTax({ ...base, filingStatus: 'single', ordinaryIncome: 90_000 });
    expect(unindexed.marginalRate).toBe(0.22);
    expect(unindexed.federalTax).toBeGreaterThan(later.federalTax);
  });

  it('grows the standard and 65+ deductions', () => {
    // (16,100 + 2,050) × 2 = 36,300
    const r = computeTax({ ...base, filingStatus: 'single', ordinaryIncome: 50_000, age: 70, indexFactor: 2 });
    expect(r.standardDeduction).toBe(36_300);
    // MFJ both 65+: (32,200 + 1,650 × 2) × 2 = 71,000
    const m = computeTax({ ...base, filingStatus: 'mfj', ordinaryIncome: 100_000, age: 70, spouseAge: 68, taxYear: 2040, indexFactor: 2 });
    expect(m.standardDeduction).toBe(71_000);
  });

  it('scales the 0% capital-gains bracket', () => {
    // MFJ, no other income, $150K gains at 2× prices: deduction 64,400,
    // taxable gains 85,600, all under the 0% edge of 98,900 × 2 → $0.
    const r = computeTax({ ...base, filingStatus: 'mfj', ordinaryIncome: 0, capitalGains: 150_000, taxYear: 2040, indexFactor: 2 });
    expect(r.capitalGainsTax).toBe(0);
  });

  it('keeps Social Security taxation and NIIT thresholds fixed', () => {
    // Provisional income 20,000 + 10,000 = 30,000 is over the statutory
    // $25K single threshold however much prices have grown.
    const ss = computeTax({ ...base, filingStatus: 'single', ordinaryIncome: 20_000, socialSecurityBenefit: 20_000, indexFactor: 2 });
    expect(ss.ssTaxablePercent).toBe(50);
    // NIIT: 3.8% of the MAGI over a fixed $200K → 0.038 × 100,000
    const niit = computeTax({ ...base, filingStatus: 'single', ordinaryIncome: 0, capitalGains: 300_000, indexFactor: 2 });
    expect(niit.niit).toBe(3_800);
  });

  it('compares IRMAA tiers in 2026 dollars', () => {
    // $150K MAGI at 1.5× prices is $100K today: under the $109K first tier.
    const r = computeTax({ ...base, filingStatus: 'single', ordinaryIncome: 150_000, indexFactor: 1.5 });
    expect(r.irmaa).toBe(0);
  });

  it('defaults to 2026 figures', () => {
    const a = computeTax({ ...base, filingStatus: 'mfj', ordinaryIncome: 180_000 });
    const b = computeTax({ ...base, filingStatus: 'mfj', ordinaryIncome: 180_000, indexFactor: 1 });
    expect(a).toEqual(b);
  });
});

describe('Roth ladder with indexing', () => {
  it('fills a bracket that grows each year', () => {
    // MFJ at 60, no SS or pension yet: filling the 22% bracket means taxable
    // income of 211,400, plus the 32,200 deduction, at that year's prices.
    const out = modelRothLadder({
      currentAge: 60, retireAge: 60, longevityAge: 75,
      tradBalance: 5_000_000, rothBalance: 0,
      expectedReturn: 0.05, retiredReturnPct: 60,
      filingStatus: 'mfj', stateCode: 'TX',
      ssMonthlyBenefit: 0, ssStartAge: 70,
      targetBracket: 22, conversionStartAge: 60, conversionEndAge: 64,
      inflationRate: 0.03,
    });
    const at = (age: number) => out.ladder.years.find(y => y.age === age)!;
    expect(at(60).conversion).toBeCloseTo(243_600, 0);
    expect(at(64).conversion).toBeCloseTo(243_600 * 1.03 ** 4, 0);
    // Each filled year stays inside the 22% bracket.
    expect(at(64).fedTax / at(64).conversion).toBeLessThan(0.22);
  });
});
