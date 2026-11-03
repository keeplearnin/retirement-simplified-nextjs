import { describe, it, expect } from 'vitest';
import { computeTax, computeSSTaxable, detectProvisionalIncomeCliff } from '@/lib/taxEngine';

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

// Standard deductions used below (age 40 — no 65+ or OBBBA adjustments):
// single $16,100, mfj $32,200. No SS/capital gains, so state taxable
// income = ordinaryIncome - standard deduction, with zero exemption.
describe('computeTax — graduated state brackets (HI, MN, MA, WI)', () => {
  it('Hawaii single: mid-bracket ($60K income, 7.20% bracket)', () => {
    const r = computeTax({
      filingStatus: 'single', ordinaryIncome: 60_000,
      socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'HI', age: 40,
    });
    // Taxable = 43,900. Marginal sum across brackets up to the $36K-$48K
    // (7.20%) tier: 9,600@1.4% + 4,800@3.2% + 4,800@5.5% + 4,800@6.4% +
    // 12,000@6.8% + 7,900@7.2% = 134.4+153.6+264+307.2+816+568.8 = 2,244.00.
    // (Hawaii's official printed schedule shows a rounded cumulative base of
    // $1,675 for this tier — the precise marginal sum is $1,675.20, a few
    // cents different. applyBrackets computes the precise value.)
    expect(r.stateTax).toBeCloseTo(2_244.00, 2);
  });

  it('Hawaii MFJ: upper bracket ($150K income, 7.60% bracket)', () => {
    const r = computeTax({
      filingStatus: 'mfj', ordinaryIncome: 150_000,
      socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'HI', age: 40,
    });
    // Taxable = 117,800. Marginal sum up to the $96K-$250K (7.60%) tier:
    // 19,200@1.4% + 9,600@3.2% + 9,600@5.5% + 9,600@6.4% + 24,000@6.8% +
    // 24,000@7.2% + 21,800@7.6% = 6,735.20 (same rounded-base caveat as above).
    expect(r.stateTax).toBeCloseTo(6_735.20, 2);
  });

  it('Minnesota single: top bracket ($150K income, 7.85% bracket)', () => {
    const r = computeTax({
      filingStatus: 'single', ordinaryIncome: 150_000,
      socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'MN', age: 40,
    });
    // Taxable = 133,900. Marginal sum across 3 brackets:
    // 33,310*5.35% + (109,430-33,310)*6.80% + (133,900-109,430)*7.85%
    // = 1,782.085 + 5,176.16 + 1,920.895 = 8,879.14
    expect(r.stateTax).toBeCloseTo(8_879.14, 2);
  });

  it('Minnesota MFJ: top rate bracket ($300K income, 7.85% bracket)', () => {
    const r = computeTax({
      filingStatus: 'mfj', ordinaryIncome: 300_000,
      socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'MN', age: 40,
    });
    // Taxable = 267,800. Marginal sum:
    // 48,700*5.35% + (193,480-48,700)*6.80% + (267,800-193,480)*7.85%
    // = 2,605.45 + 9,845.04 + 5,834.12 = 18,284.61
    expect(r.stateTax).toBeCloseTo(18_284.61, 2);
  });

  it('Massachusetts: flat 5% below the surtax threshold', () => {
    const r = computeTax({
      filingStatus: 'single', ordinaryIncome: 50_000,
      socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'MA', age: 40,
    });
    // Taxable = 33,900, well under the $1,107,750 surtax threshold → flat 5%
    expect(r.stateTax).toBeCloseTo(33_900 * 0.05, 2);
  });

  it('Massachusetts: 4% surtax applies above the millionaire threshold', () => {
    const r = computeTax({
      filingStatus: 'single', ordinaryIncome: 1_200_000,
      socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'MA', age: 40,
    });
    // Taxable = 1,183,900 → 1,107,750*5% + (1,183,900-1,107,750)*9%
    // = 55,387.50 + 6,853.50 = 62,241.00
    expect(r.stateTax).toBeCloseTo(62_241.00, 2);
  });

  it('Massachusetts: surtax threshold is identical for single and MFJ', () => {
    const single = computeTax({
      filingStatus: 'single', ordinaryIncome: 1_150_000,
      socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'MA', age: 40,
    });
    const mfj = computeTax({
      filingStatus: 'mfj', ordinaryIncome: 1_150_000 + (32_200 - 16_100), // equalize taxable income
      socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'MA', age: 40,
    });
    expect(mfj.stateTax).toBeCloseTo(single.stateTax, 2);
  });

  it('Wisconsin single: mid-bracket ($80K income, 5.30% bracket)', () => {
    const r = computeTax({
      filingStatus: 'single', ordinaryIncome: 80_000,
      socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'WI', age: 40,
    });
    // Taxable = 63,900 (2026 brackets 15,110 / 51,950 / 332,720)
    // = 3.5% × 15,110 + 4.4% × 36,840 + 5.3% × 11,950
    // = 528.85 + 1,620.96 + 633.35 = 2,783.16
    expect(r.stateTax).toBeCloseTo(2_783.16, 2);
  });

  it('Wisconsin MFJ: top bracket ($500K income, 7.65% bracket)', () => {
    const r = computeTax({
      filingStatus: 'mfj', ordinaryIncome: 500_000,
      socialSecurityBenefit: 0, capitalGains: 0, stateCode: 'WI', age: 40,
    });
    // Taxable = 467,800 (2026 MFJ brackets 20,150 / 69,260 / 443,630)
    // = $22,707.70 through 443,630 + 7.65% × 24,170 (1,849.01) = 24,556.71
    expect(r.stateTax).toBeCloseTo(24_556.71, 1);
  });

  it('all four states are monotonic: more income never means less state tax', () => {
    for (const stateCode of ['HI', 'MN', 'MA', 'WI']) {
      let prev = 0;
      for (const income of [20_000, 60_000, 150_000, 400_000, 1_200_000]) {
        const r = computeTax({
          filingStatus: 'single', ordinaryIncome: income,
          socialSecurityBenefit: 0, capitalGains: 0, stateCode, age: 40,
        });
        expect(r.stateTax).toBeGreaterThanOrEqual(prev);
        prev = r.stateTax;
      }
    }
  });
});

