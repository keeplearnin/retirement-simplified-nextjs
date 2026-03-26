'use client';

import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import { quizQuestions } from './learnData';

export default function RiskQuizSection({ riskQuiz, setRiskQuiz, riskScore }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <Card>
        <SectionLabel>Risk Tolerance Quiz</SectionLabel>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          Answer these 5 questions to find your ideal investment mix.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {quizQuestions.map((q, qi) => (
            <div key={qi}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                {qi + 1}. {q.q}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {q.opts.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => {
                      const next = [...riskQuiz];
                      next[qi] = oi;
                      setRiskQuiz(next);
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: riskQuiz[qi] === oi ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: riskQuiz[qi] === oi ? 'var(--accent-dim)' : 'var(--bg)',
                      color: riskQuiz[qi] === oi ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: 12,
                      textAlign: 'left',
                      lineHeight: 1.4,
                      transition: 'all .15s',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionLabel>Your Risk Profile</SectionLabel>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: riskScore.color, fontFamily: 'var(--serif)' }}>
            {riskScore.level}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            Score: {riskQuiz.reduce((a, b) => a + b, 0)} / 15
          </div>
        </div>

        {/* Allocation Bar Chart */}
        <div style={{ marginBottom: 24 }}>
          {[
            { label: 'Stocks', value: riskScore.stock, color: 'var(--accent)' },
            { label: 'Bonds', value: riskScore.bond, color: 'var(--blue)' },
            { label: 'Cash', value: riskScore.cash, color: 'var(--text-dim)' },
          ].map(a => (
            <div key={a.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>{a.label}</span>
                <span style={{ color: a.color, fontWeight: 600 }}>{a.value}%</span>
              </div>
              <div style={{ width: '100%', height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${a.value}%`, height: '100%', background: a.color, borderRadius: 4, transition: 'width .4s ease' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Description */}
        <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 8, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
            {riskScore.level === 'Conservative' && 'You prioritize capital preservation over growth. Your portfolio emphasizes bonds and stable income with minimal stock exposure. Best for those near retirement or with low risk tolerance.'}
            {riskScore.level === 'Moderate' && 'You want a balance of growth and stability. A 60/40 stock-bond split has historically provided solid returns with manageable volatility. Good for mid-career investors.'}
            {riskScore.level === 'Growth' && 'You&apos;re comfortable with volatility in exchange for higher long-term returns. Heavy stock allocation with some bonds for stability. Best for those with 15+ years to retirement.'}
            {riskScore.level === 'Aggressive' && 'You want maximum growth and can stomach large short-term drops. Nearly all stocks with minimal bonds. Best for young investors with 20+ year time horizons.'}
          </div>
        </div>

        {/* Recommended Funds */}
        <SectionLabel>Recommended Funds</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {riskScore.stock > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>US Stocks ({riskScore.stock}%)</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600, fontFamily: 'monospace' }}>VTI / VTSAX</span>
            </div>
          )}
          {riskScore.bond > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Bonds ({riskScore.bond}%)</span>
              <span style={{ color: 'var(--blue)', fontWeight: 600, fontFamily: 'monospace' }}>BND / VBTLX</span>
            </div>
          )}
          {riskScore.cash > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Cash ({riskScore.cash}%)</span>
              <span style={{ color: 'var(--text-dim)', fontWeight: 600, fontFamily: 'monospace' }}>HYSA / VMFXX</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
