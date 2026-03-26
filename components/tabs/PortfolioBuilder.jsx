'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import Donut from '@/components/ui/Donut';
import { RISK_LABELS, ASSET_CLASSES } from '@/lib/constants';

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
    if (alloc.dom > 0) f.push({ name: 'US Stocks', fullName: 'US Total Stock Market', ticker: 'VTI / VTSAX / FSKAX', pct: alloc.dom, color: 'var(--accent)', expense: '0.03%', desc: 'Entire US market — ~4,000 stocks' });
    if (alloc.intl > 0) f.push({ name: 'Intl Stocks', fullName: 'International Stock Market', ticker: 'VXUS / VTIAX / FTIHX', pct: alloc.intl, color: 'var(--blue)', expense: '0.07%', desc: 'Developed + emerging markets' });
    if (alloc.bond > 0) f.push({ name: 'Bonds', fullName: 'US Total Bond Market', ticker: 'BND / VBTLX / FXNAX', pct: alloc.bond, color: 'var(--warn)', expense: '0.03%', desc: 'US investment-grade bonds' });
    if (alloc.cash > 0) f.push({ name: 'Cash', fullName: 'Cash / Money Market', ticker: 'Settlement fund', pct: alloc.cash, color: 'var(--text-dim)', expense: '~0%', desc: 'Short-term reserves' });
    return f;
  }, [alloc]);

  const blended = ((alloc.dom * 0.03 + alloc.intl * 0.07 + alloc.bond * 0.03) / 100).toFixed(3);
  const targetYr = Math.round((new Date().getFullYear() + (65 - age)) / 5) * 5;

  const donutSegs = useMemo(() => {
    let cum = 0;
    return funds.map(f => {
      const s = cum;
      cum += f.pct;
      return { ...f, start: s, end: cum };
    });
  }, [funds]);

  const stockPct = alloc.dom + alloc.intl;
  const riskColors = ['var(--blue)', 'var(--blue)', 'var(--accent)', 'var(--warn)', 'var(--danger)'];

  const reasons = [
    { icon: '🌍', title: 'Broad diversification', desc: 'Own thousands of companies in 3 funds' },
    { icon: '💸', title: 'Rock-bottom fees', desc: 'Keep 99.95%+ of your returns' },
    { icon: '⚖️', title: 'Age-appropriate risk', desc: 'Auto-shifts safer as you near retirement' },
    { icon: '🧘', title: 'No stock picking', desc: 'The market does the work for you' },
    { icon: '📊', title: 'Evidence-based', desc: '50+ years of research (Bogle, Fama, Shiller)' },
  ];

  return (
    <div className="fade-up">
      {/* Hero summary */}
      <Card style={{ marginBottom: 20, background: 'linear-gradient(135deg, var(--card) 0%, rgba(52,211,153,0.06) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          <Donut segs={donutSegs} label={`${stockPct}% Stocks`} size={140} strokeWidth={24} radius={55} />
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--text)', marginBottom: 4 }}>
              {stockPct}/{alloc.bond}/{alloc.cash}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Stocks / Bonds / Cash</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                Fee: {blended}%
              </span>
              <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: 'var(--blue-dim)', color: 'var(--blue)' }}>
                Save ~{(1 - parseFloat(blended)).toFixed(2)}%/yr vs advisor
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Controls */}
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>Your Profile</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="grid-2">
          <div>
            <Slider label="Your Age" value={age} onChange={setAge} min={18} max={70} suffix=" yrs" />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>Risk Tolerance</span>
              <span style={{ color: riskColors[risk - 1], fontSize: 16, fontWeight: 700, fontFamily: 'var(--serif)' }}>{RISK_LABELS[risk - 1]}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {RISK_LABELS.map((rl, i) => {
                const active = risk === i + 1;
                return (
                  <button
                    key={i}
                    onClick={() => setRisk(i + 1)}
                    style={{
                      padding: '8px 12px', borderRadius: 20, cursor: 'pointer',
                      border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: active ? 'var(--accent-dim)' : 'var(--bg2)',
                      color: active ? 'var(--accent)' : 'var(--text-dim)',
                      fontWeight: active ? 700 : 500, fontSize: 11,
                      fontFamily: 'var(--sans)', transition: 'all .2s',
                      flex: '1 1 0', minWidth: 0, textAlign: 'center',
                    }}
                  >
                    {rl}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Fund cards */}
      <SectionLabel>Your {funds.length}-Fund Portfolio</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }} className="grid-2">
        {funds.map((f, i) => (
          <Card key={i} style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Color accent bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: f.color }} />
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <div style={{ fontFamily: 'var(--serif)', color: f.color, fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{f.pct}%</div>
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13, marginTop: 8 }}>{f.fullName}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>{f.desc}</div>
              <div style={{ marginTop: 10, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                <code style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: '.02em' }}>{f.ticker}</code>
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: 10, marginTop: 2 }}>Expense: {f.expense}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* One Fund tip */}
      <InfoBox icon="💡" title="Even Simpler: One Fund" color="var(--accent)" style={{ marginBottom: 20 }}>
        Buy a single <strong style={{ color: 'var(--text)' }}>Vanguard Target Retirement {targetYr} Fund</strong> — it holds the same mix and <strong style={{ color: 'var(--text)' }}>auto-rebalances as you age</strong>. Expense ratio: ~0.08%.
      </InfoBox>

      {/* Why this works */}
      <Card>
        <SectionLabel>✦ Why This Works</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }} className="grid-2">
          {reasons.map((r, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '16px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{r.icon}</div>
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 12, marginBottom: 4 }}>{r.title}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.4 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
