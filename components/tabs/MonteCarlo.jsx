'use client';

import { useState, useMemo, useEffect } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt } from '@/lib/format';
import ValidationWarning from '@/components/ui/ValidationWarning';
import { GRID_FRACS } from '@/lib/constants';
import { usePlan, getTotalSavings } from '@/components/PlanProvider';

// ── Portfolio-aware return/volatility profiles ──────────────────────────
// Based on historical data: Ibbotson SBBI, Vanguard research, DFA returns matrix
const PORTFOLIO_PROFILES = [
  { id: 'aggressive',    label: '90/10 Aggressive',    desc: '90% stocks, 10% bonds',    avgReturn: 0.094, stdDev: 0.155, color: 'var(--danger)' },
  { id: 'growth',        label: '80/20 Growth',        desc: '80% stocks, 20% bonds',    avgReturn: 0.088, stdDev: 0.138, color: 'var(--warn)' },
  { id: 'moderate',      label: '70/30 Moderate',      desc: '70% stocks, 30% bonds',    avgReturn: 0.082, stdDev: 0.120, color: 'var(--accent)' },
  { id: 'balanced',      label: '60/40 Balanced',      desc: '60% stocks, 40% bonds',    avgReturn: 0.076, stdDev: 0.103, color: 'var(--blue)' },
  { id: 'conservative',  label: '40/60 Conservative',  desc: '40% stocks, 60% bonds',    avgReturn: 0.063, stdDev: 0.078, color: '#818cf8' },
  { id: 'very_conservative', label: '20/80 Very Conservative', desc: '20% stocks, 80% bonds', avgReturn: 0.050, stdDev: 0.055, color: 'var(--text-muted)' },
  { id: 'custom',        label: 'Custom',              desc: 'Set your own return & vol', avgReturn: 0.07, stdDev: 0.15, color: 'var(--text-dim)' },
];

// ── Core simulation engine ──────────────────────────────────────────────
function runSimulation({ savings, monthly, salaryGrowth, annualSpend, inflationPct, age, retireAge, endAge, avgReturn, stdDev, runs }) {
  const years = retireAge - age;
  const retirementYears = endAge - retireAge;
  const totalYears = years + retirementYears;
  const paths = [];
  let successes = 0;
  const percentiles = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  const salGrowthRate = salaryGrowth / 100;

  for (let i = 0; i < runs; i++) {
    let bal = savings;
    const path = [bal];
    let failed = false;
    for (let y = 1; y <= totalYears; y++) {
      const u1 = Math.max(1e-10, Math.random()), u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const r = avgReturn + stdDev * z;
      if (y <= years) {
        const yearlyContrib = monthly * 12 * Math.pow(1 + salGrowthRate, y - 1);
        bal = bal * (1 + r) + yearlyContrib;
      } else {
        bal = bal * (1 + r) - annualSpend * Math.pow(1 + inflationPct / 100, y - years - 1);
      }
      if (bal < 0) { bal = 0; failed = true; }
      path.push(bal);
    }
    paths.push(path);
    if (!failed && bal > 0) successes++;
  }

  for (let y = 0; y <= totalYears; y++) {
    const vals = paths.map(p => p[y]).sort((a, b) => a - b);
    percentiles.p10.push(vals[Math.floor(runs * 0.1)]);
    percentiles.p25.push(vals[Math.floor(runs * 0.25)]);
    percentiles.p50.push(vals[Math.floor(runs * 0.5)]);
    percentiles.p75.push(vals[Math.floor(runs * 0.75)]);
    percentiles.p90.push(vals[Math.floor(runs * 0.9)]);
  }

  return { percentiles, successRate: successes / runs, totalYears, years, retirementYears };
}

