'use client';

import { useState, useMemo, useEffect } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import Donut from '@/components/ui/Donut';
import { fmt, fmtFull } from '@/lib/format';
import { RISK_LABELS } from '@/lib/constants';
import PortfolioAnalytics from '@/components/tabs/portfolio/PortfolioAnalytics';

// ── ETF universe with real data (10yr + 20yr returns) ──────────────────
const ETF_DATA = {
  VOO:  { name: 'Vanguard S&P 500 ETF', category: 'US Large Cap', expense: 0.03, yield: 1.3, ret10: 12.0, ret20: 10.3, maxDraw: -34, color: 'var(--accent)', location: 'taxable', locationWhy: 'Low turnover, qualified dividends taxed at 15%' },
  VXF:  { name: 'Vanguard Extended Market ETF', category: 'US Mid/Small Cap', expense: 0.06, yield: 1.1, ret10: 9.8, ret20: 9.5, maxDraw: -42, color: '#4ade80', location: 'either', locationWhy: 'Moderate turnover — slight edge in tax-deferred' },
  VEA:  { name: 'Vanguard FTSE Developed Markets', category: 'Intl Developed', expense: 0.05, yield: 3.0, ret10: 5.8, ret20: 7.8, maxDraw: -41, color: 'var(--blue)', location: 'taxable', locationWhy: 'Foreign tax credit only available in taxable accounts' },
  VWO:  { name: 'Vanguard FTSE Emerging Markets', category: 'Intl Emerging', expense: 0.08, yield: 2.8, ret10: 3.9, ret20: 6.2, maxDraw: -53, color: '#818cf8', location: 'taxable', locationWhy: 'Foreign tax credit benefit; higher volatility = long horizon' },
  BND:  { name: 'Vanguard Total Bond Market', category: 'US Bonds', expense: 0.03, yield: 4.2, ret10: 1.4, ret20: 3.5, maxDraw: -18, color: 'var(--warn)', location: 'tax-deferred', locationWhy: 'Interest taxed as ordinary income — shelter in 401(k)/IRA' },
  BNDX: { name: 'Vanguard Total Intl Bond', category: 'Intl Bonds', expense: 0.07, yield: 3.8, ret10: 0.6, ret20: 2.8, maxDraw: -10, color: '#fbbf24', location: 'tax-deferred', locationWhy: 'Interest taxed as ordinary income — shelter in 401(k)/IRA' },
  GLD:  { name: 'SPDR Gold Shares', category: 'Gold', expense: 0.40, yield: 0, ret10: 9.5, ret20: 7.5, maxDraw: -33, color: '#f59e0b', location: 'tax-deferred', locationWhy: 'Collectible tax rate (28%) in taxable — shelter in IRA' },
};

// Broker equivalents
const ALTERNATIVES = {
  VOO:  { fidelity: 'FXAIX', schwab: 'SWPPX', ishares: 'IVV' },
  VXF:  { fidelity: 'FSMDX', schwab: 'SCHA', ishares: 'IJR+IJH' },
  VEA:  { fidelity: 'FSPSX', schwab: 'SCHF', ishares: 'IEFA' },
  VWO:  { fidelity: 'FPADX', schwab: 'SCHE', ishares: 'IEMG' },
  BND:  { fidelity: 'FXNAX', schwab: 'SCHZ', ishares: 'AGG' },
  BNDX: { fidelity: 'FBIIX', schwab: 'SCHO', ishares: 'IAGG' },
  GLD:  { fidelity: 'IAU', schwab: 'IAU', ishares: 'IAU' },
};

// Location colors/labels
const LOCATION_META = {
  'taxable':      { label: 'Taxable', color: 'var(--accent)', icon: '💰' },
  'tax-deferred': { label: '401(k) / IRA', color: 'var(--warn)', icon: '🏦' },
  'either':       { label: 'Either', color: 'var(--blue)', icon: '↔️' },
};

// ── Research-backed glide path (Vanguard TDF methodology) ──────────────
// Sources: Vanguard Target Retirement Fund glide path, Fama-French,
// Ibbotson SBBI data. The "110 - age" rule is a folk heuristic;
// actual TDF equity ranges: age 25→90%, age 40→84%, age 55→68%, age 65→50%
const GLIDE_PATH = [
  // [age, equityPct] — linear interpolation between points
  [20, 92], [25, 90], [30, 88], [35, 85], [40, 82],
  [45, 76], [50, 68], [55, 60], [60, 52], [65, 50],
  [70, 40], [75, 35],
];

