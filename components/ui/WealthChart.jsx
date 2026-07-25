'use client';

import { useMemo, useRef, useState } from 'react';
import { fmt } from '@/lib/format';

/**
 * WealthChart — the flagship interactive projection canvas.
 *
 * One full-width area chart of household wealth by age with:
 *  - hover/touch scrubbing: a guide line, a dot, and a styled tooltip
 *    showing that year's exact dollars (balance, income, spending, taxes)
 *  - the retirement year marked with a vertical rule + label
 *  - the shortfall region (after money runs out) shaded in danger tint
 *
 * Pure presentational component — all numbers come from the projection rows.
 */
const W = 920;
const H = 250;
const PAD_L = 54;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 26;

export default function WealthChart({ rows, retireAge, moneyLastsAge, covered, height = 240 }) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // { idx, px } in wrapper pixels

  const model = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const maxBal = Math.max(...rows.map(r => r.portfolioEndBalance), 1);
    const x = (i) => PAD_L + (i / Math.max(1, rows.length - 1)) * (W - PAD_L - PAD_R);
    const y = (v) => H - PAD_B - (v / maxBal) * (H - PAD_T - PAD_B);

    const line = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(r.portfolioEndBalance).toFixed(1)}`).join(' ');
    const area = `${line} L${x(rows.length - 1).toFixed(1)},${H - PAD_B} L${PAD_L},${H - PAD_B} Z`;

    const retireIdx = rows.findIndex(r => r.age === retireAge);
    const brokeIdx = covered ? -1 : rows.findIndex(r => r.age === moneyLastsAge);

    // Y gridlines at quarter steps of a rounded-up max.
    const gridVals = [0.25, 0.5, 0.75, 1].map(f => maxBal * f);
    // X ticks every 5 years, aligned to multiples of 5.
    const ticks = rows
      .map((r, i) => ({ age: r.age, i }))
      .filter(t => t.age % 5 === 0);

    return { maxBal, x, y, line, area, retireIdx, brokeIdx, gridVals, ticks };
  }, [rows, retireAge, moneyLastsAge, covered]);

  if (!model || !rows || rows.length === 0) return null;
  const { x, y, line, area, retireIdx, brokeIdx, gridVals, ticks } = model;

  // Map a pointer event to the nearest row index.
  const scrub = (clientX) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = (clientX - rect.left) / rect.width;         // 0..1 across wrapper
    const svgX = frac * W;                                    // into viewBox units
    const t = (svgX - PAD_L) / (W - PAD_L - PAD_R);
    const idx = Math.round(Math.min(1, Math.max(0, t)) * (rows.length - 1));
    setHover({ idx, px: (x(idx) / W) * rect.width, width: rect.width });
  };

  const hovered = hover ? rows[hover.idx] : null;
  // Keep the tooltip inside the wrapper: flip side past the midpoint.
  const tipLeft = hover ? (hover.px > hover.width * 0.62 ? hover.px - 236 : hover.px + 14) : 0;

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', width: '100%', marginTop: 14 }}
      onMouseMove={(e) => scrub(e.clientX)}
      onMouseLeave={() => setHover(null)}
      onTouchStart={(e) => scrub(e.touches[0].clientX)}
      onTouchMove={(e) => scrub(e.touches[0].clientX)}
      onTouchEnd={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-label="Projected wealth by age">
        <defs>
          <linearGradient id="wealth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Shortfall region — every year after the money runs out */}
        {brokeIdx > 0 && (
          <rect
            x={x(brokeIdx)} y={PAD_T}
            width={Math.max(0, x(rows.length - 1) - x(brokeIdx))} height={H - PAD_T - PAD_B}
            fill="var(--danger)" opacity="0.07"
          />
        )}

        {/* Gridlines + Y labels */}
        {gridVals.map((v, gi) => (
          <g key={gi}>
            <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="var(--border)" strokeWidth="0.6" />
            <text x={PAD_L - 8} y={y(v) + 3} textAnchor="end" fill="var(--text-dim)" fontSize="10" fontFamily="var(--sans)">
              {fmt(Math.round(v))}
            </text>
          </g>
        ))}
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="var(--border)" strokeWidth="1" />

        {/* Area + line */}
        <path d={area} fill="url(#wealth-fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.25" strokeLinejoin="round" />

        {/* Retirement marker */}
        {retireIdx >= 0 && (
          <g>
            <line x1={x(retireIdx)} y1={PAD_T} x2={x(retireIdx)} y2={H - PAD_B} stroke="var(--text-dim)" strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />
            <text x={x(retireIdx) + 5} y={PAD_T + 9} fill="var(--text-dim)" fontSize="10" fontFamily="var(--sans)">
              Retire · {retireAge}
            </text>
          </g>
        )}

        {/* Broke marker */}
        {brokeIdx > 0 && (
          <text x={x(brokeIdx) + 5} y={H - PAD_B - 8} fill="var(--danger)" fontSize="10" fontWeight="600" fontFamily="var(--sans)">
            Runs out · {moneyLastsAge}
          </text>
        )}

        {/* Scrub guide + dot */}
        {hovered && (
          <g>
            <line x1={x(hover.idx)} y1={PAD_T} x2={x(hover.idx)} y2={H - PAD_B} stroke="var(--text-muted)" strokeWidth="1" opacity="0.55" />
            <circle cx={x(hover.idx)} cy={y(hovered.portfolioEndBalance)} r="4.5" fill="var(--accent)" stroke="var(--card, #fff)" strokeWidth="2" />
          </g>
        )}

        {/* X ticks */}
        {ticks.map(t => (
          <text key={t.age} x={x(t.i)} y={H - 8} textAnchor="middle" fill="var(--text-dim)" fontSize="10" fontFamily="var(--sans)">
            {t.age}
          </text>
        ))}
      </svg>

      {/* Styled tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute', top: 8, left: tipLeft, width: 222, pointerEvents: 'none',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 28px rgba(0,0,0,0.28)', padding: '10px 13px', zIndex: 5,
          fontFamily: 'var(--sans)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              Age {hovered.age}{hovered.spouseAge != null ? ` · ${hovered.spouseAge}` : ''}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              {hovered.isRetired ? (hovered.widowed ? 'survivor' : 'retired') : 'working'}
            </span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--serif)', color: hovered.portfolioEndBalance > 0 ? 'var(--text)' : 'var(--danger)', marginBottom: 6 }}>
            {fmt(hovered.portfolioEndBalance)}
          </div>
          {[
            ['Income', fmt(hovered.totalIncome)],
            ['Taxes', fmt(hovered.totalTax)],
            ['Spending', fmt(hovered.totalExpense)],
            hovered.totalWithdrawals > 0 ? ['Withdrawn', fmt(hovered.totalWithdrawals)] : null,
          ].filter(Boolean).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, lineHeight: 1.75 }}>
              <span style={{ color: 'var(--text-dim)' }}>{k}</span>
              <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
