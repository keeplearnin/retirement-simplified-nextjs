'use client';

import { useState, useMemo, useRef } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import FormInput from '@/components/ui/FormInput';
import FormSelect from '@/components/ui/FormSelect';
import BracketButtons from '@/components/ui/BracketButtons';
import { fmt, fmtFull } from '@/lib/format';
import { TAX_BRACKETS, ASSET_CLASSES, REPLACEMENT_FUNDS } from '@/lib/constants';

export default function TaxLossHarvesting() {
  const idCounter = useRef(0);
  const [holdings, setHoldings] = useState([]);
  const [taxRate, setTaxRate] = useState(24);
  const [stateRate, setStateRate] = useState(5);
  const [newHolding, setNewHolding] = useState({ name: '', currentValue: '', costBasis: '', assetClass: 'us_stock', purchaseDate: '' });

  function addHolding() {
    const cv = parseFloat(newHolding.currentValue);
    const cb = parseFloat(newHolding.costBasis);
    if (!newHolding.name || !cv || cv <= 0 || !cb || cb <= 0 || !newHolding.purchaseDate) return;
    setHoldings(h => [...h, { id: ++idCounter.current, name: newHolding.name, currentValue: cv, costBasis: cb, assetClass: newHolding.assetClass, purchaseDate: newHolding.purchaseDate }]);
    setNewHolding({ name: '', currentValue: '', costBasis: '', assetClass: 'us_stock', purchaseDate: '' });
  }

  function removeHolding(id) {
    setHoldings(h => h.filter(x => x.id !== id));
  }

  const analysis = useMemo(() => {
    const today = new Date();
    const analyzed = holdings.map(h => {
      const unrealizedGain = h.currentValue - h.costBasis;
      const isLoss = unrealizedGain < 0;
      const purchaseDate = new Date(h.purchaseDate);
      const diffMs = today - purchaseDate;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      const holdingPeriod = diffDays > 365 ? 'long-term' : 'short-term';
      const shortTermRate = (taxRate + stateRate) / 100;
      const longTermRate = 0.15 + stateRate / 100;
      const applicableRate = holdingPeriod === 'long-term' ? longTermRate : shortTermRate;
      const taxSavings = isLoss ? Math.abs(unrealizedGain) * applicableRate : 0;
      const replacement = REPLACEMENT_FUNDS[h.name.toUpperCase()] || null;
      return { ...h, unrealizedGain, isLoss, holdingPeriod, applicableRate, taxSavings, replacement };
    });

    const totalGains = analyzed.reduce((s, h) => s + (h.unrealizedGain > 0 ? h.unrealizedGain : 0), 0);
    const totalLosses = analyzed.reduce((s, h) => s + (h.unrealizedGain < 0 ? Math.abs(h.unrealizedGain) : 0), 0);
    const totalTaxSavings = analyzed.reduce((s, h) => s + h.taxSavings, 0);
    const netGainLoss = totalGains - totalLosses;

    return { analyzed, totalGains, totalLosses, totalTaxSavings, netGainLoss };
  }, [holdings, taxRate, stateRate]);

  const lossPositions = analysis.analyzed.filter(h => h.isLoss);

  return (
    <div className="fade-up">
      <InfoBox icon="🌾" title="Tax-Loss Harvesting" color="var(--accent)">
        Sell investments at a loss to offset capital gains taxes. Losses can offset gains dollar-for-dollar, plus up to <strong style={{ color: 'var(--text)' }}>$3,000/year</strong> of ordinary income. Unused losses carry forward indefinitely.
      </InfoBox>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 32, marginTop: 16 }}>
        {/* LEFT COLUMN */}
        <div>
          <Card>
            <SectionLabel>Tax Settings</SectionLabel>

            <div style={{ marginBottom: 18 }}>
              <div className="f11 dim upcase mb-8" style={{ letterSpacing: '.08em' }}>Federal Tax Bracket</div>
              <BracketButtons brackets={TAX_BRACKETS} selected={taxRate} onSelect={setTaxRate} variant="dim" />
            </div>

            <Slider label="State Tax Rate" value={stateRate} onChange={setStateRate} min={0} max={13} step={0.5} suffix="%" />
          </Card>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Your Holdings</SectionLabel>

            {holdings.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                {holdings.map(h => {
                  const ac = ASSET_CLASSES.find(a => a.id === h.assetClass);
                  const a = analysis.analyzed.find(x => x.id === h.id);
                  const gain = a ? a.unrealizedGain : 0;
                  const isLoss = gain < 0;
                  return (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '8px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: ac?.color, flexShrink: 0 }} />
                      <span className="f12" style={{ flex: 1, color: 'var(--text)' }}>{h.name}</span>
                      <span className="f12 fw6" style={{ color: isLoss ? 'var(--danger)' : 'var(--accent)', fontFamily: 'var(--serif)' }}>
                        {isLoss ? '-' : '+'}{fmt(Math.abs(gain))}
                      </span>
                      <span className="f10" style={{ padding: '2px 6px', borderRadius: 4, background: a?.holdingPeriod === 'long-term' ? 'rgba(52,211,153,.1)' : 'rgba(251,191,36,.1)', color: a?.holdingPeriod === 'long-term' ? 'var(--accent)' : 'var(--warn)', fontWeight: 600 }}>
                        {a?.holdingPeriod === 'long-term' ? 'LT' : 'ST'}
                      </span>
                      <button onClick={() => removeHolding(h.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16, padding: '0 4px' }}>&times;</button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <FormInput
                  value={newHolding.name}
                  onChange={v => setNewHolding(h => ({ ...h, name: v }))}
                  placeholder="Fund name (e.g. VTI)"
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12 }}
                />
                <FormSelect
                  value={newHolding.assetClass}
                  onChange={v => setNewHolding(h => ({ ...h, assetClass: v }))}
                  options={ASSET_CLASSES.map(ac => ({ value: ac.id, label: ac.label }))}
                  style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <FormInput
                  type="number"
                  value={newHolding.costBasis}
                  onChange={v => setNewHolding(h => ({ ...h, costBasis: v }))}
                  placeholder="Cost basis ($)"
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12 }}
                />
                <FormInput
                  type="number"
                  value={newHolding.currentValue}
                  onChange={v => setNewHolding(h => ({ ...h, currentValue: v }))}
                  placeholder="Current value ($)"
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <FormInput
                  type="date"
                  value={newHolding.purchaseDate}
                  onChange={v => setNewHolding(h => ({ ...h, purchaseDate: v }))}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12 }}
                />
                <button
                  onClick={addHolding}
                  style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'var(--accent)', color: 'var(--bg)', fontWeight: 700, fontSize: 12 }}
                >+</button>
              </div>
            </div>

            {holdings.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-dim)', fontSize: 12 }}>
                Add your holdings to see harvesting opportunities
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {holdings.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '60px 32px' }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🌾</div>
              <div className="serif f20 mb-8" style={{ color: 'var(--text-muted)' }}>Enter Your Holdings</div>
              <div className="f13 dim lh-loose">
                Add your current investments on the left — fund name, cost basis, current value, and purchase date.
                We&apos;ll identify unrealized losses and calculate your potential tax savings from harvesting them.
              </div>
            </Card>
          ) : (
            <>
              {/* Stats Row */}
              <div className="stats-row" style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <Stat icon="📈" label="Unrealized Gains" value={fmt(analysis.totalGains)} color="var(--accent)" />
                <Stat icon="📉" label="Unrealized Losses" value={fmt(analysis.totalLosses)} color="var(--danger)" />
                <Stat icon="💰" label="Potential Tax Savings" value={fmt(analysis.totalTaxSavings)} color="var(--accent)" />
              </div>

              {/* Holdings Analysis Table */}
              <Card>
                <SectionLabel>Holdings Analysis</SectionLabel>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['Name', 'Cost Basis', 'Current Value', 'Gain/Loss', 'Period', 'Tax Savings'].map((h, i) => (
                          <th key={i} style={{ padding: '10px 12px', background: 'var(--bg)', borderBottom: '2px solid var(--border)', textAlign: i >= 1 ? 'right' : 'left', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: '.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.analyzed.map(h => (
                        <tr key={h.id}>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{h.name}</span>
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--text-muted)' }}>{fmtFull(h.costBasis)}</td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--text-muted)' }}>{fmtFull(h.currentValue)}</td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, color: h.isLoss ? 'var(--danger)' : 'var(--accent)' }}>
                            {h.isLoss ? '-' : '+'}{fmt(Math.abs(h.unrealizedGain))}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: h.holdingPeriod === 'long-term' ? 'rgba(52,211,153,.1)' : 'rgba(251,191,36,.1)', color: h.holdingPeriod === 'long-term' ? 'var(--accent)' : 'var(--warn)' }}>
                              {h.holdingPeriod === 'long-term' ? 'LT' : 'ST'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, color: h.taxSavings > 0 ? 'var(--accent)' : 'var(--text-dim)' }}>
                            {h.taxSavings > 0 ? fmt(h.taxSavings) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Harvesting Opportunities */}
              {lossPositions.length > 0 && (
                <Card style={{ marginTop: 14, borderColor: 'rgba(248,113,113,.2)' }}>
                  <SectionLabel>Harvesting Opportunities</SectionLabel>
                  {lossPositions.map(h => (
                    <div key={h.id} style={{
                      padding: '14px 16px', marginBottom: 8,
                      background: 'var(--danger-dim)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(248,113,113,.15)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
                            color: 'var(--danger)',
                            padding: '2px 8px', borderRadius: 4,
                            background: 'rgba(248,113,113,.1)',
                          }}>HARVEST</span>
                          <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{h.name}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                            -{fmt(Math.abs(h.unrealizedGain))}
                          </div>
                          <div className="f11" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                            Save {fmt(h.taxSavings)} in taxes
                          </div>
                        </div>
                      </div>
                      {h.replacement ? (
                        <div style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-dim)' }}>Swap to: </span>
                          <strong style={{ color: 'var(--accent)' }}>{h.replacement.replacement}</strong>
                          <span style={{ color: 'var(--text-muted)' }}> &mdash; {h.replacement.name}</span>
                        </div>
                      ) : (
                        <div style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                          Replace with similar (non-identical) fund in same asset class
                        </div>
                      )}
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>⚠️</span>
                        <span>You cannot buy a &apos;substantially identical&apos; security within 30 days before or after selling.</span>
                      </div>
                    </div>
                  ))}
                </Card>
              )}

              {/* Important Rules */}
              <Card style={{ marginTop: 14 }}>
                <SectionLabel>Important Rules</SectionLabel>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 2 }}>
                  {[
                    { i: '💵', t: '$3,000 Annual Deduction Limit', d: 'You can deduct up to $3,000 of net capital losses against ordinary income per year ($1,500 if married filing separately)' },
                    { i: '🚫', t: 'Wash Sale Rule', d: 'You cannot buy a substantially identical security within 30 days before or after selling at a loss, or the loss is disallowed' },
                    { i: '📅', t: 'Losses Carry Forward', d: 'Unused capital losses carry forward to future tax years indefinitely — they don&apos;t expire' },
                    { i: '⏱️', t: 'Long-Term vs Short-Term', d: `Short-term losses (held ≤1 year) offset at ordinary income rates (${taxRate + stateRate}%). Long-term losses offset at lower capital gains rates (${(15 + stateRate).toFixed(1)}%)` },
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
