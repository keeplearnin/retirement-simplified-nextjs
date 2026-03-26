'use client';

import { useState, useCallback } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import { fmt } from '@/lib/format';
import { GOAL_TYPES, CURRENT_YEAR } from './goalHelpers';

/* ── Status badge ──────────────────────────────────────── */
function StatusBadge({ monthlyNeeded, monthlyAvailable }) {
  let label, bg, fg;
  const ratio = monthlyAvailable > 0 ? monthlyNeeded / monthlyAvailable : 999;
  if (ratio <= 1) { label = 'On Track'; bg = 'var(--accent-dim)'; fg = 'var(--accent)'; }
  else if (ratio <= 1.5) { label = 'Stretch'; bg = 'var(--warn-dim)'; fg = 'var(--warn)'; }
  else { label = 'Needs Attention'; bg = 'var(--danger-dim)'; fg = 'var(--danger)'; }
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px',
      borderRadius: 'var(--radius-sm)', background: bg, color: fg, letterSpacing: '.3px',
    }}>{label}</span>
  );
}

/* ── Progress bar ──────────────────────────────────────── */
function ProgressBar({ pct, color }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', marginTop: 8 }}>
      <div style={{
        height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 3,
        background: color, transition: 'width .4s ease',
      }} />
    </div>
  );
}

/* ── Goal Card (individual) ────────────────────────────── */
export default function GoalCard({ goal, metrics, monthlyAvailable, onUpdate, onRemove }) {
  const [collapsed, setCollapsed] = useState(false);
  const typeDef = GOAL_TYPES[goal.type];

  const updateParam = useCallback((key, val) => {
    onUpdate(goal.id, { ...goal, params: { ...goal.params, [key]: val } });
  }, [goal, onUpdate]);

  return (
    <Card style={{ borderLeft: `3px solid ${typeDef.color}`, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collapsed ? 0 : 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{typeDef.icon}</span>
          <span className="serif" style={{ fontSize: 17, color: typeDef.color }}>{typeDef.label}</span>
          <StatusBadge monthlyNeeded={metrics.monthlyNeeded} monthlyAvailable={monthlyAvailable} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setCollapsed(c => !c)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
            fontSize: 16, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
          }}>{collapsed ? '▸' : '▾'}</button>
          <button onClick={() => onRemove(goal.id)} style={{
            background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer',
            fontSize: 14, padding: '2px 6px', borderRadius: 'var(--radius-sm)', opacity: 0.7,
          }}>✕</button>
        </div>
      </div>

      {!collapsed && (
        <>
          {goal.type === 'retirement' && (
            <>
              <Slider label="Target Retirement Age" value={goal.params.targetAge} onChange={v => updateParam('targetAge', v)} min={50} max={80} suffix=" yrs" />
              <Slider label="Monthly Spending in Retirement" value={goal.params.monthlySpending} onChange={v => updateParam('monthlySpending', v)} min={1000} max={15000} step={100} format={fmt} />
              <Slider label="Expected Social Security" value={goal.params.ssIncome} onChange={v => updateParam('ssIncome', v)} min={0} max={5000} step={100} format={fmt} suffix="/mo" />
            </>
          )}
          {goal.type === 'home' && (
            <>
              <Slider label="Target Year" value={goal.params.targetYear} onChange={v => updateParam('targetYear', v)} min={CURRENT_YEAR + 1} max={CURRENT_YEAR + 20} />
              <Slider label="Home Price" value={goal.params.homePrice} onChange={v => updateParam('homePrice', v)} min={100000} max={1500000} step={10000} format={fmt} />
              <Slider label="Down Payment %" value={goal.params.downPct} onChange={v => updateParam('downPct', v)} min={5} max={30} suffix="%" />
              <Slider label="Current Savings for Home" value={goal.params.currentSavings} onChange={v => updateParam('currentSavings', v)} min={0} max={500000} step={1000} format={fmt} />
            </>
          )}
          {goal.type === 'college' && (
            <>
              <Slider label="Child's Current Age" value={goal.params.childAge} onChange={v => updateParam('childAge', v)} min={0} max={17} suffix=" yrs" />
              <Slider label="Annual School Cost" value={goal.params.annualCost} onChange={v => updateParam('annualCost', v)} min={10000} max={80000} step={1000} format={fmt} />
              <Slider label="Years of School" value={goal.params.years} onChange={v => updateParam('years', v)} min={2} max={6} suffix=" yrs" />
              <Slider label="Current 529 Balance" value={goal.params.balance529} onChange={v => updateParam('balance529', v)} min={0} max={300000} step={1000} format={fmt} />
            </>
          )}
          {goal.type === 'travel' && (
            <>
              <Slider label="Target Year" value={goal.params.targetYear} onChange={v => updateParam('targetYear', v)} min={CURRENT_YEAR + 1} max={CURRENT_YEAR + 15} />
              <Slider label="Total Cost" value={goal.params.cost} onChange={v => updateParam('cost', v)} min={1000} max={200000} step={500} format={fmt} />
              <Slider label="Current Savings" value={goal.params.currentSavings} onChange={v => updateParam('currentSavings', v)} min={0} max={100000} step={500} format={fmt} />
            </>
          )}

          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: typeDef.dimColor }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Monthly savings needed</span>
              <span style={{ color: typeDef.color, fontWeight: 600 }}>{fmt(metrics.monthlyNeeded)}/mo</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Target amount (inflation-adj.)</span>
              <span style={{ color: 'var(--text)' }}>{fmt(metrics.futureNeed)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Funded</span>
              <span style={{ color: 'var(--text)' }}>{metrics.fundedPct.toFixed(1)}%</span>
            </div>
            <ProgressBar pct={metrics.fundedPct} color={typeDef.color} />
          </div>
        </>
      )}
    </Card>
  );
}
