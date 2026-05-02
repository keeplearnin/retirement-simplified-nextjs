'use client';

import Card from '@/components/ui/Card';
import { fmt } from '@/lib/format';

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

export default function VerdictResult({ output, onRestart }) {
  const color = STATUS_COLORS[output.gapStatus];
  const label = STATUS_LABELS[output.gapStatus];
  const isAhead = output.gapStatus === 'ahead';
  const gapAmount = Math.abs(output.savingsGap);

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
