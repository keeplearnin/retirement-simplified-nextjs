'use client';

import { useState, useMemo, useCallback } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import MiniChart from '@/components/ui/MiniChart';
import ValidationWarning from '@/components/ui/ValidationWarning';
import SavePlanButton from '@/components/tabs/SavePlanButton';
import { fmt, fmtFull } from '@/lib/format';
import { useLocalState } from '@/lib/useLocalState';
import { MAX_401K_CONTRIBUTION, CATCHUP_401K_CONTRIBUTION, SS_WAGE_CAP, SS_BEND_POINTS, SS_FACTORS, SS_FRA } from '@/lib/constants';
import { usePlan, getSalary, getSalaryGrowth } from '@/components/PlanProvider';

const MATCH_TYPES = [
  { id: 'none', label: 'No Match' },
  { id: '50_6', label: '50% up to 6%' },
  { id: '100_3', label: '100% up to 3%' },
  { id: '100_4', label: '100% up to 4%' },
  { id: '100_6', label: '100% up to 6%' },
  { id: 'custom', label: 'Custom' },
];

const PROFILES = [
  { id: 'fresh_grad', label: '🎓 Fresh Graduate', desc: 'Age 22, starting career, entry-level salary', age: 22, retireAge: 65, savings401k: 0, taxableBalance: 5000, rothBalance: 0, hsaBalance: 0, salary: 55000, contribution401k: 6, matchType: '50_6', taxableMonthly: 50, rothMonthly: 50, hsaAnnual: 1000, returnRate: 7, salaryGrowth: 4 },
  { id: 'late_start', label: '\u23F0 Late Starter (35)', desc: 'Playing catch-up, moderate savings', age: 35, retireAge: 67, savings401k: 15000, taxableBalance: 8000, rothBalance: 2000, hsaBalance: 1000, salary: 75000, contribution401k: 10, matchType: '50_6', taxableMonthly: 150, rothMonthly: 100, hsaAnnual: 2000, returnRate: 7, salaryGrowth: 3 },
  { id: 'mid_career', label: '💼 Mid-Career Pro', desc: 'Age 40, solid income, steady saver', age: 40, retireAge: 65, savings401k: 150000, taxableBalance: 30000, rothBalance: 15000, hsaBalance: 8000, salary: 120000, contribution401k: 15, matchType: '100_4', taxableMonthly: 200, rothMonthly: 200, hsaAnnual: 3850, returnRate: 7, salaryGrowth: 2.5 },
  { id: 'high_earner', label: '🚀 High Earner', desc: 'Age 35, tech/finance salary, maxing out', age: 35, retireAge: 60, savings401k: 250000, taxableBalance: 100000, rothBalance: 40000, hsaBalance: 15000, salary: 250000, contribution401k: 25, matchType: '100_6', taxableMonthly: 1000, rothMonthly: 500, hsaAnnual: 4300, returnRate: 7, salaryGrowth: 2 },
  { id: 'couple_dual', label: '👫 Dual-Income Couple', desc: 'Combined household, age 32', age: 32, retireAge: 62, savings401k: 80000, taxableBalance: 35000, rothBalance: 20000, hsaBalance: 5000, salary: 180000, contribution401k: 12, matchType: '100_3', taxableMonthly: 500, rothMonthly: 350, hsaAnnual: 3850, returnRate: 7, salaryGrowth: 3 },
  { id: 'pre_retire', label: '🏖\uFE0F Pre-Retiree (55)', desc: 'Final stretch, maximizing contributions', age: 55, retireAge: 67, savings401k: 600000, taxableBalance: 120000, rothBalance: 60000, hsaBalance: 25000, salary: 140000, contribution401k: 25, matchType: '100_4', taxableMonthly: 800, rothMonthly: 500, hsaAnnual: 4300, returnRate: 6, salaryGrowth: 1 },
  { id: 'conservative', label: '🛡\uFE0F Conservative Saver', desc: 'Low risk tolerance, bonds-heavy', age: 45, retireAge: 67, savings401k: 200000, taxableBalance: 60000, rothBalance: 30000, hsaBalance: 10000, salary: 90000, contribution401k: 10, matchType: '50_6', taxableMonthly: 200, rothMonthly: 150, hsaAnnual: 2000, returnRate: 5, salaryGrowth: 2 },
  { id: 'aggressive', label: '🔥 Aggressive FIRE', desc: 'Financial Independence, Retire Early', age: 28, retireAge: 45, savings401k: 60000, taxableBalance: 50000, rothBalance: 25000, hsaBalance: 5000, salary: 130000, contribution401k: 25, matchType: '100_6', taxableMonthly: 1500, rothMonthly: 500, hsaAnnual: 4300, returnRate: 8, salaryGrowth: 5 },
  { id: 'teacher', label: '📚 Teacher / Public Sector', desc: 'Pension supplement, modest salary', age: 30, retireAge: 62, savings401k: 20000, taxableBalance: 5000, rothBalance: 3000, hsaBalance: 1000, salary: 55000, contribution401k: 8, matchType: '100_3', taxableMonthly: 50, rothMonthly: 100, hsaAnnual: 1500, returnRate: 7, salaryGrowth: 2 },
  { id: 'small_biz', label: '🏪 Small Business Owner', desc: 'Self-employed, SEP-IRA, variable income', age: 38, retireAge: 65, savings401k: 100000, taxableBalance: 50000, rothBalance: 20000, hsaBalance: 8000, salary: 110000, contribution401k: 20, matchType: 'none', taxableMonthly: 400, rothMonthly: 300, hsaAnnual: 3850, returnRate: 7, salaryGrowth: 3 },
];

