'use client';

import { descArc } from '@/lib/format';

export default function Donut({ segs, label, size = 160, strokeWidth = 28, radius = 70 }) {
  const center = (size / 160) * 100;
  const viewBox = `0 0 ${center * 2} ${center * 2}`;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox={viewBox} style={{ width: '100%', maxWidth: size, display: 'block', margin: '0 auto' }}>
        {segs.map((seg, i) => {
          const gap = 2, sA = (seg.start / 100) * 360 + gap, eA = (seg.end / 100) * 360 - gap;
          if (eA <= sA) return null;
          return <path key={i} d={descArc(center, center, radius, sA, eA)} fill="none" stroke={seg.color} strokeWidth={strokeWidth} strokeLinecap="round" />;
        })}
        {label && <text x={center} y={center + 5} textAnchor="middle" fill="var(--text-muted)" fontSize="12" fontFamily="Outfit" fontWeight="600">{label}</text>}
      </svg>
    </div>
  );
}
