import { describe, it, expect } from 'vitest';
import { fmt, fmtFull } from '@/lib/format';

describe('fmt — non-finite guard (never render $NaN)', () => {
  it('renders $0 for NaN / Infinity / undefined', () => {
    expect(fmt(NaN)).toBe('$0');
    expect(fmt(Infinity)).toBe('$0');
    expect(fmt(-Infinity)).toBe('$0');
    // @ts-expect-error — guarding against callers that pass undefined at runtime
    expect(fmt(undefined)).toBe('$0');
  });
});

describe('fmt — magnitudes', () => {
  it('formats K and M ranges', () => {
    expect(fmt(500)).toBe('$500');
    expect(fmt(1_500)).toBe('$1.5K');
    expect(fmt(150_000)).toBe('$150K');
    expect(fmt(1_500_000)).toBe('$1.50M');
    expect(fmt(15_000_000)).toBe('$15.0M');
  });

  it('formats negatives symmetrically (no leaky $-…)', () => {
    expect(fmt(-500)).toBe('-$500');
    expect(fmt(-1_500)).toBe('-$1.5K');
    expect(fmt(-2_000_000)).toBe('-$2.00M');
  });

  it('rounds sub-thousand values', () => {
    expect(fmt(999.4)).toBe('$999');
    expect(fmt(0)).toBe('$0');
  });
});

describe('fmtFull', () => {
  it('guards non-finite and signs negatives', () => {
    expect(fmtFull(NaN)).toBe('$0');
    expect(fmtFull(1_234_567)).toBe('$1,234,567');
    expect(fmtFull(-42_000)).toBe('-$42,000');
  });
});
