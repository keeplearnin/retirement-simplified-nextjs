'use client';

import { createContext, useContext, useCallback, useMemo } from 'react';
import { useLocalState } from '@/lib/useLocalState';

// ---------------------------------------------------------------------------
// Constants (moved from MyPlan.jsx)
// ---------------------------------------------------------------------------

export const DEFAULT_PLAN = {
  // Primary household member
  currentAge: 40,
  retireAge: 65,
  longevityAge: 95,
  filingStatus: 'single',
  stateCode: 'CA',

  // Couples mode (Phase A scaffold). When hasSpouse=false the spouse* fields
  // are ignored by every consumer; when true, they participate in income,
  // contribution-limit, and longevity math. UI to toggle this lands in Phase B.
  hasSpouse: false,
  spouseCurrentAge: 40,
  spouseRetireAge: 65,
  spouseLongevityAge: 95,

  // ── Savings / portfolio ────────────────────────────────────────────────
  // All buckets default to 0. Real values arrive via Onboarding (user
  // typed them), Verdict promotion (one total parked in 401k), or a
  // returning user's saved localStorage. Earlier defaults of
  // $150K/$50K/$10K/$30K leaked through the verdict shallow-merge and
  // the Onboarding "Skip" path, displaying $240K of phantom savings the
  // user never entered — broke trust visibly (tester report 2026-05-02).
  // Per-person accounts (split when hasSpouse=true). Contribution limits
  // are per-person, so the household total = primary + spouse.
  savings401k: 0,
  savingsRoth: 0,
  savingsHSA: 0,
  savingsPension: 0,
  spouseSavings401k: 0,
  spouseSavingsRoth: 0,
  spouseSavingsHSA: 0,
  spouseSavingsPension: 0,

  // Household-pooled accounts (joint ownership common in real life).
  savingsTaxable: 0,
  savingsRealEstate: 0,
  savingsCash: 0,
  savings529: 0,
  savingsCrypto: 0,
  savingsAnnuity: 0,

  // Per-person monthly retirement contributions. Split lets each spouse hit
  // their own 401(k) limit; downstream allocation (60/20/20) stays the same.
  monthlyContribution: 1500,
  spouseMonthlyContribution: 0,

  expectedReturn: 7,
  // Debts
  debts: [],
  // Rate assumptions
  inflationRate: 2.5,
  healthcareInflation: 3.5,
  // 1.0 = average healthy retiree (the baseline matching Fidelity's lifetime
  // healthcare benchmark). Tester reviewer flagged that someone with chronic
  // conditions has no way to bump the auto-estimate. Slider on My Plan
  // surfaces this at 0.5x to 3.0x. Applied uniformly to ACA premiums and
  // Medicare baseline costs in the expense projection.
  healthcareMultiplier: 1.0,
  // When true, treat real estate as a fallback retirement income source —
  // selling / downsizing / reverse-mortgaging in late retirement is part
  // of the plan, not a last-resort surprise. Counts RE toward liquid for
  // the broke-age detection so the plan score doesn't penalize users who
  // intend to draw from RE. Default false (conservative).
  useRealEstateInRetirement: false,
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
  // Income — each entry now carries an optional `owner: 'primary' | 'spouse'`
  // tag; absence implies primary so existing saved plans keep working.
  incomeSources: [
    { id: 1, type: 'salary', label: 'Salary', amount: 100000, growthRate: 3, owner: 'primary' },
    { id: 2, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2500, startAge: 67, owner: 'primary' },
  ],
};

export const DEBT_TEMPLATES = {
  mortgage: { type: 'mortgage', name: 'Mortgage', monthlyPayment: 2000, remainingBalance: 300000, interestRate: 6.5 },
  auto: { type: 'auto', name: 'Car Loan', monthlyPayment: 500, remainingBalance: 25000, interestRate: 5.5 },
  student: { type: 'student', name: 'Student Loans', monthlyPayment: 400, remainingBalance: 35000, interestRate: 5.0 },
  credit: { type: 'credit', name: 'Credit Card', monthlyPayment: 300, remainingBalance: 8000, interestRate: 22.0 },
};

