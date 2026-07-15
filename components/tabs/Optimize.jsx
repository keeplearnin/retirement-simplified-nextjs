'use client';

import { useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import Button from '@/components/ui/Button';
import { fmt } from '@/lib/format';
import { usePlan } from '@/components/PlanProvider';
import { runDecisionEngine } from '@/lib/decisionEngine';

const CATEGORY_COLORS = {
  'Social Security': 'var(--blue)',
  'Roth Conversions': 'var(--accent)',
  'Medicare / IRMAA': 'var(--warn)',
  'Plan Repair': 'var(--danger)',
};

function ActionCard({ action, rank, onApply, applied }) {
  const [showMath, setShowMath] = useState(false);
  const color = CATEGORY_COLORS[action.category] || 'var(--accent)';

  return (
    <Card style={{ borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', fontFamily: 'var(--sans)' }}>#{rank}</span>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color, fontFamily: 'var(--sans)' }}>
              {action.category}
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--text)', lineHeight: 1.35 }}>
            {action.title}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 8 }}>
            {action.detail}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--serif)', color }}>
            {action.dollarValue >= 0 ? '+' : ''}{fmt(action.dollarValue)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
            lifetime impact
          </div>
          {action.yearsGain > 0 && (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
              +{action.yearsGain} yr{action.yearsGain > 1 ? 's' : ''} of coverage
            </div>
          )}
        </div>
      </div>

      {/* Roth execution schedule */}
      {action.schedule && action.schedule.length > 0 && (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--sans)', minWidth: 320 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 12px 4px 0', color: 'var(--text-dim)', fontWeight: 600 }}>Age</th>
                {action.schedule.slice(0, 8).map(s => (
                  <th key={s.age} style={{ textAlign: 'right', padding: '4px 10px', color: 'var(--text-dim)', fontWeight: 600 }}>{s.age}</th>
                ))}
                {action.schedule.length > 8 && <th style={{ padding: '4px 10px', color: 'var(--text-dim)' }}>…</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '4px 12px 4px 0', color: 'var(--text-muted)' }}>Convert</td>
                {action.schedule.slice(0, 8).map(s => (
                  <td key={s.age} style={{ textAlign: 'right', padding: '4px 10px', color: 'var(--text)' }}>{fmt(s.conversion)}</td>
                ))}
                {action.schedule.length > 8 && <td style={{ padding: '4px 10px', color: 'var(--text-dim)' }}>…</td>}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="ghost" size="sm" onClick={() => setShowMath(v => !v)}>
          {showMath ? 'Hide the math' : 'Show the math'}
        </Button>
        {action.apply && !applied && (
          <Button variant="primary" size="sm" onClick={() => onApply(action)}>
            Apply to My Plan
          </Button>
        )}
        {action.apply && applied && (
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--sans)' }}>
            ✓ Applied
          </span>
        )}
      </div>

      {showMath && (
        <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {action.math.map((step, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

export default function Optimize() {
  const { plan, updatePlan, updateIncome } = usePlan();
  const [appliedIds, setAppliedIds] = useState([]);

  // ~16 full projections; runs in a few ms. Recomputes when the plan changes
  // (including right after an Apply), so ranks and dollars stay live.
  const result = useMemo(() => {
    try {
      return runDecisionEngine(plan);
    } catch (e) {
      console.error('Decision engine failed:', e);
      return null;
    }
  }, [plan]);

  function applyAction(action) {
    const a = action.apply;
    if (!a) return;
    if (a.type === 'plan-field') {
      updatePlan(a.key, a.value);
    } else if (a.type === 'ss-start-age') {
      const src = plan.incomeSources.find(s => s.id === a.sourceId);
      if (src) updateIncome(a.sourceId, { ...src, startAge: a.startAge });
    }
    setAppliedIds(ids => [...ids, action.id]);
  }

  if (!result) {
    return (
      <div className="fade-up">
        <InfoBox icon="⚠️" title="Optimizer unavailable" color="var(--warn)">
          The decision engine hit an error with the current plan inputs. Check that your plan has valid ages and at least one income source.
        </InfoBox>
      </div>
    );
  }

  const { baseline, actions, totalOpportunity } = result;
  const covered = baseline.moneyLastsAge >= baseline.longevityAge;

  return (
    <div className="fade-up">
      <InfoBox icon="🎯" title="Decision Engine" color="var(--accent)" bgColor="var(--accent-dim, rgba(16,185,129,0.08))">
        Every recommendation below re-runs your full plan — taxes, Social Security taxability, RMDs, IRMAA,
        and the withdrawal waterfall — not a rule of thumb. Expand &ldquo;Show the math&rdquo; on any card to audit it.
      </InfoBox>

      {/* Baseline strip */}
      <div className="stats-row" style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <Stat
          icon={covered ? '✅' : '⚠️'}
          label="Money Lasts To"
          value={`Age ${baseline.moneyLastsAge}`}
          sub={covered ? `Covers your plan to ${baseline.longevityAge}` : `Plan runs to ${baseline.longevityAge} — gap to close`}
          color={covered ? 'var(--accent)' : 'var(--danger)'}
        />
        <Stat icon="🏔️" label="At Retirement" value={fmt(baseline.portfolioAtRetire)} sub="Projected portfolio" color="var(--blue)" />
        <Stat icon="🧾" label="Lifetime Tax" value={fmt(baseline.lifetimeTax)} sub="Baseline projection" color="var(--warn)" />
        <Stat
          icon="💡"
          label="Opportunity Found"
          value={totalOpportunity > 0 ? `+${fmt(totalOpportunity)}` : '$0'}
          sub={`${actions.length} recommendation${actions.length === 1 ? '' : 's'}`}
          color="var(--accent)"
        />
      </div>

      {/* Ranked actions */}
      {actions.length === 0 ? (
        <Card style={{ marginTop: 16, textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 18, fontFamily: 'var(--serif)', color: 'var(--text)' }}>
            No material optimizations found
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.6 }}>
            Your claiming age, conversion strategy, and withdrawal plan are already near-optimal
            under current assumptions. Re-check after any life change or each January when tax tables update.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
          {actions.map((action, i) => (
            <ActionCard
              key={action.id}
              action={action}
              rank={i + 1}
              onApply={applyAction}
              applied={appliedIds.includes(action.id)}
            />
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 18, lineHeight: 1.6 }}>
        Estimates use 2026 IRS/SSA/CMS figures and your plan assumptions. Roth conversion and IRMAA numbers
        are modeling aids, not tax advice — confirm execution details with a tax professional.
      </p>
    </div>
  );
}
