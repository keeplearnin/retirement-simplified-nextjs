'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { RISK_LABELS } from '@/lib/constants';
import { descArc } from '@/lib/format';

export default function PortfolioBuilder() {
  const [age, setAge] = useState(35);
  const [risk, setRisk] = useState(3);

  const alloc = useMemo(() => {
    const base = Math.max(20, Math.min(95, 110 - age));
    const adj = (risk - 3) * 8;
    const stock = Math.max(15, Math.min(95, base + adj));
    const intl = Math.round(stock * 0.3);
    const dom = stock - intl;
    const bond = Math.max(5, 100 - stock - 5);
    return { dom, intl, bond, cash: 100 - dom - intl - bond };
  }, [age, risk]);

  const funds = useMemo(() => {
    const f = [];
    if (alloc.dom > 0) f.push({ name: 'US Total Stock Market', ticker: 'VTI / VTSAX / FSKAX', pct: alloc.dom, color: 'var(--accent)', expense: '0.03%', desc: 'Entire US market — ~4,000 stocks' });
    if (alloc.intl > 0) f.push({ name: 'International Stock Market', ticker: 'VXUS / VTIAX / FTIHX', pct: alloc.intl, color: 'var(--blue)', expense: '0.07%', desc: 'Developed + emerging markets' });
    if (alloc.bond > 0) f.push({ name: 'US Total Bond Market', ticker: 'BND / VBTLX / FXNAX', pct: alloc.bond, color: 'var(--warn)', expense: '0.03%', desc: 'US investment-grade bonds' });
    if (alloc.cash > 0) f.push({ name: 'Cash / Money Market', ticker: 'Settlement fund', pct: alloc.cash, color: 'var(--text-dim)', expense: '~0%', desc: 'Short-term reserves' });
    return f;
  }, [alloc]);

  const blended = ((alloc.dom * 0.03 + alloc.intl * 0.07 + alloc.bond * 0.03) / 100).toFixed(3);
  const targetYr = Math.round((2026 + (65 - age)) / 5) * 5;
  const segs = useMemo(() => { let cum = 0; return funds.map(f => { const s = cum; cum += f.pct; return { ...f, start: s, end: cum }; }); }, [funds]);

  return (
    <div className="fade-up">
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 32 }}>
        <div>
          <Card>
            <SectionLabel>About You</SectionLabel>
            <Slider label="Your Age" value={age} onChange={setAge} min={18} max={70} suffix=" yrs" />
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>Risk Tolerance</span>
                <span style={{ color: 'var(--accent)', fontSize: 16, fontWeight: 700, fontFamily: 'var(--serif)' }}>{RISK_LABELS[risk - 1]}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {RISK_LABELS.map((rl, i) => (
                  <button key={i} onClick={() => setRisk(i + 1)} className={`risk-btn${risk === i + 1 ? ' active' : ''}`}>{rl}</button>
                ))}
              </div>
            </div>
          </Card>
          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Recommended Funds</SectionLabel>
            {funds.map((f, i) => (
              <div key={i} style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 8, borderLeft: `4px solid ${f.color}`, border: '1px solid var(--border)', borderLeftWidth: 4, borderLeftColor: f.color }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{f.name}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>{f.ticker}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--serif)', color: f.color, fontSize: 24 }}>{f.pct}%</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>Fee: {f.expense}</div>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ background: 'var(--accent-dim)', borderRadius: 'var(--radius-sm)', padding: 12, marginTop: 8, textAlign: 'center', border: '1px solid rgba(52,211,153,.15)' }}>
              <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>Blended fee: ~{blended}% — saving ~{(1 - parseFloat(blended)).toFixed(2)}%/yr vs advisor</span>
            </div>
          </Card>
        </div>
        <div>
          <Card>
            <SectionLabel>Your Allocation</SectionLabel>
            <svg viewBox="0 0 300 300" style={{ width: '100%', maxWidth: 260, display: 'block', margin: '0 auto 16px' }}>
              {segs.map((seg, i) => { const gap = 2, sA = (seg.start / 100) * 360 + gap, eA = (seg.end / 100) * 360 - gap; if (eA <= sA) return null; return <path key={i} d={descArc(150, 150, 110, sA, eA)} fill="none" stroke={seg.color} strokeWidth="38" strokeLinecap="round" />; })}
              <text x="150" y="145" textAnchor="middle" fill="var(--text)" fontSize="15" fontFamily="Outfit" fontWeight="600">{alloc.dom + alloc.intl}% Stocks</text>
              <text x="150" y="168" textAnchor="middle" fill="var(--text-dim)" fontSize="12" fontFamily="Outfit">{alloc.bond}% Bonds · {alloc.cash}% Cash</text>
            </svg>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              {funds.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: f.color }} />{f.name.split(' ').slice(0, 2).join(' ')} ({f.pct}%)
                </div>
              ))}
            </div>
          </Card>
          <InfoBox icon="💡" title="Even Simpler: One Fund" color="var(--accent)" style={{ marginTop: 14 }}>
            Buy a single <strong style={{ color: 'var(--text)' }}>Vanguard Target Retirement {targetYr} Fund</strong> — it holds the same mix and <strong style={{ color: 'var(--text)' }}>auto-rebalances as you age</strong>. Expense ratio: ~0.08%.
          </InfoBox>
          <Card style={{ marginTop: 14 }}>
            <SectionLabel>✦ Why This Works</SectionLabel>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 2 }}>
              {[{ i: '🌍', t: 'Broad diversification', d: 'Own thousands of companies in 3 funds' }, { i: '💸', t: 'Rock-bottom fees', d: 'Keep 99.95%+ of your returns' }, { i: '⚖️', t: 'Age-appropriate risk', d: 'Shifts safer as you near retirement' }, { i: '🧘', t: 'No stock picking', d: 'The market does the work' }, { i: '📊', t: 'Evidence-based', d: '50+ years of research (Bogle, Fama, Shiller)' }].map((x, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6 }}><span style={{ fontSize: 16 }}>{x.i}</span><div><strong style={{ color: 'var(--text)' }}>{x.t}</strong><span style={{ color: 'var(--text-dim)' }}> — {x.d}</span></div></div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
