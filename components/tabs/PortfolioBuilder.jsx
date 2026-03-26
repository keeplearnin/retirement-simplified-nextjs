'use client';

import { useState, useMemo, useEffect } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import Donut from '@/components/ui/Donut';
import { fmt, fmtFull } from '@/lib/format';
import { RISK_LABELS } from '@/lib/constants';

// Real ETF universe with actual data
const ETF_DATA = {
  VOO:  { name: 'Vanguard S&P 500 ETF', category: 'US Large Cap', expense: 0.03, yield: 1.3, avgReturn: 10.3, color: 'var(--accent)' },
  VXF:  { name: 'Vanguard Extended Market ETF', category: 'US Mid/Small Cap', expense: 0.06, yield: 1.1, avgReturn: 9.5, color: '#4ade80' },
  VEA:  { name: 'Vanguard FTSE Developed Markets', category: 'Intl Developed', expense: 0.05, yield: 3.0, avgReturn: 7.8, color: 'var(--blue)' },
  VWO:  { name: 'Vanguard FTSE Emerging Markets', category: 'Intl Emerging', expense: 0.08, yield: 2.8, avgReturn: 6.2, color: '#818cf8' },
  BND:  { name: 'Vanguard Total Bond Market', category: 'US Bonds', expense: 0.03, yield: 4.2, avgReturn: 3.5, color: 'var(--warn)' },
  BNDX: { name: 'Vanguard Total Intl Bond', category: 'Intl Bonds', expense: 0.07, yield: 3.8, avgReturn: 2.8, color: '#fbbf24' },
  GLD:  { name: 'SPDR Gold Shares', category: 'Gold', expense: 0.40, yield: 0, avgReturn: 7.5, color: '#f59e0b' },
  IAU:  { name: 'iShares Gold Trust', category: 'Gold (lower fee)', expense: 0.25, yield: 0, avgReturn: 7.5, color: '#f59e0b' },
};

// Fidelity & Schwab alternatives
const ALTERNATIVES = {
  VOO:  { fidelity: 'FXAIX', schwab: 'SWPPX', ishares: 'IVV' },
  VXF:  { fidelity: 'FSMDX', schwab: 'SCHA', ishares: 'IJR+IJH' },
  VEA:  { fidelity: 'FSPSX', schwab: 'SCHF', ishares: 'IEFA' },
  VWO:  { fidelity: 'FPADX', schwab: 'SCHE', ishares: 'IEMG' },
  BND:  { fidelity: 'FXNAX', schwab: 'SCHZ', ishares: 'AGG' },
  BNDX: { fidelity: 'FBIIX', schwab: 'SCHO', ishares: 'IAGG' },
  GLD:  { fidelity: 'IAU', schwab: 'IAU', ishares: 'IAU' },
};

function computeAllocation(age, risk, includeGold) {
  // Base stock allocation: 110 - age, adjusted by risk
  const base = Math.max(20, Math.min(95, 110 - age));
  const adj = (risk - 3) * 8;
  const totalStock = Math.max(15, Math.min(95, base + adj));

  // Gold allocation: 5-10% depending on age/risk (hedge against inflation)
  const goldPct = includeGold ? (risk <= 2 ? 10 : risk <= 4 ? 7 : 5) : 0;

  // Bond allocation (remainder after stocks + gold)
  const bondPct = Math.max(0, 100 - totalStock - goldPct);

  // Split US stocks: 70% large cap (VOO), 30% extended (VXF) — small-cap tilt for young
  const smallCapTilt = age < 40 ? 0.35 : age < 50 ? 0.30 : 0.25;
  const voo = Math.round(totalStock * 0.6 * (1 - smallCapTilt));  // US large
  const vxf = Math.round(totalStock * 0.6 * smallCapTilt);         // US mid/small
  const vea = Math.round(totalStock * 0.3);                        // Developed intl
  const vwo = totalStock - voo - vxf - vea;                        // Emerging (remainder)

  // Split bonds if allocation is meaningful
  const bnd = bondPct > 5 ? Math.round(bondPct * 0.75) : bondPct;
  const bndx = bondPct > 5 ? bondPct - bnd : 0;

  const gld = goldPct;

  return { VOO: voo, VXF: vxf, VEA: vea, VWO: Math.max(0, vwo), BND: bnd, BNDX: bndx, GLD: gld };
}

