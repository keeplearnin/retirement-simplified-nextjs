'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLocalState } from '@/lib/useLocalState';
import ValidationWarning from '@/components/ui/ValidationWarning';
import Card from '@/components/ui/Card';
import Slider from '@/components/ui/Slider';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt } from '@/lib/format';
import { GOAL_TYPES, computeGoal } from './goals/goalHelpers';
import GoalCard from './goals/GoalCard';
import GoalChart from './goals/GoalChart';
import AddGoalForm from './goals/AddGoalForm';

export default function GoalPlanner() {
  const [currentAge, setCurrentAge] = useState(30);
  const [income, setIncome] = useState(100000);
  const [totalSavings, setTotalSavings] = useState(50000);
  const [monthlyAvailable, setMonthlyAvailable] = useState(1500);

  const [goals, setGoals] = useLocalState('planner_goals', [
    { id: crypto.randomUUID(), type: 'retirement', params: { ...GOAL_TYPES.retirement.defaults } },
  ]);
  const [showPicker, setShowPicker] = useState(false);

  const addGoal = useCallback((type) => {
    setGoals(prev => [...prev, { id: crypto.randomUUID(), type, params: { ...GOAL_TYPES[type].defaults } }]);
    setShowPicker(false);
  }, []);

  const updateGoal = useCallback((id, updated) => {
    setGoals(prev => prev.map(g => g.id === id ? updated : g));
  }, []);

  const removeGoal = useCallback((id) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  }, []);

  const metricsMap = useMemo(() => {
    const map = {};
    for (const g of goals) {
      map[g.id] = computeGoal(g, currentAge, totalSavings, goals.length);
    }
    return map;
  }, [goals, currentAge, totalSavings]);

  const totalMonthlyNeeded = useMemo(() =>
    goals.reduce((s, g) => s + (metricsMap[g.id]?.monthlyNeeded || 0), 0),
    [goals, metricsMap]
  );

  const totalGoalValue = useMemo(() =>
    goals.reduce((s, g) => s + (metricsMap[g.id]?.futureNeed || 0), 0),
    [goals, metricsMap]
  );

  const feasibilityRatio = monthlyAvailable > 0 ? totalMonthlyNeeded / monthlyAvailable : 999;
  let feasibilityLabel, feasibilityColor;
  if (feasibilityRatio <= 1) { feasibilityLabel = 'On Track'; feasibilityColor = 'var(--accent)'; }
  else if (feasibilityRatio <= 1.5) { feasibilityLabel = 'Stretch'; feasibilityColor = 'var(--warn)'; }
  else { feasibilityLabel = 'Needs Attention'; feasibilityColor = 'var(--danger)'; }

  const feasibilityScore = Math.max(0, Math.min(100, Math.round((1 / Math.max(feasibilityRatio, 0.01)) * 100)));

  const warnings = useMemo(() => {
    const w = [];
    if (monthlyAvailable === 0) w.push('Monthly available is $0 — set a savings amount to see if your goals are achievable.');
    if (feasibilityRatio > 2) w.push('Your goals require more than 2x your available savings — consider prioritizing or adjusting timelines.');
    if (goals.some(g => metricsMap[g.id]?.yearsOut <= 0)) w.push('One or more goals have a target date in the past — check your ages.');
    return w;
  }, [monthlyAvailable, feasibilityRatio, goals, metricsMap]);

  return (
    <div className="fade-up">
      <ValidationWarning warnings={warnings} />
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

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 28, alignItems: 'start' }}>
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
            <AddGoalForm onSelect={addGoal} onCancel={() => setShowPicker(false)} />
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
              <GoalChart
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
