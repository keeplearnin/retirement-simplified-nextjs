'use client';

import Card from '@/components/ui/Card';
import { fmt } from '@/lib/format';
import { computeHealthcare } from '@/lib/healthcare';

/**
 * When the user accepts the "Build a full plan" CTA, copy their three core
 * verdict inputs into the main plan in localStorage so the My Plan tab loads
 * with their numbers instead of the generic defaults. Best-effort — silent
 * failure on quota errors so the navigation still happens.
 */
function promoteVerdictToPlan(input) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('myplan-v1');
    const existing = raw ? JSON.parse(raw) : {};
    const merged = {
      ...existing,
      currentAge: input.currentAge,
      retireAge: input.retirementAge,
      filingStatus: input.filingStatus,
      monthlyContribution: input.monthlyContribution,
      // Park current savings in 401(k) by default — user can re-allocate
      // across account types in the My Plan sliders.
      savings401k: input.currentSavings,
      incomeSources: [
        ...(existing.incomeSources?.filter(s => s.type !== 'salary') || []),
        { id: 1, type: 'salary', label: 'Salary', amount: input.annualIncome, growthRate: 3 },
      ],
    };
    localStorage.setItem('myplan-v1', JSON.stringify(merged));
    localStorage.setItem('retirement-onboarded', 'true');
  } catch {
    // ignore — navigation still proceeds with whatever's in localStorage
  }
}

const STATUS_COLORS = {
  'ahead': 'var(--accent)',
  'on-track': 'var(--accent)',
  'behind': 'var(--warn)',
  'significantly-behind': 'var(--danger)',
};

const STATUS_LABELS = {
  'ahead': 'Ahead',
  'on-track': 'On track',
  'behind': 'Behind',
  'significantly-behind': 'Significantly behind',
};

export default function VerdictResult({ output, input, onRestart }) {
  const color = STATUS_COLORS[output.gapStatus];
  const label = STATUS_LABELS[output.gapStatus];
  const isAhead = output.gapStatus === 'ahead';
  const gapAmount = Math.abs(output.savingsGap);

  const healthcare = input ? computeHealthcare({
    currentAge: input.currentAge,
    retirementAge: input.retirementAge,
    longevityAge: 90,
    annualIncome: input.annualIncome,
    householdSize: input.filingStatus === 'mfj' ? 2 : 1,
    filingStatus: input.filingStatus,
  }) : null;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      {/* Hero verdict */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 11, color, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>
          {label}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--text)', lineHeight: 1.3, margin: '0 auto', maxWidth: 560 }}>
          {output.verdictText}
        </h1>
      </div>

      {/* Gap visual */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Where you are
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
              {fmt(output.benchmarkSavings - output.savingsGap)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              {isAhead ? 'Ahead by' : 'Behind by'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>
              {fmt(gapAmount)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Benchmark for your age
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-muted)' }}>
              {fmt(output.benchmarkSavings)}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic' }}>
          Benchmark: Fidelity age-based savings multiple (interpolated for your exact age).
        </div>
      </Card>

      {/* Projection vs need */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Projected at retirement
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              {fmt(output.projectedBalance)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              At 7% growth, with current contributions.
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Estimated need (4% rule)
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              {fmt(output.estimatedNeed)}
            </div>
            <div style={{ fontSize: 11, color: output.shortfallAtRetirement > 0 ? 'var(--warn)' : 'var(--accent)', marginTop: 2 }}>
              {output.shortfallAtRetirement > 0
                ? `${fmt(output.shortfallAtRetirement)} shortfall at retirement.`
                : 'On track to fully cover your need.'}
            </div>
          </div>
        </div>
      </Card>

      {/* Healthcare gap — the bridge from retirement to Medicare */}
      {healthcare && healthcare.preMedicareYears > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                Healthcare bridge: retirement → 65
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                {fmt(healthcare.preMedicareTotalCost)} over {healthcare.preMedicareYears} year{healthcare.preMedicareYears === 1 ? '' : 's'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Estimated ACA marketplace premium of {fmt(healthcare.annualAcaNetPremium)}/yr per person, after a {fmt(healthcare.annualAcaSubsidy)}/yr subsidy at your income level.
                Most planners ignore this — it's often the largest line item in early retirement.
              </div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Lifetime
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warn)' }}>
                {fmt(healthcare.lifetimeHealthcareCost)}
              </div>
              <div style={{ fontSize: 11, color: healthcare.vsBenchmark > 0 ? 'var(--warn)' : 'var(--accent)', marginTop: 2 }}>
                vs {fmt(healthcare.fidelityBenchmark)} avg
              </div>
            </div>
          </div>
        </Card>
      )}
      {healthcare && healthcare.preMedicareYears === 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Lifetime healthcare cost (Medicare era)
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {fmt(healthcare.lifetimeHealthcareCost)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Part B + Medigap + Part D, baseline (no IRMAA). Fidelity's benchmark for someone in your situation: {fmt(healthcare.fidelityBenchmark)}.
          </div>
        </Card>
      )}

      {/* Top 3 actions */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>
          Your top 3 moves
        </div>
        {output.topActions.map((action, i) => (
          <Card key={action.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                background: 'var(--accent-dim)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  {action.action}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {action.detail}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Impact
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                  +{fmt(action.dollarImpact)}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Footer actions */}
      <div style={{ display: 'flex', gap: 12, marginTop: 28, justifyContent: 'center' }}>
        <button
          onClick={onRestart}
          style={{
            padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--sans)',
          }}
        >
          ← Adjust inputs
        </button>
        <a
          href="/"
          onClick={() => input && promoteVerdictToPlan(input)}
          style={{
            padding: '10px 20px', borderRadius: 10, textDecoration: 'none',
            border: 'none', background: 'var(--accent)',
            color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'var(--sans)',
          }}
        >
          Build a full plan →
        </a>
      </div>
    </div>
  );
}
