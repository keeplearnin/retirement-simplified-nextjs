'use client';

import { useState, useMemo, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import Slider from '@/components/ui/Slider';
import FormInput from '@/components/ui/FormInput';
import FormSelect from '@/components/ui/FormSelect';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt } from '@/lib/format';
import { useLocalState } from '@/lib/useLocalState';
import { usePlan } from '@/components/PlanProvider';
import {
  projectChild,
  summarizeHousehold,
  annualCostFor,
  SCHOOL_LABELS,
  SCHOOL_COSTS,
  STATE_529_DEDUCTION_CAP,
} from '@/lib/collegePlanner';

const SCHOOL_OPTIONS = Object.entries(SCHOOL_LABELS).map(([value, label]) => ({ value, label }));

function defaultChild(n = 1) {
  return {
    id: crypto.randomUUID(),
    name: `Child ${n}`,
    currentAge: 5,
    schoolType: 'public_in_state',
    customAnnualCost: 40000,
    coveragePct: 1,
    balance529: 10000,
    monthlyContribution: 300,
  };
}

function fundColor(pct) {
  if (pct >= 0.95) return 'var(--accent)';
  if (pct >= 0.7) return 'var(--blue)';
  if (pct >= 0.4) return 'var(--warn)';
  return 'var(--danger)';
}