function calcMatch(matchType, salary, employeeContribPct, customPct, customCap) {
  if (matchType === 'none') return 0;
  const employeeContrib = salary * (employeeContribPct / 100);
  if (matchType === 'custom') {
    const matchableContrib = Math.min(employeeContrib, salary * (customCap / 100));
    return matchableContrib * (customPct / 100);
  }
  const [rate, cap] = matchType.split('_').map(Number);
  const matchableContrib = Math.min(employeeContrib, salary * (cap / 100));
  return matchableContrib * (rate / 100);
}

// Dynamic safe withdrawal rate based on retirement duration
// Based on Trinity Study + updated research (Bengen, Kitces)
function safeWithdrawalRate(retirementYears) {
  if (retirementYears <= 20) return 5.0;
  if (retirementYears <= 25) return 4.5;
  if (retirementYears <= 30) return 4.0;
  if (retirementYears <= 35) return 3.7;
  if (retirementYears <= 40) return 3.5;
  return 3.3; // 40+ years (FIRE)
}

// Estimate monthly Social Security benefit using simplified PIA formula
function estimateSS(annualSalary, claimAge) {
  const cappedSalary = Math.min(annualSalary, SS_WAGE_CAP);
  // Average Indexed Monthly Earnings (simplified — assumes current salary ~ career avg)
  const aime = cappedSalary / 12;

  // PIA using bend points
  let pia = 0;
  if (aime <= SS_BEND_POINTS[0]) {
    pia = aime * SS_FACTORS[0];
  } else if (aime <= SS_BEND_POINTS[1]) {
    pia = SS_BEND_POINTS[0] * SS_FACTORS[0] + (aime - SS_BEND_POINTS[0]) * SS_FACTORS[1];
  } else {
    pia = SS_BEND_POINTS[0] * SS_FACTORS[0] + (SS_BEND_POINTS[1] - SS_BEND_POINTS[0]) * SS_FACTORS[1] + (aime - SS_BEND_POINTS[1]) * SS_FACTORS[2];
  }

  // Age adjustment relative to FRA
  const monthsDiff = (claimAge - SS_FRA) * 12;
  let adjustment = 1.0;
  if (monthsDiff < 0) {
    // Early: reduce by 0.556% per month before FRA
    adjustment = 1 + (monthsDiff * 0.00556);
  } else if (monthsDiff > 0) {
    // Delayed: add 0.667% per month after FRA
    adjustment = 1 + (monthsDiff * 0.00667);
  }

  return Math.round(pia * adjustment);
}

// Milestone thresholds to track
const MILESTONE_THRESHOLDS = [100000, 250000, 500000, 1000000, 2000000, 5000000];

const GP_DEFAULTS = {
  // GP-specific fields only (age, savings, salary, returnRate come from shared PlanProvider)
  rothMonthly: 200, hsaAnnual: 3850, taxableMonthly: 200,
  contribution401k: 10, matchType: '50_6', customMatchPct: 50, customMatchCap: 6,
  showInflation: false, taxBracket: 22, ssClaimAge: 67, includeSSIncome: true,
};