function glidePathEquity(age) {
  if (age <= GLIDE_PATH[0][0]) return GLIDE_PATH[0][1];
  if (age >= GLIDE_PATH[GLIDE_PATH.length - 1][0]) return GLIDE_PATH[GLIDE_PATH.length - 1][1];
  for (let i = 0; i < GLIDE_PATH.length - 1; i++) {
    const [a1, e1] = GLIDE_PATH[i];
    const [a2, e2] = GLIDE_PATH[i + 1];
    if (age >= a1 && age <= a2) {
      return Math.round(e1 + (e2 - e1) * (age - a1) / (a2 - a1));
    }
  }
  return 50;
}

function computeAllocation(age, risk, includeGold, intlBias) {
  // Research-backed base from glide path, then risk-adjust
  const baseEquity = glidePathEquity(age);
  const riskAdj = (risk - 3) * 6; // ±6% per risk level (was ±8, tightened)
  const totalStock = Math.max(15, Math.min(95, baseEquity + riskAdj));

  // Gold: 5-10% (Ray Dalio All-Weather inspired)
  const goldPct = includeGold ? (risk <= 2 ? 10 : risk <= 4 ? 7 : 5) : 0;

  // Bonds = remainder
  const bondPct = Math.max(0, 100 - totalStock - goldPct);

  // International bias (user-configurable, default ~35% of equity)
  const intlPct = intlBias / 100; // e.g. 35 → 0.35
  const domPct = 1 - intlPct;

  // US split: large cap vs extended market (small-cap tilt for young)
  const smallCapTilt = age < 35 ? 0.35 : age < 45 ? 0.30 : age < 55 ? 0.25 : 0.20;
  const usDom = Math.round(totalStock * domPct);
  const voo = Math.round(usDom * (1 - smallCapTilt));
  const vxf = usDom - voo;

  // Intl split: developed vs emerging (70/30 standard)
  const intlTotal = totalStock - usDom;
  const vea = Math.round(intlTotal * 0.70);
  const vwo = intlTotal - vea;

  // Bond split (75/25 US/Intl when meaningful)
  const bnd = bondPct > 5 ? Math.round(bondPct * 0.75) : bondPct;
  const bndx = bondPct > 5 ? bondPct - bnd : 0;

  // Verify total = 100 (fix rounding)
  const raw = { VOO: voo, VXF: vxf, VEA: vea, VWO: Math.max(0, vwo), BND: bnd, BNDX: bndx, GLD: goldPct };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  if (sum !== 100) raw.VOO += (100 - sum); // adjust largest position

  return raw;
}