export const INCOME_TEMPLATES = {
  salary: { type: 'salary', label: 'Salary', amount: 100000, growthRate: 3, owner: 'primary' },
  socialSecurity: { type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2500, startAge: 67, owner: 'primary' },
  pension: { type: 'pension', label: 'Pension', monthlyAmount: 1500, startAge: 65, cola: true, owner: 'primary' },
  // Phased retirement: part-time / consulting income covering the gap
  // between full-time salary ending and full retirement. Common pattern
  // in mass-affluent transitions ("I'll work part-time at 60 until 65").
  // Pair this with a salary source whose endAge matches partTime startAge
  // for a clean phased-retirement configuration.
  partTime: { type: 'partTime', label: 'Part-time / consulting', annualAmount: 40000, startAge: 60, endAge: 65, owner: 'primary' },
  rental: { type: 'rental', label: 'Rental Income', monthlyNet: 1500, appreciation: 3 },
};

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/**
 * Existing users have localStorage entries from before couples-mode fields
 * existed. Merging with DEFAULT_PLAN at load time backfills the missing
 * fields with safe defaults so consumers never see `undefined`.
 *
 * Important: shallow merge only. Nested arrays (incomeSources, debts) come
 * from the stored plan as-is — we don't want to clobber the user's edits.
 */
// Reassign fresh ids to any list items whose id duplicates an earlier one.
// Heals plans saved while the old ref-based id counter was live: it reset
// on every page load, so sources added across sessions could share an id —
// and updateIncome(id) then edited every matching row at once.
function dedupeIds(items) {
  if (!Array.isArray(items) || items.length < 2) return items;
  const seen = new Set();
  let maxId = items.reduce((m, it) => Math.max(m, Number(it.id) || 0), 0);
  let changed = false;
  const out = items.map((it) => {
    const id = Number(it.id) || 0;
    if (seen.has(id)) {
      maxId += 1;
      changed = true;
      seen.add(maxId);
      return { ...it, id: maxId };
    }
    seen.add(id);
    return it;
  });
  return changed ? out : items;
}

