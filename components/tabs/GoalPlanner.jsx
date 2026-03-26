'use client';

import { useState, useMemo, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Slider from '@/components/ui/Slider';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt } from '@/lib/format';
import { DEFAULT_RETURN, DEFAULT_INFLATION } from '@/lib/constants';

/* ── Goal type definitions ─────────────────────────────── */
const GOAL_TYPES = {
  retirement: {
    icon: '🏖️', label: 'Retirement', color: 'var(--accent)', dimColor: 'var(--accent-dim)',
    defaults: { targetAge: 65, monthlySpending: 4000, ssIncome: 2000 },
  },
  home: {
    icon: '🏠', label: 'Buy a Home', color: 'var(--blue)', dimColor: 'var(--blue-dim)',
    defaults: { targetYear: 2031, homePrice: 400000, downPct: 20, currentSavings: 20000 },
  },
  college: {
    icon: '🎓', label: 'College Fund', color: 'var(--purple)', dimColor: 'var(--purple-dim)',
    defaults: { childAge: 5, annualCost: 35000, years: 4, balance529: 10000 },
  },
  travel: {
    icon: '✈️', label: 'Travel / Big Purchase', color: 'var(--warn)', dimColor: 'var(--warn-dim)',
    defaults: { targetYear: 2029, cost: 15000, currentSavings: 2000 },
  },
};

const CURRENT_YEAR = 2026;
const SAFE_WITHDRAWAL = 0.04;

let nextGoalId = 1;

/* ── Helper: future value with monthly contributions ───── */
function fvMonthly(pv, pmt, rateAnnual, years) {
  if (years <= 0) return pv;
  const r = rateAnnual / 12;
  if (r === 0) return pv + pmt * years * 12;
  return pv * Math.pow(1 + r, years * 12) + pmt * ((Math.pow(1 + r, years * 12) - 1) / r);
}

/* ── Helper: monthly savings needed to reach target ────── */
function pmtNeeded(pv, fv, rateAnnual, years) {
  if (years <= 0) return Math.max(0, fv - pv);
  const r = rateAnnual / 12;
  if (r === 0) return years > 0 ? Math.max(0, (fv - pv) / (years * 12)) : 0;
  const factor = (Math.pow(1 + r, years * 12) - 1) / r;
  const needed = (fv - pv * Math.pow(1 + r, years * 12)) / factor;
  return Math.max(0, needed);
}

/* ── Compute goal metrics ──────────────────────────────── */
function computeGoal(goal, currentAge) {
  const inflRate = DEFAULT_INFLATION / 100;
  const retRate = DEFAULT_RETURN;

  let targetYear, yearsOut, futureNeed, currentFunding, monthlyNeeded;

  switch (goal.type) {
    case 'retirement': {
      targetYear = CURRENT_YEAR + (goal.params.targetAge - currentAge);
      yearsOut = goal.params.targetAge - currentAge;
      const annualSpend = (goal.params.monthlySpending - goal.params.ssIncome) * 12;
      futureNeed = (annualSpend / SAFE_WITHDRAWAL) * Math.pow(1 + inflRate, yearsOut);
      currentFunding = 0;
      monthlyNeeded = pmtNeeded(0, futureNeed, retRate, yearsOut);
      break;
    }
    case 'home': {
      targetYear = goal.params.targetYear;
      yearsOut = targetYear - CURRENT_YEAR;
      const inflatedPrice = goal.params.homePrice * Math.pow(1 + inflRate, yearsOut);
      futureNeed = inflatedPrice * (goal.params.downPct / 100);
      currentFunding = goal.params.currentSavings;
      monthlyNeeded = pmtNeeded(currentFunding, futureNeed, retRate, yearsOut);
      break;
    }
    case 'college': {
      const yearsToCollege = 18 - goal.params.childAge;
      targetYear = CURRENT_YEAR + yearsToCollege;
      yearsOut = yearsToCollege;
      futureNeed = goal.params.annualCost * goal.params.years * Math.pow(1 + inflRate, yearsOut);
      currentFunding = goal.params.balance529;
      monthlyNeeded = pmtNeeded(currentFunding, futureNeed, retRate, yearsOut);
      break;
    }
    case 'travel': {
      targetYear = goal.params.targetYear;
      yearsOut = targetYear - CURRENT_YEAR;
      futureNeed = goal.params.cost * Math.pow(1 + inflRate, yearsOut);
      currentFunding = goal.params.currentSavings;
      monthlyNeeded = pmtNeeded(currentFunding, futureNeed, retRate, yearsOut);
      break;
    }
    default:
      targetYear = CURRENT_YEAR;
      yearsOut = 0;
      futureNeed = 0;
      currentFunding = 0;
      monthlyNeeded = 0;
  }

  const projectedValue = fvMonthly(currentFunding, monthlyNeeded, retRate, yearsOut);
  const fundedPct = futureNeed > 0 ? Math.min(100, (currentFunding / futureNeed) * 100) : 0;

  return { targetYear, yearsOut, futureNeed, currentFunding, monthlyNeeded, projectedValue, fundedPct };
}

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
function GoalCard({ goal, metrics, monthlyAvailable, onUpdate, onRemove }) {
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

/* ── Goal type picker (Add Goal flow) ──────────────────── */
function GoalPicker({ onSelect, onCancel }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Choose a Goal Type</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        {Object.entries(GOAL_TYPES).map(([key, def]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
              borderRadius: 'var(--radius)', border: `1px solid ${def.color}33`,
              background: def.dimColor, cursor: 'pointer', color: def.color,
              fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)', transition: 'border-color .2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = def.color}
            onMouseLeave={e => e.currentTarget.style.borderColor = `${def.color}33`}
          >
            <span style={{ fontSize: 22 }}>{def.icon}</span>
            {def.label}
          </button>
        ))}
      </div>
      <button onClick={onCancel} style={{
        marginTop: 10, width: '100%', padding: '8px 0', background: 'none',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--sans)',
      }}>Cancel</button>
    </Card>
  );
}

