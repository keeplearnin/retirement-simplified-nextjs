/**
 * referenceCases.js — published checks of the engine against answers you
 * can work out by hand from IRS and SSA rules.
 *
 * One list, two uses: tests/referenceCases.test.js asserts every case, and
 * the /accuracy page shows each one with the engine's live result. Add a
 * case here and it is both tested and published.
 */

import { computeTax, computeSSTaxable, detectIrmaaCliff } from './taxEngine';
import { ssClaimingFactor, spousalFactor } from './ssClaiming';
import { RMD_TABLE } from './constants';

const IRS_BRACKETS = { label: 'IRS Rev. Proc. 2025-32 (2026 brackets and standard deduction)', url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf' };
const IRS_PUB_915 = { label: 'IRS Pub. 915 — Social Security benefits worksheet', url: 'https://www.irs.gov/publications/p915' };
const IRS_PUB_590B = { label: 'IRS Pub. 590-B — Uniform Lifetime Table', url: 'https://www.irs.gov/publications/p590b' };
const SSA_EARLY = { label: 'SSA — Benefit reduction for early retirement', url: 'https://www.ssa.gov/benefits/retirement/planner/agereduction.html' };
const SSA_DELAY = { label: 'SSA — Delayed retirement credits', url: 'https://www.ssa.gov/benefits/retirement/planner/delayret.html' };

const tax = (input) => computeTax({ capitalGains: 0, stateCode: 'TX', socialSecurityBenefit: 0, taxYear: 2026, ...input });

// unit: '$' (whole dollars), '%' (percent, one decimal) — `run` returns the
// engine's value in that unit.
export const REFERENCE_CASES = [
  {
    id: 'fed-mfj-150k',
    area: 'Federal income tax',
    question: 'Married couple, both 45, $150,000 in wages, 2026',
    expected: 15340, unit: '$',
    worked: '$150,000 − $32,200 standard deduction = $117,800 taxable. 10% × $24,800 + 12% × $76,000 + 22% × $17,000 = $2,480 + $9,120 + $3,740.',
    source: IRS_BRACKETS,
    run: () => tax({ filingStatus: 'mfj', ordinaryIncome: 150000, age: 45, spouseAge: 45 }).federalTax,
  },
  {
    id: 'fed-single-250k',
    area: 'Federal income tax',
    question: 'Single, 50, $250,000 in wages, 2026',
    expected: 51304, unit: '$',
    worked: '$250,000 − $16,100 = $233,900 taxable. 10% × $12,400 + 12% × $38,000 + 22% × $55,300 + 24% × $96,075 + 32% × $32,125.',
    source: IRS_BRACKETS,
    run: () => tax({ filingStatus: 'single', ordinaryIncome: 250000, age: 50 }).federalTax,
  },
  {
    id: 'ss-taxable-single',
    area: 'Tax on Social Security',
    question: 'Single retiree: $36,000 Social Security plus $30,000 from an IRA — how much Social Security is taxable?',
    expected: 16400, unit: '$',
    worked: 'Provisional income = $30,000 + half of $36,000 = $48,000. Taxable = 85% × ($48,000 − $34,000) + the lesser of $4,500 or half the benefit = $11,900 + $4,500.',
    source: IRS_PUB_915,
    run: () => computeSSTaxable(36000, 30000, 'single').taxableAmount,
  },
  {
    id: 'fed-retiree-68',
    area: 'Federal income tax',
    question: 'Same single retiree, age 68, 2026 — federal tax',
    expected: 2422, unit: '$',
    worked: 'Income $30,000 + $16,400 taxable Social Security = $46,400. Deductions $16,100 + $2,050 (age 65+) + $6,000 senior deduction = $24,150. Taxable $22,250: 10% × $12,400 + 12% × $9,850.',
    source: IRS_BRACKETS,
    run: () => tax({ filingStatus: 'single', ordinaryIncome: 30000, socialSecurityBenefit: 36000, age: 68, retirementIncome: 30000 }).federalTax,
  },
  {
    id: 'ss-claim-62',
    area: 'Social Security claiming',
    question: 'Claiming at 62 with a full retirement age of 67 — share of the full benefit',
    expected: 70, unit: '%',
    worked: '60 months early: 36 × 5/9 of 1% + 24 × 5/12 of 1% = 30% reduction.',
    source: SSA_EARLY,
    run: () => ssClaimingFactor(62, 67) * 100,
  },
  {
    id: 'ss-claim-64',
    area: 'Social Security claiming',
    question: 'Claiming at 64 with a full retirement age of 67',
    expected: 80, unit: '%',
    worked: '36 months early × 5/9 of 1% = 20% reduction.',
    source: SSA_EARLY,
    run: () => ssClaimingFactor(64, 67) * 100,
  },
  {
    id: 'ss-claim-70',
    area: 'Social Security claiming',
    question: 'Claiming at 70 with a full retirement age of 67',
    expected: 124, unit: '%',
    worked: '36 months of delayed credits × 2/3 of 1% = 24% increase.',
    source: SSA_DELAY,
    run: () => ssClaimingFactor(70, 67) * 100,
  },
  {
    id: 'ss-spousal-62',
    area: 'Social Security claiming',
    question: 'Spousal benefit claimed at 62 (full retirement age 67) — share of the full spousal benefit',
    expected: 65, unit: '%',
    worked: '36 × 25/36 of 1% + 24 × 5/12 of 1% = 35% reduction, i.e. 32.5% of the worker’s benefit.',
    source: SSA_EARLY,
    run: () => spousalFactor(62, 67) * 100,
  },
  {
    id: 'rmd-73',
    area: 'Required minimum distributions',
    question: '$500,000 in a 401(k) at age 73 — first required withdrawal',
    expected: 18868, unit: '$',
    worked: '$500,000 ÷ 26.5 (Uniform Lifetime Table, age 73).',
    source: IRS_PUB_590B,
    run: () => Math.round(500000 / RMD_TABLE[73]),
  },
  {
    id: 'rmd-85',
    area: 'Required minimum distributions',
    question: '$500,000 at age 85',
    expected: 31250, unit: '$',
    worked: '$500,000 ÷ 16.0 (Uniform Lifetime Table, age 85).',
    source: IRS_PUB_590B,
    run: () => Math.round(500000 / RMD_TABLE[85]),
  },
  {
    id: 'cap-gains-leftover-deduction',
    area: 'Capital gains',
    question: 'Single, 45: $10,000 of wages and $60,000 of long-term gains, 2026',
    expected: 668, unit: '$',
    worked: 'The $16,100 standard deduction absorbs all wages and $6,100 of gains, leaving $53,900 taxable. Gains fill the 0% bracket to $49,450; the remaining $4,450 is taxed at 15% = $667.50.',
    source: IRS_BRACKETS,
    run: () => Math.round(tax({ filingStatus: 'single', ordinaryIncome: 10000, capitalGains: 60000, age: 45 }).totalTax),
  },
  {
    id: 'niit-single',
    area: 'Net investment income tax',
    question: 'Single, 50: $230,000 of wages plus $50,000 of gains — the 3.8% surtax, 2026',
    expected: 1900, unit: '$',
    worked: 'MAGI $280,000 is $80,000 over the (never-indexed) $200,000 threshold. NIIT = 3.8% x the lesser of $50,000 investment income or the $80,000 excess = 3.8% x $50,000.',
    source: { label: 'IRS Topic 559 - Net investment income tax', url: 'https://www.irs.gov/taxtopics/tc559' },
    run: () => Math.round(tax({ filingStatus: 'single', ordinaryIncome: 230000, capitalGains: 50000, age: 50 }).niit),
  },
  {
    id: 'irmaa-top-tier',
    area: 'Medicare IRMAA',
    question: 'Single with exactly $500,000 MAGI - the 2026 Part B surcharge',
    expected: 5844, unit: '$',
    worked: 'SSA: "$500,000 or more" is the top tier, so exactly $500,000 pays the full $487.00/month surcharge = $5,844 a year.',
    source: { label: 'SSA POMS HI 01101.031 - 2026 IRMAA tables', url: 'https://secure.ssa.gov/POMS.nsf/lnx/0601101031' },
    run: () => Math.round(detectIrmaaCliff(500000, 'single').annualSurcharge),
  },
  {
    id: 'ss-taxable-mfj-small-benefit-cap',
    area: 'Tax on Social Security',
    question: 'Married couple: $40,000 of Social Security plus $50,000 of other income - taxable amount, 2026',
    expected: 28100, unit: '$',
    worked: 'Provisional income = $50,000 + half of $40,000 = $70,000, above the $44,000 upper threshold. Taxable = the lesser of 85% of the benefit ($34,000) or 85% x ($70,000 - $44,000) + the lesser of $6,000 (half the tier width) or $20,000 (half the benefit) = $22,100 + $6,000 = $28,100.',
    source: IRS_PUB_915,
    run: () => Math.round(computeSSTaxable(40000, 50000, 'mfj').taxableAmount),
  },
  {
    id: 'obbba-phaseout-mfj',
    area: 'OBBBA senior deduction',
    question: 'Married couple, both 67, $190,000 of wages, 2026 - federal tax with the senior deduction phase-out',
    expected: 21830, unit: '$',
    worked: 'Deductions: $32,200 standard + $1,650 x 2 (65+) + the $12,000 senior deduction reduced by 6% per spouse of the $40,000 MAGI over $150,000 ($12,000 - $4,800 = $7,200) = $42,700. Taxable $147,300: 10% x $24,800 + 12% x $76,000 + 22% x $46,500.',
    source: { label: 'OBBBA sec. 70103 - senior deduction', url: 'https://www.congress.gov/bill/119th-congress/house-bill/1' },
    run: () => Math.round(tax({ filingStatus: 'mfj', ordinaryIncome: 190000, age: 67, spouseAge: 67 }).federalTax),
  },
];

/** Engine result rounded the way the case is stated. */
export function caseResult(c) {
  const v = c.run();
  return c.unit === '%' ? Math.round(v * 10) / 10 : Math.round(v);
}
