'use client';

import { useMemo } from 'react';
import { fmt } from '@/lib/format';
import { DEFAULT_RETURN } from '@/lib/constants';
import { GOAL_TYPES, CURRENT_YEAR, fvMonthly } from './goalHelpers';

export default function GoalChart({ goals, metricsMap, currentAge, totalSavings }) {
  const W = 600, H = 300, L = 60, R = W - 20, T = 250, B = 30;

  const allTargetYears = goals.map(g => metricsMap[g.id]?.targetYear || CURRENT_YEAR);
  const maxYear = Math.max(CURRENT_YEAR + 5, ...allTargetYears) + 2;
  const totalYears = maxYear - CURRENT_YEAR;

  // Build trajectories for each goal
  const trajectories = useMemo(() => {
    return goals.map(goal => {
      const m = metricsMap[goal.id];
      if (!m) return { goal, points: [] };
      const pts = [];
      for (let y = 0; y <= totalYears; y++) {
        const val = fvMonthly(m.currentFunding, m.monthlyNeeded, DEFAULT_RETURN, Math.min(y, m.yearsOut));
        pts.push({ year: CURRENT_YEAR + y, value: y <= m.yearsOut ? val : m.futureNeed });
      }
      return { goal, points: pts };
    });
  }, [goals, metricsMap, totalYears]);

  // Aggregate savings curve
  const aggregatePoints = useMemo(() => {
    const pts = [];
    const totalMonthly = goals.reduce((s, g) => s + (metricsMap[g.id]?.monthlyNeeded || 0), 0);
    for (let y = 0; y <= totalYears; y++) {
      const val = fvMonthly(totalSavings, totalMonthly, DEFAULT_RETURN, y);
      pts.push({ year: CURRENT_YEAR + y, value: val });
    }
    return pts;
  }, [goals, metricsMap, totalSavings, totalYears]);

  const yMax = Math.max(
    1000,
    ...aggregatePoints.map(p => p.value),
    ...trajectories.flatMap(t => t.points.map(p => p.value))
  ) * 1.1;

  const xScale = (year) => L + ((year - CURRENT_YEAR) / totalYears) * (R - L);
  const yScale = (val) => H - B - (val / yMax) * T;

  // Grid lines
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => f * yMax);
  const xTicks = [];
  const xStep = totalYears <= 10 ? 1 : totalYears <= 20 ? 2 : 5;
  for (let y = CURRENT_YEAR; y <= maxYear; y += xStep) xTicks.push(y);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <g key={`yg-${i}`}>
          <line x1={L} y1={yScale(v)} x2={R} y2={yScale(v)} stroke="var(--border)" strokeWidth=".5" />
          <text x={L - 6} y={yScale(v) + 4} fill="var(--text-dim)" fontSize="9" textAnchor="end" fontFamily="var(--sans)">{fmt(v)}</text>
        </g>
      ))}
      {xTicks.map((yr, i) => (
        <g key={`xg-${i}`}>
          <line x1={xScale(yr)} y1={H - B} x2={xScale(yr)} y2={H - B + 5} stroke="var(--border)" strokeWidth=".5" />
          <text x={xScale(yr)} y={H - B + 16} fill="var(--text-dim)" fontSize="9" textAnchor="middle" fontFamily="var(--sans)">{yr}</text>
        </g>
      ))}
      {/* X axis line */}
      <line x1={L} y1={H - B} x2={R} y2={H - B} stroke="var(--border)" strokeWidth="1" />

      {/* Area fills for each goal trajectory */}
      {trajectories.map(({ goal, points }, ti) => {
        if (points.length < 2) return null;
        const color = GOAL_TYPES[goal.type].color;
        const areaPath = points.map((p, i) =>
          `${i === 0 ? 'M' : 'L'}${xScale(p.year)},${yScale(p.value)}`
        ).join(' ') + ` L${xScale(points[points.length - 1].year)},${yScale(0)} L${xScale(points[0].year)},${yScale(0)} Z`;
        const linePath = points.map((p, i) =>
          `${i === 0 ? 'M' : 'L'}${xScale(p.year)},${yScale(p.value)}`
        ).join(' ');
        return (
          <g key={`traj-${ti}`}>
            <path d={areaPath} fill={color} opacity="0.08" />
            <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="6 3" />
          </g>
        );
      })}

      {/* Aggregate savings line (solid, prominent) */}
      {aggregatePoints.length > 1 && (
        <path
          d={aggregatePoints.map((p, i) =>
            `${i === 0 ? 'M' : 'L'}${xScale(p.year)},${yScale(p.value)}`
          ).join(' ')}
          fill="none" stroke="var(--text)" strokeWidth="2.5"
        />
      )}

      {/* Goal milestone markers */}
      {goals.map((goal, gi) => {
        const m = metricsMap[goal.id];
        if (!m) return null;
        const x = xScale(m.targetYear);
        const color = GOAL_TYPES[goal.type].color;
        return (
          <g key={`marker-${gi}`}>
            <line x1={x} y1={H - B} x2={x} y2={yScale(yMax * 0.95)} stroke={color} strokeWidth="1" strokeDasharray="4 3" />
            <circle cx={x} cy={yScale(m.futureNeed)} r={5} fill={color} stroke="var(--bg)" strokeWidth="2" />
            <text x={x} y={yScale(yMax * 0.95) - 6} fill={color} fontSize="10" textAnchor="middle" fontFamily="var(--sans)" fontWeight="600">
              {GOAL_TYPES[goal.type].icon} {m.targetYear}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {goals.map((goal, gi) => {
        const color = GOAL_TYPES[goal.type].color;
        const lx = L + gi * 130;
        return (
          <g key={`leg-${gi}`}>
            <line x1={lx} y1={10} x2={lx + 14} y2={10} stroke={color} strokeWidth="2" strokeDasharray="4 2" />
            <text x={lx + 18} y={13} fill="var(--text-muted)" fontSize="9" fontFamily="var(--sans)">{GOAL_TYPES[goal.type].label}</text>
          </g>
        );
      })}
      {goals.length > 0 && (
        <g>
          <line x1={L + goals.length * 130} y1={10} x2={L + goals.length * 130 + 14} y2={10} stroke="var(--text)" strokeWidth="2.5" />
          <text x={L + goals.length * 130 + 18} y={13} fill="var(--text-muted)" fontSize="9" fontFamily="var(--sans)">Total Savings</text>
        </g>
      )}
    </svg>
  );
}
