'use client';

import { useState } from 'react';
import TaxAware from '@/components/tabs/TaxAware';
import RothLadder from '@/components/tabs/RothLadder';

/**
 * RothStrategy — merges the two Roth-decision tabs into one surface.
 *
 *   • Contributions (accumulation phase): TaxAware tab, which compares
 *     Roth vs Traditional contributions for your CURRENT working years.
 *   • Conversions (retirement phase): RothLadder tab, which models
 *     converting Traditional → Roth between retirement and age 73 to
 *     reduce future RMDs and lifetime tax.
 *
 * These were two separate top-level tabs prior to the Plan/Coach/Learn
 * restructure. They're the same decision viewed at two life stages, so
 * merging them gives users one mental home for "everything Roth".
 */
export default function RothStrategy() {
  const [view, setView] = useState('contributions');

  const segments = [
    { id: 'contributions', label: 'Contributions', sub: 'Roth vs Trad while working' },
    { id: 'conversions', label: 'Conversions', sub: 'Roth ladder in retirement' },
  ];

  return (
    <div>
      <SegmentedControl segments={segments} value={view} onChange={setView} />
      {view === 'contributions' && <TaxAware />}
      {view === 'conversions' && <RothLadder />}
    </div>
  );
}

// Reusable segmented control for the merged tabs. Same visual vocabulary
// as the top-level nav pills — consistent across the app.
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
