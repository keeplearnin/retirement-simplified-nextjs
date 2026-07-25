'use client';

import { useRef, useState } from 'react';
import { fmt } from '@/lib/format';

/**
 * ClaimingHeatmap — 9×9 grid of joint Social Security claiming combinations.
 * Rows = primary's claim age, columns = spouse's claim age. Cell shade encodes
 * end-of-plan wealth (darker jade = better). The best cell gets a solid
 * accent ring; the currently-planned combination gets a dashed ring. Hovering
 * any cell shows a styled tooltip (instant, on-brand — not the browser's
 * delayed native title bubble).
 *
 * `grid` comes from sweepJointSsClaiming: [{ primaryAge, spouseAge, net,
 * moneyLastsAge, isCurrent }]. Ages may start above 62 when a member is
 * already past a claiming age.
 */
export default function ClaimingHeatmap({ grid, best }) {
  const wrapRef = useRef(null);
  const [tip, setTip] = useState(null); // { cell, x, y } wrapper-relative

  if (!grid || grid.length === 0) return null;

  const primaryAges = [...new Set(grid.map((c) => c.primaryAge))].sort((a, b) => a - b);
  const spouseAges = [...new Set(grid.map((c) => c.spouseAge))].sort((a, b) => a - b);
  const byKey = new Map(grid.map((c) => [`${c.primaryAge}-${c.spouseAge}`, c]));

  const nets = grid.map((c) => c.net);
  const min = Math.min(...nets);
  const max = Math.max(...nets);
  const span = Math.max(1, max - min);

  const showTip = (cell, e) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const cr = e.currentTarget.getBoundingClientRect();
    setTip({
      cell,
      x: cr.left - wr.left + cr.width / 2,
      y: cr.top - wr.top,
      flip: cr.left - wr.left > wr.width * 0.55,
    });
  };

  return (
    <div ref={wrapRef} style={{ fontFamily: 'var(--sans)', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0 }}>
        {/* Y-axis label */}
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 4 }}>
          <span style={{
            writingMode: 'vertical-rl', transform: 'rotate(180deg)',
            fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-dim)',
          }}>
            You claim at
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-dim)', textAlign: 'center', marginBottom: 6 }}>
            Spouse claims at
          </div>
          <table style={{ borderCollapse: 'separate', borderSpacing: 3 }}>
            <thead>
              <tr>
                <th aria-hidden style={{ width: 22 }} />
                {spouseAges.map((a) => (
                  <th key={a} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '0 0 2px', textAlign: 'center' }}>{a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {primaryAges.map((pAge) => (
                <tr key={pAge}>
                  <td style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', paddingRight: 6, textAlign: 'right' }}>{pAge}</td>
                  {spouseAges.map((sAge) => {
                    const cell = byKey.get(`${pAge}-${sAge}`);
                    if (!cell) return <td key={sAge} />;
                    const t = (cell.net - min) / span; // 0 = worst, 1 = best
                    const isBest = best && cell.primaryAge === best.primaryAge && cell.spouseAge === best.spouseAge;
                    return (
                      <td
                        key={sAge}
                        onMouseEnter={(e) => showTip(cell, e)}
                        onMouseLeave={() => setTip(null)}
                        style={{
                          width: 30, height: 26, borderRadius: 5, cursor: 'default',
                          background: `color-mix(in srgb, var(--accent) ${Math.round(8 + t * 72)}%, transparent)`,
                          outline: isBest
                            ? '2px solid var(--accent)'
                            : cell.isCurrent ? '2px dashed var(--text-dim)' : 'none',
                          outlineOffset: -1,
                        }}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--text-dim)', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, outline: '2px solid var(--accent)', outlineOffset: -1, display: 'inline-block', background: 'color-mix(in srgb, var(--accent) 70%, transparent)' }} />
          Best combination
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, outline: '2px dashed var(--text-dim)', outlineOffset: -1, display: 'inline-block' }} />
          Your current plan
        </span>
        <span>Darker = more wealth left at the end of the plan. Hover any cell for its number.</span>
      </div>

      {/* Styled tooltip — instant, on-brand */}
      {tip && (() => {
        const isBest = tip.cell.net === max;
        return (
          <div style={{
            position: 'absolute', top: tip.y - 8, left: tip.flip ? tip.x - 216 : tip.x + 14,
            transform: 'translateY(-100%)', width: 200, pointerEvents: 'none', zIndex: 6,
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 28px rgba(0,0,0,0.28)', padding: '9px 12px',
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
              You at {tip.cell.primaryAge} · spouse at {tip.cell.spouseAge}
              {tip.cell.isCurrent && <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}> — current plan</span>}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--serif)', color: isBest ? 'var(--accent)' : 'var(--text)' }}>
              {fmt(tip.cell.net)}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
              {isBest ? 'Best combination' : `${fmt(tip.cell.net - max)} vs best`} · end-of-plan wealth
            </div>
          </div>
        );
      })()}
    </div>
  );
}
