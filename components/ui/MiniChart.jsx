'use client';

import React from 'react';
import { fmt } from '@/lib/format';
import { GRID_FRACS } from '@/lib/constants';

/**
 * MiniChart — the house line-chart voice.
 *
 * Treatment (applies to every line chart in the product):
 *   - hairline horizontal grid only, tabular axis labels in the UI face
 *   - lines end in a terminal dot with the final value annotated at the
 *     end of the line, in the line's color — the chart answers "where do
 *     I end up?" without a tooltip
 *   - round caps/joins, no drop shadows, no gradients
 */
const MiniChart = React.memo(function MiniChart({ data, width = 500, height = 200, lines, yMax: yMaxOverride }) {
  const yMax = yMaxOverride || Math.max(...data.flatMap(d => lines.map(l => d[l.key] || 0))) * 1.05;
  // Right margin reserves room for the end-of-line value annotations.
  const H = height, W = width, L = 55, R = W - 52, T = height - 40, B = 20;
  const x = (i) => L + (i / (data.length - 1)) * (R - L);
  const y = (v) => H - B - ((v || 0) / yMax) * T;

  // Spread end-labels vertically if two lines terminate too close together.
  const endpoints = lines.map((line) => ({ line, ex: x(data.length - 1), ey: y(data[data.length - 1]?.[line.key]) }));
  const sorted = [...endpoints].sort((a, b) => a.ey - b.ey);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].ey - sorted[i - 1].ey < 12) sorted[i].ey = sorted[i - 1].ey + 12;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      {GRID_FRACS.map((f, i) => (
        <g key={i}>
          <line x1={L} y1={H - B - f * T} x2={R} y2={H - B - f * T} stroke="var(--border)" strokeWidth=".5" />
          <text x={L - 6} y={H - B + 3 - f * T} fill="var(--text-dim)" fontSize="9" textAnchor="end" fontFamily="var(--sans)" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(yMax * f)}</text>
        </g>
      ))}
      {lines.map((line, li) => {
        const pts = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[line.key]).toFixed(1)}`).join(' ');
        return (
          <path
            key={li}
            d={pts}
            fill="none"
            stroke={line.color}
            strokeWidth={line.width || 2}
            strokeDasharray={line.dash || 'none'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
      {/* Terminal dots + end-value annotations */}
      {endpoints.map(({ line, ex, ey }, li) => {
        const labelY = sorted.find((s) => s.line === line)?.ey ?? ey;
        const endVal = data[data.length - 1]?.[line.key] || 0;
        return (
          <g key={li}>
            <circle cx={ex} cy={ey} r={3} fill={line.color} />
            <text x={ex + 7} y={labelY + 3} fill={line.color} fontSize="10" fontWeight="600" fontFamily="var(--sans)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmt(endVal)}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      {lines.map((line, li) => (
        <g key={li}>
          <line x1={L + li * 150} y1={9} x2={L + 14 + li * 150} y2={9} stroke={line.color} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={line.dash || 'none'} />
          <text x={L + 20 + li * 150} y={12} fill="var(--text-muted)" fontSize="10" fontFamily="var(--sans)">{line.label}</text>
        </g>
      ))}
    </svg>
  );
});

export default MiniChart;
