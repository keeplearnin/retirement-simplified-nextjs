'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fmt } from '@/lib/format';

/**
 * WealthChart — the flagship interactive projection canvas.
 *
 * One full-width area chart of household wealth by age with:
 *  - hover/touch scrubbing: a guide line, a dot, and a styled tooltip
 *    showing that year's exact dollars (balance, income, spending, taxes)
 *  - the retirement year marked with a vertical rule + label, plus optional
 *    milestones (Social Security, required withdrawals) the same way, so a
 *    bend in the curve has its reason written next to it
 *  - the shortfall region (after money runs out) shaded in danger tint
 *
 * Pure presentational component — all numbers come from the projection rows.
 */
const W = 920;

// Compact labels for narrow screens, where the full milestone names overrun
// a 340px-wide chart.
const COMPACT_LABELS = {
  'Social Security': 'SS',
  'Required withdrawals': 'RMDs',
};

export default function WealthChart({ rows, retireAge, moneyLastsAge, covered, milestones = [] }) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // { idx, px } in wrapper pixels
  const [cw, setCw] = useState(0);          // measured container width (CSS px)

  // The SVG has a fixed 920-unit viewBox, so anything sized in viewBox units
  // shrinks with the container — at a 343px phone width, a fontSize of 10
  // rendered at ~3.7 physical px. Measure the container and size text,
  // strokes, and padding in PHYSICAL pixels instead (unit = px × scale).
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setCw(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = W / Math.max(cw || 700, 300); // viewBox units per physical px
  const compact = cw > 0 && cw < 480;
  const px = (n) => n * scale;                // n physical px → viewBox units
  // Consistent physical height: ~180px of chart on every screen.
  const H = Math.round(Math.min(520, Math.max(230, px(compact ? 190 : 180))));
  const PAD_L = px(44);
  const PAD_R = px(12);
  const PAD_T = px(14);
  const PAD_B = px(22);

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
    // X ticks every 5 years (every 10 when narrow — bigger physical text
    // needs more room per label).
    const tickStep = compact ? 10 : 5;
    const ticks = rows
      .map((r, i) => ({ age: r.age, i }))
      .filter(t => t.age % tickStep === 0);

    // Milestones inside the chart's range; labels step down so neighbors
    // a few years apart don't overprint the retirement label or each other.
    const marks = milestones
      .map(m => ({ ...m, i: rows.findIndex(r => r.age === m.age) }))
      .filter(m => m.i >= 0 && m.i !== retireIdx)
      .sort((a, b) => a.i - b.i)
      .map((m, k) => ({
        ...m,
        shownLabel: compact ? (COMPACT_LABELS[m.label] || m.label) : m.label,
        labelY: PAD_T + px(18) + k * px(12),
      }));

    return { maxBal, x, y, line, area, retireIdx, brokeIdx, gridVals, ticks, marks };
  }, [rows, retireAge, moneyLastsAge, covered, milestones, cw]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!model || !rows || rows.length === 0) return null;
  const { x, y, line, area, retireIdx, brokeIdx, gridVals, ticks, marks } = model;

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
  // Keep the tooltip inside the wrapper: flip side past the midpoint, then
  // clamp so it can never overflow a narrow container.
  const tipW = 222;
  const tipLeft = hover
    ? Math.min(Math.max(2, hover.px > hover.width * 0.62 ? hover.px - tipW - 14 : hover.px + 14), Math.max(2, hover.width - tipW - 4))
    : 0;

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
            <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="var(--border)" strokeWidth={px(0.5)} />
            <text x={PAD_L - px(6)} y={y(v) + px(3)} textAnchor="end" fill="var(--text-dim)" fontSize={px(9.5)} fontFamily="var(--sans)">
              {fmt(Math.round(v))}
            </text>
          </g>
        ))}
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="var(--border)" strokeWidth={px(0.8)} />

        {/* Area + line */}
        <path d={area} fill="url(#wealth-fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={px(2.25)} strokeLinejoin="round" />

        {/* Retirement marker */}
        {retireIdx >= 0 && (
          <g>
            <line x1={x(retireIdx)} y1={PAD_T} x2={x(retireIdx)} y2={H - PAD_B} stroke="var(--text-dim)" strokeWidth={px(0.8)} strokeDasharray={`${px(3)} ${px(4)}`} opacity="0.7" />
            <text x={x(retireIdx) + px(4)} y={PAD_T + px(8)} fill="var(--text-dim)" fontSize={px(10)} fontFamily="var(--sans)">
              Retire · {retireAge}
            </text>
          </g>
        )}

        {/* Milestones */}
        {marks.map(m => (
          <g key={m.label}>
            <line x1={x(m.i)} y1={PAD_T} x2={x(m.i)} y2={H - PAD_B} stroke="var(--text-dim)" strokeWidth={px(0.8)} strokeDasharray={`${px(1)} ${px(4)}`} opacity="0.6" />
            <text
              x={x(m.i) > W * 0.78 ? x(m.i) - px(4) : x(m.i) + px(4)} y={m.labelY}
              textAnchor={x(m.i) > W * 0.78 ? 'end' : 'start'}
              fill="var(--text-dim)" fontSize={px(10)} fontFamily="var(--sans)"
            >
              {m.shownLabel} · {m.age}
            </text>
          </g>
        ))}

        {/* Broke marker */}
        {brokeIdx > 0 && (
          <text x={x(brokeIdx) + px(4)} y={H - PAD_B - px(7)} fill="var(--danger)" fontSize={px(10)} fontWeight="600" fontFamily="var(--sans)">
            Runs out · {moneyLastsAge}
          </text>
        )}

        {/* Scrub guide + dot */}
        {hovered && (
          <g>
            <line x1={x(hover.idx)} y1={PAD_T} x2={x(hover.idx)} y2={H - PAD_B} stroke="var(--text-muted)" strokeWidth={px(0.8)} opacity="0.55" />
            <circle cx={x(hover.idx)} cy={y(hovered.portfolioEndBalance)} r={px(4.5)} fill="var(--accent)" stroke="var(--card, #fff)" strokeWidth={px(2)} />
          </g>
        )}

        {/* X ticks */}
        {ticks.map(t => (
          <text key={t.age} x={x(t.i)} y={H - px(7)} textAnchor="middle" fill="var(--text-dim)" fontSize={px(9.5)} fontFamily="var(--sans)">
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