export default function PortfolioBuilder() {
  const [age, setAge] = useState(35);
  const [risk, setRisk] = useState(3);
  const [portfolioSize, setPortfolioSize] = useState(50000);
  const [includeGold, setIncludeGold] = useState(true);
  const [intlBias, setIntlBias] = useState(35);
  const [broker, setBroker] = useState('vanguard');
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('riskProfile');
      if (stored) {
        const profile = JSON.parse(stored);
        if (profile.level >= 1 && profile.level <= 5) setRisk(profile.level);
      }
    } catch {}
  }, []);

  const alloc = useMemo(() => computeAllocation(age, risk, includeGold, intlBias), [age, risk, includeGold, intlBias]);

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
        return { ticker, displayTicker, pct, dollars: Math.round(portfolioSize * pct / 100), ...etf };
      });
  }, [alloc, portfolioSize, broker]);

  const totalStock = (alloc.VOO || 0) + (alloc.VXF || 0) + (alloc.VEA || 0) + (alloc.VWO || 0);
  const totalBond = (alloc.BND || 0) + (alloc.BNDX || 0);
  const totalGold = alloc.GLD || 0;

  const blendedExpense = funds.reduce((s, f) => s + f.pct * f.expense, 0) / 100;
  const blendedYield = funds.reduce((s, f) => s + f.pct * f.yield, 0) / 100;
  const annualDividend = portfolioSize * blendedYield / 100;
  const blendedRet20 = funds.reduce((s, f) => s + f.pct * f.ret20, 0) / 100;

  const donutSegs = useMemo(() => {
    let cum = 0;
    return funds.map(f => { const s = cum; cum += f.pct; return { start: s, end: cum, color: f.color }; });
  }, [funds]);

  // Glide path chart data
  const gpData = useMemo(() => {
    return Array.from({ length: 53 }, (_, i) => {
      const a = 18 + i;
      const eq = glidePathEquity(a);
      const adj = (risk - 3) * 6;
      return { age: a, equity: Math.max(15, Math.min(95, eq + adj)) };
    });
  }, [risk]);

  const targetYr = Math.round((new Date().getFullYear() + (65 - age)) / 5) * 5;
  const riskColors = ['var(--blue)', 'var(--blue)', 'var(--accent)', 'var(--warn)', 'var(--danger)'];

  // Group funds by location
  const taxable = funds.filter(f => f.location === 'taxable');
  const deferred = funds.filter(f => f.location === 'tax-deferred');
  const either = funds.filter(f => f.location === 'either');

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
            <Slider label="International Bias" value={intlBias} onChange={setIntlBias} min={15} max={50} suffix="% of equity" />
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={includeGold} onChange={e => setIncludeGold(e.target.checked)} style={{ accentColor: '#f59e0b', width: 16, height: 16 }} />
              Include Gold (inflation hedge)
            </label>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Intl bias: Vanguard recommends 40%, home-bias investors prefer 20-30%. Default 35% balances diversification with currency risk.
            </div>
          </div>
        </div>
      </Card>

      {/* Glide Path Chart */}
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>Research-Backed Glide Path</SectionLabel>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
          Based on Vanguard Target Retirement Fund methodology. Equity allocation decreases as you approach retirement. Your current position is marked below.
        </div>
        <svg viewBox="0 0 600 180" style={{ width: '100%', maxWidth: 600, display: 'block' }}>
          {/* Grid lines */}
          {[25, 50, 75, 100].map(pct => (
            <g key={pct}>
              <line x1="40" y1={160 - pct * 1.4} x2="580" y2={160 - pct * 1.4} stroke="var(--border)" strokeWidth="0.5" />
              <text x="36" y={163 - pct * 1.4} textAnchor="end" fill="var(--text-dim)" fontSize="9" fontFamily="var(--sans)">{pct}%</text>
            </g>
          ))}
          {/* Age labels */}
          {[20, 30, 40, 50, 60, 70].map(a => (
            <text key={a} x={40 + (a - 18) * (540 / 52)} y="175" textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="var(--sans)">{a}</text>
          ))}
          {/* Equity curve */}
          <path
            d={gpData.map((d, i) => `${i === 0 ? 'M' : 'L'}${40 + (d.age - 18) * (540 / 52)},${160 - d.equity * 1.4}`).join(' ')}
            fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"
          />
          {/* Bond fill below */}
          <path
            d={`${gpData.map((d, i) => `${i === 0 ? 'M' : 'L'}${40 + (d.age - 18) * (540 / 52)},${160 - d.equity * 1.4}`).join(' ')} L580,160 L40,160 Z`}
            fill="rgba(251,191,36,0.08)"
          />
          {/* Current age marker */}
          <circle cx={40 + (age - 18) * (540 / 52)} cy={160 - totalStock * 1.4} r="6" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
          <text x={40 + (age - 18) * (540 / 52)} y={150 - totalStock * 1.4} textAnchor="middle" fill="var(--accent)" fontSize="10" fontWeight="700" fontFamily="var(--sans)">
            {totalStock}% at {age}
          </text>
          <text x="310" y="175" textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="var(--sans)">Age</text>
          <text x="40" y="15" fill="var(--accent)" fontSize="10" fontFamily="var(--sans)" fontWeight="600">Equity %</text>
          <text x="540" y="155" fill="var(--warn)" fontSize="9" fontFamily="var(--sans)" opacity="0.6">Bonds + Gold</text>
        </svg>
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
              <div style={{ marginTop: 10, padding: '8px 0', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Fee</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{f.expense.toFixed(2)}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>10yr</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue)' }}>{f.ret10.toFixed(1)}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>20yr</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{f.ret20.toFixed(1)}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Invest</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{fmt(f.dollars)}</div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Past performance caveat */}
      <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--warn)' }}>Past performance caveat:</strong> 10yr returns reflect 2015-2025 (strong US bull market). 20yr returns include 2008 crisis and provide a more balanced view. Use 20yr figures for long-term planning. Neither predicts future results.
      </div>

      {/* Dollar breakdown table with returns */}
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>Exact Purchase Amounts</SectionLabel>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['ETF', 'Category', 'Alloc', 'Amount', 'Fee', '10yr', '20yr', 'Max Draw'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: h === 'ETF' || h === 'Category' ? 'left' : 'right', color: 'var(--text-dim)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {funds.map(f => (
                <tr key={f.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px' }}><code style={{ color: 'var(--accent)', fontWeight: 700 }}>{f.displayTicker}</code></td>
                  <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{f.category}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: f.color }}>{f.pct}%</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: 'var(--text)' }}>{fmtFull(f.dollars)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: 'var(--accent)' }}>{f.expense.toFixed(2)}%</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: 'var(--blue)' }}>{f.ret10.toFixed(1)}%</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)' }}>{f.ret20.toFixed(1)}%</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: 'var(--danger)' }}>{f.maxDraw}%</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--bg2)' }}>
                <td colSpan={2} style={{ padding: '10px', fontWeight: 700, color: 'var(--text)' }}>Total / Blended</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>100%</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{fmtFull(portfolioSize)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{blendedExpense.toFixed(3)}%</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--blue)' }}>{(funds.reduce((s, f) => s + f.pct * f.ret10, 0) / 100).toFixed(1)}%</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>{blendedRet20.toFixed(1)}%</td>
                <td style={{ padding: '10px' }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── ASSET LOCATION GUIDE ── */}
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel icon="🧭">Where to Hold Each ETF (Tax-Efficient Placement)</SectionLabel>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.5 }}>
          Asset location can add 0.1-0.5% annually to after-tax returns. Place tax-inefficient assets (bonds, gold) in tax-sheltered accounts, and tax-efficient assets (US/intl stocks) in taxable.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }} className="grid-2">
          {/* Taxable column */}
          <div style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>💰 Taxable Brokerage</div>
            {taxable.length > 0 ? taxable.map(f => (
              <div key={f.ticker} style={{ marginBottom: 8, padding: '8px 10px', background: 'var(--card)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <code style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 12 }}>{f.displayTicker}</code>
                  <span style={{ color: f.color, fontWeight: 600, fontSize: 12 }}>{f.pct}%</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{f.locationWhy}</div>
              </div>
            )) : <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>None allocated</div>}
          </div>

          {/* Tax-deferred column */}
          <div style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)', marginBottom: 8 }}>🏦 401(k) / Traditional IRA</div>
            {deferred.length > 0 ? deferred.map(f => (
              <div key={f.ticker} style={{ marginBottom: 8, padding: '8px 10px', background: 'var(--card)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <code style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 12 }}>{f.displayTicker}</code>
                  <span style={{ color: f.color, fontWeight: 600, fontSize: 12 }}>{f.pct}%</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{f.locationWhy}</div>
              </div>
            )) : <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>None allocated</div>}
          </div>

          {/* Either column */}
          <div style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)', marginBottom: 8 }}>↔️ Either / Roth IRA</div>
            {either.length > 0 ? either.map(f => (
              <div key={f.ticker} style={{ marginBottom: 8, padding: '8px 10px', background: 'var(--card)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <code style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 12 }}>{f.displayTicker}</code>
                  <span style={{ color: f.color, fontWeight: 600, fontSize: 12 }}>{f.pct}%</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{f.locationWhy}</div>
              </div>
            )) : <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Roth is ideal for highest-growth ETFs</div>}
          </div>
        </div>
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
            { icon: '🌍', title: 'Global diversification', desc: `${intlBias}% international equity — ${intlBias >= 35 ? 'Vanguard-aligned' : 'US-tilted home bias'} approach` },
            { icon: '💸', title: 'Ultra-low fees', desc: `Blended ${blendedExpense.toFixed(3)}% vs 1%+ advisor — ${fmtFull(Math.round(portfolioSize * 0.01 - portfolioSize * blendedExpense / 100))}/yr saved` },
            { icon: '📈', title: 'Research-backed', desc: 'Glide path based on Vanguard TDF methodology, not folk rules' },
            { icon: '🏆', title: 'Small-cap tilt', desc: age < 40 ? `${alloc.VXF || 0}% extended market for higher growth when young` : 'Balanced large/small cap for stability' },
            { icon: '🛡️', title: includeGold ? 'Gold hedge' : 'Bond stability', desc: includeGold ? `${totalGold}% gold — uncorrelated to stocks in crashes (2022: stocks -18%, gold +1%)` : `${totalBond}% bonds cushion drawdowns` },
            { icon: '🧭', title: 'Tax-optimized placement', desc: 'Asset location guide saves 0.1-0.5% annually after-tax' },
          ].map((r, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '16px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{r.icon}</div>
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 12, marginBottom: 4 }}>{r.title}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.4 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Deep Analytics Toggle */}
      <button
        onClick={() => setShowAnalytics(!showAnalytics)}
        style={{
          width: '100%', marginTop: 20, padding: '16px 24px', borderRadius: 10,
          background: showAnalytics ? 'rgba(99,102,241,0.12)' : 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(52,211,153,0.06) 100%)',
          border: showAnalytics ? '1.5px solid rgba(99,102,241,0.4)' : '1.5px solid var(--border)',
          cursor: 'pointer', transition: 'all .25s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}
      >
        <span style={{ fontSize: 22 }}>📊</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--sans)' }}>
            {showAnalytics ? 'Hide' : 'Show'} Deep Portfolio Analytics
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Correlation matrix · Stress tests · Sharpe ratios · Tax efficiency · Sector/geo exposure · Rate sensitivity
          </div>
        </div>
        <span style={{ fontSize: 18, color: 'var(--text-dim)', transition: 'transform .2s', transform: showAnalytics ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
      </button>

      {showAnalytics && <PortfolioAnalytics alloc={alloc} portfolioSize={portfolioSize} funds={funds} />}
    </div>
  );
}
