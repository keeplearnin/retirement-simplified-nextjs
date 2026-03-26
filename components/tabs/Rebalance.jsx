'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt, fmtFull, descArc } from '@/lib/format';
import { RISK_LABELS, ASSET_CLASSES } from '@/lib/constants';

function computeTarget(age, risk) {
  const base = Math.max(20, Math.min(95, 110 - age));
  const adj = (risk - 3) * 8;
  const stock = Math.max(15, Math.min(95, base + adj));
  const intl = Math.round(stock * 0.3);
  const dom = stock - intl;
  const bond = Math.max(5, 100 - stock - 5);
  const cash = 100 - dom - intl - bond;
  return { us_stock: dom, intl_stock: intl, bond, cash };
}

let holdingIdCounter = 0;

export default function Rebalance() {
  const [age, setAge] = useState(35);
  const [risk, setRisk] = useState(3);
  const [threshold, setThreshold] = useState(5);
  const [holdings, setHoldings] = useState([]);
  const [newHolding, setNewHolding] = useState({ name: '', value: '', assetClass: 'us_stock' });

  function addHolding() {
    const val = parseFloat(newHolding.value);
    if (!newHolding.name || !val || val <= 0) return;
    setHoldings(h => [...h, { id: ++holdingIdCounter, name: newHolding.name, value: val, assetClass: newHolding.assetClass }]);
    setNewHolding({ name: '', value: '', assetClass: 'us_stock' });
  }

  function removeHolding(id) {
    setHoldings(h => h.filter(x => x.id !== id));
  }

  const target = useMemo(() => computeTarget(age, risk), [age, risk]);

  const totalValue = useMemo(() => holdings.reduce((s, h) => s + h.value, 0), [holdings]);

  const current = useMemo(() => {
    const c = { us_stock: 0, intl_stock: 0, bond: 0, cash: 0 };
    holdings.forEach(h => { c[h.assetClass] = (c[h.assetClass] || 0) + h.value; });
    return c;
  }, [holdings]);

  const currentPct = useMemo(() => {
    if (totalValue === 0) return { us_stock: 0, intl_stock: 0, bond: 0, cash: 0 };
    return {
      us_stock: (current.us_stock / totalValue) * 100,
      intl_stock: (current.intl_stock / totalValue) * 100,
      bond: (current.bond / totalValue) * 100,
      cash: (current.cash / totalValue) * 100,
    };
  }, [current, totalValue]);

  const driftData = useMemo(() => {
    return ASSET_CLASSES.map(ac => {
      const cur = currentPct[ac.id] || 0;
      const tgt = target[ac.id] || 0;
      const drift = cur - tgt;
      const absDrift = Math.abs(drift);
      const needsAction = absDrift >= threshold;
      const amount = (drift / 100) * totalValue;
      return { ...ac, current: cur, target: tgt, drift, absDrift, needsAction, amount };
    });
  }, [currentPct, target, threshold, totalValue]);

  const trades = useMemo(() => {
    if (totalValue === 0) return [];
    const t = driftData
      .filter(d => d.needsAction)
      .map(d => ({
        ...d,
        action: d.drift > 0 ? 'sell' : 'buy',
        tradeAmount: Math.abs(d.amount),
      }))
      .sort((a, b) => (a.action === 'sell' ? -1 : 1) - (b.action === 'sell' ? -1 : 1));
    return t;
  }, [driftData, totalValue]);

  const maxDrift = useMemo(() => Math.max(...driftData.map(d => d.absDrift), 0), [driftData]);
  const isBalanced = maxDrift < threshold;

  function makeDonutSegs(alloc) {
    let cum = 0;
    return ASSET_CLASSES.map(ac => {
      const pct = alloc[ac.id] || 0;
      const s = cum;
      cum += pct;
      return { ...ac, start: s, end: cum, pct };
    }).filter(s => s.pct > 0);
  }

  const targetSegs = useMemo(() => makeDonutSegs(target), [target]);
  const currentSegs = useMemo(() => makeDonutSegs(currentPct), [currentPct]);

  function Donut({ segs, label }) {
    return (
      <div style={{ textAlign: 'center' }}>
        <svg viewBox="0 0 200 200" style={{ width: '100%', maxWidth: 160, display: 'block', margin: '0 auto' }}>
          {segs.map((seg, i) => {
            const gap = 2, sA = (seg.start / 100) * 360 + gap, eA = (seg.end / 100) * 360 - gap;
            if (eA <= sA) return null;
            return <path key={i} d={descArc(100, 100, 70, sA, eA)} fill="none" stroke={seg.color} strokeWidth="28" strokeLinecap="round" />;
          })}
          <text x="100" y="105" textAnchor="middle" fill="var(--text-muted)" fontSize="12" fontFamily="Outfit" fontWeight="600">{label}</text>
        </svg>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <InfoBox icon="⚖️" title="Portfolio Rebalancing" color="var(--accent)">
        Enter your current holdings, and we&apos;ll compare them to your target allocation.
        You&apos;ll get <strong style={{ color: 'var(--text)' }}>specific trade recommendations</strong> to bring your portfolio back in line — the same thing robo-advisors charge 0.25% for.
      </InfoBox>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 32, marginTop: 16 }}>
        {/* LEFT COLUMN */}
        <div>
          <Card>
            <SectionLabel>Target Allocation</SectionLabel>
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
            <Slider label="Rebalance Threshold" value={threshold} onChange={setThreshold} min={1} max={10} suffix="%" tooltip="Only recommend trades when drift exceeds this %" />
            <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: 14, border: '1px solid var(--border)' }}>
              <div className="f11 dim upcase mb-8">Target Mix</div>
              {ASSET_CLASSES.map(ac => (
                <div key={ac.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: ac.color }} />
                    <span className="f12 muted">{ac.label}</span>
                  </div>
                  <span className="f14 fw7" style={{ color: ac.color, fontFamily: 'var(--serif)' }}>{target[ac.id]}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Your Current Holdings</SectionLabel>
            {holdings.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                {holdings.map(h => {
                  const ac = ASSET_CLASSES.find(a => a.id === h.assetClass);
                  return (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '8px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: ac?.color, flexShrink: 0 }} />
                      <span className="f12" style={{ flex: 1, color: 'var(--text)' }}>{h.name}</span>
                      <span className="f12 fw6" style={{ color: ac?.color }}>{fmt(h.value)}</span>
                      <span className="f10 dim" style={{ padding: '2px 6px', background: 'var(--bg)', borderRadius: 4 }}>{ac?.label}</span>
                      <button onClick={() => removeHolding(h.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16, padding: '0 4px' }}>&times;</button>
                    </div>
                  );
                })}
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <span className="f11 dim">Total: </span>
                  <span className="f16 fw7 c-accent" style={{ fontFamily: 'var(--serif)' }}>{fmtFull(totalValue)}</span>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={newHolding.name}
                onChange={e => setNewHolding(h => ({ ...h, name: e.target.value }))}
                placeholder="Fund name (e.g. VTI)"
                style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, outline: 'none' }}
              />
              <input
                type="number"
                value={newHolding.value}
                onChange={e => setNewHolding(h => ({ ...h, value: e.target.value }))}
                placeholder="Value ($)"
                style={{ width: 100, padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, outline: 'none' }}
                onKeyDown={e => e.key === 'Enter' && addHolding()}
              />
              <select
                value={newHolding.assetClass}
                onChange={e => setNewHolding(h => ({ ...h, assetClass: e.target.value }))}
                style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12 }}
              >
                {ASSET_CLASSES.map(ac => <option key={ac.id} value={ac.id}>{ac.label}</option>)}
              </select>
              <button
                onClick={addHolding}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'var(--accent)', color: 'var(--bg)', fontWeight: 700, fontSize: 12 }}
              >+</button>
            </div>
            {holdings.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-dim)', fontSize: 12 }}>
                Add your holdings above to see rebalancing recommendations
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {holdings.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '60px 32px' }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>⚖️</div>
              <div className="serif f20 mb-8" style={{ color: 'var(--text-muted)' }}>Enter Your Holdings</div>
              <div className="f13 dim lh-loose">
                Add your current investments on the left — fund name, value, and asset class.
                We&apos;ll calculate how far you&apos;ve drifted from your target and tell you exactly what to trade.
              </div>
            </Card>
          ) : (
            <>
              {/* Stats */}
              <div className="stats-row" style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <Stat icon="💼" label="Total Portfolio" value={fmt(totalValue)} />
                <Stat
                  icon={isBalanced ? '✅' : '⚠️'}
                  label="Status"
                  value={isBalanced ? 'Balanced' : `${trades.length} trade${trades.length !== 1 ? 's' : ''} needed`}
                  color={isBalanced ? 'var(--accent)' : 'var(--warn)'}
                />
                <Stat
                  icon="📊"
                  label="Max Drift"
                  value={`${maxDrift.toFixed(1)}%`}
                  color={maxDrift < threshold ? 'var(--accent)' : maxDrift < 10 ? 'var(--warn)' : 'var(--danger)'}
                  sub={`Threshold: ${threshold}%`}
                />
              </div>

              {/* Donut Comparison */}
              <Card>
                <SectionLabel>Current vs Target Allocation</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <Donut segs={currentSegs} label="Current" />
                  <Donut segs={targetSegs} label="Target" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
                  {ASSET_CLASSES.map(ac => (
                    <div key={ac.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: ac.color }} />{ac.label}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Drift Table */}
              <Card style={{ marginTop: 14 }}>
                <SectionLabel>Allocation Drift</SectionLabel>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['Asset Class', 'Current', 'Target', 'Drift', 'Status'].map((h, i) => (
                          <th key={i} style={{ padding: '10px 12px', background: 'var(--bg)', borderBottom: '2px solid var(--border)', textAlign: i >= 1 ? 'right' : 'left', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: '.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {driftData.map(d => (
                        <tr key={d.id}>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{d.label}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--text-muted)' }}>{d.current.toFixed(1)}%</td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--text-muted)' }}>{d.target.toFixed(1)}%</td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, color: d.absDrift < threshold ? 'var(--text-dim)' : d.drift > 0 ? 'var(--danger)' : 'var(--accent)' }}>
                            {d.drift > 0 ? '+' : ''}{d.drift.toFixed(1)}%
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontSize: 14 }}>
                            {d.absDrift < threshold ? '✅' : '⚠️'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Trade Recommendations */}
              <Card style={{ marginTop: 14, borderColor: isBalanced ? 'rgba(52,211,153,.2)' : 'rgba(251,191,36,.2)' }}>
                <SectionLabel>{isBalanced ? '✅ Portfolio is Balanced' : '📋 Recommended Trades'}</SectionLabel>
                {isBalanced ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                    <div className="serif f18 c-accent">No trades needed</div>
                    <div className="f13 dim mt-8">All asset classes are within your {threshold}% drift threshold. Check back in a few months.</div>
                  </div>
                ) : (
                  <div>
                    {trades.map((t, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 16px', marginBottom: 8,
                        background: t.action === 'sell' ? 'var(--danger-dim)' : 'var(--accent-dim)',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${t.action === 'sell' ? 'rgba(248,113,113,.15)' : 'rgba(52,211,153,.2)'}`,
                      }}>
                        <div>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
                            color: t.action === 'sell' ? 'var(--danger)' : 'var(--accent)',
                            padding: '2px 8px', borderRadius: 4,
                            background: t.action === 'sell' ? 'rgba(248,113,113,.1)' : 'rgba(52,211,153,.1)',
                          }}>{t.action}</span>
                          <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t.label}</span>
                          <span className="f11 dim" style={{ marginLeft: 8 }}>({t.ticker})</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700,
                            color: t.action === 'sell' ? 'var(--danger)' : 'var(--accent)',
                          }}>
                            {t.action === 'sell' ? '-' : '+'}{fmt(t.tradeAmount)}
                          </div>
                          <div className="f11 dim">{fmtFull(t.tradeAmount)}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="f12 dim">Net cash flow</span>
                      <span className="f14 fw7 c-accent" style={{ fontFamily: 'var(--serif)' }}>$0</span>
                    </div>
                  </div>
                )}
              </Card>

              {/* Tips */}
              <Card style={{ marginTop: 14 }}>
                <SectionLabel>Rebalancing Tips</SectionLabel>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 2 }}>
                  {[
                    { i: '📅', t: 'Rebalance 1-2x per year', d: 'More often creates unnecessary trading costs and taxes' },
                    { i: '💰', t: 'Use new contributions first', d: 'Direct new money to underweight classes instead of selling' },
                    { i: '🏦', t: 'Rebalance in tax-advantaged accounts', d: 'No capital gains tax in 401(k)/IRA — rebalance there first' },
                    { i: '📊', t: 'Use threshold-based rebalancing', d: `Only trade when drift exceeds ${threshold}% — reduces unnecessary transactions` },
                  ].map((x, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{x.i}</span>
                      <div><strong style={{ color: 'var(--text)' }}>{x.t}</strong><span style={{ color: 'var(--text-dim)' }}> — {x.d}</span></div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
