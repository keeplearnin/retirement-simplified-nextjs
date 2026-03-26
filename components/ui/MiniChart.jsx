'use client';

import React from 'react';
import { fmt } from '@/lib/format';
import { GRID_FRACS } from '@/lib/constants';

const MiniChart = React.memo(function MiniChart({ data, width = 500, height = 200, lines, yMax: yMaxOverride }) {
  const yMax = yMaxOverride || Math.max(...data.flatMap(d => lines.map(l => d[l.key] || 0))) * 1.05;
  const H = height, W = width, L = 55, R = W - 10, T = height - 40, B = 20;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      {GRID_FRACS.map((f, i) => (
        <g key={i}>
          <line x1={L} y1={H - B - f * T} x2={R} y2={H - B - f * T} stroke="var(--border)" strokeWidth=".5" />
          <text x={L - 5} y={H - B + 4 - f * T} fill="var(--text-dim)" fontSize="9" textAnchor="end" fontFamily="Outfit">{fmt(yMax * f)}</text>
        </g>
      ))}
      {lines.map((line, li) => {
        const pts = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${L + (i / (data.length - 1)) * (R - L)},${H - B - ((d[line.key] || 0) / yMax) * T}`).join(' ');
        return <path key={li} d={pts} fill="none" stroke={line.color} strokeWidth={line.width || 2} strokeDasharray={line.dash || 'none'} />;
      })}
      {lines.map((line, li) => (
        <g key={li}>
          <circle cx={L + li * 140} cy={10} r={4} fill={line.color} />
          <text x={L + 10 + li * 140} y={14} fill="var(--text-muted)" fontSize="10" fontFamily="Outfit">{line.label}</text>
        </g>
      ))}
    </svg>
  );
});

export default MiniChart;
