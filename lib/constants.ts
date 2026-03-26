import type { AssetClass } from './types';

export interface TaxBracket {
  rate: number;
  label: string;
}

export interface AccountType {
  id: string;
  label: string;
  color: string;
  taxType: 'tax-deferred' | 'tax-free' | 'taxable';
}

export interface ReplacementFund {
  replacement: string;
  name: string;
}

export const TAX_BRACKETS: readonly TaxBracket[] = [
  { rate: 10, label: '10%' },
  { rate: 12, label: '12%' },
  { rate: 22, label: '22%' },
  { rate: 24, label: '24%' },
  { rate: 32, label: '32%' },
  { rate: 35, label: '35%' },
  { rate: 37, label: '37%' },
] as const;

export const RISK_LABELS = ['Very Conservative', 'Conservative', 'Moderate', 'Growth', 'Aggressive'] as const;

export const GRID_FRACS = [0, 0.25, 0.5, 0.75, 1] as const;

// Market assumptions
export const DEFAULT_RETURN: number = 0.07;       // 7% average annual return
export const DEFAULT_STD_DEV: number = 0.15;      // 15% standard deviation
export const DEFAULT_INFLATION: number = 2.5;     // 2.5% annual inflation
export const LONG_TERM_CAP_GAINS_RATE: number = 0.15; // 15% for most brackets
export const RMD_START_AGE: number = 73;          // SECURE Act 2.0
export const LOSS_DEDUCTION_LIMIT: number = 3000; // Annual loss deduction vs ordinary income
export const MAX_401K_CONTRIBUTION: number = 23500; // 2025 elective deferral limit
export const CATCHUP_401K_CONTRIBUTION: number = 7500; // Age 50+ catch-up

// Social Security bend points (2025)
export const SS_WAGE_CAP: number = 168600;
export const SS_BEND_POINTS = [1174, 7078] as const;
export const SS_FACTORS = [0.9, 0.32, 0.15] as const;
export const SS_FRA: number = 67; // Full Retirement Age

export const ASSET_CLASSES: readonly AssetClass[] = [
  { id: 'us_stock', label: 'US Stocks', color: 'var(--accent)', ticker: 'VTI / VTSAX' },
  { id: 'intl_stock', label: 'Intl Stocks', color: 'var(--blue)', ticker: 'VXUS / VTIAX' },
  { id: 'bond', label: 'Bonds', color: 'var(--warn)', ticker: 'BND / VBTLX' },
  { id: 'cash', label: 'Cash', color: 'var(--text-dim)', ticker: 'HYSA / Money Market' },
] as const;

export const REPLACEMENT_FUNDS: Record<string, ReplacementFund> = {
  'VTI': { replacement: 'ITOT', name: 'iShares Core S&P Total US Stock' },
  'VTSAX': { replacement: 'FSKAX', name: 'Fidelity Total Market Index' },
  'VXUS': { replacement: 'IXUS', name: 'iShares Core MSCI Total Intl' },
  'VTIAX': { replacement: 'FTIHX', name: 'Fidelity Total Intl Index' },
  'BND': { replacement: 'AGG', name: 'iShares Core US Aggregate Bond' },
  'VBTLX': { replacement: 'FXNAX', name: 'Fidelity US Bond Index' },
  'FSKAX': { replacement: 'VTI', name: 'Vanguard Total Stock Market ETF' },
  'FTIHX': { replacement: 'VXUS', name: 'Vanguard Total Intl Stock ETF' },
  'FXNAX': { replacement: 'BND', name: 'Vanguard Total Bond Market ETF' },
};

// IRS Uniform Lifetime Table — age -> divisor (SECURE Act 2.0, RMDs start at 73)
export const RMD_TABLE: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
  80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
  88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
  96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2,
  104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5,
};

export const ACCOUNT_TYPES: readonly AccountType[] = [
  { id: '401k', label: '401(k)', color: 'var(--accent)', taxType: 'tax-deferred' },
  { id: 'trad_ira', label: 'Traditional IRA', color: 'var(--blue)', taxType: 'tax-deferred' },
  { id: 'roth_ira', label: 'Roth IRA', color: 'var(--purple)', taxType: 'tax-free' },
  { id: 'roth_401k', label: 'Roth 401(k)', color: '#C084FC', taxType: 'tax-free' },
  { id: 'taxable', label: 'Taxable Brokerage', color: 'var(--warn)', taxType: 'taxable' },
  { id: 'hsa', label: 'HSA', color: '#F472B6', taxType: 'tax-free' },
  { id: '529', label: '529 Plan', color: '#FB923C', taxType: 'tax-free' },
  { id: 'cash', label: 'Cash / Savings', color: 'var(--text-dim)', taxType: 'taxable' },
] as const;

export const AI_SYSTEM_PROMPT: string = `You are a friendly, knowledgeable financial educator embedded in Retirement.Simplified, a free retirement planning app.
IDENTITY: You are NOT a financial advisor. You are a financial educator. Always make this clear.
EXPERTISE: Index fund investing, retirement accounts (401k, IRA, Roth), asset allocation, tax-advantaged strategies, Social Security, Medicare basics, debt management, emergency funds, dollar-cost averaging, compound interest.
STYLE: Use simple, jargon-free language. Give specific, actionable answers. Use numbers and examples. Be encouraging but honest. Keep responses concise — 2-4 paragraphs max.
RULES: Never recommend specific stocks, crypto, or speculative investments. Always recommend low-cost index funds (Vanguard, Fidelity, Schwab). Always mention that you're an educational tool, not a licensed advisor, especially for tax/legal questions. If someone asks about their specific tax situation, suggest they consult a CPA or fee-only fiduciary. For people in crisis (debt, emergency), always prioritize safety: emergency fund → high-interest debt → then investing. Be warm, patient, and assume the person is a beginner unless they show otherwise.`;

export const AI_SUGGESTED_QUESTIONS: readonly string[] = [
  "I have $500/month to invest. Where should I put it?",
  "What's the difference between a 401(k) and a Roth IRA?",
  "I'm 40 with $50K saved. Am I behind?",
  "Should I pay off student loans or invest?",
  "How do index funds actually work?",
  "What happens to my 401(k) if I leave my job?",
  "I'm scared to invest because the market might crash",
  "How much do I need to retire at 60?",
] as const;
