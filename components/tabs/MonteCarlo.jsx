'use client';

import { useState, useMemo, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt } from '@/lib/format';
import { GRID_FRACS } from '@/lib/constants';
import { usePlan } from '@/components/PlanProvider';
import { interpretMonteCarloResult } from '@/lib/monteCarloInterpret';
import { runPlanOdds, runPlanHistory, oddsLabel, ON_TRACK_ODDS } from '@/lib/planOdds';
import { HISTORICAL_START_YEAR } from '@/lib/historicalReturns';
import MiniChart from '@/components/ui/MiniChart';

// No inputs of its own: this tab runs the same plan My Plan shows (taxes,
// healthcare, Social Security and all) through many markets, so its odds
// are the exact number on My Plan's verdict. Change numbers in My Plan.

// "What if" plans for the lever cards — small, concrete changes.
function leverPlans(plan) {
  const retireSpend = plan.retireSpending || Math.round((plan.annualSpending || 0) * 0.8);
  const workLonger = {
    ...plan,
    retireAge: plan.retireAge + 2,
    // A salary that stops at retirement keeps going for the extra years.
    incomeSources: plan.incomeSources.map(s =>
      s.type === 'salary' && (s.owner || 'primary') === 'primary' && s.endAge === plan.retireAge
        ? { ...s, endAge: s.endAge + 2 }
        : s),
  };
  return {
    saveMore: { plan: { ...plan, monthlyContribution: (plan.monthlyContribution || 0) + 200 }, label: 'Save $200 more a month', detail: `${fmt(plan.monthlyContribution || 0)} → ${fmt((plan.monthlyContribution || 0) + 200)}` },
    workLonger: { plan: workLonger, label: 'Work 2 more years', detail: `Retire at ${plan.retireAge + 2} instead of ${plan.retireAge}` },
    spendLess: { plan: { ...plan, retireSpending: Math.max(0, retireSpend - 5000) }, label: 'Spend $5K less a year in retirement', detail: `${fmt(retireSpend)} → ${fmt(Math.max(0, retireSpend - 5000))}` },
  };
}

