import { describe, it, expect } from 'vitest';
import { HISTORICAL_RETURNS, HISTORICAL_START_YEAR } from '@/lib/historicalReturns';

// The "every real market sequence since 1928" claim rests on this dataset.
// Anchor it to externally published figures (Damodaran/NYU Stern; BLS CPI)
// so silent edits or truncation fail loudly. (Credibility audit 2026-11-11:
// all five anchors verified against the live Damodaran dataset.)
describe('historical returns dataset integrity', () => {
  const year = (y) => HISTORICAL_RETURNS[y - HISTORICAL_START_YEAR];

  it('spans 1928 through 2025 with no gaps', () => {
    expect(HISTORICAL_START_YEAR).toBe(1928);
    expect(HISTORICAL_RETURNS.length).toBe(98); // 1928..2025 inclusive
    for (const row of HISTORICAL_RETURNS) {
      expect(row.length).toBe(3); // [stock, bond, cpi]
      expect(row[0]).toBeGreaterThan(-0.9);
      expect(row[0]).toBeLessThan(1);
      expect(row[1]).toBeGreaterThan(-0.9);
      expect(row[1]).toBeLessThan(1);
    }
  });

  it('matches Damodaran/BLS anchors: 1931, 1954, 1974, 2008, 2022', () => {
    expect(year(1931)[0]).toBeCloseTo(-0.4384, 3);
    expect(year(1954)[0]).toBeCloseTo(0.5256, 3);
    expect(year(1974)[0]).toBeCloseTo(-0.2590, 3);
    expect(year(2008)[0]).toBeCloseTo(-0.3655, 3);
    expect(year(2008)[1]).toBeCloseTo(0.2010, 3);
    expect(year(2022)[0]).toBeCloseTo(-0.1804, 3);
    expect(year(2022)[1]).toBeCloseTo(-0.1783, 3);
    expect(year(1974)[2]).toBeCloseTo(0.110, 2); // stagflation CPI
    expect(year(2022)[2]).toBeCloseTo(0.080, 2);
  });
});
