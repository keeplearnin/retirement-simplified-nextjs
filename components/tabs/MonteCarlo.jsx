'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt } from '@/lib/format';
import { GRID_FRACS } from '@/lib/constants';

const avgReturn = 0.07;
const stdDev = 0.15;
const inflationRate = 0.025;

export default function MonteCarlo() {
  const [age, setAge] = useState(35);
  const [retireAge, setRetireAge] = useState(65);
  const [savings, setSavings] = useState(100000);
  const [monthly, setMonthly] = useState(800);
  const [annualSpend, setAnnualSpend] = useState(50000);
  const [runs, setRuns] = useState(1000);
  const [simData, setSimData] = useState(null);
  const [running, setRunning] = useState(false);

  function runSim() {
    setRunning(true);
    setTimeout(() => {
      const years = retireAge - age;
      const retirementYears = 30;
      const totalYears = years + retirementYears;
      const paths = [];
      let successes = 0;
      const percentiles = { p10: [], p25: [], p50: [], p75: [], p90: [] };
      for (let i = 0; i < runs; i++) {
        let bal = savings;
        const path = [bal];
        let failed = false;
        for (let y = 1; y <= totalYears; y++) {
          const u1 = Math.random(), u2 = Math.random();
          const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          const r = avgReturn + stdDev * z;
          if (y <= years) {
            bal = bal * (1 + r) + monthly * 12;
          } else {
            bal = bal * (1 + r) - annualSpend * Math.pow(1 + inflationRate, y - years);
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
      setSimData({ percentiles, successRate: successes / runs, totalYears, years, retirementYears });
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
    const maxVal = Math.max(...percentiles.p90);
    const xScale = (i) => pad.left + (i / totalYears) * w;
    const yScale = (v) => pad.top + h - (v / maxVal) * h;

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

    const retireX = xScale(years);

    return { makePath, makeBand, gridLines, retireX, xScale, yScale, maxVal, percentiles, totalYears, years };
  }, [simData, w, h]);

  return (
    <div className="fade-up">
      <InfoBox icon="🎲" title="Monte Carlo Simulation" color="var(--purple)" bgColor="var(--purple-dim, rgba(139,92,246,0.08))">
        Monte Carlo simulations run thousands of random market scenarios to estimate the probability your savings will last through retirement.
        Instead of assuming a fixed return, each simulation uses randomized annual returns based on historical market behavior (7% average, 15% standard deviation).
        This gives you a realistic range of outcomes rather than a single optimistic number.
      </InfoBox>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 32, marginTop: 20 }}>
        <div>
          <Card>
            <SectionLabel>Simulation Parameters</SectionLabel>
            <Slider label="Current Age" value={age} onChange={v => { setAge(v); if (retireAge <= v + 5) setRetireAge(v + 5); }} min={18} max={60} suffix=" yrs" />
            <Slider label="Retirement Age" value={retireAge} onChange={setRetireAge} min={Math.max(age + 5, 50)} max={80} suffix=" yrs" />
            <Slider label="Current Savings" value={savings} onChange={setSavings} min={0} max={2000000} step={5000} format={fmt} />
            <Slider label="Monthly Contribution" value={monthly} onChange={setMonthly} min={0} max={10000} step={50} format={fmt} tooltip="How much you invest each month before retirement" />
            <Slider label="Annual Spending in Retirement" value={annualSpend} onChange={setAnnualSpend} min={20000} max={200000} step={1000} format={fmt} tooltip="Yearly spending adjusted for inflation each year" />
            <Slider label="Simulations" value={runs} onChange={setRuns} min={100} max={5000} step={100} tooltip="More runs = smoother results but slower" />
            <button
              onClick={runSim}
              disabled={running}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: running ? 'var(--border)' : 'var(--accent)',
                color: running ? 'var(--text-muted)' : '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: running ? 'not-allowed' : 'pointer',
                marginTop: 8,
                transition: 'all .2s',
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
              <div className="serif f20 mb-8" style={{ color: 'var(--text-muted)' }}>Ready to Simulate</div>
              <div className="f13 dim lh-loose">
                Adjust the parameters on the left and click the button to run
                a Monte Carlo simulation of your retirement portfolio. You&apos;ll see
                how likely your savings are to last through 30 years of retirement.
              </div>
            </Card>
          ) : (
            <div>
              <div className="stats-row" style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <Stat
                  icon="🎯"
                  label="Success Rate"
                  value={`${(simData.successRate * 100).toFixed(1)}%`}
                  sub={`${Math.round(simData.successRate * runs)} of ${runs} simulations`}
                  color={successColor}
                />
                <Stat
                  icon="💰"
                  label="Median at Retirement"
                  value={fmt(simData.percentiles.p50[simData.years])}
                  sub={`After ${simData.years} years of saving`}
                  color="var(--blue)"
                />
                <Stat
                  icon="🏁"
                  label="Median at End"
                  value={fmt(simData.percentiles.p50[simData.totalYears])}
                  sub={`After ${simData.retirementYears} yrs of retirement`}
                  color="var(--purple, var(--accent))"
                />
              </div>

              <Card style={{ marginTop: 14 }}>
                <SectionLabel>Portfolio Value Over Time</SectionLabel>
                <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                  {chartElements && (
                    <>
                      {/* Grid lines */}
                      {chartElements.gridLines.map((g, i) => (
                        <g key={i}>
                          <line x1={pad.left} y1={g.y} x2={chartW - pad.right} y2={g.y} stroke="var(--border)" strokeWidth={0.5} />
                          <text x={pad.left - 8} y={g.y + 4} textAnchor="end" fill="var(--text-muted)" fontSize={9}>{g.label}</text>
                        </g>
                      ))}

                      {/* X-axis labels */}
                      {[0, Math.floor(simData.totalYears / 4), Math.floor(simData.totalYears / 2), Math.floor(simData.totalYears * 3 / 4), simData.totalYears].map((yr, i) => (
                        <text key={i} x={chartElements.xScale(yr)} y={chartH - 6} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>
                          Age {age + yr}
                        </text>
                      ))}

                      {/* Retire line */}
                      <line
                        x1={chartElements.retireX} y1={pad.top}
                        x2={chartElements.retireX} y2={pad.top + h}
                        stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="4 3" opacity={0.5}
                      />
                      <text x={chartElements.retireX} y={pad.top - 6} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontWeight={600}>
                        Retire
                      </text>

                      {/* 10-90 band */}
                      <path
                        d={chartElements.makeBand(chartElements.percentiles.p90, chartElements.percentiles.p10)}
                        fill="var(--accent)" opacity={0.08}
                      />

                      {/* 25-75 band */}
                      <path
                        d={chartElements.makeBand(chartElements.percentiles.p75, chartElements.percentiles.p25)}
                        fill="var(--accent)" opacity={0.12}
                      />

                      {/* Median line */}
                      <path
                        d={chartElements.makePath(chartElements.percentiles.p50)}
                        fill="none" stroke="var(--accent)" strokeWidth={2.5}
                      />

                      {/* 10th percentile dashed */}
                      <path
                        d={chartElements.makePath(chartElements.percentiles.p10)}
                        fill="none" stroke="var(--danger)" strokeWidth={1} strokeDasharray="4 3"
                      />

                      {/* Legend */}
                      <g transform={`translate(${pad.left + 8}, ${pad.top + 6})`}>
                        <rect x={0} y={0} width={8} height={8} fill="var(--accent)" opacity={0.1} rx={1} />
                        <text x={12} y={7} fill="var(--text-muted)" fontSize={8}>10th–90th</text>

                        <rect x={70} y={0} width={8} height={8} fill="var(--accent)" opacity={0.2} rx={1} />
                        <text x={82} y={7} fill="var(--text-muted)" fontSize={8}>25th–75th</text>

                        <line x1={145} y1={4} x2={157} y2={4} stroke="var(--accent)" strokeWidth={2.5} />
                        <text x={161} y={7} fill="var(--text-muted)" fontSize={8}>Median</text>

                        <line x1={200} y1={4} x2={212} y2={4} stroke="var(--danger)" strokeWidth={1} strokeDasharray="3 2" />
                        <text x={216} y={7} fill="var(--text-muted)" fontSize={8}>10th pctl</text>
                      </g>
                    </>
                  )}
                </svg>
              </Card>

              <Card style={{ marginTop: 14 }}>
                <SectionLabel>How to Read This</SectionLabel>
                <div className="f13 dim lh-loose">
                  <p style={{ marginBottom: 8 }}>
                    The chart shows the range of possible outcomes from {runs.toLocaleString()} simulated market scenarios.
                    The <strong style={{ color: 'var(--accent)' }}>solid line</strong> is the median (50th percentile) — half of simulations did better, half did worse.
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    The <strong>darker band</strong> covers the 25th to 75th percentile, and the <strong>lighter band</strong> covers the 10th to 90th percentile.
                    The <strong style={{ color: 'var(--danger)' }}>dashed red line</strong> shows the 10th percentile — a &quot;bad luck&quot; scenario.
                  </p>
                  <p>
                    A success rate above 90% is generally considered strong. If yours is below 75%, consider increasing savings, delaying retirement, or reducing planned spending.
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