/* ── Combined SVG chart ────────────────────────────────── */
function CombinedChart({ goals, metricsMap, currentAge, totalSavings }) {
  const W = 600, H = 300, L = 60, R = W - 20, T = 250, B = 30;

  const allTargetYears = goals.map(g => metricsMap[g.id]?.targetYear || CURRENT_YEAR);
  const maxYear = Math.max(CURRENT_YEAR + 5, ...allTargetYears) + 2;
  const totalYears = maxYear - CURRENT_YEAR;

  // Build trajectories for each goal
  const trajectories = useMemo(() => {
    return goals.map(goal => {
      const m = metricsMap[goal.id];
      if (!m) return { goal, points: [] };
      const pts = [];
      for (let y = 0; y <= totalYears; y++) {
        const val = fvMonthly(m.currentFunding, m.monthlyNeeded, DEFAULT_RETURN, Math.min(y, m.yearsOut));
        pts.push({ year: CURRENT_YEAR + y, value: y <= m.yearsOut ? val : m.futureNeed });
      }
      return { goal, points: pts };
    });
  }, [goals, metricsMap, totalYears]);

  // Aggregate savings curve
  const aggregatePoints = useMemo(() => {
    const pts = [];
    const totalMonthly = goals.reduce((s, g) => s + (metricsMap[g.id]?.monthlyNeeded || 0), 0);
    for (let y = 0; y <= totalYears; y++) {
      const val = fvMonthly(totalSavings, totalMonthly, DEFAULT_RETURN, y);
      pts.push({ year: CURRENT_YEAR + y, value: val });
    }
    return pts;
  }, [goals, metricsMap, totalSavings, totalYears]);

  const yMax = Math.max(
    1000,
    ...aggregatePoints.map(p => p.value),
    ...trajectories.flatMap(t => t.points.map(p => p.value))
  ) * 1.1;

  const xScale = (year) => L + ((year - CURRENT_YEAR) / totalYears) * (R - L);
  const yScale = (val) => H - B - (val / yMax) * T;

  // Grid lines
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => f * yMax);
  const xTicks = [];
  const xStep = totalYears <= 10 ? 1 : totalYears <= 20 ? 2 : 5;
  for (let y = CURRENT_YEAR; y <= maxYear; y += xStep) xTicks.push(y);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <g key={`yg-${i}`}>
          <line x1={L} y1={yScale(v)} x2={R} y2={yScale(v)} stroke="var(--border)" strokeWidth=".5" />
          <text x={L - 6} y={yScale(v) + 4} fill="var(--text-dim)" fontSize="9" textAnchor="end" fontFamily="var(--sans)">{fmt(v)}</text>
        </g>
      ))}
      {xTicks.map((yr, i) => (
        <g key={`xg-${i}`}>
          <line x1={xScale(yr)} y1={H - B} x2={xScale(yr)} y2={H - B + 5} stroke="var(--border)" strokeWidth=".5" />
          <text x={xScale(yr)} y={H - B + 16} fill="var(--text-dim)" fontSize="9" textAnchor="middle" fontFamily="var(--sans)">{yr}</text>
        </g>
      ))}
      {/* X axis line */}
      <line x1={L} y1={H - B} x2={R} y2={H - B} stroke="var(--border)" strokeWidth="1" />

      {/* Area fills for each goal trajectory */}
      {trajectories.map(({ goal, points }, ti) => {
        if (points.length < 2) return null;
        const color = GOAL_TYPES[goal.type].color;
        const areaPath = points.map((p, i) =>
          `${i === 0 ? 'M' : 'L'}${xScale(p.year)},${yScale(p.value)}`
        ).join(' ') + ` L${xScale(points[points.length - 1].year)},${yScale(0)} L${xScale(points[0].year)},${yScale(0)} Z`;
        const linePath = points.map((p, i) =>
          `${i === 0 ? 'M' : 'L'}${xScale(p.year)},${yScale(p.value)}`
        ).join(' ');
        return (
          <g key={`traj-${ti}`}>
            <path d={areaPath} fill={color} opacity="0.08" />
            <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="6 3" />
          </g>
        );
      })}

      {/* Aggregate savings line (solid, prominent) */}
      {aggregatePoints.length > 1 && (
        <path
          d={aggregatePoints.map((p, i) =>
            `${i === 0 ? 'M' : 'L'}${xScale(p.year)},${yScale(p.value)}`
          ).join(' ')}
          fill="none" stroke="var(--text)" strokeWidth="2.5"
        />
      )}

      {/* Goal milestone markers */}
      {goals.map((goal, gi) => {
        const m = metricsMap[goal.id];
        if (!m) return null;
        const x = xScale(m.targetYear);
        const color = GOAL_TYPES[goal.type].color;
        return (
          <g key={`marker-${gi}`}>
            <line x1={x} y1={H - B} x2={x} y2={yScale(yMax * 0.95)} stroke={color} strokeWidth="1" strokeDasharray="4 3" />
            <circle cx={x} cy={yScale(m.futureNeed)} r={5} fill={color} stroke="var(--bg)" strokeWidth="2" />
            <text x={x} y={yScale(yMax * 0.95) - 6} fill={color} fontSize="10" textAnchor="middle" fontFamily="var(--sans)" fontWeight="600">
              {GOAL_TYPES[goal.type].icon} {m.targetYear}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {goals.map((goal, gi) => {
        const color = GOAL_TYPES[goal.type].color;
        const lx = L + gi * 130;
        return (
          <g key={`leg-${gi}`}>
            <line x1={lx} y1={10} x2={lx + 14} y2={10} stroke={color} strokeWidth="2" strokeDasharray="4 2" />
            <text x={lx + 18} y={13} fill="var(--text-muted)" fontSize="9" fontFamily="var(--sans)">{GOAL_TYPES[goal.type].label}</text>
          </g>
        );
      })}
      {goals.length > 0 && (
        <g>
          <line x1={L + goals.length * 130} y1={10} x2={L + goals.length * 130 + 14} y2={10} stroke="var(--text)" strokeWidth="2.5" />
          <text x={L + goals.length * 130 + 18} y={13} fill="var(--text-muted)" fontSize="9" fontFamily="var(--sans)">Total Savings</text>
        </g>
      )}
    </svg>
  );
}

/* ── Main component ────────────────────────────────────── */
export default function GoalPlanner() {
  const [currentAge, setCurrentAge] = useState(30);
  const [income, setIncome] = useState(100000);
  const [totalSavings, setTotalSavings] = useState(50000);
  const [monthlyAvailable, setMonthlyAvailable] = useState(1500);

  const [goals, setGoals] = useState([
    { id: nextGoalId++, type: 'retirement', params: { ...GOAL_TYPES.retirement.defaults } },
  ]);
  const [showPicker, setShowPicker] = useState(false);

  const addGoal = useCallback((type) => {
    setGoals(prev => [...prev, { id: nextGoalId++, type, params: { ...GOAL_TYPES[type].defaults } }]);
    setShowPicker(false);
  }, []);

  const updateGoal = useCallback((id, updated) => {
    setGoals(prev => prev.map(g => g.id === id ? updated : g));
  }, []);

  const removeGoal = useCallback((id) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  }, []);

  // Compute metrics for all goals
  const metricsMap = useMemo(() => {
    const map = {};
    for (const g of goals) {
      map[g.id] = computeGoal(g, currentAge);
    }
    return map;
  }, [goals, currentAge]);

  const totalMonthlyNeeded = useMemo(() =>
    goals.reduce((s, g) => s + (metricsMap[g.id]?.monthlyNeeded || 0), 0),
    [goals, metricsMap]
  );

  const totalGoalValue = useMemo(() =>
    goals.reduce((s, g) => s + (metricsMap[g.id]?.futureNeed || 0), 0),
    [goals, metricsMap]
  );

  // Feasibility
  const feasibilityRatio = monthlyAvailable > 0 ? totalMonthlyNeeded / monthlyAvailable : 999;
  let feasibilityLabel, feasibilityColor;
  if (feasibilityRatio <= 1) { feasibilityLabel = 'On Track'; feasibilityColor = 'var(--accent)'; }
  else if (feasibilityRatio <= 1.5) { feasibilityLabel = 'Stretch'; feasibilityColor = 'var(--warn)'; }
  else { feasibilityLabel = 'Needs Attention'; feasibilityColor = 'var(--danger)'; }

  const feasibilityScore = Math.max(0, Math.min(100, Math.round((1 / Math.max(feasibilityRatio, 0.01)) * 100)));

  return (
    <div className="fade-up">
      {/* Shared inputs */}
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>Your Household</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
          <Slider label="Current Age" value={currentAge} onChange={setCurrentAge} min={18} max={65} suffix=" yrs" />
          <Slider label="Annual Income" value={income} onChange={setIncome} min={30000} max={500000} step={5000} format={fmt} />
          <Slider label="Total Savings" value={totalSavings} onChange={setTotalSavings} min={0} max={2000000} step={5000} format={fmt} />
          <Slider label="Monthly Available to Invest" value={monthlyAvailable} onChange={setMonthlyAvailable} min={0} max={10000} step={50} format={fmt}
            tooltip="How much you can put toward all goals combined each month" />
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 28, alignItems: 'start' }}>
        {/* Left: Goal cards */}
        <div>
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              metrics={metricsMap[goal.id]}
              monthlyAvailable={goals.length > 0 ? monthlyAvailable / goals.length : monthlyAvailable}
              onUpdate={updateGoal}
              onRemove={removeGoal}
            />
          ))}

          {showPicker ? (
            <GoalPicker onSelect={addGoal} onCancel={() => setShowPicker(false)} />
          ) : (
            <button
              onClick={() => setShowPicker(true)}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 'var(--radius)',
                border: '2px dashed var(--border)', background: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 14, fontFamily: 'var(--sans)',
                fontWeight: 500, transition: 'border-color .2s, color .2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              + Add Goal
            </button>
          )}
        </div>

        {/* Right: Combined view */}
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <Stat icon="💵" label="Total Monthly Needed" value={fmt(totalMonthlyNeeded)} sub={`${fmt(monthlyAvailable)}/mo available`}
              color={feasibilityRatio <= 1 ? 'var(--accent)' : feasibilityRatio <= 1.5 ? 'var(--warn)' : 'var(--danger)'} />
            <Stat icon="🎯" label="Total Goal Value" value={fmt(totalGoalValue)} sub="Inflation-adjusted" color="var(--blue)" />
            <Stat icon="📊" label="Feasibility Score" value={`${feasibilityScore}%`} sub={feasibilityLabel} color={feasibilityColor} />
          </div>

          {/* Warning if goals conflict */}
          {feasibilityRatio > 1.5 && (
            <InfoBox icon="⚠️" title="Goals May Conflict" color="var(--danger)" bgColor="var(--danger-dim)">
              Your goals require <strong>{fmt(totalMonthlyNeeded)}/mo</strong> but you have <strong>{fmt(monthlyAvailable)}/mo</strong> available.
              Consider extending timelines, reducing target amounts, or increasing your monthly investment.
            </InfoBox>
          )}
          {feasibilityRatio > 1 && feasibilityRatio <= 1.5 && (
            <InfoBox icon="🔔" title="Tight but Possible" color="var(--warn)" bgColor="var(--warn-dim)">
              You need about <strong>{Math.round((feasibilityRatio - 1) * 100)}% more</strong> monthly savings to hit all goals.
              Small increases in contributions or slightly longer timelines can close the gap.
            </InfoBox>
          )}

          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Combined Goal Projection</SectionLabel>
            {goals.length > 0 ? (
              <CombinedChart
                goals={goals}
                metricsMap={metricsMap}
                currentAge={currentAge}
                totalSavings={totalSavings}
              />
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
                Add a goal to see your projection chart.
              </div>
            )}
          </Card>

          {/* Goal timeline summary */}
          {goals.length > 1 && (
            <Card style={{ marginTop: 14 }}>
              <SectionLabel>Goal Timeline</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {goals
                  .slice()
                  .sort((a, b) => (metricsMap[a.id]?.targetYear || 0) - (metricsMap[b.id]?.targetYear || 0))
                  .map(goal => {
                    const m = metricsMap[goal.id];
                    const td = GOAL_TYPES[goal.type];
                    return (
                      <div key={goal.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)', background: td.dimColor,
                      }}>
                        <span style={{ fontSize: 18 }}>{td.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: td.color }}>{td.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {m.targetYear} &middot; {fmt(m.futureNeed)} needed &middot; {fmt(m.monthlyNeeded)}/mo
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m.yearsOut} yrs</div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{m.fundedPct.toFixed(0)}% funded</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
