'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import MiniChart from '@/components/ui/MiniChart';
import ValidationWarning from '@/components/ui/ValidationWarning';
import { fmt, fmtFull } from '@/lib/format';
import { MAX_401K_CONTRIBUTION, CATCHUP_401K_CONTRIBUTION } from '@/lib/constants';

const MATCH_TYPES = [
  { id: 'none', label: 'No Match' },
  { id: '50_6', label: '50% up to 6%' },
  { id: '100_3', label: '100% up to 3%' },
  { id: '100_4', label: '100% up to 4%' },
  { id: '100_6', label: '100% up to 6%' },
  { id: 'custom', label: 'Custom' },
];

const PROFILES = [
  { id: 'fresh_grad', label: '🎓 Fresh Graduate', desc: 'Age 22, starting career, entry-level salary', age: 22, retireAge: 65, savings401k: 0, savingsOther: 5000, salary: 55000, contribution401k: 6, matchType: '50_6', monthlyOther: 100, returnRate: 7, salaryGrowth: 4 },
  { id: 'late_start', label: '⏰ Late Starter (35)', desc: 'Playing catch-up, moderate savings', age: 35, retireAge: 67, savings401k: 15000, savingsOther: 10000, salary: 75000, contribution401k: 10, matchType: '50_6', monthlyOther: 300, returnRate: 7, salaryGrowth: 3 },
  { id: 'mid_career', label: '💼 Mid-Career Pro', desc: 'Age 40, solid income, steady saver', age: 40, retireAge: 65, savings401k: 150000, savingsOther: 50000, salary: 120000, contribution401k: 15, matchType: '100_4', monthlyOther: 500, returnRate: 7, salaryGrowth: 2.5 },
  { id: 'high_earner', label: '🚀 High Earner', desc: 'Age 35, tech/finance salary, maxing out', age: 35, retireAge: 60, savings401k: 250000, savingsOther: 150000, salary: 250000, contribution401k: 25, matchType: '100_6', monthlyOther: 2000, returnRate: 7, salaryGrowth: 2 },
  { id: 'couple_dual', label: '👫 Dual-Income Couple', desc: 'Combined household, age 32', age: 32, retireAge: 62, savings401k: 80000, savingsOther: 60000, salary: 180000, contribution401k: 12, matchType: '100_3', monthlyOther: 1000, returnRate: 7, salaryGrowth: 3 },
  { id: 'pre_retire', label: '🏖️ Pre-Retiree (55)', desc: 'Final stretch, maximizing contributions', age: 55, retireAge: 67, savings401k: 600000, savingsOther: 200000, salary: 140000, contribution401k: 25, matchType: '100_4', monthlyOther: 1500, returnRate: 6, salaryGrowth: 1 },
  { id: 'conservative', label: '🛡️ Conservative Saver', desc: 'Low risk tolerance, bonds-heavy', age: 45, retireAge: 67, savings401k: 200000, savingsOther: 100000, salary: 90000, contribution401k: 10, matchType: '50_6', monthlyOther: 400, returnRate: 5, salaryGrowth: 2 },
  { id: 'aggressive', label: '🔥 Aggressive FIRE', desc: 'Financial Independence, Retire Early', age: 28, retireAge: 45, savings401k: 60000, savingsOther: 80000, salary: 130000, contribution401k: 25, matchType: '100_6', monthlyOther: 3000, returnRate: 8, salaryGrowth: 5 },
  { id: 'teacher', label: '📚 Teacher / Public Sector', desc: 'Pension supplement, modest salary', age: 30, retireAge: 62, savings401k: 20000, savingsOther: 8000, salary: 55000, contribution401k: 8, matchType: '100_3', monthlyOther: 150, returnRate: 7, salaryGrowth: 2 },
  { id: 'small_biz', label: '🏪 Small Business Owner', desc: 'Self-employed, SEP-IRA, variable income', age: 38, retireAge: 65, savings401k: 100000, savingsOther: 75000, salary: 110000, contribution401k: 20, matchType: 'none', monthlyOther: 800, returnRate: 7, salaryGrowth: 3 },
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

export default function GrowthProjector() {
  const [age, setAge] = useState(35);
  const [retireAge, setRetireAge] = useState(65);
  const [savings401k, setSavings401k] = useState(30000);
  const [savingsOther, setSavingsOther] = useState(20000);
  const [salary, setSalary] = useState(85000);
  const [salaryGrowth, setSalaryGrowth] = useState(3);
  const [contribution401k, setContribution401k] = useState(10);
  const [matchType, setMatchType] = useState('50_6');
  const [customMatchPct, setCustomMatchPct] = useState(50);
  const [customMatchCap, setCustomMatchCap] = useState(6);
  const [monthlyOther, setMonthlyOther] = useState(200);
  const [returnRate, setReturnRate] = useState(7);
  const [showInflation, setShowInflation] = useState(false);
  const [taxBracket, setTaxBracket] = useState(22);
  const [activeProfile, setActiveProfile] = useState(null);
  const inflation = 2.5;
  const stdDev = 0.15; // Market std dev for confidence bands

  function applyProfile(p) {
    setActiveProfile(p.id);
    setAge(p.age); setRetireAge(p.retireAge);
    setSavings401k(p.savings401k); setSavingsOther(p.savingsOther);
    setSalary(p.salary); setContribution401k(p.contribution401k);
    setMatchType(p.matchType); setMonthlyOther(p.monthlyOther);
    setReturnRate(p.returnRate); setSalaryGrowth(p.salaryGrowth || 3);
  }

  const totalSavings = savings401k + savingsOther;
  const years = retireAge - age;

  // Current year calculations (for display)
  const limit401k = age >= 50 ? MAX_401K_CONTRIBUTION + CATCHUP_401K_CONTRIBUTION : MAX_401K_CONTRIBUTION;
  const annual401kNow = Math.min(salary * (contribution401k / 100), limit401k);
  const annualMatchNow = calcMatch(matchType, salary, contribution401k, customMatchPct, customMatchCap);
  const monthlyOtherNow = monthlyOther;
  const totalMonthlyNow = (annual401kNow + annualMatchNow) / 12 + monthlyOther;
  const employeeMonthlyNow = (annual401kNow / 12) + monthlyOther;

  // ── Main projection with salary growth ──
  const data = useMemo(() => {
    const monthlyRate = returnRate / 100 / 12;
    const monthlyRateReal = (returnRate - inflation) / 100 / 12;
    const pts = [];
    let bal = totalSavings, balR = totalSavings;
    let bal401k = savings401k, balOther = savingsOther;
    let totalContrib = totalSavings;
    let curSalary = salary;
    let curOther = monthlyOther;
    // Confidence bands
    let balHigh = totalSavings, balLow = totalSavings;
    const highRate = (returnRate + stdDev * 100 * 0.5) / 100 / 12; // +1 std dev annualized
    const lowRate = (returnRate - stdDev * 100 * 0.5) / 100 / 12;  // -1 std dev annualized

    for (let y = 0; y <= years; y++) {
      const curAge = age + y;
      const yearLimit = curAge >= 50 ? MAX_401K_CONTRIBUTION + CATCHUP_401K_CONTRIBUTION : MAX_401K_CONTRIBUTION;
      const annual401k = Math.min(curSalary * (contribution401k / 100), yearLimit);
      const annualMatch = calcMatch(matchType, curSalary, contribution401k, customMatchPct, customMatchCap);
      const monthly401kContrib = (annual401k + annualMatch) / 12;
      const totalMonthly = monthly401kContrib + curOther;

      pts.push({
        year: y, age: curAge, balance: bal, real: balR, contributed: totalContrib,
        bal401k, balOther, salary: curSalary, balHigh, balLow,
      });

      // Monthly compounding for this year
      for (let m = 0; m < 12; m++) {
        bal = bal * (1 + monthlyRate) + totalMonthly;
        balR = balR * (1 + monthlyRateReal) + totalMonthly;
        bal401k = bal401k * (1 + monthlyRate) + monthly401kContrib;
        balOther = balOther * (1 + monthlyRate) + curOther;
        balHigh = balHigh * (1 + highRate) + totalMonthly;
        balLow = Math.max(0, balLow * (1 + lowRate) + totalMonthly);
      }
      totalContrib += totalMonthly * 12;

      // Grow salary and other contributions for next year
      curSalary = curSalary * (1 + salaryGrowth / 100);
      curOther = curOther * (1 + salaryGrowth / 100);
    }
    return pts;
  }, [age, retireAge, totalSavings, savings401k, savingsOther, salary, salaryGrowth,
      contribution401k, matchType, customMatchPct, customMatchCap, monthlyOther, returnRate, inflation, stdDev, years]);

  const final = data[data.length - 1] || {};
  const totalC = final.contributed || totalSavings;
  const growth = final.balance - totalC;
  const retirementYears = 90 - retireAge; // plan to 90
  const swr = safeWithdrawalRate(retirementYears);
  const monthlyIncome = (final.balance * swr / 100) / 12;
  const maxBal = Math.max(...data.map(d => d.balHigh || d.balance));
  const totalMatchLifetime = data.reduce((sum, d, i) => {
    if (i === 0) return 0;
    const s = data[i - 1].salary;
    return sum + calcMatch(matchType, s, contribution401k, customMatchPct, customMatchCap);
  }, 0);

  // After-tax equivalents
  const after401k = final.bal401k * (1 - taxBracket / 100);
  const afterOther = final.balOther * 0.85; // ~15% LTCG avg
  const afterTotal = after401k + afterOther;

  // Cost of delay: what if you wait 5 years?
  const costOfDelay = useMemo(() => {
    if (years <= 5) return 0;
    const monthlyRate = returnRate / 100 / 12;
    let bal = totalSavings;
    let curSalary = salary;
    let curOther = monthlyOther;
    // Compound for 5 years with NO contributions, salary still grows
    for (let y = 0; y < 5; y++) {
      for (let m = 0; m < 12; m++) {
        bal = bal * (1 + monthlyRate); // growth only, no contributions
      }
      curSalary = curSalary * (1 + salaryGrowth / 100);
      curOther = curOther * (1 + salaryGrowth / 100);
    }
    // Then contribute for remaining years
    for (let y = 5; y < years; y++) {
      const curAge = age + y;
      const yearLimit = curAge >= 50 ? MAX_401K_CONTRIBUTION + CATCHUP_401K_CONTRIBUTION : MAX_401K_CONTRIBUTION;
      const annual401k = Math.min(curSalary * (contribution401k / 100), yearLimit);
      const annualMatch = calcMatch(matchType, curSalary, contribution401k, customMatchPct, customMatchCap);
      const totalMonthly = (annual401k + annualMatch) / 12 + curOther;
      for (let m = 0; m < 12; m++) {
        bal = bal * (1 + monthlyRate) + totalMonthly;
      }
      curSalary = curSalary * (1 + salaryGrowth / 100);
      curOther = curOther * (1 + salaryGrowth / 100);
    }
    return Math.max(0, final.balance - bal);
  }, [final.balance, years, totalSavings, salary, salaryGrowth, monthlyOther, returnRate,
      age, contribution401k, matchType, customMatchPct, customMatchCap]);

  // Warnings
  const warnings = useMemo(() => {
    const w = [];
    if (years < 10) w.push('Very short time horizon — consider working longer for more compounding.');
    if (salary > 0 && contribution401k === 0 && monthlyOther === 0) w.push('No contributions — savings will only grow from existing balance.');
    if (employeeMonthlyNow > salary / 12 * 0.5) w.push('Saving over 50% of gross income — make sure this is realistic.');
    if (monthlyIncome < 2000) w.push('Projected retirement income under $2K/mo — you may need to save more.');
    return w;
  }, [years, salary, contribution401k, monthlyOther, employeeMonthlyNow, monthlyIncome]);

  const btnStyle = (active) => ({
    padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--bg)' : 'var(--text-muted)',
    cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)',
    transition: 'all .2s',
  });

  return (
    <div className="fade-up">
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel icon="👤">Quick Profiles — Pick one to auto-fill, then customize</SectionLabel>
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

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 32 }}>
        <div>
          <Card>
            <SectionLabel>Your Details</SectionLabel>
            <Slider label="Current Age" value={age} onChange={v => { setAge(v); if (retireAge <= v + 5) setRetireAge(v + 5); }} min={18} max={60} suffix=" yrs" />
            <Slider label="Retirement Age" value={retireAge} onChange={setRetireAge} min={Math.max(age + 5, 50)} max={80} suffix=" yrs" />
            <Slider label="Annual Salary" value={salary} onChange={setSalary} min={20000} max={500000} step={5000} format={fmt} />
            <Slider label="Salary Growth" value={salaryGrowth} onChange={setSalaryGrowth} min={0} max={8} step={0.5} suffix="%/yr" />
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -4, marginBottom: 6 }}>
              Salary at retirement: {fmt(salary * Math.pow(1 + salaryGrowth / 100, years))} · Avg US: ~3%/yr
            </div>
          </Card>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel icon="🏦">401(k) / Employer Plan</SectionLabel>
            <Slider label="Current 401(k) Balance" value={savings401k} onChange={setSavings401k} min={0} max={3000000} step={5000} format={fmt} />
            <Slider label="Your Contribution" value={contribution401k} onChange={setContribution401k} min={0} max={25} step={1} suffix="% of salary" />
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: -4, marginBottom: 10 }}>
              = {fmt(annual401kNow / 12)}/mo ({fmt(annual401kNow)}/yr) · 2025 limit: ${limit401k.toLocaleString()}{age >= 50 ? ' (incl. catch-up)' : ''}
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
                  🎉 Free money: {fmt(annualMatchNow)}/yr ({fmt(annualMatchNow / 12)}/mo)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  Lifetime match (with salary growth): <strong style={{ color: 'var(--accent)' }}>{fmt(totalMatchLifetime)}</strong>
                </div>
              </div>
            )}
          </Card>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel icon="💼">Other Savings (IRA, Brokerage, etc.)</SectionLabel>
            <Slider label="Current Other Savings" value={savingsOther} onChange={setSavingsOther} min={0} max={3000000} step={5000} format={fmt} />
            <Slider label="Monthly Other Contribution" value={monthlyOther} onChange={setMonthlyOther} min={0} max={5000} step={50} format={fmt} />
            {salaryGrowth > 0 && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -4 }}>Grows with salary: {fmt(monthlyOther)}/mo now → {fmt(monthlyOther * Math.pow(1 + salaryGrowth / 100, years))}/mo at retirement</div>}
          </Card>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel icon="📈">Assumptions</SectionLabel>
            <Slider label="Expected Annual Return" value={returnRate} onChange={setReturnRate} min={3} max={12} step={0.5} suffix="%" />
            <Slider label="Retirement Tax Bracket" value={taxBracket} onChange={setTaxBracket} min={10} max={37} step={1} suffix="%" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={showInflation} onChange={e => setShowInflation(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
              Show inflation-adjusted ({inflation}%)
            </label>
          </Card>
        </div>

        <div>
          {/* Summary stats */}
          <div className="stats-row" style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <Stat icon="🎯" label="At Retirement" value={fmt(final.balance)} sub={showInflation ? `${fmt(final.real)} in today's $` : `in ${years} years`} />
            <Stat icon="💰" label="You Contribute" value={fmt(totalC)} color="var(--warn)" />
            <Stat icon="🏖️" label={`Monthly Income (${swr}%)`} value={fmt(monthlyIncome)} color="var(--blue)" sub={retirementYears > 30 ? 'Lower rate for longer retirement' : 'Standard 4% rule'} />
          </div>

          {/* Confidence range */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <Card style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Pessimistic (-1σ)</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--warn)' }}>{fmt(final.balLow)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{fmt((final.balLow * swr / 100) / 12)}/mo income</div>
            </Card>
            <Card style={{ flex: 1, textAlign: 'center', padding: '12px 8px', border: '1.5px solid var(--accent)' }}>
              <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Expected</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--accent)' }}>{fmt(final.balance)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{fmt(monthlyIncome)}/mo income</div>
            </Card>
            <Card style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Optimistic (+1σ)</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--blue)' }}>{fmt(final.balHigh)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{fmt((final.balHigh * swr / 100) / 12)}/mo income</div>
            </Card>
          </div>

          {/* Account breakdown */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <Card style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>🏦</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>401(K) AT RETIREMENT</div>
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
            <Card style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>💼</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>OTHER AT RETIREMENT</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--blue)' }}>{fmt(final.balOther)}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>After ~15% LTCG:</span>
                  <strong style={{ color: 'var(--blue)' }}>{fmt(afterOther)}</strong>
                </div>
              </div>
            </Card>
          </div>

          {/* After-tax total */}
          <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>AFTER-TAX SPENDING POWER</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>401(k) taxed at {taxBracket}% ordinary income · Other at ~15% LTCG</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--warn)' }}>{fmt(afterTotal)}</div>
          </div>

          {/* Monthly contribution breakdown */}
          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Monthly Contribution Breakdown</SectionLabel>
            <div style={{ display: 'flex', gap: 4, height: 28, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
              {annual401kNow > 0 && (
                <div style={{ flex: annual401kNow / 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                  You: {fmt(annual401kNow / 12)}
                </div>
              )}
              {annualMatchNow > 0 && (
                <div style={{ flex: annualMatchNow / 12, background: 'rgba(52,211,153,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                  Match: {fmt(annualMatchNow / 12)}
                </div>
              )}
              {monthlyOther > 0 && (
                <div style={{ flex: monthlyOther, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                  Other: {fmt(monthlyOther)}
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
          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Portfolio Growth Over Time</SectionLabel>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>
              Shaded area = ±1 standard deviation (68% probability range)
            </div>
            <MiniChart data={data} height={220} lines={[
              { key: 'balHigh', color: 'rgba(96,165,250,0.15)', fill: true, label: 'Optimistic', width: 0 },
              { key: 'balance', color: 'var(--accent)', label: 'Expected', width: 2.5 },
              { key: 'balLow', color: 'rgba(251,191,36,0.15)', fill: true, label: 'Pessimistic', width: 0 },
              ...(showInflation ? [{ key: 'real', color: 'var(--blue)', label: 'Inflation-adjusted', dash: '6 4' }] : []),
              { key: 'contributed', color: 'var(--warn)', label: 'Contributions', dash: '5 4', width: 1.5 },
            ]} yMax={maxBal} />
          </Card>

          {/* Cost of Delay */}
          {costOfDelay > 0 && years > 5 && (
            <Card style={{ marginTop: 14, background: 'linear-gradient(135deg, rgba(239,68,68,0.04) 0%, var(--card) 100%)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <SectionLabel icon="⏳">Cost of Waiting 5 Years</SectionLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--danger)' }}>-{fmt(costOfDelay)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>lost by delaying 5 years</div>
                </div>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  If you wait until age <strong style={{ color: 'var(--text)' }}>{age + 5}</strong> to start contributing (but keep existing savings invested),
                  you lose <strong style={{ color: 'var(--danger)' }}>{fmt(costOfDelay)}</strong> — that is{' '}
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
        </div>
      </div>
    </div>
  );
}