export default function PortfolioBuilder() {
  const [age, setAge] = useState(35);
  const [risk, setRisk] = useState(3);
  const [portfolioSize, setPortfolioSize] = useState(50000);
  const [includeGold, setIncludeGold] = useState(true);
  const [broker, setBroker] = useState('vanguard');

  // Auto-set risk from Risk Quiz result if available
  useEffect(() => {
    try {
      const stored = localStorage.getItem('riskProfile');
      if (stored) {
        const profile = JSON.parse(stored);
        if (profile.level >= 1 && profile.level <= 5) setRisk(profile.level);
      }
    } catch {}
  }, []);

  const alloc = useMemo(() => computeAllocation(age, risk, includeGold), [age, risk, includeGold]);

  const funds = useMemo(() => {
    return Object.entries(alloc)
      .filter(([, pct]) => pct > 0)
      .map(([ticker, pct]) => {
        const etf = ETF_DATA[ticker];
        const alt = ALTERNATIVES[ticker];
        const displayTicker = broker === 'vanguard' ? ticker
          : broker === 'fidelity' ? (alt?.fidelity || ticker)
          : broker === 'schwab' ? (alt?.schwab || ticker)
          : (alt?.ishares || ticker);
        return {
          ticker,
          displayTicker,
          pct,
          dollars: Math.round(portfolioSize * pct / 100),
          ...etf,
        };
      });
  }, [alloc, portfolioSize, broker]);

  const totalStock = (alloc.VOO || 0) + (alloc.VXF || 0) + (alloc.VEA || 0) + (alloc.VWO || 0);
  const totalBond = (alloc.BND || 0) + (alloc.BNDX || 0);
  const totalGold = alloc.GLD || 0;

  const blendedExpense = funds.reduce((s, f) => s + f.pct * f.expense, 0) / 100;
  const blendedYield = funds.reduce((s, f) => s + f.pct * f.yield, 0) / 100;
  const annualDividend = portfolioSize * blendedYield / 100;

  const donutSegs = useMemo(() => {
    let cum = 0;
    return funds.map(f => {
      const s = cum;
      cum += f.pct;
      return { start: s, end: cum, color: f.color, label: f.ticker };
    });
  }, [funds]);

  const targetYr = Math.round((new Date().getFullYear() + (65 - age)) / 5) * 5;
  const riskColors = ['var(--blue)', 'var(--blue)', 'var(--accent)', 'var(--warn)', 'var(--danger)'];

  return (
    <div className="fade-up">
      {/* Hero */}
      <Card style={{ marginBottom: 20, background: 'linear-gradient(135deg, var(--card) 0%, rgba(52,211,153,0.06) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          <Donut segs={donutSegs} label={`${totalStock}% Stocks`} size={150} strokeWidth={24} radius={58} />
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--text)', marginBottom: 4 }}>
              {totalStock}/{totalBond}/{totalGold}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Stocks / Bonds / Gold</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                Fee: {blendedExpense.toFixed(3)}%
              </span>
              <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: 'var(--blue-dim)', color: 'var(--blue)' }}>
                Yield: {blendedYield.toFixed(1)}% (~{fmt(annualDividend)}/yr)
              </span>
              <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: 'var(--warn-dim)', color: 'var(--warn)' }}>
                Save ~{(1 - blendedExpense).toFixed(2)}%/yr vs advisor
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
            <Slider label="Portfolio Size" value={portfolioSize} onChange={setPortfolioSize} min={1000} max={2000000} step={1000} format={fmt} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>Risk Tolerance</span>
              <span style={{ color: riskColors[risk - 1], fontSize: 16, fontWeight: 700, fontFamily: 'var(--serif)' }}>{RISK_LABELS[risk - 1]}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
              {RISK_LABELS.map((rl, i) => {
                const active = risk === i + 1;
                return (
                  <button key={i} onClick={() => setRisk(i + 1)} style={{
                    padding: '8px 12px', borderRadius: 20, cursor: 'pointer',
                    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: active ? 'var(--accent-dim)' : 'var(--bg2)',
                    color: active ? 'var(--accent)' : 'var(--text-dim)',
                    fontWeight: active ? 700 : 500, fontSize: 11,
                    fontFamily: 'var(--sans)', transition: 'all .2s',
                    flex: '1 1 0', minWidth: 0, textAlign: 'center',
                  }}>{rl}</button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={includeGold} onChange={e => setIncludeGold(e.target.checked)} style={{ accentColor: '#f59e0b', width: 16, height: 16 }} />
                Include Gold (inflation hedge)
              </label>
            </div>
          </div>
        </div>
      </Card>

      {/* Broker selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, lineHeight: '32px', marginRight: 4 }}>Show tickers for:</span>
        {[
          { id: 'vanguard', label: 'Vanguard' },
          { id: 'fidelity', label: 'Fidelity' },
          { id: 'schwab', label: 'Schwab' },
          { id: 'ishares', label: 'iShares' },
        ].map(b => (
          <button key={b.id} onClick={() => setBroker(b.id)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            border: broker === b.id ? '1.5px solid var(--accent)' : '1px solid var(--border)',
            background: broker === b.id ? 'var(--accent-dim)' : 'transparent',
            color: broker === b.id ? 'var(--accent)' : 'var(--text-dim)',
            fontFamily: 'var(--sans)', transition: 'all .2s',
          }}>{b.label}</button>
        ))}
      </div>

      {/* Fund cards */}
      <SectionLabel>Your {funds.length}-ETF Portfolio</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {funds.map((f, i) => (
          <Card key={i} style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: f.color }} />
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <div style={{ fontFamily: 'var(--serif)', color: f.color, fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{f.pct}%</div>
              <div style={{ marginTop: 6, padding: '4px 12px', display: 'inline-block', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <code style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 700, letterSpacing: '.04em' }}>{f.displayTicker}</code>
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 12, marginTop: 8 }}>{f.category}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 2 }}>{f.name}</div>
              <div style={{ marginTop: 10, padding: '8px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-around' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Fee</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{f.expense.toFixed(2)}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Yield</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)' }}>{f.yield.toFixed(1)}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Invest</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{fmt(f.dollars)}</div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Dollar breakdown table */}
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>Exact Purchase Amounts</SectionLabel>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['ETF', 'Category', 'Allocation', 'Amount', 'Expense', '10yr Avg Return'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: h === 'ETF' || h === 'Category' ? 'left' : 'right', color: 'var(--text-dim)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funds.map(f => (
              <tr key={f.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px' }}>
                  <code style={{ color: 'var(--accent)', fontWeight: 700 }}>{f.displayTicker}</code>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{f.category}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: f.color }}>{f.pct}%</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text)' }}>{fmtFull(f.dollars)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--accent)' }}>{f.expense.toFixed(2)}%</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--blue)' }}>{f.avgReturn.toFixed(1)}%</td>
              </tr>
            ))}
            <tr style={{ background: 'var(--bg2)' }}>
              <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)' }}>Total</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>100%</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{fmtFull(portfolioSize)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{blendedExpense.toFixed(3)}%</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--blue)' }}>{(funds.reduce((s, f) => s + f.pct * f.avgReturn, 0) / 100).toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </Card>

      {/* One Fund tip */}
      <InfoBox icon="💡" title="Even Simpler: One Fund" color="var(--accent)" style={{ marginBottom: 20 }}>
        Buy a single <strong style={{ color: 'var(--text)' }}>Vanguard Target Retirement {targetYr} Fund (VTTVX)</strong> — it holds a similar mix and <strong style={{ color: 'var(--text)' }}>auto-rebalances as you age</strong>. Expense ratio: 0.08%. Perfect if you want zero maintenance.
      </InfoBox>

      {/* Why this works */}
      <Card>
        <SectionLabel>Why This Works</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {[
            { icon: '🌍', title: 'Global diversification', desc: 'US + international stocks across 10,000+ companies' },
            { icon: '💸', title: 'Ultra-low fees', desc: `Blended ${blendedExpense.toFixed(3)}% — keep 99.9%+ of returns` },
            { icon: '⚖️', title: 'Age-appropriate', desc: `${totalStock}% stocks at age ${age} — shifts safer over time` },
            { icon: '🏆', title: 'Small-cap tilt', desc: age < 40 ? 'Extra mid/small cap for higher growth when young' : 'Balanced large/small cap exposure' },
            { icon: '🛡️', title: includeGold ? 'Gold hedge' : 'Bond stability', desc: includeGold ? `${totalGold}% gold protects against inflation & crashes` : `${totalBond}% bonds cushion downturns` },
            { icon: '📊', title: 'Evidence-based', desc: '50+ years of research (Bogle, Fama, Shiller)' },
          ].map((r, i) => (
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