describe('computeTax — provisionalIncome field', () => {
  it('matches the documented formula: ordinaryIncome + capitalGains + 50% of gross SS benefit', () => {
    const r = computeTax({
      filingStatus: 'single', ordinaryIncome: 10_000, capitalGains: 2_000,
      socialSecurityBenefit: 20_000, stateCode: 'TX', age: 65,
    });
    expect(r.provisionalIncome).toBeCloseTo(10_000 + 2_000 + 20_000 * 0.5, 2);
  });
});

describe('detectProvisionalIncomeCliff', () => {
  it('tier 0, not at risk when far from the lower threshold (single, $25K)', () => {
    const c = detectProvisionalIncomeCliff(10_000, 'single');
    expect(c.currentTier).toBe(0);
    expect(c.nextThreshold).toBe(25_000);
    expect(c.distanceToNextCliff).toBe(15_000);
    expect(c.atRisk).toBe(false);
  });

  it('tier 0, at risk within the default $5K window (single)', () => {
    const c = detectProvisionalIncomeCliff(22_000, 'single');
    expect(c.currentTier).toBe(0);
    expect(c.distanceToNextCliff).toBe(3_000);
    expect(c.atRisk).toBe(true);
  });

  it('tier 1 (50% band), approaching the 85% threshold (single)', () => {
    const c = detectProvisionalIncomeCliff(31_000, 'single');
    expect(c.currentTier).toBe(1);
    expect(c.nextThreshold).toBe(34_000);
    expect(c.distanceToNextCliff).toBe(3_000);
    expect(c.atRisk).toBe(true);
  });

  it('tier 2 (85% band): no further cliff, never at risk', () => {
    const c = detectProvisionalIncomeCliff(50_000, 'single');
    expect(c.currentTier).toBe(2);
    expect(c.nextThreshold).toBe(Infinity);
    expect(c.distanceToNextCliff).toBe(0);
    expect(c.atRisk).toBe(false);
  });

  it('uses the wider MFJ thresholds ($32K / $44K)', () => {
    const belowMfj = detectProvisionalIncomeCliff(29_000, 'mfj');
    expect(belowMfj.currentTier).toBe(0);
    expect(belowMfj.nextThreshold).toBe(32_000);

    // The same income would already be in tier 1 for a single filer.
    const asSingle = detectProvisionalIncomeCliff(29_000, 'single');
    expect(asSingle.currentTier).toBe(1);
  });

  it('respects a custom warnWindow', () => {
    const tight = detectProvisionalIncomeCliff(20_000, 'single', 1_000);
    expect(tight.atRisk).toBe(false); // 5,000 away, outside a 1,000 window
    const wide = detectProvisionalIncomeCliff(20_000, 'single', 10_000);
    expect(wide.atRisk).toBe(true); // 5,000 away, inside a 10,000 window
  });
});
