import { describe, it, expect } from 'vitest';
import {
  projectPrice,
  projectVesting,
  analyzeRSU,
  computeAMT,
  analyzeISO,
  analyzeESPP,
  concentrationRisk,
  summarizeEquity,
  AMT_EXEMPTION,
  type EquityGrant,
  type MarketAssumptions,
} from '@/lib/equityComp';

const market: MarketAssumptions = {
  currentPrice: 100,
  annualGrowth: 0,        // flat price → deterministic vest values
  marginalRate: 0.35,
  withholdingRate: 0.22,
  filingStatus: 'single',
  otherOrdinaryIncome: 200_000,
  ltcgRate: 0.15,
};

// A grant fully in the past so every tranche is already vested, independent of
// the wall-clock date the test runs on.
const now = new Date('2026-07-16');

describe('projectPrice', () => {
  it('compounds annual growth over months', () => {
    expect(projectPrice(100, 0.1, 12)).toBeCloseTo(110, 6);
    expect(projectPrice(100, 0.1, 24)).toBeCloseTo(121, 6);
    expect(projectPrice(100, 0, 60)).toBe(100);
  });
});

describe('projectVesting', () => {
  it('preserves total shares across all tranches', () => {
    const grant: EquityGrant = {
      id: '1', type: 'rsu', label: 'RSU', grantDate: '2025-01-01',
      shares: 4000, grantPrice: 50, vestYears: 4, cliffMonths: 12, vestFrequency: 'monthly',
    };
    const events = projectVesting(grant, market, now);
    const totalShares = events.reduce((s, e) => s + e.shares, 0);
    expect(totalShares).toBeCloseTo(4000, 6);
  });

  it('releases the cliff as a single lump of the pro-rata shares', () => {
    const grant: EquityGrant = {
      id: '1', type: 'rsu', label: 'RSU', grantDate: '2025-01-01',
      shares: 4800, grantPrice: 50, vestYears: 4, cliffMonths: 12, vestFrequency: 'monthly',
    };
    const events = projectVesting(grant, market, now);
    // 4800 shares / 48 months = 100/mo; a 12-month cliff releases 1200.
    expect(events[0].shares).toBeCloseTo(1200, 6);
  });

  it('treats ESPP as an immediate single purchase', () => {
    const grant: EquityGrant = {
      id: '1', type: 'espp', label: 'ESPP', grantDate: '2026-06-30',
      shares: 100, grantPrice: 100, discountPct: 15,
    };
    const events = projectVesting(grant, market, now);
    expect(events).toHaveLength(1);
    expect(events[0].shares).toBe(100);
  });
});

describe('analyzeRSU', () => {
  it('flags the withholding gap when marginal > supplemental rate', () => {
    const grant: EquityGrant = {
      id: '1', type: 'rsu', label: 'RSU', grantDate: '2024-01-01',
      shares: 1200, grantPrice: 100, vestYears: 1, cliffMonths: 0, vestFrequency: 'annual',
    };
    const summary = analyzeRSU(grant, market, now);
    const totalIncome = summary.reduce((s, y) => s + y.ordinaryIncome, 0);
    // 1200 shares × $100 flat = $120,000 of ordinary income.
    expect(totalIncome).toBeCloseTo(120_000, 6);
    // Gap = (0.35 − 0.22) × 120,000 = $15,600 owed beyond withholding.
    const totalGap = summary.reduce((s, y) => s + y.withholdingGap, 0);
    expect(totalGap).toBeCloseTo(15_600, 6);
  });
});

describe('computeAMT', () => {
  it('returns no AMT when there is no preference item', () => {
    const r = computeAMT(150_000, 30_000, 0, 'single');
    expect(r.amtDue).toBe(0);
  });

  it('applies the full exemption below the phaseout threshold', () => {
    const r = computeAMT(100_000, 15_000, 50_000, 'single');
    expect(r.exemption).toBe(AMT_EXEMPTION.single);
    // AMTI = 150,000; base = 150,000 − 90,100 = 59,900; TMT = 26% × 59,900.
    expect(r.tentativeMinTax).toBeCloseTo(59_900 * 0.26, 4);
  });

  it('phases out the exemption at high AMTI', () => {
    const r = computeAMT(700_000, 200_000, 0, 'single');
    // AMTI 700k is above the 639,300 phaseout start → reduced exemption.
    expect(r.exemption).toBeLessThan(AMT_EXEMPTION.single);
  });
});

