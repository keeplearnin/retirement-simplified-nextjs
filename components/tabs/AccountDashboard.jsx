'use client';

import { useState, useMemo, useRef } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import Donut from '@/components/ui/Donut';
import { fmt, fmtFull } from '@/lib/format';
import { ASSET_CLASSES, ACCOUNT_TYPES, RISK_LABELS } from '@/lib/constants';
import { computeTarget } from '@/lib/allocation';

const INSTITUTIONS = ['Vanguard', 'Fidelity', 'Schwab', 'Other'];

export default function AccountDashboard() {
  const idCounter = useRef(0);
  const [accounts, setAccounts] = useState([]);
  const [newAccount, setNewAccount] = useState({ name: '', type: '401k', institution: 'Vanguard', balance: '' });
  const [age, setAge] = useState(35);
  const [risk, setRisk] = useState(3);
  const [retirementGoal, setRetirementGoal] = useState(1500000);
  const [monthlyIncome, setMonthlyIncome] = useState(8000);
  const [monthlySavings, setMonthlySavings] = useState(1500);
  const [settingsOpen, setSettingsOpen] = useState(false);

  function addAccount() {
    const bal = parseFloat(newAccount.balance);
    if (!newAccount.name || !bal || bal <= 0) return;
    setAccounts(a => [...a, {
      id: ++idCounter.current,
      name: newAccount.name,
      type: newAccount.type,
      institution: newAccount.institution,
      balance: bal,
      holdings: [],
    }]);
    setNewAccount({ name: '', type: '401k', institution: 'Vanguard', balance: '' });
  }

  function removeAccount(id) {
    setAccounts(a => a.filter(x => x.id !== id));
  }

  const totalNetWorth = useMemo(() => accounts.reduce((s, a) => s + a.balance, 0), [accounts]);

  const taxBreakdown = useMemo(() => {
    const result = { taxDeferred: 0, taxFree: 0, taxable: 0 };
    accounts.forEach(acct => {
      const acctType = ACCOUNT_TYPES.find(t => t.id === acct.type);
      if (!acctType) return;
      if (acctType.taxType === 'tax-deferred') result.taxDeferred += acct.balance;
      else if (acctType.taxType === 'tax-free') result.taxFree += acct.balance;
      else result.taxable += acct.balance;
    });
    return result;
  }, [accounts]);

  const savingsRate = useMemo(() => {
    if (monthlyIncome <= 0) return 0;
    return (monthlySavings / monthlyIncome) * 100;
  }, [monthlySavings, monthlyIncome]);

  const target = useMemo(() => computeTarget(age, risk), [age, risk]);

  const retirementProgress = useMemo(() => {
    if (retirementGoal <= 0) return 0;
    return (totalNetWorth / retirementGoal) * 100;
  }, [totalNetWorth, retirementGoal]);

  const milestones = useMemo(() => {
    return [25, 50, 75, 100].map(pct => ({
      pct,
      label: `${pct}%`,
      amount: retirementGoal * (pct / 100),
      achieved: retirementProgress >= pct,
    }));
  }, [retirementGoal, retirementProgress]);

  // Donut segments for account types
  const accountTypeSegs = useMemo(() => {
    if (totalNetWorth === 0) return [];
    const grouped = {};
    accounts.forEach(acct => {
      if (!grouped[acct.type]) grouped[acct.type] = 0;
      grouped[acct.type] += acct.balance;
    });
    let cum = 0;
    return Object.entries(grouped).map(([typeId, val]) => {
      const acctType = ACCOUNT_TYPES.find(t => t.id === typeId);
      const pct = (val / totalNetWorth) * 100;
      const start = cum;
      cum += pct;
      return { id: typeId, label: acctType?.label || typeId, color: acctType?.color || 'var(--text-dim)', pct, start, end: cum, value: val };
    }).filter(s => s.pct > 0);
  }, [accounts, totalNetWorth]);


  const savingsColor = savingsRate < 10 ? 'var(--danger)' : savingsRate < 20 ? 'var(--warn)' : 'var(--accent)';
  const progressColor = retirementProgress < 25 ? 'var(--danger)' : retirementProgress < 50 ? 'var(--warn)' : 'var(--accent)';

  return (
    <div className="fade-up">
      <InfoBox icon="📊" title="Account Dashboard" color="var(--accent)">
        Your complete financial picture in one place. See your net worth, track progress toward retirement, and make sure your accounts are working together.
      </InfoBox>

      {accounts.length === 0 ? (
        /* Empty State */
        <Card style={{ textAlign: 'center', padding: '60px 32px', marginTop: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📊</div>
          <div className="serif f20 mb-8" style={{ color: 'var(--text-muted)' }}>Add Your Accounts</div>
          <div className="f13 dim lh-loose" style={{ maxWidth: 420, margin: '0 auto 24px' }}>
            Add your retirement and investment accounts to see your total net worth, tax-advantaged breakdown, and track your progress toward retirement.
          </div>

          {/* Add Account Form in empty state */}
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              <input
                value={newAccount.name}
                onChange={e => setNewAccount(a => ({ ...a, name: e.target.value }))}
                placeholder="Account name"
                style={{ flex: '1 1 140px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, outline: 'none' }}
              />
              <select
                value={newAccount.type}
                onChange={e => setNewAccount(a => ({ ...a, type: e.target.value }))}
                style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12 }}
              >
                {ACCOUNT_TYPES.map(at => <option key={at.id} value={at.id}>{at.label}</option>)}
              </select>
              <select
                value={newAccount.institution}
                onChange={e => setNewAccount(a => ({ ...a, institution: e.target.value }))}
                style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12 }}
              >
                {INSTITUTIONS.map(inst => <option key={inst} value={inst}>{inst}</option>)}
              </select>
              <input
                type="number"
                value={newAccount.balance}
                onChange={e => setNewAccount(a => ({ ...a, balance: e.target.value }))}
                placeholder="Balance ($)"
                style={{ width: 110, padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, outline: 'none' }}
                onKeyDown={e => e.key === 'Enter' && addAccount()}
              />
              <button
                onClick={addAccount}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'var(--accent)', color: 'var(--bg)', fontWeight: 700, fontSize: 12 }}
              >+</button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Row 1 — Big Stats */}
          <div className="stats-row" style={{ display: 'flex', gap: 12, marginTop: 16, marginBottom: 14 }}>
            <Stat icon="💰" label="Total Net Worth" value={fmt(totalNetWorth)} color="var(--accent)" />
            <Stat
              icon="📈"
              label="Savings Rate"
              value={`${savingsRate.toFixed(1)}%`}
              color={savingsColor}
              sub={`${fmt(monthlySavings)}/mo of ${fmt(monthlyIncome)}`}
            />
            <Stat
              icon="🎯"
              label="Retirement Progress"
              value={`${Math.min(retirementProgress, 999).toFixed(1)}%`}
              color={progressColor}
              sub={`Goal: ${fmt(retirementGoal)}`}
            />
            <Stat
              icon="💵"
              label="Monthly Savings"
              value={fmt(monthlySavings)}
              color="var(--blue)"
              sub={`${fmt(monthlySavings * 12)}/year`}
            />
          </div>

          {/* Row 2 — Account Cards Grid */}
          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Your Accounts</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {accounts.map(acct => {
                const acctType = ACCOUNT_TYPES.find(t => t.id === acct.type);
                return (
                  <div key={acct.id} style={{
                    padding: '14px 16px',
                    background: 'var(--bg2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${acctType?.color || 'var(--text-dim)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{acct.name}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em',
                          padding: '2px 6px', borderRadius: 4,
                          background: `${acctType?.color || 'var(--text-dim)'}18`,
                          color: acctType?.color || 'var(--text-dim)',
                        }}>{acctType?.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{acct.institution}</div>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: acctType?.color || 'var(--accent)', marginTop: 6 }}>
                        {fmtFull(acct.balance)}
                      </div>
                    </div>
                    <button
                      onClick={() => removeAccount(acct.id)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 18, padding: '0 4px', opacity: 0.6 }}
                      title="Remove account"
                    >&times;</button>
                  </div>
                );
              })}
            </div>

            {/* Add Account Form */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                value={newAccount.name}
                onChange={e => setNewAccount(a => ({ ...a, name: e.target.value }))}
                placeholder="Account name"
                style={{ flex: '1 1 140px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, outline: 'none' }}
              />
              <select
                value={newAccount.type}
                onChange={e => setNewAccount(a => ({ ...a, type: e.target.value }))}
                style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12 }}
              >
                {ACCOUNT_TYPES.map(at => <option key={at.id} value={at.id}>{at.label}</option>)}
              </select>
              <select
                value={newAccount.institution}
                onChange={e => setNewAccount(a => ({ ...a, institution: e.target.value }))}
                style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12 }}
              >
                {INSTITUTIONS.map(inst => <option key={inst} value={inst}>{inst}</option>)}
              </select>
              <input
                type="number"
                value={newAccount.balance}
                onChange={e => setNewAccount(a => ({ ...a, balance: e.target.value }))}
                placeholder="Balance ($)"
                style={{ width: 110, padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, outline: 'none' }}
                onKeyDown={e => e.key === 'Enter' && addAccount()}
              />
              <button
                onClick={addAccount}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'var(--accent)', color: 'var(--bg)', fontWeight: 700, fontSize: 12 }}
              >+</button>
            </div>

            {/* Total */}
            <div style={{ textAlign: 'right', marginTop: 10 }}>
              <span className="f11 dim">Total: </span>
              <span className="f16 fw7 c-accent" style={{ fontFamily: 'var(--serif)' }}>{fmtFull(totalNetWorth)}</span>
            </div>
          </Card>

          {/* Row 3 — Two-column analysis */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {/* Tax-Advantaged Breakdown */}
            <Card>
              <SectionLabel>Tax-Advantaged Breakdown</SectionLabel>
              {/* Stacked bar */}
              {totalNetWorth > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', height: 28, borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 12 }}>
                    {taxBreakdown.taxDeferred > 0 && (
                      <div style={{ width: `${(taxBreakdown.taxDeferred / totalNetWorth) * 100}%`, background: 'var(--blue)', transition: 'width .3s' }} />
                    )}
                    {taxBreakdown.taxFree > 0 && (
                      <div style={{ width: `${(taxBreakdown.taxFree / totalNetWorth) * 100}%`, background: 'var(--purple)', transition: 'width .3s' }} />
                    )}
                    {taxBreakdown.taxable > 0 && (
                      <div style={{ width: `${(taxBreakdown.taxable / totalNetWorth) * 100}%`, background: 'var(--warn)', transition: 'width .3s' }} />
                    )}
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { label: 'Tax-Deferred', color: 'var(--blue)', value: taxBreakdown.taxDeferred },
                      { label: 'Tax-Free', color: 'var(--purple)', value: taxBreakdown.taxFree },
                      { label: 'Taxable', color: 'var(--warn)', value: taxBreakdown.taxable },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
                          <span className="f12 muted">{item.label}</span>
                        </div>
                        <div>
                          <span className="f13 fw6" style={{ color: item.color, fontFamily: 'var(--serif)' }}>{fmtFull(item.value)}</span>
                          <span className="f11 dim" style={{ marginLeft: 6 }}>
                            ({totalNetWorth > 0 ? ((item.value / totalNetWorth) * 100).toFixed(0) : 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendation */}
              <div style={{ padding: '10px 14px', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 12, lineHeight: 1.6 }}>
                <span style={{ marginRight: 6 }}>💡</span>
                {totalNetWorth > 0 && (taxBreakdown.taxable / totalNetWorth) > 0.5 ? (
                  <span style={{ color: 'var(--warn)' }}>Consider maxing out tax-advantaged accounts first before adding to taxable accounts.</span>
                ) : totalNetWorth > 0 && (taxBreakdown.taxDeferred / totalNetWorth) > 0.7 ? (
                  <span style={{ color: 'var(--blue)' }}>Consider Roth contributions for tax diversification in retirement.</span>
                ) : (
                  <span style={{ color: 'var(--accent)' }}>Good tax diversification! You&apos;re spreading money across different tax treatments.</span>
                )}
              </div>
            </Card>

            {/* Account Type Distribution */}
            <Card>
              <SectionLabel>Account Type Distribution</SectionLabel>
              {accountTypeSegs.length > 0 ? (
                <>
                  <Donut segs={accountTypeSegs} label={fmt(totalNetWorth)} />
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                    {accountTypeSegs.map(seg => (
                      <div key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }} />
                        {seg.label} ({seg.pct.toFixed(0)}%)
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 14, padding: '8px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <span className="f11 dim">For detailed asset allocation, use the <strong style={{ color: 'var(--accent)' }}>Rebalance</strong> tab</span>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-dim)', fontSize: 12 }}>
                  No accounts to display
                </div>
              )}
            </Card>
          </div>

          {/* Row 4 — Retirement Milestones */}
          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Retirement Milestones</SectionLabel>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span className="f12 dim">Progress toward {fmtFull(retirementGoal)}</span>
              <span className="f14 fw7" style={{ color: progressColor, fontFamily: 'var(--serif)' }}>
                {fmtFull(totalNetWorth)} ({Math.min(retirementProgress, 100).toFixed(1)}%)
              </span>
            </div>

            {/* Main progress bar */}
            <div style={{ position: 'relative', marginBottom: 32 }}>
              <div style={{ height: 12, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(retirementProgress, 100)}%`,
                  background: `linear-gradient(90deg, var(--accent), var(--blue))`,
                  borderRadius: 6,
                  transition: 'width .4s ease',
                }} />
              </div>

              {/* Milestone markers */}
              {milestones.map(ms => (
                <div key={ms.pct} style={{
                  position: 'absolute',
                  left: `${ms.pct}%`,
                  top: -6,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}>
                  <div style={{
                    width: 24, height: 24,
                    borderRadius: '50%',
                    background: ms.achieved ? 'var(--accent)' : 'var(--bg2)',
                    border: `2px solid ${ms.achieved ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: ms.achieved ? 'var(--bg)' : 'var(--text-dim)',
                    fontWeight: 700,
                  }}>
                    {ms.achieved ? '✓' : ''}
                  </div>
                  <div style={{ marginTop: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: ms.achieved ? 'var(--accent)' : 'var(--text-dim)' }}>{ms.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{fmt(ms.amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Row 5 — Settings (collapsible) */}
          <Card>
            <div
              onClick={() => setSettingsOpen(!settingsOpen)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            >
              <SectionLabel>Settings</SectionLabel>
              <span style={{ fontSize: 14, color: 'var(--text-dim)', transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>▼</span>
            </div>

            {settingsOpen && (
              <div style={{ marginTop: 12 }}>
                <Slider label="Your Age" value={age} onChange={setAge} min={18} max={70} suffix=" yrs" />

                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>Risk Tolerance</span>
                    <span style={{ color: 'var(--accent)', fontSize: 16, fontWeight: 700, fontFamily: 'var(--serif)' }}>{RISK_LABELS[risk - 1]}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {RISK_LABELS.map((rl, i) => (
                      <button key={i} onClick={() => setRisk(i + 1)} className={`risk-btn${risk === i + 1 ? ' active' : ''}`}>{rl}</button>
                    ))}
                  </div>
                </div>

                <Slider
                  label="Retirement Goal"
                  value={retirementGoal}
                  onChange={setRetirementGoal}
                  min={100000}
                  max={5000000}
                  step={50000}
                  format={fmt}
                  prefix=""
                />

                <Slider
                  label="Monthly Income"
                  value={monthlyIncome}
                  onChange={setMonthlyIncome}
                  min={0}
                  max={30000}
                  step={500}
                  format={fmt}
                  prefix=""
                />

                <Slider
                  label="Monthly Savings"
                  value={monthlySavings}
                  onChange={setMonthlySavings}
                  min={0}
                  max={10000}
                  step={100}
                  format={fmt}
                  prefix=""
                />
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
