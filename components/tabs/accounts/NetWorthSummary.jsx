'use client';

import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import Donut from '@/components/ui/Donut';
import { fmt, fmtFull } from '@/lib/format';

export default function NetWorthSummary({
  totalNetWorth, monthChange, retirementTotal, taxableTotal, cashTotal, debtTotal,
  linked, categorySegs, allocationSegs,
}) {
  return (
    <>
      {/* Aggregated stats */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <Stat label="Total Net Worth" value={fmt(totalNetWorth)} color="var(--accent)"
          sub={<span style={{ color: monthChange.amount >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
            {monthChange.amount >= 0 ? '+' : ''}{fmtFull(monthChange.amount)} ({monthChange.pct}%) this month
          </span>}
        />
        <Stat label="Retirement" value={fmt(retirementTotal)} color="var(--accent)"
          sub={`${linked.length} institution${linked.length !== 1 ? 's' : ''} linked`}
        />
        <Stat label="Taxable Investments" value={fmt(taxableTotal)} color="var(--blue)" />
        <Stat label="Cash & Savings" value={fmt(cashTotal)} color="var(--purple)" />
        {debtTotal > 0 && <Stat label="Debt" value={`-${fmt(debtTotal)}`} color="var(--danger)" />}
      </div>

      {/* Charts row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* Category breakdown donut */}
        {categorySegs.length > 0 && (
          <Card style={{ flex: '1 1 240px', padding: 20 }}>
            <SectionLabel>Account Type Breakdown</SectionLabel>
            <Donut segs={categorySegs} label={fmt(totalNetWorth)} size={150} />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {categorySegs.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--text-muted)' }}>{s.label}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{s.pct.toFixed(1)}%</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11, minWidth: 60, textAlign: 'right' }}>{fmtFull(s.value)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Asset allocation donut */}
        {allocationSegs.length > 0 && (
          <Card style={{ flex: '1 1 240px', padding: 20 }}>
            <SectionLabel>Asset Allocation (Investments)</SectionLabel>
            <Donut segs={allocationSegs} label="Allocation" size={150} />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {allocationSegs.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--text-muted)' }}>{s.label}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{s.pct}%</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
