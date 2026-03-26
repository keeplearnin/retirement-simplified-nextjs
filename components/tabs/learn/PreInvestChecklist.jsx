'use client';

import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';

export default function PreInvestChecklist({ hasEmergency, setHasEmergency, hasDebt, setHasDebt, has401k, setHas401k }) {
  const checklistReady = hasEmergency && !hasDebt && has401k;

  return (
    <Card>
      <SectionLabel>Before You Invest</SectionLabel>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
        Make sure you&apos;ve checked these boxes before putting money in the market.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {/* Emergency Fund */}
        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          padding: '16px 20px',
          background: hasEmergency ? 'var(--accent-dim)' : 'var(--bg)',
          borderRadius: 8,
          border: hasEmergency ? '1px solid var(--accent)44' : '1px solid var(--border)',
          cursor: 'pointer',
          transition: 'all .2s',
        }}>
          <input
            type="checkbox"
            checked={hasEmergency}
            onChange={e => setHasEmergency(e.target.checked)}
            style={{ marginTop: 2, accentColor: 'var(--accent)', width: 18, height: 18, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Emergency Fund (3-6 months)</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              Keep this in a high-yield savings account (currently ~4-5% APY). This isn&apos;t an investment — it&apos;s insurance against unexpected expenses.
            </div>
          </div>
        </label>

        {/* High-Interest Debt */}
        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          padding: '16px 20px',
          background: !hasDebt ? 'var(--accent-dim)' : 'var(--bg)',
          borderRadius: 8,
          border: !hasDebt ? '1px solid var(--accent)44' : '1px solid var(--border)',
          cursor: 'pointer',
          transition: 'all .2s',
        }}>
          <input
            type="checkbox"
            checked={!hasDebt}
            onChange={e => setHasDebt(!e.target.checked)}
            style={{ marginTop: 2, accentColor: 'var(--accent)', width: 18, height: 18, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No High-Interest Debt (&gt;6-7%)</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              Credit cards, personal loans, and other high-rate debt should be paid off first. The stock market averages ~7-10% — you can&apos;t reliably out-earn 20%+ credit card interest.
            </div>
          </div>
        </label>

        {/* 401k Match */}
        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          padding: '16px 20px',
          background: has401k ? 'var(--accent-dim)' : 'var(--bg)',
          borderRadius: 8,
          border: has401k ? '1px solid var(--accent)44' : '1px solid var(--border)',
          cursor: 'pointer',
          transition: 'all .2s',
        }}>
          <input
            type="checkbox"
            checked={has401k}
            onChange={e => setHas401k(e.target.checked)}
            style={{ marginTop: 2, accentColor: 'var(--accent)', width: 18, height: 18, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Getting Full 401(k) Match</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              If your employer offers a 401(k) match, contribute at least enough to get the full match. A typical 50% match on 6% of salary is an instant 50% return.
            </div>
          </div>
        </label>
      </div>

      {/* Status */}
      <div style={{
        padding: '16px 20px',
        borderRadius: 8,
        background: checklistReady ? 'var(--success)15' : 'var(--warn)15',
        border: checklistReady ? '1px solid var(--success)33' : '1px solid var(--warn)33',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 24 }}>{checklistReady ? '🟢' : '🟡'}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: checklistReady ? 'var(--success)' : 'var(--warn)' }}>
            {checklistReady ? 'You&apos;re Ready to Invest!' : 'Almost There'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 2 }}>
            {checklistReady
              ? 'Your financial foundation is solid. You can confidently start investing in index funds.'
              : 'Complete the items above before investing. Building a strong foundation prevents you from having to sell investments early.'}
          </div>
        </div>
      </div>
    </Card>
  );
}
