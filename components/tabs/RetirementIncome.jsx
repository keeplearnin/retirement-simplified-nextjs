'use client';

import { useState } from 'react';
import SocialSecurity from '@/components/tabs/SocialSecurity';
import WithdrawalStrategy from '@/components/tabs/WithdrawalStrategy';
import TaxTorpedo from '@/components/tabs/TaxTorpedo';

/**
 * RetirementIncome — merges the three "money coming in" tabs into one
 * surface. Three sub-views, one tab in the nav:
 *
 *   • Claim Strategy (Social Security): when to claim, breakeven math,
 *     spousal/survivor strategies.
 *   • Withdrawal Sequence: which accounts to draw from in what order,
 *     RMD planning, safe withdrawal rate analysis.
 *   • Tax Torpedo: educational explainer about the provisional-income
 *     tax cliff that can hit early-retirement withdrawals.
 *
 * These three were independent top-level tabs prior to the Plan/Coach/
 * Learn restructure. They're all "how do I generate income in
 * retirement?" — merging them gives users one mental home for the
 * drawdown decision and demotes Tax Torpedo from "tab" to "tip".
 */
export default function RetirementIncome() {
  const [view, setView] = useState('claim');

  const segments = [
    { id: 'claim', label: 'Claim Strategy', sub: 'Social Security timing' },
    { id: 'withdrawal', label: 'Withdrawal Sequence', sub: 'Account drawdown order' },
    { id: 'torpedo', label: 'Tax Torpedo', sub: 'Provisional-income trap explainer' },
  ];

  return (
    <div>
      <SegmentedControl segments={segments} value={view} onChange={setView} />
      {view === 'claim' && <SocialSecurity />}
      {view === 'withdrawal' && <WithdrawalStrategy />}
      {view === 'torpedo' && <TaxTorpedo />}
    </div>
  );
}

// Same segmented-control vocabulary as RothStrategy. Could be hoisted to
// components/ui/SegmentedControl if a third merged tab needs it, but two
// uses isn't enough to justify the abstraction yet (rule of three).
function SegmentedControl({ segments, value, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}
    >
      {segments.map((seg) => {
        const active = seg.id === value;
        return (
          <button
            key={seg.id}
            onClick={() => onChange(seg.id)}
            style={{
              flex: '1 1 auto',
              minWidth: 140,
              padding: '8px 14px',
              borderRadius: 8,
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--bg)' : 'var(--text)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--sans)',
              textAlign: 'center',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700 }}>{seg.label}</div>
            {seg.sub && (
              <div
                style={{
                  fontSize: 11,
                  marginTop: 2,
                  color: active ? 'var(--bg)' : 'var(--text-muted)',
                  opacity: active ? 0.85 : 1,
                  fontWeight: 500,
                }}
              >
                {seg.sub}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