/* ── Editable child card ──────────────────────────────────── */
function ChildCard({ child, proj, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...child, [k]: v });
  const pct = Math.round(proj.fundedPct * 100);
  const color = fundColor(proj.fundedPct);

  return (
    <Card variant="input" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <FormInput value={child.name} onChange={v => set('name', v)} style={{ width: 160, fontWeight: 600 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="f12" style={{ color, fontWeight: 700 }}>{pct}% funded</span>
          <button onClick={onRemove} className="dim f12" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
        </div>
      </div>

      {/* Funded bar */}
      <div style={{ height: 8, borderRadius: 999, background: 'var(--bg2)', overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, transition: 'width 250ms var(--ease-out)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <label className="f11 dim upcase">
          Current age
          <FormInput type="number" value={child.currentAge} onChange={v => set('currentAge', +v || 0)} style={{ marginTop: 4 }} />
        </label>
        <label className="f11 dim upcase">
          School type
          <FormSelect value={child.schoolType} onChange={v => set('schoolType', v)} options={SCHOOL_OPTIONS} style={{ marginTop: 4, width: '100%' }} />
        </label>
        {child.schoolType === 'custom' && (
          <label className="f11 dim upcase">
            Annual cost (today)
            <FormInput type="number" value={child.customAnnualCost} onChange={v => set('customAnnualCost', +v || 0)} style={{ marginTop: 4 }} />
          </label>
        )}
        <label className="f11 dim upcase">
          Current 529 balance
          <FormInput type="number" value={child.balance529} onChange={v => set('balance529', +v || 0)} style={{ marginTop: 4 }} />
        </label>
        <label className="f11 dim upcase">
          Monthly contribution
          <FormInput type="number" value={child.monthlyContribution} onChange={v => set('monthlyContribution', +v || 0)} style={{ marginTop: 4 }} />
        </label>
      </div>

      <div style={{ marginTop: 14 }}>
        <Slider
          label={`Cost you'll cover — ${Math.round(child.coveragePct * 100)}%`}
          value={Math.round(child.coveragePct * 100)}
          onChange={v => set('coveragePct', v / 100)}
          min={0} max={100} step={5} suffix="%"
        />
      </div>

      <div className="f12 dim" style={{ marginTop: 10, lineHeight: 1.7 }}>
        {proj.yearsToCollege > 0
          ? <>Starts college in <strong>{proj.yearsToCollege} yr</strong> · covered 4-yr cost <strong>{fmt(proj.totalCostFuture)}</strong> (today {fmt(annualCostFor(child) * child.coveragePct * 4)})</>
          : <>College age now · covered 4-yr cost <strong>{fmt(proj.totalCostFuture)}</strong></>}
        {proj.shortfall > 1 && (
          <> · <span style={{ color: 'var(--warn)' }}>shortfall {fmt(proj.shortfall)}</span> — need <strong>{fmt(proj.monthlyToFullyFund)}/mo</strong> to fully fund</>
        )}
        {proj.shortfall <= 1 && <> · <span style={{ color: 'var(--accent)' }}>on track ✓</span></>}
      </div>
    </Card>
  );
}

/* ── Overlap ("double tuition") timeline ──────────────────── */
function OverlapTimeline({ summary }) {
  const years = useMemo(() => {
    // Union of all children's college calendar years.
    const map = new Map();
    for (const p of summary.children) {
      for (let i = 0; i < p.collegeCalendarYears.length; i++) {
        const yr = p.collegeCalendarYears[i];
        map.set(yr, (map.get(yr) || 0) + p.totalCostFuture / p.collegeCalendarYears.length);
      }
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [summary]);

  if (years.length === 0) return null;
  const max = Math.max(...years.map(([, v]) => v));
  const overlapSet = new Set(summary.overlapYears.map(o => o.year));
  const W = 720, H = 200, pad = { top: 16, right: 16, bottom: 34, left: 56 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const gap = innerW / years.length;
  const barW = gap * 0.6;

  return (
    <Card style={{ marginTop: 16 }}>
      <SectionLabel>Tuition outlay by year — watch the overlap</SectionLabel>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {[0, 0.5, 1].map(f => {
          const y = pad.top + innerH * (1 - f);
          return (
            <g key={f}>
              <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={pad.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-dim)">{fmt(max * f)}</text>
            </g>
          );
        })}
        {years.map(([year, val], i) => {
          const h = max > 0 ? (val / max) * innerH : 0;
          const x = pad.left + gap * i + (gap - barW) / 2;
          const y = pad.top + innerH - h;
          const isOverlap = overlapSet.has(year);
          return (
            <g key={year}>
              <rect x={x} y={y} width={barW} height={h} rx={4} fill={isOverlap ? 'var(--warn)' : 'var(--accent)'} opacity={0.85} />
              <text x={x + barW / 2} y={H - 12} textAnchor="middle" fontSize="10" fill="var(--text-dim)">{year}</text>
            </g>
          );
        })}
      </svg>
      {summary.overlapYears.length > 0 && (
        <div className="f12 muted" style={{ marginTop: 4 }}>
          <span style={{ color: 'var(--warn)' }}>■</span> {summary.overlapYears.length} year{summary.overlapYears.length !== 1 ? 's' : ''} with two or more kids in college at once — the peak year runs <strong>{fmt(summary.peakYear.totalCost)}</strong>.
        </div>
      )}
    </Card>
  );
}

/* ── Main tab ─────────────────────────────────────────────── */
export default function CollegePlanner() {
  const { plan } = usePlan();

  const [children, setChildren] = useLocalState('college-children-v1', [defaultChild(1)]);
  const [returnRate, setReturnRate] = useState(0.06);
  const [costInflation, setCostInflation] = useState(0.05);
  const [stateRate, setStateRate] = useState(0.05);

  const stateCode = (plan.stateCode || '').toUpperCase();
  const hasStateDeduction = STATE_529_DEDUCTION_CAP[stateCode] > 0;

  const assumptions = useMemo(() => ({ returnRate, costInflation, startAge: 18, years: 4 }), [returnRate, costInflation]);

  const addChild = useCallback(() => setChildren(prev => [...prev, defaultChild(prev.length + 1)]), [setChildren]);
  const updateChild = useCallback((c) => setChildren(prev => prev.map(x => x.id === c.id ? c : x)), [setChildren]);
  const removeChild = useCallback((id) => setChildren(prev => prev.filter(x => x.id !== id)), [setChildren]);

  const summary = useMemo(
    () => summarizeHousehold(children, assumptions, stateCode, stateRate),
    [children, assumptions, stateCode, stateRate],
  );
  const projById = useMemo(() => {
    const m = {};
    for (const p of summary.children) m[p.id] = p;
    return m;
  }, [summary]);

  const overallColor = fundColor(summary.overallFundedPct);

  return (
    <div>
      <InfoBox title="Fund every kid's college without derailing your own retirement" color="var(--blue)" bgColor="rgba(96,165,250,0.08)">
        College costs inflate at <strong>~5%</strong> — nearly double general inflation — and multiple kids create a <strong>double-tuition crunch</strong> when their college years overlap. This projects each child's 529 year by year, tells you the <strong>monthly contribution to fully fund</strong> the share you'll cover, flags the <strong>peak overlap year</strong>, and values your <strong>state 529 tax deduction</strong>.
      </InfoBox>

      <Card style={{ marginTop: 16 }}>
        <SectionLabel>Assumptions</SectionLabel>
        <Slider label="529 investment return" value={Math.round(returnRate * 100)} onChange={v => setReturnRate(v / 100)} min={0} max={12} step={1} suffix="%" />
        <Slider label="College cost inflation" value={Math.round(costInflation * 100)} onChange={v => setCostInflation(v / 100)} min={0} max={10} step={1} suffix="%" />
        {hasStateDeduction && (
          <Slider label={`Your ${stateCode} marginal state tax rate`} value={Math.round(stateRate * 100)} onChange={v => setStateRate(v / 100)} min={0} max={13} step={1} suffix="%" />
        )}
        <div className="f12 dim" style={{ marginTop: 4 }}>
          Preset costs (today): in-state {fmt(SCHOOL_COSTS.public_in_state)}, out-of-state {fmt(SCHOOL_COSTS.public_out_state)}, private {fmt(SCHOOL_COSTS.private)} — total cost of attendance per year.
        </div>
      </Card>

      {/* Household summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
        <Stat label="Overall funded" value={`${Math.round(summary.overallFundedPct * 100)}%`} color={overallColor} sub={`${children.length} child${children.length !== 1 ? 'ren' : ''}`} />
        <Stat label="Total future cost" value={fmt(summary.totalFutureCost)} color="var(--blue)" sub="Covered portion, inflated" />
        <Stat label="Contributing now" value={`${fmt(summary.totalMonthlyContribution)}/mo`} sub="Across all 529s" />
        <Stat
          label="To fully fund"
          value={`${fmt(summary.totalMonthlyToFullyFund)}/mo`}
          color={summary.totalMonthlyToFullyFund > summary.totalMonthlyContribution ? 'var(--warn)' : 'var(--accent)'}
          sub={summary.totalMonthlyToFullyFund > summary.totalMonthlyContribution
            ? `+${fmt(summary.totalMonthlyToFullyFund - summary.totalMonthlyContribution)}/mo more`
            : 'On track ✓'}
        />
      </div>

      {hasStateDeduction && summary.stateDeductionSavings > 0 && (
        <Card style={{ marginTop: 16 }}>
          <div className="f13 muted lh-loose">
            Your {stateCode} 529 deduction is worth about <strong style={{ color: 'var(--accent)' }}>{fmt(summary.stateDeductionSavings)}/yr</strong> in state tax on your current contributions
            {STATE_529_DEDUCTION_CAP[stateCode] < 999999 ? <> (capped at {fmt(STATE_529_DEDUCTION_CAP[stateCode])}/yr of contributions, MFJ)</> : <> (full deduction)</>}.
          </div>
        </Card>
      )}

      <OverlapTimeline summary={summary} />

      {/* Children */}
      <div style={{ marginTop: 24 }}>
        <SectionLabel>Your children</SectionLabel>
        {children.map(c => (
          <ChildCard key={c.id} child={c} proj={projById[c.id] || projectChild(c, assumptions)} onChange={updateChild} onRemove={() => removeChild(c.id)} />
        ))}
        <button onClick={addChild}
          style={{
            background: 'var(--bg2)', border: '1px solid var(--blue)', color: 'var(--blue)',
            borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 8,
          }}>
          + Add a child
        </button>
      </div>

      {summary.totalMonthlyToFullyFund > summary.totalMonthlyContribution && (
        <InfoBox title="Balancing college against retirement" color="var(--warn)" style={{ marginTop: 24 }}>
          Fully funding college would take <strong>{fmt(summary.totalMonthlyToFullyFund)}/mo</strong> — {fmt(summary.totalMonthlyToFullyFund - summary.totalMonthlyContribution)}/mo above what you're saving today. Before redirecting cash flow, remember the order of priorities most planners recommend: <strong>capture the 401(k) match and fund retirement first</strong> — you can borrow for college, but not for retirement. Consider covering a smaller share, in-state options, or the overlap-year crunch on the chart above.
        </InfoBox>
      )}
    </div>
  );
}
