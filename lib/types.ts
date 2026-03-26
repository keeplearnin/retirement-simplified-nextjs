// Asset allocation
export interface Allocation {
  us_stock: number;
  intl_stock: number;
  bond: number;
  cash: number;
}

// Asset class definition
export interface AssetClass {
  id: string;
  label: string;
  color: string;
  ticker: string;
}

// Account types
export interface Account {
  id: number;
  name: string;
  type: string;
  institution: string;
  balance: number;
}

// Goal planner
export interface Goal {
  id: number;
  type: 'retirement' | 'house' | 'college' | 'travel' | 'custom';
  label: string;
  targetAge: number;
  targetAmount: number;
  currentSavings: number;
  monthlyContrib: number;
}

// Holding for rebalance/tax-loss
export interface Holding {
  id: number;
  name: string;
  currentValue: number;
  costBasis: number;
  assetClass: string;
  purchaseDate: string;
}

// Monte Carlo result
export interface MonteCarloResult {
  successRate: number;
  medianAtRetirement: number;
  medianAtEnd: number;
  percentiles: Record<string, number[]>;
}

// Journal entry
export interface JournalEntry {
  id: string;
  date: string;
  totalSavings: number;
  totalInvested: number;
  netWorth: number;
  monthlyContributions: number;
  notes: string;
  accounts: { name: string; balance: number; type: string }[];
}

// User profile from auth
export interface UserProfile {
  name: string;
  given_name?: string;
  email: string;
  sub: string;
  picture?: string;
}

// Plaid linked account
export interface LinkedAccount {
  id: string;
  name: string;
  type: string;
  subtype: string;
  balance: number;
  institution: string;
  mask?: string;
}

// Plan saved by user
export interface SavedPlan {
  id: string;
  name: string;
  updatedAt: string;
  currentSavings: number;
  monthlyContribution: number;
  [key: string]: any;
}

// Donut chart segment
export interface DonutSegment {
  start: number;
  end: number;
  color: string;
  label?: string;
  pct?: number;
}

// Withdrawal projection data point
export interface WithdrawalDataPoint {
  age: number;
  traditional: number;
  roth: number;
  taxable: number;
  total: number;
  rmd: number;
  withdrawal: number;
  ss: number;
}
