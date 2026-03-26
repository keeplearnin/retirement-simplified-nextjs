// ---------------------------------------------------------------------------
// Demo institution data — realistic account structures
// ---------------------------------------------------------------------------
export const DEMO_INSTITUTIONS = {
  vanguard: {
    id: 'inst_vanguard',
    name: 'Vanguard',
    color: '#c41200',
    accounts: [
      { id: 'vg_roth', name: 'Roth IRA', type: 'investment', subtype: 'roth_ira', category: 'retirement', balance: 45200, allocation: { stocks: 90, bonds: 8, cash: 2 } },
      { id: 'vg_401k', name: '401(k)', type: 'investment', subtype: '401k', category: 'retirement', balance: 128500, allocation: { stocks: 70, bonds: 25, cash: 5 } },
      { id: 'vg_brok', name: 'Individual Brokerage', type: 'investment', subtype: 'brokerage', category: 'taxable', balance: 32100, allocation: { stocks: 80, bonds: 10, cash: 10 } },
    ],
  },
  fidelity: {
    id: 'inst_fidelity',
    name: 'Fidelity',
    color: '#4a8c2a',
    accounts: [
      { id: 'fid_401k', name: '401(k) Growth Fund', type: 'investment', subtype: '401k', category: 'retirement', balance: 87300, allocation: { stocks: 85, bonds: 12, cash: 3 } },
    ],
  },
  schwab: {
    id: 'inst_schwab',
    name: 'Schwab',
    color: '#00a3e0',
    accounts: [
      { id: 'sch_brok', name: 'Brokerage Account', type: 'investment', subtype: 'brokerage', category: 'taxable', balance: 18700, allocation: { stocks: 75, bonds: 15, cash: 10 } },
      { id: 'sch_ira', name: 'Traditional IRA', type: 'investment', subtype: 'ira', category: 'retirement', balance: 56400, allocation: { stocks: 65, bonds: 30, cash: 5 } },
    ],
  },
  chase: {
    id: 'inst_chase',
    name: 'Chase',
    color: '#117aca',
    accounts: [
      { id: 'ch_chk', name: 'Total Checking', type: 'depository', subtype: 'checking', category: 'cash', balance: 8450, allocation: { stocks: 0, bonds: 0, cash: 100 } },
      { id: 'ch_sav', name: 'Savings Account', type: 'depository', subtype: 'savings', category: 'cash', balance: 25000, allocation: { stocks: 0, bonds: 0, cash: 100 } },
      { id: 'ch_cc', name: 'Sapphire Preferred', type: 'credit', subtype: 'credit_card', category: 'debt', balance: -2100, allocation: { stocks: 0, bonds: 0, cash: 0 } },
    ],
  },
  bofa: {
    id: 'inst_bofa',
    name: 'Bank of America',
    color: '#e31837',
    accounts: [
      { id: 'bofa_chk', name: 'Advantage Checking', type: 'depository', subtype: 'checking', category: 'cash', balance: 4200, allocation: { stocks: 0, bonds: 0, cash: 100 } },
      { id: 'bofa_sav', name: 'Savings Account', type: 'depository', subtype: 'savings', category: 'cash', balance: 12000, allocation: { stocks: 0, bonds: 0, cash: 100 } },
    ],
  },
};

export const INSTITUTION_LIST = [
  { key: 'vanguard', name: 'Vanguard', color: '#c41200' },
  { key: 'fidelity', name: 'Fidelity', color: '#4a8c2a' },
  { key: 'schwab', name: 'Schwab', color: '#00a3e0' },
  { key: 'chase', name: 'Chase', color: '#117aca' },
  { key: 'bofa', name: 'Bank of America', color: '#e31837' },
];

export const TYPE_BADGE_COLORS = {
  '401k': 'var(--accent)',
  roth_ira: 'var(--purple)',
  ira: 'var(--purple)',
  brokerage: 'var(--blue)',
  checking: 'var(--text-muted)',
  savings: 'var(--text-muted)',
  credit_card: 'var(--danger)',
};

export const TYPE_LABELS = {
  '401k': '401(k)',
  roth_ira: 'Roth IRA',
  ira: 'Traditional IRA',
  brokerage: 'Brokerage',
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
};

export const CATEGORY_META = {
  retirement: { label: 'Retirement', color: 'var(--accent)', icon: '🏦' },
  taxable: { label: 'Taxable Investment', color: 'var(--blue)', icon: '📈' },
  cash: { label: 'Cash / Savings', color: 'var(--purple)', icon: '💵' },
  debt: { label: 'Debt', color: 'var(--danger)', icon: '💳' },
};

export const LS_KEY = 'linkedAccounts';

export function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