describe('analyzeISO', () => {
  const isoGrant: EquityGrant = {
    id: '1', type: 'iso', label: 'ISO', grantDate: '2024-01-01',
    shares: 10_000, grantPrice: 10, strikePrice: 10, vestYears: 4, cliffMonths: 12, vestFrequency: 'monthly',
  };

  it('computes the bargain element on vested shares', () => {
    const r = analyzeISO(isoGrant, market, 40_000, now);
    expect(r.bargainElementPerShare).toBe(90); // 100 − 10
    expect(r.vestedShares).toBeGreaterThan(0);
    expect(r.totalBargainElement).toBeCloseTo(r.bargainElementPerShare * r.vestedShares, 6);
  });

  it('finds an AMT-free share count no greater than vested shares', () => {
    const r = analyzeISO(isoGrant, market, 40_000, now);
    expect(r.amtFreeShares).toBeGreaterThanOrEqual(0);
    expect(r.amtFreeShares).toBeLessThanOrEqual(r.vestedShares);
  });

  it('is out of the money when price is below strike', () => {
    const underwater: MarketAssumptions = { ...market, currentPrice: 5 };
    const r = analyzeISO(isoGrant, underwater, 40_000, now);
    expect(r.inTheMoney).toBe(false);
    expect(r.bargainElementPerShare).toBe(0);
  });
});

describe('analyzeESPP', () => {
  it('values the 15% discount with a lookback', () => {
    const grant: EquityGrant = {
      id: '1', type: 'espp', label: 'ESPP', grantDate: '2026-06-30',
      shares: 100, grantPrice: 80, discountPct: 15, lookback: true, offeringPrice: 80,
    };
    // market 100, lookback basis min(80,100)=80, purchase = 80 × 0.85 = 68.
    const r = analyzeESPP(grant, { ...market, currentPrice: 100 });
    expect(r.purchasePrice).toBeCloseTo(68, 6);
    expect(r.discountValue).toBeCloseTo((100 - 68) * 100, 6); // $3,200
    expect(r.annualizedReturn).toBeGreaterThan(0.15);
  });

  it('qualifying ordinary income is capped at the offering-price discount', () => {
    const grant: EquityGrant = {
      id: '1', type: 'espp', label: 'ESPP', grantDate: '2026-06-30',
      shares: 100, grantPrice: 80, discountPct: 15, lookback: true, offeringPrice: 80,
    };
    const r = analyzeESPP(grant, { ...market, currentPrice: 100 });
    // Offering-price discount = 80 × 0.15 × 100 = $1,200, less than the $3,200
    // disqualifying spread → qualifying ordinary is the smaller figure.
    expect(r.qualifyingOrdinary).toBeCloseTo(1_200, 6);
    expect(r.qualifyingOrdinary).toBeLessThan(r.disqualifyingOrdinary);
  });
});

describe('concentrationRisk', () => {
  it('scales the risk level with the concentration percentage', () => {
    expect(concentrationRisk(50_000, 1_000_000).level).toBe('low');
    expect(concentrationRisk(200_000, 1_000_000).level).toBe('moderate');
    expect(concentrationRisk(400_000, 1_000_000).level).toBe('high');
    expect(concentrationRisk(800_000, 1_000_000).level).toBe('severe');
  });

  it('treats equity beyond net worth as 100% concentration', () => {
    const r = concentrationRisk(500_000, 100_000);
    expect(r.pct).toBe(1);
  });
});

describe('summarizeEquity', () => {
  it('splits vested vs unvested and totals lifetime vest income', () => {
    const grants: EquityGrant[] = [
      { id: '1', type: 'rsu', label: 'Old', grantDate: '2023-01-01', shares: 1000, grantPrice: 100, vestYears: 4, cliffMonths: 12, vestFrequency: 'annual' },
      { id: '2', type: 'rsu', label: 'New', grantDate: '2026-07-01', shares: 2000, grantPrice: 100, vestYears: 4, cliffMonths: 12, vestFrequency: 'annual' },
    ];
    const s = summarizeEquity(grants, market, now);
    expect(s.totalValue).toBeCloseTo(s.vestedValue + s.unvestedValue, 6);
    expect(s.vestEvents.length).toBeGreaterThan(0);
    // Events are chronologically sorted.
    for (let i = 1; i < s.vestEvents.length; i++) {
      expect(s.vestEvents[i].date >= s.vestEvents[i - 1].date).toBe(true);
    }
  });
});