export default function MonteCarlo() {
  const { plan } = usePlan();
  // Same call and seed as My Plan's verdict → the same percentage.
  const odds = useMemo(() => runPlanOdds(plan), [plan]);
  const history = useMemo(() => runPlanHistory(plan), [plan]);

  // Levers cost ~4 × 150ms, so they fill in just after the page paints.
  const [levers, setLevers] = useState(null);
  useEffect(() => {
    setLevers(null);
    const t = setTimeout(() => {
      const lp = leverPlans(plan);
      const rate = (p) => runPlanOdds(p).successRate;
      const combined = {
        ...lp.workLonger.plan,
        monthlyContribution: lp.saveMore.plan.monthlyContribution,
        retireSpending: lp.spendLess.plan.retireSpending,
      };
      const rows = [
        ...['saveMore', 'workLonger', 'spendLess'].map(k => ({ key: k, label: lp[k].label, detail: lp[k].detail, rate: rate(lp[k].plan) })),
        { key: 'all', label: 'All three together', rate: rate(combined) },
      ];
      setLevers(rows.map(r => ({ ...r, delta: r.rate - odds.successRate })));
    }, 50);
    return () => clearTimeout(t);
  }, [plan, odds]);

  const { ages, percentiles } = odds;
  const startAge = ages[0];
  const endAge = ages[ages.length - 1];
  const retireIdx = Math.max(0, ages.indexOf(plan.retireAge));
  const totalYears = ages.length - 1;
  const { color: successColor } = oddsLabel(odds.successRate);

  const chartW = 600;
  const chartH = 240;
  const pad = { top: 30, right: 20, bottom: 30, left: 60 };
  const w = chartW - pad.left - pad.right;
  const h = chartH - pad.top - pad.bottom;

  const chart = useMemo(() => {
    // Cap at the 75th percentile so the likely range has room to read.
    const maxVal = Math.max(1, ...percentiles.p75) * 1.1;
    const xScale = (i) => pad.left + (i / totalYears) * w;
    const yScale = (v) => pad.top + h - (Math.min(v, maxVal) / maxVal) * h;
    const makePath = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ');
    const makeBand = (upper, lower) => {
      const top = upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ');
      const bottom = [...lower].reverse().map((v, i2) => `L${xScale(lower.length - 1 - i2).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ');
      return `${top} ${bottom} Z`;
    };
    const gridLines = GRID_FRACS.map(frac => ({ y: pad.top + frac * h, label: fmt(maxVal * (1 - frac)) }));
    return { makePath, makeBand, gridLines, xScale, yScale };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- layout constants
  }, [percentiles, totalYears]);

  const interp = interpretMonteCarloResult({
    successRate: odds.successRate,
    p50: percentiles.p50,
    p10: percentiles.p10,
    totalYears,
    yearsToRetire: retireIdx,
    startAge,
    endAge,
  });
  const toneColor = interp.tone === 'good' ? 'var(--accent)' : interp.tone === 'caution' ? 'var(--warn)' : 'var(--danger)';
  const goMyPlan = () => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'myplan' }));

  return (
    <div className="fade-up">
      <InfoBox title="Monte Carlo" color="var(--purple)" bgColor="var(--purple-dim, rgba(139,92,246,0.08))">
        Your plan from My Plan, run through {odds.runs} markets: good and bad years in random order, averaging your{' '}
        {plan.expectedReturn ?? 7}% return with about {odds.stdDev.toFixed(0)}% swings a year. Taxes, healthcare and Social Security
        are all included. To change the numbers,{' '}
        <button type="button" onClick={goMyPlan} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>edit My Plan</button>.
      </InfoBox>

      <div style={{ border: `1px solid ${toneColor}`, borderRadius: 12, padding: '14px 18px', margin: '16px 0 14px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: toneColor, marginBottom: 6, fontFamily: 'var(--serif)' }}>{interp.headline}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{interp.detail}</div>
      </div>

      <div className="stats-row" style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <Stat label="Chance it lasts" value={`${Math.round(odds.successRate * 100)}%`} sub={`${odds.successes} of ${odds.runs} markets`} color={successColor} />
        <Stat label="Median at retirement" value={fmt(percentiles.p50[retireIdx])} sub={`Age ${plan.retireAge}`} color="var(--blue)" />
        <Stat label="Median at end" value={fmt(percentiles.p50[totalYears])} sub={`Age ${endAge}`} color="var(--purple, var(--accent))" />
      </div>

      <Card style={{ marginTop: 14 }}>
        <SectionLabel>Savings over time</SectionLabel>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {chart.gridLines.map((g, i) => (
            <g key={i}>
              <line x1={pad.left} y1={g.y} x2={chartW - pad.right} y2={g.y} stroke="var(--border)" strokeWidth={0.5} />
              <text x={pad.left - 8} y={g.y + 4} textAnchor="end" fill="var(--text-muted)" fontSize={9}>{g.label}</text>
            </g>
          ))}
          {[0, Math.floor(totalYears / 4), Math.floor(totalYears / 2), Math.floor(totalYears * 3 / 4), totalYears].map((yr, i) => (
            <text key={i} x={chart.xScale(yr)} y={chartH - 6} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>Age {startAge + yr}</text>
          ))}
          <line x1={chart.xScale(retireIdx)} y1={pad.top} x2={chart.xScale(retireIdx)} y2={pad.top + h} stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
          <text x={chart.xScale(retireIdx)} y={pad.top - 6} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontWeight={600}>Retire</text>
          <path d={chart.makeBand(percentiles.p90, percentiles.p10)} fill="var(--accent)" opacity={0.08} />
          <path d={chart.makeBand(percentiles.p75, percentiles.p25)} fill="var(--accent)" opacity={0.12} />
          <path d={chart.makePath(percentiles.p50)} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          <path d={chart.makePath(percentiles.p10)} fill="none" stroke="var(--danger)" strokeWidth={1} strokeDasharray="4 3" />
          <circle cx={chart.xScale(totalYears)} cy={chart.yScale(percentiles.p50[totalYears])} r={3.5} fill="var(--accent)" />
          <text x={chart.xScale(totalYears) - 6} y={chart.yScale(percentiles.p50[totalYears]) - 8} textAnchor="end" fill="var(--accent)" fontSize={10} fontWeight={600} fontFamily="var(--sans)" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmt(percentiles.p50[totalYears])}
          </text>
          <g transform={`translate(${pad.left + 8}, ${pad.top + 6})`}>
            <rect x={0} y={0} width={8} height={8} fill="var(--accent)" opacity={0.1} rx={1} />
            <text x={12} y={7} fill="var(--text-muted)" fontSize={8}>10th–90th</text>
            <rect x={70} y={0} width={8} height={8} fill="var(--accent)" opacity={0.2} rx={1} />
            <text x={82} y={7} fill="var(--text-muted)" fontSize={8}>25th–75th</text>
            <line x1={145} y1={4} x2={157} y2={4} stroke="var(--accent)" strokeWidth={2.5} />
            <text x={161} y={7} fill="var(--text-muted)" fontSize={8}>Median</text>
            <line x1={200} y1={4} x2={212} y2={4} stroke="var(--danger)" strokeWidth={1} strokeDasharray="3 2" />
            <text x={216} y={7} fill="var(--text-muted)" fontSize={8}>Bad market (1 in 10)</text>
          </g>
        </svg>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <SectionLabel>What would move your odds?</SectionLabel>
        {!levers ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Calculating…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {levers.map(lever => {
              const { color } = oddsLabel(lever.rate);
              const isAll = lever.key === 'all';
              return (
                <div key={lever.key} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg2)', border: isAll ? '1.5px solid var(--accent)' : '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isAll ? 'var(--accent)' : 'var(--text)' }}>{lever.label}</span>
                      {lever.detail && <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>{lever.detail}</span>}
                    </div>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--serif)', color }}>{Math.round(lever.rate * 100)}%</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 6 }}>
                        {lever.delta > 0 ? '+' : ''}{Math.round(lever.delta * 100)} pts
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, lever.rate * 100)}%`, background: color, borderRadius: 3, transition: 'width .3s' }} />
                  </div>
                </div>
              );
            })}
            {odds.successRate < ON_TRACK_ODDS && (() => {
              const best = [...levers].filter(l => l.key !== 'all').sort((a, b) => b.delta - a.delta)[0];
              const all = levers.find(l => l.key === 'all');
              return (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  The biggest single lever is <strong>{best.label.toLowerCase()}</strong> (+{Math.round(best.delta * 100)} pts).{' '}
                  {all.rate >= ON_TRACK_ODDS
                    ? `All three together get you to ${Math.round(all.rate * 100)}%.`
                    : `Even all three only reach ${Math.round(all.rate * 100)}% — the plan needs a bigger change. Optimize shows the dollar amounts.`}
                </div>
              );
            })()}
          </div>
        )}
      </Card>

      {history.runs > 0 && (
        <Card style={{ marginTop: 14 }}>
          <SectionLabel>Real market history since {HISTORICAL_START_YEAR}</SectionLabel>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
            Your plan replayed through every real run of years since {HISTORICAL_START_YEAR} — 1929, the 1970s, 2000 and 2008 included —
            using a {Math.round(history.stockPct * 100)}/{Math.round((1 - history.stockPct) * 100)} stock/bond mix. Each year keeps its
            real ups and downs and their order, centered on your {plan.expectedReturn ?? 7}% return, so this tests bad timing rather than a
            different average. (Sources: Damodaran/NYU Stern.)
          </div>
          <div className="stats-row" style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <Stat label="Histories that last" value={`${Math.round(history.successRate * 100)}%`}
              sub={`${history.successes} of ${history.runs} start years`} color={oddsLabel(history.successRate).color} />
          </div>
          {history.failures.length > 0 && (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--danger)' }}>Start years that run short:</strong>{' '}
              {history.failures.map(f => `${f.startYear} (at ${f.shortAge})`).join(', ')}.
            </div>
          )}
          <MiniChart
            height={220}
            data={history.percentiles.p50.map((_, i) => ({ i, p10: history.percentiles.p10[i], p50: history.percentiles.p50[i], p90: history.percentiles.p90[i] }))}
            lines={[
              { key: 'p90', color: 'var(--blue)', label: 'Best decile', width: 1.5 },
              { key: 'p50', color: 'var(--accent)', label: 'Median history', width: 2.5 },
              { key: 'p10', color: 'var(--danger)', label: 'Worst decile', width: 1.5 },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
