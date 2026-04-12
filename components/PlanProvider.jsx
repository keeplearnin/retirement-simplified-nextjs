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
  monthlyContribution: 1500,
  expectedReturn: 7,
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
  return (plan.savings401k || 0) + (plan.savingsRoth || 0) + (plan.savingsTaxable || 0) + (plan.savingsHSA || 0);
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

  const bulkUpdate = useCallback((updates) => {
    setPlan(prev => ({ ...prev, ...updates }));
  }, [setPlan]);

  return (
    <PlanContext.Provider value={{ plan, updatePlan, updateIncome, removeIncome, addIncome, bulkUpdate }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
