'use client';

import Card from '@/components/ui/Card';
import Slider from '@/components/ui/Slider';
import SectionLabel from '@/components/ui/SectionLabel';
import MiniChart from '@/components/ui/MiniChart';
import { fmt } from '@/lib/format';

export default function DCACalculator({ investAmt, setInvestAmt, investFreq, setInvestFreq, dcaData }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <Card>
        <SectionLabel>Dollar-Cost Averaging Calculator</SectionLabel>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          See how consistent investing grows over 30 years at an average 7% annual return.
        </p>
        <Slider
          label="Investment Amount"
          value={investAmt}
          onChange={setInvestAmt}
          min={50}
          max={5000}
          step={50}
          prefix="$"
        />
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Frequency</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'weekly', label: 'Weekly' },
              { id: 'biweekly', label: 'Bi-weekly' },
              { id: 'monthly', label: 'Monthly' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setInvestFreq(f.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: investFreq === f.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: investFreq === f.id ? 'var(--accent-dim)' : 'var(--bg)',
                  color: investFreq === f.id ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  transition: 'all .15s',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
          <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Total Contributed</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--serif)' }}>
              {fmt(dcaData[dcaData.length - 1]?.contributed || 0)}
            </div>
          </div>
          <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Portfolio Value</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--serif)' }}>
              {fmt(dcaData[dcaData.length - 1]?.balance || 0)}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Growth from compounding: <strong style={{ color: 'var(--success)' }}>{fmt((dcaData[dcaData.length - 1]?.balance || 0) - (dcaData[dcaData.length - 1]?.contributed || 0))}</strong>
          </span>
        </div>
      </Card>

      <Card>
        <SectionLabel>Growth Over 30 Years</SectionLabel>
        <MiniChart
          data={dcaData}
          height={260}
          lines={[
            { key: 'balance', label: 'Portfolio Value', color: 'var(--accent)', width: 2 },
            { key: 'contributed', label: 'Total Contributed', color: 'var(--text-dim)', width: 1.5, dash: '4 2' },
          ]}
        />
        <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 8, marginTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
            The gap between the lines is <strong style={{ color: 'var(--accent)' }}>compound growth</strong> — money your money earned. The longer you invest, the more compounding dominates. After 30 years, investment gains typically exceed your total contributions.
          </div>
        </div>
      </Card>
    </div>
  );
}
