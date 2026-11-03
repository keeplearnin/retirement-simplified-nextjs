import { describe, it, expect } from 'vitest';
import { relevantTools } from '@/lib/relevantTools';

const plan = (o = {}) => ({
  currentAge: 40, retireAge: 67, savings401k: 100_000, spouseSavings401k: 0, monthlyContribution: 1_000,
  incomeSources: [{ type: 'socialSecurity', monthlyBenefit: 2_500, startAge: 67 }],
  ...o,
});
const tabs = (p) => relevantTools(p).map(t => t.tab);

describe('relevantTools', () => {
  it('a young saver only sees the Roth-or-traditional question', () => {
    expect(tabs(plan())).toEqual(['roth-strategy:contributions']);
  });

  it('near retirement: claiming, conversions and withdrawal order', () => {
    expect(tabs(plan({ currentAge: 58, retireAge: 65, savings401k: 900_000 })))
      .toEqual(['income:claim', 'roth-strategy:conversions', 'income:withdrawal']);
  });

  it('retiring before 65 surfaces health cover', () => {
    expect(tabs(plan({ currentAge: 52, retireAge: 60 }))).toContain('income:bridge');
  });

  it('already claiming Social Security: no claiming card', () => {
    expect(tabs(plan({ currentAge: 70, retireAge: 65, incomeSources: [{ type: 'socialSecurity', startAge: 67 }] })))
      .not.toContain('income:claim');
  });
});
