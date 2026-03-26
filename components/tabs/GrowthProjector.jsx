'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import MiniChart from '@/components/ui/MiniChart';
import { fmt } from '@/lib/format';

const MATCH_TYPES = [
  { id: 'none', label: 'No Match' },
  { id: '50_6', label: '50% up to 6%' },
  { id: '100_3', label: '100% up to 3%' },
  { id: '100_4', label: '100% up to 4%' },
  { id: '100_6', label: '100% up to 6%' },
  { id: 'custom', label: 'Custom' },
];

const PROFILES = [
  { id: 'fresh_grad', label: '🎓 Fresh Graduate', desc: 'Age 22, starting career, entry-level salary', age: 22, retireAge: 65, savings401k: 0, savingsOther: 5000, salary: 55000, contribution401k: 6, matchType: '50_6', monthlyOther: 100, returnRate: 7 },
  { id: 'late_start', label: '⏰ Late Starter (35)', desc: 'Playing catch-up, moderate savings', age: 35, retireAge: 67, savings401k: 15000, savingsOther: 10000, salary: 75000, contribution401k: 10, matchType: '50_6', monthlyOther: 300, returnRate: 7 },
  { id: 'mid_career', label: '💼 Mid-Career Pro', desc: 'Age 40, solid income, steady saver', age: 40, retireAge: 65, savings401k: 150000, savingsOther: 50000, salary: 120000, contribution401k: 15, matchType: '100_4', monthlyOther: 500, returnRate: 7 },
  { id: 'high_earner', label: '🚀 High Earner', desc: 'Age 35, tech/finance salary, maxing out', age: 35, retireAge: 60, savings401k: 250000, savingsOther: 150000, salary: 250000, contribution401k: 25, matchType: '100_6', monthlyOther: 2000, returnRate: 7 },
  { id: 'couple_dual', label: '👫 Dual-Income Couple', desc: 'Combined household, age 32', age: 32, retireAge: 62, savings401k: 80000, savingsOther: 60000, salary: 180000, contribution401k: 12, matchType: '100_3', monthlyOther: 1000, returnRate: 7 },
  { id: 'pre_retire', label: '🏖️ Pre-Retiree (55)', desc: 'Final stretch, maximizing contributions', age: 55, retireAge: 67, savings401k: 600000, savingsOther: 200000, salary: 140000, contribution401k: 25, matchType: '100_4', monthlyOther: 1500, returnRate: 6 },
  { id: 'conservative', label: '🛡️ Conservative Saver', desc: 'Low risk tolerance, bonds-heavy', age: 45, retireAge: 67, savings401k: 200000, savingsOther: 100000, salary: 90000, contribution401k: 10, matchType: '50_6', monthlyOther: 400, returnRate: 5 },
  { id: 'aggressive', label: '🔥 Aggressive FIRE', desc: 'Financial Independence, Retire Early', age: 28, retireAge: 45, savings401k: 60000, savingsOther: 80000, salary: 130000, contribution401k: 25, matchType: '100_6', monthlyOther: 3000, returnRate: 8 },
  { id: 'teacher', label: '📚 Teacher / Public Sector', desc: 'Pension supplement, modest salary', age: 30, retireAge: 62, savings401k: 20000, savingsOther: 8000, salary: 55000, contribution401k: 8, matchType: '100_3', monthlyOther: 150, returnRate: 7 },
  { id: 'small_biz', label: '🏪 Small Business Owner', desc: 'Self-employed, SEP-IRA, variable income', age: 38, retireAge: 65, savings401k: 100000, savingsOther: 75000, salary: 110000, contribution401k: 20, matchType: 'none', monthlyOther: 800, returnRate: 7 },
];

function calcMatch(matchType, salary, customPct, customCap) {
  if (matchType === 'none') return 0;
  if (matchType === 'custom') return Math.min(salary * (customPct / 100), salary * (customCap / 100));
  const [rate, cap] = matchType.split('_').map(Number);
  const matchRate = rate / 100;
  const capPct = cap / 100;
  return salary * capPct * matchRate;
}