export default function MonteCarlo() {
  const { plan } = usePlan();
  const [age, setAge] = useState(() => plan.currentAge || 35);
  const [retireAge, setRetireAge] = useState(() => plan.retireAge || 65);
  const [savings, setSavings] = useState(() => getTotalSavings(plan) || 100000);
  const [monthly, setMonthly] = useState(() => plan.monthlyContribution || 800);
  const [annualSpend, setAnnualSpend] = useState(() => plan.annualSpending || 50000);
  const [endAge, setEndAge] = useState(() => plan.longevityAge || 95);
  const [inflationPct, setInflationPct] = useState(2.5);
  const [salaryGrowth, setSalaryGrowth] = useState(3);
  const [runs, setRuns] = useState(1000);
  const [portfolioProfile, setPortfolioProfile] = useState('moderate');
  const [customReturn, setCustomReturn] = useState(7);
  const [customVol, setCustomVol] = useState(15);
  const [simData, setSimData] = useState(null);
  const [running, setRunning] = useState(false);
  const [sensitivity, setSensitivity] = useState(null);

  // Auto-populate from Growth Projector if navigated via bridge button
  useEffect(() => {
    try {
      const stored = localStorage.getItem('growthToMonteCarlo');
      if (stored) {
        const d = JSON.parse(stored);
        if (d.age) setAge(d.age);
        if (d.retireAge) setRetireAge(d.retireAge);
        if (d.savings) setSavings(d.savings);
        if (d.monthly) setMonthly(Math.round(d.monthly));
        if (d.salaryGrowth !== undefined) setSalaryGrowth(d.salaryGrowth);
        if (d.annualSpend) setAnnualSpend(d.annualSpend);
        localStorage.removeItem('growthToMonteCarlo'); // consume once
      }
    } catch {}
  }, []);

  const activeProfile = PORTFOLIO_PROFILES.find(p => p.id === portfolioProfile);
  const avgReturn = portfolioProfile === 'custom' ? customReturn / 100 : activeProfile.avgReturn;
  const stdDev = portfolioProfile === 'custom' ? customVol / 100 : activeProfile.stdDev;

  const simParams = { savings, monthly, salaryGrowth, annualSpend, inflationPct, age, retireAge, endAge, avgReturn, stdDev, runs };

  function runSim() {
    setRunning(true);
    setTimeout(() => {
      // Main simulation
      const result = runSimulation(simParams);
      setSimData(result);

      // Sensitivity analysis: 3 levers
      const lever1 = runSimulation({ ...simParams, monthly: monthly + 200 });
      const lever2 = runSimulation({ ...simParams, retireAge: retireAge + 2, endAge: endAge });
      const lever3 = runSimulation({ ...simParams, annualSpend: annualSpend - 5000 });

      // Combined: all three levers at once
      const leverAll = runSimulation({
        ...simParams,
        monthly: monthly + 200,
        retireAge: retireAge + 2,
        annualSpend: annualSpend - 5000,
      });

      setSensitivity({
        current: result.successRate,
        saveMore: { rate: lever1.successRate, delta: lever1.successRate - result.successRate, label: `Save $200 more/mo`, detail: `${fmt(monthly)}/mo → ${fmt(monthly + 200)}/mo` },
        workLonger: { rate: lever2.successRate, delta: lever2.successRate - result.successRate, label: `Work 2 more years`, detail: `Retire at ${retireAge + 2} instead of ${retireAge}` },
        spendLess: { rate: lever3.successRate, delta: lever3.successRate - result.successRate, label: `Spend $5K less/yr`, detail: `${fmt(annualSpend)}/yr → ${fmt(annualSpend - 5000)}/yr` },
        combined: { rate: leverAll.successRate, delta: leverAll.successRate - result.successRate, label: `All three combined` },
      });

      setRunning(false);
    }, 50);
  }

  const successColor = simData
    ? simData.successRate >= 0.9 ? 'var(--accent)' : simData.successRate >= 0.75 ? 'var(--warn)' : 'var(--danger)'
    : 'var(--accent)';

  const chartW = 600;
  const chartH = 240;
  const pad = { top: 30, right: 20, bottom: 30, left: 60 };
  const w = chartW - pad.left - pad.right;
  const h = chartH - pad.top - pad.bottom;

  const chartElements = useMemo(() => {
    if (!simData) return null;
    const { percentiles, totalYears, years } = simData;
    // Cap at 75th percentile for better detail visibility
    const maxVal = Math.max(...percentiles.p75) * 1.1;
    const xScale = (i) => pad.left + (i / totalYears) * w;
    const yScale = (v) => pad.top + h - (Math.min(v, maxVal) / maxVal) * h;

    const makePath = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ');
    const makeBand = (upper, lower) => {
      const top = upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ');
      const bottom = [...lower].reverse().map((v, i2) => {
        const i = lower.length - 1 - i2;
        return `L${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`;
      }).join(' ');
      return top + ' ' + bottom + ' Z';
    };

    const gridLines = GRID_FRACS.map(frac => {
      const val = maxVal * (1 - frac);
      const y = pad.top + frac * h;
      return { y, label: fmt(val) };
    });

    return { makePath, makeBand, gridLines, retireX: xScale(years), xScale, yScale, maxVal, percentiles, totalYears, years };
  }, [simData, w, h]);

  const warnings = useMemo(() => {
    const w = [];
    if (savings === 0 && monthly === 0) w.push('Both savings and contributions are $0 — simulation will show 0% success.');
    if (annualSpend === 0) w.push('Annual spending is $0 — all simulations will succeed (unrealistic).');
    if (endAge - retireAge < 10) w.push('Short retirement period — consider planning to at least age 90.');
    if (retireAge - age < 5) w.push('Very short accumulation period — limited time to build savings.');
    return w;
  }, [savings, monthly, annualSpend, endAge, retireAge, age]);

  return (
    <div className="fade-up">
      <InfoBox icon="🎲" title="Monte Carlo Simulation" color="var(--purple)" bgColor="var(--purple-dim, rgba(139,92,246,0.08))">
        Runs thousands of random market scenarios to estimate the probability your savings last through retirement.
        Each simulation uses randomized returns matching your portfolio risk profile — not a single fixed number.
      </InfoBox>

      <ValidationWarning warnings={warnings} />

      {/* Portfolio Risk Profile Selector */}
      <Card style={{ marginTop: 16, marginBottom: 20 }}>
        <SectionLabel icon="📊">Portfolio Risk Profile</SectionLabel>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
          Select a profile matching your Portfolio Builder allocation. Each profile uses historically accurate return and volatility assumptions.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 8 }}>
          {PORTFOLIO_PROFILES.map(p => (
            <button key={p.id} onClick={() => setPortfolioProfile(p.id)} style={{
              padding: '10px 12px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
              border: portfolioProfile === p.id ? `2px solid ${p.color}` : '1px solid var(--border)',
              background: portfolioProfile === p.id ? 'rgba(45,212,191,0.06)' : 'var(--card)',
              transition: 'all .2s',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: p.color, fontFamily: 'var(--sans)' }}>{p.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{p.desc}</div>
              {p.id !== 'custom' && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  Return: {(p.avgReturn * 100).toFixed(1)}% · Vol: {(p.stdDev * 100).toFixed(1)}%
                </div>
              )}
            </button>
          ))}
        </div>
        {portfolioProfile === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            <Slider label="Expected Return" value={customReturn} onChange={setCustomReturn} min={2} max={12} step={0.5} suffix="%" />
            <Slider label="Volatility (Std Dev)" value={customVol} onChange={setCustomVol} min={3} max={25} step={0.5} suffix="%" />
          </div>
        )}
        {portfolioProfile !== 'custom' && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'var(--bg2)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 20 }}>
            <span>Using: <strong style={{ color: activeProfile.color }}>{(avgReturn * 100).toFixed(1)}%</strong> avg return</span>
            <span>Volatility: <strong style={{ color: activeProfile.color }}>{(stdDev * 100).toFixed(1)}%</strong> std dev</span>
            <span>Worst year (2σ): <strong style={{ color: 'var(--danger)' }}>{((avgReturn - 2 * stdDev) * 100).toFixed(0)}%</strong></span>
          </div>
        )}
      </Card>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 32 }}>
        <div>
          <Card>
            <SectionLabel>Simulation Parameters</SectionLabel>
            <Slider label="Current Age" value={age} onChange={v => { setAge(v); if (retireAge <= v + 5) setRetireAge(v + 5); }} min={18} max={60} suffix=" yrs" />
            <Slider label="Retirement Age" value={retireAge} onChange={v => { setRetireAge(v); if (endAge <= v + 5) setEndAge(v + 5); }} min={Math.max(age + 5, 50)} max={80} suffix=" yrs" />
            <Slider label="Plan Until Age" value={endAge} onChange={setEndAge} min={Math.max(retireAge + 5, 75)} max={100} suffix=" yrs" />
            <Slider label="Current Savings" value={savings} onChange={setSavings} min={0} max={2000000} step={5000} format={fmt} />
            <Slider label="Monthly Contribution" value={monthly} onChange={setMonthly} min={0} max={10000} step={50} format={fmt} />
            <Slider label="Salary Growth" value={salaryGrowth} onChange={setSalaryGrowth} min={0} max={6} step={0.5} suffix="%/yr" />
            <Slider label="Annual Spending in Retirement" value={annualSpend} onChange={setAnnualSpend} min={20000} max={200000} step={1000} format={fmt} />
            <Slider label="Inflation" value={inflationPct} onChange={setInflationPct} min={1} max={5} step={0.5} suffix="%" />
            <Slider label="Simulations" value={runs} onChange={setRuns} min={100} max={5000} step={100} />
            <button
              onClick={runSim}
              disabled={running}
              style={{
                width: '100%', padding: '14px 24px',
                background: running ? 'var(--border)' : 'var(--accent)',
                color: running ? 'var(--text-muted)' : 'var(--bg)',
                border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
                cursor: running ? 'not-allowed' : 'pointer', marginTop: 8, transition: 'all .2s',
              }}
            >
              {running ? 'Running simulation...' : `Run ${runs.toLocaleString()} Simulations`}
            </button>
          </Card>
        </div>

        <div>
          {!simData ? (
            <Card style={{ textAlign: 'center', padding: '60px 32px' }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🎲</div>
              <div style={{ fontSize: 20, fontFamily: 'var(--serif)', color: 'var(--text-muted)', marginBottom: 8 }}>Ready to Simulate</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                Select your portfolio risk profile above, adjust parameters, and click Run.
              </div>
            </Card>
          ) : (
            <div>
              {/* Stats */}
              <div className="stats-row" style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <Stat icon="🎯" label="Success Rate" value={`${(simData.successRate * 100).toFixed(1)}%`}
                  sub={`${Math.round(simData.successRate * runs)} of ${runs}`} color={successColor} />
                <Stat icon="💰" label="Median at Retirement" value={fmt(simData.percentiles.p50[simData.years])}
                  sub={`After ${simData.years} years`} color="var(--blue)" />
                <Stat icon="🏁" label="Median at End" value={fmt(simData.percentiles.p50[simData.totalYears])}
                  sub={`Age ${endAge}`} color="var(--purple, var(--accent))" />
              </div>

              {/* Chart */}
              <Card style={{ marginTop: 14 }}>
                <SectionLabel>Portfolio Value Over Time</SectionLabel>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
                  Using {activeProfile?.label || 'Custom'} profile: {(avgReturn * 100).toFixed(1)}% return, {(stdDev * 100).toFixed(1)}% volatility
                </div>
                <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                  {chartElements && (
                    <>
                      {chartElements.gridLines.map((g, i) => (
                        <g key={i}>
                          <line x1={pad.left} y1={g.y} x2={chartW - pad.right} y2={g.y} stroke="var(--border)" strokeWidth={0.5} />
                          <text x={pad.left - 8} y={g.y + 4} textAnchor="end" fill="var(--text-muted)" fontSize={9}>{g.label}</text>
                        </g>
                      ))}
                      {[0, Math.floor(simData.totalYears / 4), Math.floor(simData.totalYears / 2), Math.floor(simData.totalYears * 3 / 4), simData.totalYears].map((yr, i) => (
                        <text key={i} x={chartElements.xScale(yr)} y={chartH - 6} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>
                          Age {age + yr}
                        </text>
                      ))}
                      <line x1={chartElements.retireX} y1={pad.top} x2={chartElements.retireX} y2={pad.top + h}
                        stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
                      <text x={chartElements.retireX} y={pad.top - 6} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontWeight={600}>Retire</text>

                      <path d={chartElements.makeBand(chartElements.percentiles.p90, chartElements.percentiles.p10)} fill="var(--accent)" opacity={0.08} />
                      <path d={chartElements.makeBand(chartElements.percentiles.p75, chartElements.percentiles.p25)} fill="var(--accent)" opacity={0.12} />
                      <path d={chartElements.makePath(chartElements.percentiles.p50)} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
                      <path d={chartElements.makePath(chartElements.percentiles.p10)} fill="none" stroke="var(--danger)" strokeWidth={1} strokeDasharray="4 3" />

                      <g transform={`translate(${pad.left + 8}, ${pad.top + 6})`}>
                        <rect x={0} y={0} width={8} height={8} fill="var(--accent)" opacity={0.1} rx={1} />
                        <text x={12} y={7} fill="var(--text-muted)" fontSize={8}>10th-90th</text>
                        <rect x={70} y={0} width={8} height={8} fill="var(--accent)" opacity={0.2} rx={1} />
                        <text x={82} y={7} fill="var(--text-muted)" fontSize={8}>25th-75th</text>
                        <line x1={145} y1={4} x2={157} y2={4} stroke="var(--accent)" strokeWidth={2.5} />
                        <text x={161} y={7} fill="var(--text-muted)" fontSize={8}>Median</text>
                        <line x1={200} y1={4} x2={212} y2={4} stroke="var(--danger)" strokeWidth={1} strokeDasharray="3 2" />
                        <text x={216} y={7} fill="var(--text-muted)" fontSize={8}>10th pctl</text>
                      </g>
                    </>
                  )}
                </svg>
              </Card>

              {/* ── SENSITIVITY ANALYSIS: What Levers Can You Pull? ── */}
              {sensitivity && (
                <Card style={{ marginTop: 14 }}>
                  <SectionLabel icon="🎛️">What Levers Can You Pull?</SectionLabel>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.5 }}>
                    Your current success rate is <strong style={{ color: successColor }}>{(sensitivity.current * 100).toFixed(1)}%</strong>.
                    Here is how each change would impact your odds:
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[sensitivity.saveMore, sensitivity.workLonger, sensitivity.spendLess, sensitivity.combined].map((lever, i) => {
                      const newRate = lever.rate;
                      const deltaColor = lever.delta > 0.05 ? 'var(--accent)' : lever.delta > 0.02 ? 'var(--blue)' : 'var(--text-muted)';
                      const barWidth = Math.min(100, newRate * 100);
                      const barColor = newRate >= 0.9 ? 'var(--accent)' : newRate >= 0.75 ? 'var(--warn)' : 'var(--danger)';
                      const isCombined = i === 3;

                      return (
                        <div key={i} style={{
                          padding: '12px 14px', borderRadius: 8,
                          background: isCombined ? 'rgba(52,211,153,0.06)' : 'var(--bg2)',
                          border: isCombined ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: isCombined ? 'var(--accent)' : 'var(--text)' }}>
                                {isCombined ? '🚀 ' : ''}{lever.label}
                              </span>
                              {lever.detail && <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>{lever.detail}</span>}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--serif)', color: barColor }}>
                                {(newRate * 100).toFixed(1)}%
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: deltaColor, marginLeft: 6 }}>
                                {lever.delta > 0 ? '+' : ''}{(lever.delta * 100).toFixed(1)}pp
                              </span>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${barWidth}%`, background: barColor, borderRadius: 3, transition: 'width .3s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {sensitivity.current < 0.9 && (
                    <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--warn)' }}>Recommendation:</strong>{' '}
                      {(() => {
                        const levers = [
                          { ...sensitivity.saveMore, name: 'saving more' },
                          { ...sensitivity.workLonger, name: 'working longer' },
                          { ...sensitivity.spendLess, name: 'reducing spending' },
                        ].sort((a, b) => b.delta - a.delta);
                        const best = levers[0];
                        return `The most impactful lever is ${best.name} (+${(best.delta * 100).toFixed(1)}pp). ${
                          sensitivity.combined.rate >= 0.9
                            ? `Combining all three gets you to ${(sensitivity.combined.rate * 100).toFixed(0)}% — well within the safe zone.`
                            : `Even combining all three reaches ${(sensitivity.combined.rate * 100).toFixed(0)}% — consider larger adjustments.`
                        }`;
                      })()}
                    </div>
                  )}

                  {sensitivity.current >= 0.9 && (
                    <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', fontSize: 12, color: 'var(--accent)', lineHeight: 1.6 }}>
                      <strong>You are on track.</strong> Your success rate of {(sensitivity.current * 100).toFixed(0)}% means your plan survives the vast majority of market scenarios. The levers above show your margin of safety.
                    </div>
                  )}
                </Card>
              )}

              {/* How to read */}
              <Card style={{ marginTop: 14 }}>
                <SectionLabel>How to Read This</SectionLabel>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  <p style={{ marginBottom: 8 }}>
                    The chart shows outcomes from {runs.toLocaleString()} simulated market scenarios using your <strong style={{ color: activeProfile?.color }}>{activeProfile?.label}</strong> portfolio profile.
                    The <strong style={{ color: 'var(--accent)' }}>solid line</strong> is the median — half did better, half did worse.
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    The <strong>darker band</strong> covers the 25th-75th percentile (likely range), the <strong>lighter band</strong> is the 10th-90th percentile (wide range).
                    The <strong style={{ color: 'var(--danger)' }}>dashed red line</strong> shows the 10th percentile — a &quot;bad luck&quot; scenario.
                  </p>
                  <p>
                    A success rate above <strong style={{ color: 'var(--accent)' }}>90%</strong> is strong. Between <strong style={{ color: 'var(--warn)' }}>75-90%</strong> is workable with flexibility. Below <strong style={{ color: 'var(--danger)' }}>75%</strong> needs attention — use the levers above.
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
