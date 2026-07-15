'use client';

import { useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import Slider from '@/components/ui/Slider';
import SectionLabel from '@/components/ui/SectionLabel';
import CalcShell from '@/components/calculators/CalcShell';
import { detectIrmaaCliff, IRMAA_TABLES } from '@/lib/taxEngine';
import { fmt } from '@/lib/format';

export default function IrmaaChecker() {
  const [filingStatus, setFilingStatus] = useState('single');
  const [magi, setMagi] = useState(105000);

  const cliff = useMemo(() => detectIrmaaCliff(magi, filingStatus, 10_000), [magi, filingStatus]);
  const table = IRMAA_TABLES[filingStatus];
  const perPerson = filingStatus === 'mfj' ? 2 : 1;

  return (
    <CalcShell
      slug="irmaa-cliff-checker"
      title="IRMAA Cliff Checker — Are You About to Trigger a Medicare Surcharge?"
      intro="IRMAA (the Income-Related Monthly Adjustment Amount) raises your Medicare Part B premium based on your MAGI from two years ago. The tiers are cliffs, not phase-ins: one extra dollar of income — a Roth conversion, a capital gain, an RMD — can cost the full year's surcharge. Check how close you are."
    >
      <Card>
        <SectionLabel>Your Inputs</SectionLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['single', 'Single'], ['mfj', 'Married filing jointly']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilingStatus(val)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                border: filingStatus === val ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: filingStatus === val ? 'var(--accent-dim, rgba(16,185,129,0.08))' : 'transparent',
                color: filingStatus === val ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--sans)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <Slider label="Expected MAGI (modified adjusted gross income)" value={magi} onChange={setMagi} min={30000} max={800000} step={1000} format={fmt} />
      </Card>

      <div className="stats-row" style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <Stat
          icon={cliff.annualSurcharge > 0 ? '💸' : '✅'}
          label="Your Current Tier"
          value={cliff.annualSurcharge > 0 ? `${fmt(cliff.annualSurcharge * perPerson)}/yr` : 'No surcharge'}
          sub={cliff.annualSurcharge > 0 ? `Part B surcharge${perPerson === 2 ? ' (both spouses)' : ''}` : 'Below the first IRMAA threshold'}
          color={cliff.annualSurcharge > 0 ? 'var(--warn)' : 'var(--accent)'}
        />
        <Stat
          icon={cliff.atRisk ? '⚠️' : '📏'}
          label="Distance to Next Cliff"
          value={isFinite(cliff.nextThreshold) ? fmt(cliff.distanceToNextCliff) : 'Top tier'}
          sub={isFinite(cliff.nextThreshold) ? `Next tier starts above ${fmt(cliff.nextThreshold)}` : 'No higher tier exists'}
          color={cliff.atRisk ? 'var(--danger)' : 'var(--blue)'}
        />
      </div>

      {cliff.atRisk && (
        <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--danger)', background: 'rgba(239,68,68,0.06)', fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--danger)' }}>You are within {fmt(cliff.distanceToNextCliff)} of the next tier.</strong>{' '}
          Crossing it costs the full surcharge for the year{perPerson === 2 ? ' — for each spouse' : ''}. Common
          fixes: trim IRA withdrawals, defer a capital gain, use Roth dollars for the marginal spending, or make a
          Qualified Charitable Distribution.
        </div>
      )}

      <Card style={{ marginTop: 16 }}>
        <SectionLabel>2026 IRMAA Tiers ({filingStatus === 'mfj' ? 'Married Filing Jointly' : 'Single'})</SectionLabel>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420, fontFamily: 'var(--sans)', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px 8px 0', fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>MAGI up to</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>Monthly surcharge</th>
                <th style={{ textAlign: 'right', padding: '8px 0 8px 12px', fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>Annual cost{perPerson === 2 ? ' (couple)' : ''}</th>
              </tr>
            </thead>
            <tbody>
              {table.map((tier, i) => {
                const isCurrent = i === cliff.currentTier;
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)', background: isCurrent ? 'var(--accent-dim, rgba(16,185,129,0.07))' : 'transparent' }}>
                    <td style={{ padding: '9px 12px 9px 0', color: 'var(--text)', fontWeight: isCurrent ? 700 : 400 }}>
                      {isFinite(tier.magiThreshold) ? fmt(tier.magiThreshold) : 'Above all thresholds'}
                      {isCurrent && <span style={{ color: 'var(--accent)', fontSize: 11, marginLeft: 8 }}>← you</span>}
                    </td>
                    <td style={{ textAlign: 'right', padding: '9px 12px', color: 'var(--text-muted)' }}>
                      {tier.monthlyPartBSurcharge > 0 ? `$${tier.monthlyPartBSurcharge.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '9px 0 9px 12px', color: tier.monthlyPartBSurcharge > 0 ? 'var(--warn)' : 'var(--text-dim)', fontWeight: 600 }}>
                      {tier.monthlyPartBSurcharge > 0 ? fmt(Math.round(tier.monthlyPartBSurcharge * 12 * perPerson)) : '$0'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.6 }}>
          Part B surcharges shown (2026, SSA POMS HI 01101.020). Part D carries additional smaller surcharges at the
          same thresholds. IRMAA is assessed on MAGI from two years prior — plan conversions with the lag in mind.
        </p>
      </Card>
    </CalcShell>
  );
}