export function migratePlan(stored) {
  if (!stored || typeof stored !== 'object') return DEFAULT_PLAN;
  const merged = { ...DEFAULT_PLAN, ...stored };
  merged.incomeSources = dedupeIds(merged.incomeSources);
  merged.debts = dedupeIds(merged.debts);
  return merged;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getSalary(plan, owner = 'primary') {
  const src = plan.incomeSources?.find(s => s.type === 'salary' && (s.owner || 'primary') === owner);
  return src?.amount || 0;
}

export function getSalaryGrowth(plan, owner = 'primary') {
  const src = plan.incomeSources?.find(s => s.type === 'salary' && (s.owner || 'primary') === owner);
  return src?.growthRate || 3;
}

/**
 * Total liquid + non-liquid savings across the household. When hasSpouse is
 * true the spouse* per-person buckets are added in. Joint accounts (taxable,
 * cash, RE, 529, crypto, annuity) are counted once regardless.
 */
export function getTotalSavings(plan) {
  const primary = (plan.savings401k || 0) + (plan.savingsRoth || 0) + (plan.savingsHSA || 0) + (plan.savingsPension || 0);
  const spouse = plan.hasSpouse
    ? (plan.spouseSavings401k || 0) + (plan.spouseSavingsRoth || 0) + (plan.spouseSavingsHSA || 0) + (plan.spouseSavingsPension || 0)
    : 0;
  const joint = (plan.savingsTaxable || 0) + (plan.savingsRealEstate || 0) + (plan.savingsCash || 0)
    + (plan.savings529 || 0) + (plan.savingsCrypto || 0) + (plan.savingsAnnuity || 0);
  return primary + spouse + joint;
}

/** Filing status the projection should use. Couples default to MFJ but the
 *  user can override (e.g., MFS or — rarely — single after a separation). */
export function getEffectiveFilingStatus(plan) {
  if (plan.hasSpouse) return plan.filingStatus === 'mfj' || plan.filingStatus === 'single' ? plan.filingStatus : 'mfj';
  return 'single';
}

/** Combined monthly contribution across both members (per-person 401(k)
 *  limits and employer matches enforce treating these separately at the
 *  contribution-engine layer; this helper is for UI summaries.) */
export function getHouseholdMonthlyContribution(plan) {
  return (plan.monthlyContribution || 0) + (plan.hasSpouse ? (plan.spouseMonthlyContribution || 0) : 0);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PlanContext = createContext(null);

export function PlanProvider({ children }) {
  const [storedPlan, setPlan] = useLocalState('myplan-v1', DEFAULT_PLAN);
  // Backfill any fields added since the saved plan was last written so
  // consumers downstream never encounter undefined.
  const plan = useMemo(() => migratePlan(storedPlan), [storedPlan]);

  // CRITICAL: every mutator must operate on migratePlan(prev), not raw prev.
  // The UI renders the HEALED plan (deduped ids), so the id it passes back
  // may not exist in the raw stored plan — and worse, duplicate ids in raw
  // storage would make `.map(s => s.id === id ? ...)` overwrite multiple
  // rows at once (the "edit one income source, both change" bug). Healing
  // inside the write path also persists the repair on first edit.
  // dedupeIds is deterministic, so healed ids in the UI and here agree.
  const updatePlan = useCallback((key, val) => {
    setPlan(prev => ({ ...migratePlan(prev), [key]: val }));
  }, [setPlan]);

  const updateIncome = useCallback((id, updated) => {
    setPlan(prev => {
      const cur = migratePlan(prev);
      const newSources = cur.incomeSources.map(s => s.id === id ? updated : s);
      const next = { ...cur, incomeSources: newSources };
      if (updated.type === 'salary' && !cur._expenseManuallySet) {
        // Auto-estimate spending from HOUSEHOLD salary, not just the source
        // being edited — otherwise a couple's expense estimate lurches to
        // whichever spouse's salary was last touched (ignoring the other).
        const householdSalary = newSources
          .filter(s => s.type === 'salary')
          .reduce((sum, s) => sum + (s.amount || 0), 0);
        next.annualSpending = Math.round(householdSalary * 0.75 / 1000) * 1000;
      }
      return next;
    });
  }, [setPlan]);

  const removeIncome = useCallback((id) => {
    setPlan(prev => {
      const cur = migratePlan(prev);
      return { ...cur, incomeSources: cur.incomeSources.filter(s => s.id !== id) };
    });
  }, [setPlan]);

  // ID minting derives from the list itself, NOT a ref. A ref-based counter
  // resets to its seed on every page load while sources persisted from a
  // previous session keep their higher ids — the next add then reused an
  // existing id, and updateIncome(id) edited BOTH rows ("change one, both
  // change" bug). Max-of-list + 1 can never collide with saved data.
  const nextId = (items, floor) =>
    (items || []).reduce((m, it) => Math.max(m, Number(it.id) || 0), floor) + 1;

  const addIncome = useCallback((type, owner = 'primary') => {
    const template = INCOME_TEMPLATES[type];
    if (!template) return;
    setPlan(prev => {
      const cur = migratePlan(prev);
      return {
        ...cur,
        incomeSources: [...cur.incomeSources, {
          ...template,
          id: nextId(cur.incomeSources, 100),
          owner,
          // Prefix spouse-owned sources so every list (cards, AI plan summary,
          // report) reads unambiguously.
          label: owner === 'spouse' ? `Spouse ${template.label}` : template.label,
        }],
      };
    });
  }, [setPlan]);

  const addDebt = useCallback((type) => {
    const template = DEBT_TEMPLATES[type];
    if (!template) return;
    setPlan(prev => {
      const cur = migratePlan(prev);
      return { ...cur, debts: [...(cur.debts || []), { ...template, id: nextId(cur.debts, 200) }] };
    });
  }, [setPlan]);

  const updateDebt = useCallback((id, updated) => {
    setPlan(prev => {
      const cur = migratePlan(prev);
      return { ...cur, debts: (cur.debts || []).map(d => d.id === id ? updated : d) };
    });
  }, [setPlan]);

  const removeDebt = useCallback((id) => {
    setPlan(prev => {
      const cur = migratePlan(prev);
      return { ...cur, debts: (cur.debts || []).filter(d => d.id !== id) };
    });
  }, [setPlan]);

  const bulkUpdate = useCallback((updates) => {
    setPlan(prev => ({ ...prev, ...updates }));
  }, [setPlan]);

  // Stable identity prevents every usePlan() consumer from re-rendering on
  // unrelated PlanProvider renders. Callbacks below are already memoized.
  const value = useMemo(
    () => ({ plan, updatePlan, updateIncome, removeIncome, addIncome, addDebt, updateDebt, removeDebt, bulkUpdate }),
    [plan, updatePlan, updateIncome, removeIncome, addIncome, addDebt, updateDebt, removeDebt, bulkUpdate]
  );

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