export default function GrowthProjector() {
  const { plan, bulkUpdate } = usePlan();
  const [inputs, setInputs] = useLocalState('growth_projector', GP_DEFAULTS);
  const set = useCallback((field, value) => setInputs(prev => ({ ...prev, [field]: value })), [setInputs]);

  // Shared fields from My Plan context
  const age = plan.currentAge;
  const retireAge = plan.retireAge;
  const salary = getSalary(plan);
  const salaryGrowth = getSalaryGrowth(plan);
  const savings401k = plan.savings401k || 0;
  const taxableBalance = plan.savingsTaxable || 0;
  const rothBalance = plan.savingsRoth || 0;
  const hsaBalance = plan.savingsHSA || 0;
  const returnRate = plan.expectedReturn || 7;

  // GP-specific fields stay local
  const { rothMonthly, hsaAnnual, taxableMonthly, contribution401k,
    matchType, customMatchPct, customMatchCap, showInflation, taxBracket,
    ssClaimAge, includeSSIncome } = inputs;

  // Convenience setters (GP-specific fields only)
  const setRothMonthly = v => set('rothMonthly', v);
  const setHsaAnnual = v => set('hsaAnnual', v);
  const setTaxableMonthly = v => set('taxableMonthly', v);
  const setContribution401k = v => set('contribution401k', v);
  const setMatchType = v => set('matchType', v);
  const setCustomMatchPct = v => set('customMatchPct', v);
  const setCustomMatchCap = v => set('customMatchCap', v);
  const setShowInflation = v => set('showInflation', v);
  const setTaxBracket = v => set('taxBracket', v);
  const setSsClaimAge = v => set('ssClaimAge', v);
  const setIncludeSSIncome = v => set('includeSSIncome', v);

  const [activeProfile, setActiveProfile] = useState(null);
  // What-If (transient, no persistence needed)
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [extraMonthly, setExtraMonthly] = useState(200);
  const [extraYears, setExtraYears] = useState(3);
  const [altReturn, setAltReturn] = useState(8);

  const inflation = 2.5;
  const stdDev = 0.15; // Market std dev for confidence bands

  function applyProfile(p) {
    setActiveProfile(p.id);
    // Update shared fields in My Plan context
    bulkUpdate({
      currentAge: p.age,
      retireAge: p.retireAge,
      savings401k: p.savings401k,
      savingsTaxable: p.taxableBalance,
      savingsRoth: p.rothBalance || 0,
      savingsHSA: p.hsaBalance || 0,
      expectedReturn: p.returnRate,
      incomeSources: [
        { id: 1, type: 'salary', label: 'Salary', amount: p.salary, growthRate: p.salaryGrowth || 3 },
        { id: 2, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2500, startAge: 67 },
      ],
    });
    // Update GP-specific fields
    setInputs(prev => ({
      ...prev,
      contribution401k: p.contribution401k, matchType: p.matchType,
      taxableMonthly: p.taxableMonthly, rothMonthly: p.rothMonthly || 200,
      hsaAnnual: p.hsaAnnual || 3850,
    }));
  }

  const totalSavings = savings401k + taxableBalance + rothBalance + hsaBalance;
  const years = retireAge - age;

  // Current year calculations (for display)
  const limit401k = age >= 50 ? MAX_401K_CONTRIBUTION + CATCHUP_401K_CONTRIBUTION : MAX_401K_CONTRIBUTION;
  const annual401kNow = Math.min(salary * (contribution401k / 100), limit401k);
  const annualMatchNow = calcMatch(matchType, salary, contribution401k, customMatchPct, customMatchCap);
  const hsaMonthly = hsaAnnual / 12;
  const totalMonthlyNow = (annual401kNow + annualMatchNow) / 12 + taxableMonthly + rothMonthly + hsaMonthly;
  const employeeMonthlyNow = (annual401kNow / 12) + taxableMonthly + rothMonthly + hsaMonthly;

  // ── Main projection with salary growth (4 buckets) ──
  const data = useMemo(() => {
    const monthlyRate = returnRate / 100 / 12;
    const monthlyRateReal = (returnRate - inflation) / 100 / 12;
    const pts = [];
    let bal = totalSavings, balR = totalSavings;
    let bal401k = savings401k, balTaxable = taxableBalance, balRoth = rothBalance, balHsa = hsaBalance;
    let totalContrib = totalSavings;
    let taxableContrib = taxableBalance; // cost basis tracking
    let curSalary = salary;
    let curTaxableMonthly = taxableMonthly;
    let curRothMonthly = rothMonthly;
    let curHsaAnnual = hsaAnnual;
    // Confidence bands
    let balHigh = totalSavings, balLow = totalSavings;
    const highRate = (returnRate + stdDev * 100 * 0.5) / 100 / 12;
    const lowRate = (returnRate - stdDev * 100 * 0.5) / 100 / 12;

    for (let y = 0; y <= years; y++) {
      const curAge = age + y;
      const yearLimit = curAge >= 50 ? MAX_401K_CONTRIBUTION + CATCHUP_401K_CONTRIBUTION : MAX_401K_CONTRIBUTION;
      const annual401k = Math.min(curSalary * (contribution401k / 100), yearLimit);
      const annualMatch = calcMatch(matchType, curSalary, contribution401k, customMatchPct, customMatchCap);
      const monthly401kContrib = (annual401k + annualMatch) / 12;
      const curHsaMonthly = curHsaAnnual / 12;
      const totalMonthly = monthly401kContrib + curTaxableMonthly + curRothMonthly + curHsaMonthly;

      pts.push({
        year: y, age: curAge, balance: bal, real: balR, contributed: totalContrib,
        bal401k, balTaxable, balRoth, balHsa, taxableContrib,
        salary: curSalary, balHigh, balLow,
      });

      // Monthly compounding for this year
      for (let m = 0; m < 12; m++) {
        bal = bal * (1 + monthlyRate) + totalMonthly;
        balR = balR * (1 + monthlyRateReal) + totalMonthly;
        bal401k = bal401k * (1 + monthlyRate) + monthly401kContrib;
        balTaxable = balTaxable * (1 + monthlyRate) + curTaxableMonthly;
        balRoth = balRoth * (1 + monthlyRate) + curRothMonthly;
        balHsa = balHsa * (1 + monthlyRate) + curHsaMonthly;
        balHigh = balHigh * (1 + highRate) + totalMonthly;
        balLow = Math.max(0, balLow * (1 + lowRate) + totalMonthly);
      }
      totalContrib += totalMonthly * 12;
      taxableContrib += curTaxableMonthly * 12;

      // Grow salary and contributions for next year
      curSalary = curSalary * (1 + salaryGrowth / 100);
      curTaxableMonthly = curTaxableMonthly * (1 + salaryGrowth / 100);
      curRothMonthly = curRothMonthly * (1 + salaryGrowth / 100);
      curHsaAnnual = curHsaAnnual * (1 + salaryGrowth / 100);
    }
    return pts;
  }, [age, retireAge, totalSavings, savings401k, taxableBalance, rothBalance, hsaBalance,
      salary, salaryGrowth, contribution401k, matchType, customMatchPct, customMatchCap,
      taxableMonthly, rothMonthly, hsaAnnual, returnRate, inflation, stdDev, years]);

  // ── What-If projection ──
  const whatIfData = useMemo(() => {
    if (!showWhatIf) return null;
    const wiRetireAge = retireAge + extraYears;
    const wiYears = wiRetireAge - age;
    const wiReturn = altReturn;
    const monthlyRate = wiReturn / 100 / 12;
    const pts = [];
    let bal = totalSavings;
    let curSalary = salary;
    let curTaxableMonthly = taxableMonthly;
    let curRothMonthly = rothMonthly;
    let curHsaAnnual = hsaAnnual;

    for (let y = 0; y <= wiYears; y++) {
      const curAge = age + y;
      const yearLimit = curAge >= 50 ? MAX_401K_CONTRIBUTION + CATCHUP_401K_CONTRIBUTION : MAX_401K_CONTRIBUTION;
      const annual401k = Math.min(curSalary * (contribution401k / 100), yearLimit);
      const annualMatch = calcMatch(matchType, curSalary, contribution401k, customMatchPct, customMatchCap);
      const monthly401kContrib = (annual401k + annualMatch) / 12;
      const curHsaMonthly = curHsaAnnual / 12;
      const totalMonthly = monthly401kContrib + curTaxableMonthly + curRothMonthly + curHsaMonthly + extraMonthly;

      pts.push({ year: y, age: curAge, whatIf: bal });

      for (let m = 0; m < 12; m++) {
        bal = bal * (1 + monthlyRate) + totalMonthly;
      }

      curSalary = curSalary * (1 + salaryGrowth / 100);
      curTaxableMonthly = curTaxableMonthly * (1 + salaryGrowth / 100);
      curRothMonthly = curRothMonthly * (1 + salaryGrowth / 100);
      curHsaAnnual = curHsaAnnual * (1 + salaryGrowth / 100);
    }
    return pts;
  }, [showWhatIf, age, retireAge, extraYears, altReturn, totalSavings, salary, salaryGrowth,
      taxableMonthly, rothMonthly, hsaAnnual, extraMonthly, contribution401k, matchType,
      customMatchPct, customMatchCap]);

  const final = data[data.length - 1] || {};
  const totalC = final.contributed || totalSavings;
  const growth = final.balance - totalC;
  const retirementYears = (plan.longevityAge || 95) - retireAge;
  const swr = safeWithdrawalRate(retirementYears);
  const monthlyIncome = (final.balance * swr / 100) / 12;
  const maxBal = Math.max(
    ...data.map(d => d.balHigh || d.balance),
    ...(whatIfData ? whatIfData.map(d => d.whatIf) : [0]),
  );
  const totalMatchLifetime = data.reduce((sum, d, i) => {
    if (i === 0) return 0;
    const s = data[i - 1].salary;
    return sum + calcMatch(matchType, s, contribution401k, customMatchPct, customMatchCap);
  }, 0);

  // Social Security
  const ssMonthly = useMemo(() => estimateSS(salary, ssClaimAge), [salary, ssClaimAge]);
  const ssMonthlyDisplay = includeSSIncome ? ssMonthly : 0;
  const combinedMonthlyIncome = monthlyIncome + ssMonthlyDisplay;

  // After-tax equivalents (4 buckets)
  const after401k = final.bal401k * (1 - taxBracket / 100);
  const afterRoth = final.balRoth; // tax-free
  const taxableGains = Math.max(0, final.balTaxable - (final.taxableContrib || 0));
  const afterTaxable = (final.taxableContrib || 0) + taxableGains * 0.85; // 15% LTCG on gains only
  const afterHsa = final.balHsa; // tax-free for medical
  const afterTotal = after401k + afterRoth + afterTaxable + afterHsa;

  // Milestones
  const milestones = useMemo(() => {
    const found = [];
    for (const threshold of MILESTONE_THRESHOLDS) {
      const pt = data.find(d => d.balance >= threshold);
      if (pt) {
        found.push({ amount: threshold, age: pt.age });
      }
    }
    return found;
  }, [data]);

  // What-If comparison values
  const whatIfFinal = whatIfData ? whatIfData[whatIfData.length - 1] : null;
  const whatIfDelta = whatIfFinal ? whatIfFinal.whatIf - final.balance : 0;
  const whatIfDeltaPct = final.balance > 0 && whatIfDelta > 0 ? ((whatIfDelta / final.balance) * 100).toFixed(0) : 0;

  // Cost of delay: what if you wait 5 years?
  const costOfDelay = useMemo(() => {
    if (years <= 5) return 0;
    const monthlyRate = returnRate / 100 / 12;
    let bal = totalSavings;
    let curSalary = salary;
    let curTaxableMonthly = taxableMonthly;
    let curRothMonthly = rothMonthly;
    let curHsaAnnual = hsaAnnual;
    // Compound for 5 years with NO contributions, salary still grows
    for (let y = 0; y < 5; y++) {
      for (let m = 0; m < 12; m++) {
        bal = bal * (1 + monthlyRate); // growth only, no contributions
      }
      curSalary = curSalary * (1 + salaryGrowth / 100);
      curTaxableMonthly = curTaxableMonthly * (1 + salaryGrowth / 100);
      curRothMonthly = curRothMonthly * (1 + salaryGrowth / 100);
      curHsaAnnual = curHsaAnnual * (1 + salaryGrowth / 100);
    }
    // Then contribute for remaining years
    for (let y = 5; y < years; y++) {
      const curAge = age + y;
      const yearLimit = curAge >= 50 ? MAX_401K_CONTRIBUTION + CATCHUP_401K_CONTRIBUTION : MAX_401K_CONTRIBUTION;
      const annual401k = Math.min(curSalary * (contribution401k / 100), yearLimit);
      const annualMatch = calcMatch(matchType, curSalary, contribution401k, customMatchPct, customMatchCap);
      const curHsaMonthly = curHsaAnnual / 12;
      const totalMonthly = (annual401k + annualMatch) / 12 + curTaxableMonthly + curRothMonthly + curHsaMonthly;
      for (let m = 0; m < 12; m++) {
        bal = bal * (1 + monthlyRate) + totalMonthly;
      }
      curSalary = curSalary * (1 + salaryGrowth / 100);
      curTaxableMonthly = curTaxableMonthly * (1 + salaryGrowth / 100);
      curRothMonthly = curRothMonthly * (1 + salaryGrowth / 100);
      curHsaAnnual = curHsaAnnual * (1 + salaryGrowth / 100);
    }
    return Math.max(0, final.balance - bal);
  }, [final.balance, years, totalSavings, salary, salaryGrowth, taxableMonthly, rothMonthly,
      hsaAnnual, returnRate, age, contribution401k, matchType, customMatchPct, customMatchCap]);

  // Warnings
  const warnings = useMemo(() => {
    const w = [];
    if (years < 10) w.push('Very short time horizon \u2014 consider working longer for more compounding.');
    if (salary > 0 && contribution401k === 0 && taxableMonthly === 0 && rothMonthly === 0 && hsaAnnual === 0) w.push('No contributions \u2014 savings will only grow from existing balance.');
    if (employeeMonthlyNow > salary / 12 * 0.5) w.push('Saving over 50% of gross income \u2014 make sure this is realistic.');
    if (monthlyIncome < 2000) w.push('Projected retirement income under $2K/mo \u2014 you may need to save more.');
    return w;
  }, [years, salary, contribution401k, taxableMonthly, rothMonthly, hsaAnnual, employeeMonthlyNow, monthlyIncome]);

  const btnStyle = (active) => ({
    padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--bg)' : 'var(--text-muted)',
    cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)',
    transition: 'all .2s',
  });

  // Merge what-if data into chart data
  const chartData = useMemo(() => {
    if (!showWhatIf || !whatIfData) return data;
    // Extend data array to cover extra years if needed
    const maxLen = Math.max(data.length, whatIfData.length);
    const merged = [];
    for (let i = 0; i < maxLen; i++) {
      const base = data[i] || {};
      const wi = whatIfData[i] || {};
      merged.push({ ...base, whatIf: wi.whatIf, age: base.age || wi.age, year: base.year !== undefined ? base.year : wi.year });
    }
    return merged;
  }, [data, whatIfData, showWhatIf]);

  return (
    <div className="fade-up">
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel icon={'👤'}>Quick Profiles {'\u2014'} Pick one to auto-fill, then customize</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 8 }}>
          {PROFILES.map(p => (
            <button key={p.id} onClick={() => applyProfile(p)} style={{
              padding: '10px 12px', borderRadius: 8, textAlign: 'left',
              border: activeProfile === p.id ? '2px solid var(--accent)' : '1px solid var(--border)',
              background: activeProfile === p.id ? 'rgba(45,212,191,0.08)' : 'var(--card)',
              cursor: 'pointer', transition: 'all .2s',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--sans)' }}>{p.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--sans)' }}>{p.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      <ValidationWarning warnings={warnings} />

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 32 }}>
        <div>
          <Card variant="input">
            <SectionLabel>Your Details</SectionLabel>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--bg2)', lineHeight: 1.8 }}>
              Age <strong style={{ color: 'var(--text)' }}>{age}</strong> · Retire at <strong style={{ color: 'var(--text)' }}>{retireAge}</strong> · Salary <strong style={{ color: 'var(--accent)' }}>{fmt(salary)}</strong> · Growth <strong style={{ color: 'var(--text)' }}>{salaryGrowth}%</strong>/yr
              <br />
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Salary at retirement: {fmt(salary * Math.pow(1 + salaryGrowth / 100, years))} · Edit in My Plan</span>
            </div>
          </Card>

          <Card variant="input" style={{ marginTop: 14 }}>
            <SectionLabel icon="🏦">401(k) / Employer Plan</SectionLabel>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Balance: <strong style={{ color: 'var(--accent)' }}>{fmt(savings401k)}</strong> <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>(from My Plan)</span></div>
            <Slider label="Your Contribution" value={contribution401k} onChange={setContribution401k} min={0} max={25} step={1} suffix="% of salary" />
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: -4, marginBottom: 10 }}>
              = {fmt(annual401kNow / 12)}/mo ({fmt(annual401kNow)}/yr) &middot; 2026 limit: ${limit401k.toLocaleString()}{age >= 50 ? ' (incl. catch-up)' : ''}
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Employer Match</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {MATCH_TYPES.map(m => (
                  <button key={m.id} onClick={() => setMatchType(m.id)} style={btnStyle(matchType === m.id)}>{m.label}</button>
                ))}
              </div>
            </div>

            {matchType === 'custom' && (
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <Slider label="Match Rate" value={customMatchPct} onChange={setCustomMatchPct} min={0} max={100} step={5} suffix="%" />
                <Slider label="Up To" value={customMatchCap} onChange={setCustomMatchCap} min={1} max={15} step={1} suffix="% of salary" />
              </div>
            )}

            {annualMatchNow > 0 && (
              <div style={{
                marginTop: 10, padding: '10px 14px', borderRadius: 8,
                background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.2)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
                  {'🎉'} Free money: {fmt(annualMatchNow)}/yr ({fmt(annualMatchNow / 12)}/mo)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  Lifetime match (with salary growth): <strong style={{ color: 'var(--accent)' }}>{fmt(totalMatchLifetime)}</strong>
                </div>
              </div>
            )}
          </Card>

          <Card variant="input" style={{ marginTop: 14 }}>
            <SectionLabel icon="💼">Roth IRA</SectionLabel>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Balance: <strong style={{ color: 'var(--accent)' }}>{fmt(rothBalance)}</strong> <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>(from My Plan)</span></div>
            <Slider label="Monthly Roth Contribution" value={rothMonthly} onChange={setRothMonthly} min={0} max={2000} step={25} format={fmt} />
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -4 }}>
              Tax-free growth and withdrawals &middot; 2026 limit: $7,500/yr ($8,600 age 50+)
            </div>
          </Card>

          <Card variant="input" style={{ marginTop: 14 }}>
            <SectionLabel icon="💹">Taxable Brokerage</SectionLabel>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Balance: <strong style={{ color: 'var(--accent)' }}>{fmt(taxableBalance)}</strong> <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>(from My Plan)</span></div>
            <Slider label="Monthly Taxable Contribution" value={taxableMonthly} onChange={setTaxableMonthly} min={0} max={5000} step={50} format={fmt} />
            {salaryGrowth > 0 && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -4 }}>Grows with salary: {fmt(taxableMonthly)}/mo now \u2192 {fmt(taxableMonthly * Math.pow(1 + salaryGrowth / 100, years))}/mo at retirement</div>}
          </Card>

          <Card variant="input" style={{ marginTop: 14 }}>
            <SectionLabel icon="🩺">HSA (Health Savings Account)</SectionLabel>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Balance: <strong style={{ color: 'var(--accent)' }}>{fmt(hsaBalance)}</strong> <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>(from My Plan)</span></div>
            <Slider label="Annual HSA Contribution" value={hsaAnnual} onChange={setHsaAnnual} min={0} max={8750} step={50} format={fmt} />
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -4 }}>
              Triple tax advantage: pre-tax in, tax-free growth, tax-free medical withdrawals
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
              2026 limits: $4,400 individual / $8,750 family &middot; {fmt(hsaAnnual / 12)}/mo
            </div>
          </Card>

          <Card variant="input" style={{ marginTop: 14 }}>
            <SectionLabel icon="📈">Assumptions</SectionLabel>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Return: <strong style={{ color: 'var(--text)' }}>{returnRate}%</strong> <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>(from My Plan)</span></div>
            <Slider label="Retirement Tax Bracket" value={taxBracket} onChange={setTaxBracket} min={10} max={37} step={1} suffix="%" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={showInflation} onChange={e => setShowInflation(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
              Show inflation-adjusted ({inflation}%)
            </label>

            {/* Social Security */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>Social Security Estimate</div>
              <Slider label="SS Claim Age" value={ssClaimAge} onChange={setSsClaimAge} min={62} max={70} suffix=" yrs" />
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -4, marginBottom: 6 }}>
                FRA = {SS_FRA} &middot; Est. benefit: {fmt(ssMonthly)}/mo at age {ssClaimAge}
                {ssClaimAge < SS_FRA && ' (reduced for early claiming)'}
                {ssClaimAge > SS_FRA && ' (increased for delayed claiming)'}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={includeSSIncome} onChange={e => setIncludeSSIncome(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
                Include SS in retirement income
              </label>
            </div>
          </Card>
        </div>

        <div>
          {/* Summary stats */}
          <div className="stats-row" style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <Stat icon="🎯" label="At Retirement" value={fmt(final.balance)} sub={showInflation ? `${fmt(final.real)} in today's $` : `in ${years} years`} />
            <Stat icon="💰" label="You Contribute" value={fmt(totalC)} color="var(--warn)" />
            <Stat icon="🏖\uFE0F" label={`Portfolio Income (${swr}%)`} value={fmt(monthlyIncome)} color="var(--blue)" sub={retirementYears > 30 ? 'Lower rate for longer retirement' : 'Standard 4% rule'} />
          </div>

          {/* Combined income with SS */}
          {includeSSIncome && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <Card variant="output" style={{ flex: 1, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Portfolio Withdrawal</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--blue)' }}>{fmt(monthlyIncome)}/mo</div>
                  </div>
                  <div style={{ fontSize: 18, color: 'var(--text-dim)', fontWeight: 300 }}>+</div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Social Security</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--accent)' }}>{fmt(ssMonthly)}/mo</div>
                  </div>
                  <div style={{ fontSize: 18, color: 'var(--text-dim)', fontWeight: 300 }}>=</div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Combined Monthly</div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--accent)' }}>{fmt(combinedMonthlyIncome)}/mo</div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Confidence range */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <Card style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Pessimistic (-1\u03C3)</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--warn)' }}>{fmt(final.balLow)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{fmt((final.balLow * swr / 100) / 12)}/mo income</div>
            </Card>
            <Card style={{ flex: 1, textAlign: 'center', padding: '12px 8px', border: '1.5px solid var(--accent)' }}>
              <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Expected</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--accent)' }}>{fmt(final.balance)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{fmt(monthlyIncome)}/mo income</div>
            </Card>
            <Card style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Optimistic (+1\u03C3)</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--blue)' }}>{fmt(final.balHigh)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{fmt((final.balHigh * swr / 100) / 12)}/mo income</div>
            </Card>
          </div>

          {/* Account breakdown — 4 buckets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <Card variant="output">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{'🏦'}</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>TRADITIONAL 401(K)/IRA</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--accent)' }}>{fmt(final.bal401k)}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>After {taxBracket}% tax:</span>
                  <strong style={{ color: 'var(--warn)' }}>{fmt(after401k)}</strong>
                </div>
              </div>
            </Card>
            <Card variant="output">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{'💜'}</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>ROTH IRA</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)', color: '#A78BFA' }}>{fmt(final.balRoth)}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tax-free:</span>
                  <strong style={{ color: 'var(--accent)' }}>{fmt(afterRoth)}</strong>
                </div>
              </div>
            </Card>
            <Card variant="output">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{'💹'}</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>TAXABLE BROKERAGE</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--blue)' }}>{fmt(final.balTaxable)}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>15% LTCG on {fmt(taxableGains)} gains:</span>
                  <strong style={{ color: 'var(--blue)' }}>{fmt(afterTaxable)}</strong>
                </div>
              </div>
            </Card>
            <Card variant="output">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{'🩺'}</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>HSA</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)', color: '#F472B6' }}>{fmt(final.balHsa)}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tax-free (medical):</span>
                  <strong style={{ color: 'var(--accent)' }}>{fmt(afterHsa)}</strong>
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
                  *Tax-free if used for qualified medical expenses. After 65, non-medical withdrawals taxed as income.
                </div>
              </div>
            </Card>
          </div>

          {/* After-tax total */}
          <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>AFTER-TAX SPENDING POWER</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Traditional: {taxBracket}% income tax &middot; Roth: tax-free &middot; Taxable: 15% LTCG on gains &middot; HSA: tax-free (medical)</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--warn)' }}>{fmt(afterTotal)}</div>
          </div>

          {/* Monthly contribution breakdown */}
          <Card variant="output" style={{ marginBottom: 14 }}>
            <SectionLabel>Monthly Contribution Breakdown</SectionLabel>
            <div style={{ display: 'flex', gap: 4, height: 28, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
              {annual401kNow > 0 && (
                <div style={{ flex: annual401kNow / 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                  401k: {fmt(annual401kNow / 12)}
                </div>
              )}
              {annualMatchNow > 0 && (
                <div style={{ flex: annualMatchNow / 12, background: 'rgba(52,211,153,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                  Match: {fmt(annualMatchNow / 12)}
                </div>
              )}
              {rothMonthly > 0 && (
                <div style={{ flex: rothMonthly, background: '#A78BFA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                  Roth: {fmt(rothMonthly)}
                </div>
              )}
              {taxableMonthly > 0 && (
                <div style={{ flex: taxableMonthly, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                  Taxable: {fmt(taxableMonthly)}
                </div>
              )}
              {hsaMonthly > 0 && (
                <div style={{ flex: hsaMonthly, background: '#F472B6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                  HSA: {fmt(hsaMonthly)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Total: <strong style={{ color: 'var(--text)' }}>{fmt(totalMonthlyNow)}/mo</strong> (grows with salary)</span>
              <span>Savings rate: <strong style={{ color: salary > 0 ? (employeeMonthlyNow * 12 / salary >= 0.2 ? 'var(--accent)' : 'var(--warn)') : 'var(--text-dim)' }}>{salary > 0 ? ((employeeMonthlyNow * 12 / salary) * 100).toFixed(0) : 0}%</strong></span>
            </div>
          </Card>

          <Stat icon="📈" label="Market Growth" value={fmt(growth)} sub={`${totalC > 0 ? ((growth / totalC) * 100).toFixed(0) : 0}% return on contributions`} color="var(--blue)" />

          {/* Chart with confidence band */}
          <Card variant="output" style={{ marginTop: 14 }}>
            <SectionLabel>Portfolio Growth Over Time</SectionLabel>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>
              Shaded area = \u00B11 standard deviation (68% probability range)
              {showWhatIf && ' \u00B7 Dashed purple = What-If scenario'}
            </div>
            <MiniChart data={chartData} height={220} lines={[
              { key: 'balHigh', color: 'rgba(96,165,250,0.15)', fill: true, label: 'Optimistic', width: 0 },
              { key: 'balance', color: 'var(--accent)', label: 'Expected', width: 2.5 },
              { key: 'balLow', color: 'rgba(251,191,36,0.15)', fill: true, label: 'Pessimistic', width: 0 },
              ...(showInflation ? [{ key: 'real', color: 'var(--blue)', label: 'Inflation-adjusted', dash: '6 4' }] : []),
              { key: 'contributed', color: 'var(--warn)', label: 'Contributions', dash: '5 4', width: 1.5 },
              ...(showWhatIf ? [{ key: 'whatIf', color: '#A78BFA', label: 'What-If', dash: '8 4', width: 2 }] : []),
            ]} yMax={maxBal} />
          </Card>

          {/* Milestones */}
          {milestones.length > 0 && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(45,212,191,0.04)', border: '1px solid rgba(45,212,191,0.12)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{'📍'} Milestones:</span>{' '}
              {milestones.map((m, i) => (
                <span key={m.amount}>
                  {i > 0 && ' \u00B7 '}
                  <strong style={{ color: 'var(--accent)' }}>{fmt(m.amount)}</strong> at age {m.age}
                </span>
              ))}
            </div>
          )}

          {/* What-If Comparison */}
          <Card variant="output" style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showWhatIf ? 12 : 0 }}>
              <SectionLabel icon="🤔">What-If Comparison</SectionLabel>
              <button onClick={() => setShowWhatIf(!showWhatIf)} style={{
                ...btnStyle(showWhatIf),
                padding: '8px 16px',
              }}>
                {showWhatIf ? 'Hide What-If' : 'Compare Scenario'}
              </button>
            </div>
            {showWhatIf && (
              <div>
                <Slider label="Extra Monthly Savings" value={extraMonthly} onChange={setExtraMonthly} min={0} max={3000} step={50} format={fmt} />
                <Slider label="Extra Years Working" value={extraYears} onChange={setExtraYears} min={0} max={10} suffix=" yrs" />
                <Slider label="Alternative Return Rate" value={altReturn} onChange={setAltReturn} min={3} max={12} step={0.5} suffix="%" />

                {whatIfFinal && whatIfDelta > 0 && (
                  <div style={{
                    marginTop: 12, padding: '14px 16px', borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(52,211,153,0.06) 100%)',
                    border: '1.5px solid rgba(167,139,250,0.25)',
                  }}>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--serif)', color: '#A78BFA' }}>
                      +{fmt(whatIfDelta)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>
                      {extraMonthly > 0 && <>Saving <strong style={{ color: 'var(--text)' }}>{fmt(extraMonthly)} more/mo</strong></>}
                      {extraYears > 0 && <>{extraMonthly > 0 ? ' + ' : ''}working <strong style={{ color: 'var(--text)' }}>{extraYears} more year{extraYears !== 1 ? 's' : ''}</strong></>}
                      {altReturn !== returnRate && <>{(extraMonthly > 0 || extraYears > 0) ? ' + ' : ''}<strong style={{ color: 'var(--text)' }}>{altReturn}% returns</strong> (vs {returnRate}%)</>}
                      {' '}\u2192 <strong style={{ color: '#A78BFA' }}>{fmt(whatIfFinal.whatIf)}</strong> total (+{whatIfDeltaPct}%)
                    </div>
                  </div>
                )}
                {whatIfFinal && whatIfDelta <= 0 && (
                  <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 8, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', fontSize: 12, color: 'var(--text-muted)' }}>
                    The what-if scenario does not improve on the base case. Try increasing savings or years.
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Cost of Delay */}
          {costOfDelay > 0 && years > 5 && (
            <Card style={{ marginTop: 14, background: 'linear-gradient(135deg, rgba(239,68,68,0.04) 0%, var(--card) 100%)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <SectionLabel icon="\u23F3">Cost of Waiting 5 Years</SectionLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--danger)' }}>-{fmt(costOfDelay)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>lost by delaying 5 years</div>
                </div>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  If you wait until age <strong style={{ color: 'var(--text)' }}>{age + 5}</strong> to start contributing (but keep existing savings invested),
                  you lose <strong style={{ color: 'var(--danger)' }}>{fmt(costOfDelay)}</strong> \u2014 that is{' '}
                  <strong style={{ color: 'var(--danger)' }}>{fmt(costOfDelay / 60)}/month</strong> for every month you delay.
                  Time in the market beats timing the market.
                </div>
              </div>
            </Card>
          )}

          {annualMatchNow > 0 && contribution401k < 6 && (
            <InfoBox icon="💡" title="Tip: Maximize Your Match" style={{ marginTop: 14 }}>
              You may be leaving free money on the table. Consider increasing your 401(k) contribution to at least capture the full employer match.
            </InfoBox>
          )}

          {/* Bridge to Monte Carlo */}
          <button
            onClick={() => {
              localStorage.setItem('growthToMonteCarlo', JSON.stringify({
                age, retireAge, savings: totalSavings, monthly: totalMonthlyNow,
                salaryGrowth, annualSpend: Math.round(monthlyIncome * 12),
              }));
              window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'montecarlo' }));
            }}
            style={{
              width: '100%', marginTop: 14, padding: '14px 24px', borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(52,211,153,0.10) 100%)',
              border: '1.5px solid rgba(139,92,246,0.3)', cursor: 'pointer', transition: 'all .2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <span style={{ fontSize: 20 }}>{'🎲'}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--sans)' }}>
                Stress-Test with Monte Carlo \u2192
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Run 1,000 market simulations with these numbers
              </div>
            </div>
          </button>

          {/* Save Plan */}
          <SavePlanButton
            tabName="Growth Projection"
            getCurrentSettings={() => ({
              type: 'growth_projector',
              ...inputs,
              currentSavings: totalSavings,
              monthlyContribution: totalMonthlyNow,
              projectedTotal: Math.round(final.balance),
            })}
          />
        </div>
      </div>
    </div>
  );
}
