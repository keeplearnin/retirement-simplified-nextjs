'use client';

import { createContext, useContext, useCallback, useRef } from 'react';
import { useLocalState } from '@/lib/useLocalState';

// ---------------------------------------------------------------------------
// Constants (moved from MyPlan.jsx)
// ---------------------------------------------------------------------------

export const DEFAULT_PLAN = {
  currentAge: 40,
  retireAge: 65,
  longevityAge: 95,
  filingStatus: 'single',
  stateCode: 'CA',
  // Savings / portfolio
  savings401k: 150000,
  savingsRoth: 50000,
  savingsTaxable: 30000,
  savingsHSA: 10000,
  savingsRealEstate: 0,
  savingsCash: 0,
  savings529: 0,
  savingsCrypto: 0,
  savingsPension: 0,
  savingsAnnuity: 0,
  monthlyContribution: 1500,
  expectedReturn: 7,
  // Debts
  debts: [],
  // Rate assumptions
  inflationRate: 2.5,
  healthcareInflation: 3.5,
  retiredReturnPct: 60,
  cashReturn: 3.0,
  realEstateAppreciation: 3.0,
  annuityReturn: 3.5,
  // Expenses
  annualSpending: 75000,
  retireSpending: 60000,
  expenseMode: 'simple',
  expenseBreakdown: null,
  goGoEndAge: 75,
  slowGoEndAge: 85,
  // Income
  incomeSources: [
    { id: 1, type: 'salary', label: 'Salary', amount: 100000, growthRate: 3 },
    { id: 2, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2500, startAge: 67 },
  ],
};

export const DEBT_TEMPLATES = {
  mortgage: { type: 'mortgage', name: 'Mortgage', monthlyPayment: 2000, remainingBalance: 300000, interestRate: 6.5 },
  auto: { type: 'auto', name: 'Car Loan', monthlyPayment: 500, remainingBalance: 25000, interestRate: 5.5 },
  student: { type: 'student', name: 'Student Loans', monthlyPayment: 400, remainingBalance: 35000, interestRate: 5.0 },
  credit: { type: 'credit', name: 'Credit Card', monthlyPayment: 300, remainingBalance: 8000, interestRate: 22.0 },
};

export const INCOME_TEMPLATES = {
  salary: { type: 'salary', label: 'Salary', amount: 100000, growthRate: 3 },
  socialSecurity: { type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2500, startAge: 67 },
  pension: { type: 'pension', label: 'Pension', monthlyAmount: 1500, startAge: 65, cola: true },
  rental: { type: 'rental', label: 'Rental Income', monthlyNet: 1500, appreciation: 3 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getSalary(plan) {
  const src = plan.incomeSources?.find(s => s.type === 'salary');
  return src?.amount || 0;
}

export function getSalaryGrowth(plan) {
  const src = plan.incomeSources?.find(s => s.type === 'salary');
  return src?.growthRate || 3;
}

export function getTotalSavings(plan) {
  return (plan.savings401k || 0) + (plan.savingsRoth || 0) + (plan.savingsTaxable || 0) + (plan.savingsHSA || 0)
    + (plan.savingsRealEstate || 0) + (plan.savingsCash || 0) + (plan.savings529 || 0)
    + (plan.savingsCrypto || 0) + (plan.savingsPension || 0) + (plan.savingsAnnuity || 0);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PlanContext = createContext(null);

export function PlanProvider({ children }) {
  const incomeIdRef = useRef(100);
  const [plan, setPlan] = useLocalState('myplan-v1', DEFAULT_PLAN);

  const updatePlan = useCallback((key, val) => {
    setPlan(prev => ({ ...prev, [key]: val }));
  }, [setPlan]);

  const updateIncome = useCallback((id, updated) => {
    setPlan(prev => {
      const newSources = prev.incomeSources.map(s => s.id === id ? updated : s);
      const next = { ...prev, incomeSources: newSources };
      if (updated.type === 'salary' && !prev._expenseManuallySet) {
        const salary = updated.amount || 0;
        next.annualSpending = Math.round(salary * 0.75 / 1000) * 1000;
      }
      return next;
    });
  }, [setPlan]);

  const removeIncome = useCallback((id) => {
    setPlan(prev => ({
      ...prev,
      incomeSources: prev.incomeSources.filter(s => s.id !== id),
    }));
  }, [setPlan]);

  const addIncome = useCallback((type) => {
    const template = INCOME_TEMPLATES[type];
    if (!template) return;
    incomeIdRef.current += 1;
    setPlan(prev => ({
      ...prev,
      incomeSources: [...prev.incomeSources, { ...template, id: incomeIdRef.current }],
    }));
  }, [setPlan]);

  const debtIdRef = useRef(200);

  const addDebt = useCallback((type) => {
    const template = DEBT_TEMPLATES[type];
    if (!template) return;
    debtIdRef.current += 1;
    setPlan(prev => ({
      ...prev,
      debts: [...(prev.debts || []), { ...template, id: debtIdRef.current }],
    }));
  }, [setPlan]);

  const updateDebt = useCallback((id, updated) => {
    setPlan(prev => ({
      ...prev,
      debts: (prev.debts || []).map(d => d.id === id ? updated : d),
    }));
  }, [setPlan]);

  const removeDebt = useCallback((id) => {
    setPlan(prev => ({
      ...prev,
      debts: (prev.debts || []).filter(d => d.id !== id),
    }));
  }, [setPlan]);

  const bulkUpdate = useCallback((updates) => {
    setPlan(prev => ({ ...prev, ...updates }));
  }, [setPlan]);

  return (
    <PlanContext.Provider value={{ plan, updatePlan, updateIncome, removeIncome, addIncome, addDebt, updateDebt, removeDebt, bulkUpdate }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