export default function GrowthProjector() {
  const [age, setAge] = useState(35);
  const [retireAge, setRetireAge] = useState(65);
  const [savings401k, setSavings401k] = useState(30000);
  const [savingsOther, setSavingsOther] = useState(20000);
  const [salary, setSalary] = useState(85000);
  const [contribution401k, setContribution401k] = useState(10);
  const [matchType, setMatchType] = useState('50_6');
  const [customMatchPct, setCustomMatchPct] = useState(50);
  const [customMatchCap, setCustomMatchCap] = useState(6);
  const [monthlyOther, setMonthlyOther] = useState(200);
  const [returnRate, setReturnRate] = useState(7);
  const [showInflation, setShowInflation] = useState(false);
  const [activeProfile, setActiveProfile] = useState(null);
  const inflation = 2.5;

  function applyProfile(p) {
    setActiveProfile(p.id);
    setAge(p.age); setRetireAge(p.retireAge);
    setSavings401k(p.savings401k); setSavingsOther(p.savingsOther);
    setSalary(p.salary); setContribution401k(p.contribution401k);
    setMatchType(p.matchType); setMonthlyOther(p.monthlyOther);
    setReturnRate(p.returnRate);
  }

  const totalSavings = savings401k + savingsOther;
  const annual401k = Math.min(salary * (contribution401k / 100), 23500); // 2025 limit
  const annualMatch = calcMatch(matchType, salary, customMatchPct, customMatchCap);
  const monthly401kTotal = (annual401k + annualMatch) / 12;
  const totalMonthly = monthly401kTotal + monthlyOther;

  const data = useMemo(() => {
    const years = retireAge - age;
    const r = returnRate / 100;
    const ri = (returnRate - inflation) / 100;
    const annualContrib = totalMonthly * 12;
    const pts = [];
    let bal = totalSavings, balR = totalSavings;
    let bal401k = savings401k, balOther = savingsOther;
    for (let y = 0; y <= years; y++) {
      const c = totalSavings + annualContrib * y;
      pts.push({ year: y, age: age + y, balance: bal, real: balR, contributed: c, bal401k, balOther });
      bal = bal * (1 + r) + annualContrib;
      balR = balR * (1 + ri) + annualContrib;
      bal401k = bal401k * (1 + r) + (annual401k + annualMatch);
      balOther = balOther * (1 + r) + monthlyOther * 12;
    }
    return pts;
  }, [age, retireAge, totalSavings, savings401k, savingsOther, totalMonthly, annual401k, annualMatch, monthlyOther, returnRate, inflation]);

  const final = data[data.length - 1] || {};
  const totalC = totalSavings + totalMonthly * 12 * (retireAge - age);
  const growth = final.balance - totalC;
  const monthlyIncome = (final.balance * 0.04) / 12;
  const maxBal = Math.max(...data.map(d => d.balance));
  const totalMatchLifetime = annualMatch * (retireAge - age);

  const btnStyle = (active) => ({
    padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
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
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--heading)', fontFamily: 'var(--sans)' }}>{p.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--sans)' }}>{p.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 32 }}>
        <div>
          <Card>
            <SectionLabel>Your Details</SectionLabel>
            <Slider label="Current Age" value={age} onChange={v => { setAge(v); if (retireAge <= v + 5) setRetireAge(v + 5); }} min={18} max={60} suffix=" yrs" />
            <Slider label="Retirement Age" value={retireAge} onChange={setRetireAge} min={Math.max(age + 5, 50)} max={80} suffix=" yrs" />
            <Slider label="Annual Salary" value={salary} onChange={setSalary} min={20000} max={500000} step={5000} format={fmt} />
          </Card>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel icon="🏦">401(k) / Employer Plan</SectionLabel>
            <Slider label="Current 401(k) Balance" value={savings401k} onChange={setSavings401k} min={0} max={3000000} step={5000} format={fmt} />
            <Slider label="Your Contribution" value={contribution401k} onChange={setContribution401k} min={0} max={25} step={1} suffix="% of salary" />
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: -4, marginBottom: 10 }}>
              = {fmt(annual401k / 12)}/mo ({fmt(annual401k)}/yr) · 2025 limit: $23,500
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

            {annualMatch > 0 && (
              <div style={{
                marginTop: 10, padding: '10px 14px', borderRadius: 8,
                background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.2)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
                  🎉 Free money: {fmt(annualMatch)}/yr ({fmt(annualMatch / 12)}/mo)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  Employer match over {retireAge - age} years = <strong style={{ color: 'var(--accent)' }}>{fmt(totalMatchLifetime)}</strong> in contributions alone
                </div>
              </div>
            )}
          </Card>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel icon="💼">Other Savings (IRA, Brokerage, etc.)</SectionLabel>
            <Slider label="Current Other Savings" value={savingsOther} onChange={setSavingsOther} min={0} max={3000000} step={5000} format={fmt} />
            <Slider label="Monthly Other Contribution" value={monthlyOther} onChange={setMonthlyOther} min={0} max={5000} step={50} format={fmt} />
          </Card>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel icon="📈">Assumptions</SectionLabel>
            <Slider label="Expected Annual Return" value={returnRate} onChange={setReturnRate} min={3} max={12} step={0.5} suffix="%" tooltip="S&P 500 avg ~10%, after inflation ~7%" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={showInflation} onChange={e => setShowInflation(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
              Show inflation-adjusted ({inflation}%)
            </label>
          </Card>
        </div>

        <div>
          {/* Summary stats */}
          <div className="stats-row" style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <Stat icon="🎯" label="At Retirement" value={fmt(final.balance)} sub={showInflation ? `${fmt(final.real)} in today's $` : `in ${retireAge - age} years`} />
            <Stat icon="💰" label="You Contribute" value={fmt(totalC)} color="var(--warn)" />
            <Stat icon="🏖️" label="Monthly Income (4%)" value={fmt(monthlyIncome)} color="var(--blue)" />
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                <span>Your contrib: {fmt(annual401k)}/yr</span>
                <span>Match: {fmt(annualMatch)}/yr</span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                <span>IRA / Brokerage / HSA</span>
                <span>{fmt(monthlyOther)}/mo</span>
              </div>
            </Card>
          </div>

          {/* Monthly contribution breakdown */}
          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Monthly Contribution Breakdown</SectionLabel>
            <div style={{ display: 'flex', gap: 4, height: 28, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
              {annual401k > 0 && (
                <div style={{ flex: annual401k / 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                  You: {fmt(annual401k / 12)}
                </div>
              )}
              {annualMatch > 0 && (
                <div style={{ flex: annualMatch / 12, background: 'rgba(52,211,153,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                  Match: {fmt(annualMatch / 12)}
                </div>
              )}
              {monthlyOther > 0 && (
                <div style={{ flex: monthlyOther, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                  Other: {fmt(monthlyOther)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Total: <strong style={{ color: 'var(--text)' }}>{fmt(totalMonthly)}/mo</strong></span>
              <span>{fmt(totalMonthly * 12)}/yr</span>
              <span>Savings rate: <strong style={{ color: salary > 0 ? (totalMonthly * 12 / salary >= 0.2 ? 'var(--accent)' : 'var(--warn)') : 'var(--text-dim)' }}>{salary > 0 ? ((totalMonthly * 12 / salary) * 100).toFixed(0) : 0}%</strong></span>
            </div>
          </Card>

          <Stat icon="📈" label="Market Growth" value={fmt(growth)} sub={`${((growth / totalC) * 100).toFixed(0)}% return on contributions`} color="var(--blue)" />

          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Portfolio Growth Over Time</SectionLabel>
            <MiniChart data={data} height={220} lines={[
              { key: 'balance', color: 'var(--accent)', label: 'Total balance', width: 2.5 },
              ...(showInflation ? [{ key: 'real', color: 'var(--blue)', label: 'Inflation-adjusted', dash: '6 4' }] : []),
              { key: 'contributed', color: 'var(--warn)', label: 'Contributions', dash: '5 4', width: 1.5 },
            ]} yMax={maxBal} />
          </Card>

          {annualMatch > 0 && contribution401k < 6 && (
            <InfoBox icon="💡" title="Tip: Maximize Your Match" style={{ marginTop: 14 }}>
              You may be leaving free money on the table. Consider increasing your 401(k) contribution to at least capture the full employer match.
            </InfoBox>
          )}
        </div>
      </div>
    </div>
  );
}
