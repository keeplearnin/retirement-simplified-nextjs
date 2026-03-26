'use client';

import { useMemo } from 'react';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import { fmt, fmtFull } from '@/lib/format';
import { CORRELATIONS, ETF_METRICS, STRESS_TESTS, TAX_PROFILES, DIVIDEND_DATA, BOND_METRICS, computePortfolioMetrics } from '@/lib/etfData';

// Heatmap color for correlation values
function corrColor(v) {
  if (v >= 0.8) return 'rgba(239,68,68,0.7)';
  if (v >= 0.6) return 'rgba(249,115,22,0.5)';
  if (v >= 0.3) return 'rgba(251,191,36,0.35)';
  if (v >= 0) return 'rgba(52,211,153,0.2)';
  return 'rgba(59,130,246,0.4)';
}

function ratingColor(val, thresholds) {
  // thresholds = { good, ok } — higher is better
  if (val >= thresholds.good) return 'var(--accent)';
  if (val >= thresholds.ok) return 'var(--warn)';
  return 'var(--danger)';
}

const cellStyle = { padding: '8px 10px', fontSize: 11, fontFamily: 'var(--sans)', borderBottom: '1px solid var(--border)' };
const headerStyle = { ...cellStyle, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '.06em' };

export default function PortfolioAnalytics({ alloc, portfolioSize, funds }) {
  const tickers = Object.entries(alloc).filter(([, p]) => p > 0).map(([t]) => t);

  const metrics = useMemo(() => computePortfolioMetrics(alloc), [alloc]);

  const { avgReturn, portfolioStdDev, sharpe, stressResults, worstDrawdown, blendedTaxCost, blendedQualified, blendedYield, sectors, geos, portfolioDuration, totalBondPct } = metrics;

  const annualIncome = portfolioSize * blendedYield / 100;
  const monthlyIncome = annualIncome / 12;

  // Sort sectors/geos by weight
  const sortedSectors = Object.entries(sectors).sort((a, b) => b[1] - a[1]);
  const sortedGeos = Object.entries(geos).sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= 0.5);

  const sectorColors = {
    Tech: '#818cf8', Healthcare: '#34d399', Financials: '#60a5fa', ConsDisc: '#f472b6',
    Industrials: '#a78bfa', CommSvcs: '#fb923c', ConsStaples: '#4ade80', Energy: '#ef4444',
    Utilities: '#22d3ee', RealEstate: '#fbbf24', Materials: '#94a3b8',
  };

  return (
    <div style={{ marginTop: 24 }}>
      {/* Portfolio-level summary */}
      <Card style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(52,211,153,0.04) 100%)' }}>
        <SectionLabel icon="📊">Portfolio Risk Analytics</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 8 }}>
          {[
            { label: 'Expected Return', value: `${avgReturn.toFixed(1)}%`, color: 'var(--accent)' },
            { label: 'Portfolio Volatility', value: `${portfolioStdDev.toFixed(1)}%`, color: portfolioStdDev > 15 ? 'var(--warn)' : 'var(--blue)' },
            { label: 'Sharpe Ratio', value: sharpe.toFixed(2), color: ratingColor(sharpe, { good: 0.3, ok: 0.15 }) },
            { label: 'Worst Drawdown', value: `${worstDrawdown.toFixed(1)}%`, color: 'var(--danger)' },
            { label: 'Tax Cost Ratio', value: `${blendedTaxCost.toFixed(2)}%/yr`, color: ratingColor(1 - blendedTaxCost, { good: 0.6, ok: 0.3 }) },
            { label: 'Annual Income', value: fmt(annualIncome), color: 'var(--accent)' },
          ].map((m, i) => (
            <div key={i} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)', color: m.color, marginTop: 4 }}>{m.value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ---- CORRELATION MATRIX ---- */}
      <Card style={{ marginBottom: 20, overflowX: 'auto' }}>
        <SectionLabel icon="🔗">Correlation Matrix (10yr Monthly Returns)</SectionLabel>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
          Low correlation = better diversification. <span style={{ color: 'var(--blue)' }}>Blue = negative</span> (ideal hedge), <span style={{ color: 'var(--accent)' }}>Green = low</span>, <span style={{ color: 'var(--warn)' }}>Orange = moderate</span>, <span style={{ color: 'var(--danger)' }}>Red = high</span> (move together).
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={headerStyle}></th>
              {tickers.map(t => <th key={t} style={{ ...headerStyle, textAlign: 'center' }}>{t}</th>)}
            </tr>
          </thead>
          <tbody>
            {tickers.map(t1 => (
              <tr key={t1}>
                <td style={{ ...cellStyle, fontWeight: 700, color: 'var(--text)' }}>{t1}</td>
                {tickers.map(t2 => {
                  const v = CORRELATIONS[t1]?.[t2] ?? 0;
                  return (
                    <td key={t2} style={{
                      ...cellStyle, textAlign: 'center', fontWeight: 600,
                      background: t1 === t2 ? 'var(--bg2)' : corrColor(v),
                      color: v < 0 ? 'var(--blue)' : v > 0.7 ? 'var(--danger)' : 'var(--text)',
                    }}>
                      {t1 === t2 ? '—' : v.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ---- RISK-ADJUSTED METRICS TABLE ---- */}
      <Card style={{ marginBottom: 20, overflowX: 'auto' }}>
        <SectionLabel icon="⚖️">Risk-Adjusted Returns (10yr Annualized)</SectionLabel>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['ETF', 'Return', 'Std Dev', 'Sharpe', 'Sortino', 'Max DD', 'Recovery', 'Beta'].map(h => (
                <th key={h} style={{ ...headerStyle, textAlign: h === 'ETF' ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map(t => {
              const m = ETF_METRICS[t];
              if (!m) return null;
              return (
                <tr key={t}>
                  <td style={{ ...cellStyle, fontWeight: 700, color: 'var(--accent)' }}>{t}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--text)' }}>{m.avgReturn.toFixed(1)}%</td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: m.stdDev > 18 ? 'var(--warn)' : 'var(--text-muted)' }}>{m.stdDev.toFixed(1)}%</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: ratingColor(m.sharpe, { good: 0.3, ok: 0.15 }) }}>{m.sharpe.toFixed(2)}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: ratingColor(m.sortino, { good: 0.4, ok: 0.2 }) }}>{m.sortino.toFixed(2)}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--danger)' }}>{m.maxDrawdown.toFixed(1)}%</td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--text-muted)' }}>{m.recovery}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: m.beta > 1 ? 'var(--warn)' : 'var(--text-muted)' }}>{m.beta.toFixed(2)}</td>
                </tr>
              );
            })}
            <tr style={{ background: 'var(--bg2)' }}>
              <td style={{ ...cellStyle, fontWeight: 700 }}>Portfolio</td>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{avgReturn.toFixed(1)}%</td>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700, color: 'var(--blue)' }}>{portfolioStdDev.toFixed(1)}%</td>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700, color: ratingColor(sharpe, { good: 0.3, ok: 0.15 }) }}>{sharpe.toFixed(2)}</td>
              <td colSpan={4} style={{ ...cellStyle, textAlign: 'right', fontSize: 10, color: 'var(--text-dim)' }}>
                Diversification reduces portfolio vol from {(tickers.reduce((s, t) => s + (ETF_METRICS[t]?.stdDev || 0) * (alloc[t] || 0), 0) / 100).toFixed(1)}% → {portfolioStdDev.toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      {/* ---- STRESS TESTS ---- */}
      <Card style={{ marginBottom: 20, overflowX: 'auto' }}>
        <SectionLabel icon="🔥">Historical Stress Tests</SectionLabel>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
          How your portfolio would have performed during major market crises. Dollar losses based on {fmtFull(portfolioSize)} portfolio.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...headerStyle, textAlign: 'left' }}>Crisis</th>
              <th style={{ ...headerStyle, textAlign: 'left' }}>Period</th>
              <th style={{ ...headerStyle, textAlign: 'right' }}>Portfolio</th>
              <th style={{ ...headerStyle, textAlign: 'right' }}>$ Loss</th>
              {tickers.slice(0, 4).map(t => <th key={t} style={{ ...headerStyle, textAlign: 'right' }}>{t}</th>)}
            </tr>
          </thead>
          <tbody>
            {stressResults.map((s, i) => {
              const dollarLoss = portfolioSize * s.portfolioReturn / 100;
              return (
                <tr key={i}>
                  <td style={{ ...cellStyle, fontWeight: 600, color: 'var(--text)' }}>
                    {s.name}
                  </td>
                  <td style={{ ...cellStyle, color: 'var(--text-dim)', fontSize: 10 }}>{s.period}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700, color: s.portfolioReturn < -20 ? 'var(--danger)' : s.portfolioReturn < 0 ? 'var(--warn)' : 'var(--accent)' }}>
                    {s.portfolioReturn.toFixed(1)}%
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                    {dollarLoss < 0 ? '-' : '+'}{fmt(Math.abs(dollarLoss))}
                  </td>
                  {tickers.slice(0, 4).map(t => (
                    <td key={t} style={{ ...cellStyle, textAlign: 'right', color: (s.returns[t] || 0) < 0 ? 'var(--text-dim)' : 'var(--accent)', fontSize: 10 }}>
                      {(s.returns[t] || 0).toFixed(1)}%
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* ---- TAX EFFICIENCY ---- */}
      <Card style={{ marginBottom: 20, overflowX: 'auto' }}>
        <SectionLabel icon="🏛️">Tax Efficiency Analysis</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 14 }}>
          {[
            { label: 'Blended Tax Cost', value: `${blendedTaxCost.toFixed(2)}%/yr`, sub: `${fmtFull(Math.round(portfolioSize * blendedTaxCost / 100))}/yr lost to taxes`, color: blendedTaxCost < 0.4 ? 'var(--accent)' : 'var(--warn)' },
            { label: 'Qualified Dividends', value: `${blendedQualified.toFixed(0)}%`, sub: 'Taxed at LTCG rate (0/15/20%)', color: blendedQualified > 70 ? 'var(--accent)' : 'var(--warn)' },
            { label: 'Annual Income', value: fmt(annualIncome), sub: `${fmt(monthlyIncome)}/mo · Yield ${blendedYield.toFixed(1)}%`, color: 'var(--blue)' },
          ].map((m, i) => (
            <div key={i} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--serif)', color: m.color, marginTop: 2 }}>{m.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['ETF', 'Yield', 'Qualified %', 'Turnover', 'Tax Cost', 'Frequency', 'Foreign Tax Credit'].map(h => (
                <th key={h} style={{ ...headerStyle, textAlign: h === 'ETF' ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map(t => {
              const tax = TAX_PROFILES[t];
              const div = DIVIDEND_DATA[t];
              if (!tax || !div) return null;
              return (
                <tr key={t}>
                  <td style={{ ...cellStyle, fontWeight: 700, color: 'var(--accent)' }}>{t}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{div.yield.toFixed(1)}%</td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: tax.qualifiedDividendPct > 80 ? 'var(--accent)' : tax.qualifiedDividendPct > 0 ? 'var(--warn)' : 'var(--text-dim)' }}>{tax.qualifiedDividendPct}%</td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: tax.turnoverRate > 20 ? 'var(--warn)' : 'var(--text-muted)' }}>{tax.turnoverRate}%</td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: tax.taxCostRatio > 0.5 ? 'var(--warn)' : 'var(--accent)' }}>{tax.taxCostRatio.toFixed(2)}%</td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--text-muted)' }}>{tax.distribFrequency}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{div.foreignTaxCredit ? <span style={{ color: 'var(--accent)' }}>✓</span> : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(52,211,153,0.06)', borderRadius: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          <strong style={{ color: 'var(--text)' }}>Tax-Optimal Placement:</strong> Hold BND/BNDX in tax-deferred accounts (401k/IRA) — bond interest is taxed as ordinary income. Hold VOO/VXF in taxable accounts — qualified dividends taxed at lower LTCG rates. GLD in tax-deferred if possible (collectibles rate = 28%).
        </div>
      </Card>

      {/* ---- SECTOR EXPOSURE ---- */}
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel icon="🏢">Sector Concentration</SectionLabel>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
          Weighted by your allocation. Watch for over-concentration in any single sector.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sortedSectors.filter(([, v]) => v >= 0.5).map(([sector, pct]) => (
            <div key={sector} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 90, fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0 }}>{sector}</div>
              <div style={{ flex: 1, height: 18, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${Math.min(pct, 100)}%`, height: '100%',
                  background: pct > 25 ? 'var(--danger)' : pct > 15 ? 'var(--warn)' : sectorColors[sector] || 'var(--accent)',
                  borderRadius: 4, transition: 'width .3s',
                }} />
              </div>
              <div style={{ width: 50, textAlign: 'right', fontSize: 12, fontWeight: 600, color: pct > 25 ? 'var(--danger)' : 'var(--text)', fontFamily: 'var(--sans)' }}>
                {pct.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
        {sortedSectors[0] && sortedSectors[0][1] > 25 && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, fontSize: 11, color: 'var(--warn)' }}>
            ⚠️ <strong>{sortedSectors[0][0]}</strong> is {sortedSectors[0][1].toFixed(1)}% of your portfolio — consider if this concentration aligns with your risk tolerance.
          </div>
        )}
      </Card>

      {/* ---- GEOGRAPHIC EXPOSURE ---- */}
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel icon="🌍">Geographic Exposure</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="grid-2">
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>By Country/Region</div>
            {sortedGeos.slice(0, 10).map(([geo, pct]) => (
              <div key={geo} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>{geo}</span>
                <span style={{ fontWeight: 600, color: pct > 40 ? 'var(--warn)' : 'var(--text)' }}>{pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>Summary</div>
            {(() => {
              const us = (geos['United States'] || 0);
              const developed = us + (geos['Japan'] || 0) + (geos['UK'] || 0) + (geos['France'] || 0) + (geos['Germany'] || 0) + (geos['Switzerland'] || 0) + (geos['Australia'] || 0) + (geos['Canada'] || 0) + (geos['Netherlands'] || 0) + (geos['Sweden'] || 0) + (geos['Europe'] || 0);
              const emerging = 100 - developed - (geos['Physical Gold'] || 0) - (geos['US Treasury'] || 0) - (geos['US Corp IG'] || 0) - (geos['US MBS'] || 0) - (geos['US Agency'] || 0);
              return [
                { label: 'United States', pct: us, color: 'var(--accent)' },
                { label: 'Developed ex-US', pct: Math.max(0, developed - us), color: 'var(--blue)' },
                { label: 'Emerging Markets', pct: Math.max(0, emerging), color: '#818cf8' },
              ].filter(r => r.pct > 0).map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: r.color }}>{r.pct.toFixed(1)}%</span>
                </div>
              ));
            })()}
          </div>
        </div>
      </Card>

      {/* ---- INTEREST RATE SENSITIVITY ---- */}
      {totalBondPct > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <SectionLabel icon="📉">Interest Rate Sensitivity (Bond Allocation)</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>Portfolio Duration</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--blue)' }}>{portfolioDuration.toFixed(1)} yrs</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Price drop per 1% rate increase</div>
            </div>
            <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>If Rates Rise 1%</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--danger)' }}>
                -{fmt(Math.round(portfolioSize * (totalBondPct / 100) * portfolioDuration / 100))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Impact on bond portion ({totalBondPct}% of portfolio)</div>
            </div>
            <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>Bond Yield to Maturity</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--accent)' }}>
                {(Object.entries(alloc).filter(([t]) => BOND_METRICS[t]).reduce((s, [t, p]) => s + (BOND_METRICS[t]?.yieldToMaturity || 0) * p, 0) / totalBondPct).toFixed(2)}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Breakeven: rates can rise ~{((Object.entries(alloc).filter(([t]) => BOND_METRICS[t]).reduce((s, [t, p]) => s + (BOND_METRICS[t]?.yieldToMaturity || 0) * p, 0) / totalBondPct) / portfolioDuration).toFixed(1)}%/yr before you lose money</div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Bond ETF', 'Duration', 'Avg Maturity', 'Credit Quality', 'YTM', 'Allocation', '$ Invested'].map(h => (
                  <th key={h} style={{ ...headerStyle, textAlign: h === 'Bond ETF' ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(alloc).filter(([t]) => BOND_METRICS[t]).map(([t, pct]) => {
                const b = BOND_METRICS[t];
                return (
                  <tr key={t}>
                    <td style={{ ...cellStyle, fontWeight: 700, color: 'var(--accent)' }}>{t}</td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>{b.effectiveDuration.toFixed(1)} yrs</td>
                    <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--text-muted)' }}>{b.avgMaturity.toFixed(1)} yrs</td>
                    <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--blue)' }}>{b.creditQuality}</td>
                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>{b.yieldToMaturity.toFixed(2)}%</td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>{pct}%</td>
                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>{fmtFull(Math.round(portfolioSize * pct / 100))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
