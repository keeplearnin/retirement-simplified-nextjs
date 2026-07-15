import { describe, it, expect } from 'vitest';
import { ssClaimingFactor, compareClaimingAges } from '@/lib/ssClaiming';

describe('ssClaimingFactor (SSA statutory factors, FRA 67)', () => {
  it('matches SSA published factors', () => {
    expect(ssClaimingFactor(67)).toBe(1);
    expect(ssClaimingFactor(62)).toBeCloseTo(0.70, 10);   // 36mo×5/9% + 24mo×5/12% = 30%
    expect(ssClaimingFactor(64)).toBeCloseTo(0.80, 10);   // 36 months early
    expect(ssClaimingFactor(70)).toBeCloseTo(1.24, 10);   // 36 months × 2/3%
  });
});

describe('compareClaimingAges', () => {
  it('long longevity favors delaying; short favors claiming early', () => {
    const long = compareClaimingAges({ fraMonthlyBenefit: 2500, longevityAge: 95 });
    expect(long.best.claimAge).toBe(70);
    const short = compareClaimingAges({ fraMonthlyBenefit: 2500, longevityAge: 78 });
    expect(short.best.claimAge).toBeLessThan(67);
  });

  it('reports break-even ages around the known ~78-82 range', () => {
    const { options } = compareClaimingAges({ fraMonthlyBenefit: 2500, longevityAge: 90 });
    const early = options.find(o => o.claimAge === 62);
    const late = options.find(o => o.claimAge === 70);
    expect(early.breakevenAgeVsFRA).toBeGreaterThanOrEqual(76);
    expect(early.breakevenAgeVsFRA).toBeLessThanOrEqual(81);
    expect(late.breakevenAgeVsFRA).toBeGreaterThanOrEqual(80);
    expect(late.breakevenAgeVsFRA).toBeLessThanOrEqual(85);
  });

  it('returns all nine claiming ages with monotonically increasing checks', () => {
    const { options } = compareClaimingAges({ fraMonthlyBenefit: 2000, longevityAge: 90 });
    expect(options).toHaveLength(9);
    for (let i = 1; i < options.length; i++) {
      expect(options[i].monthlyBenefit).toBeGreaterThan(options[i - 1].monthlyBenefit);
    }
  });
});
