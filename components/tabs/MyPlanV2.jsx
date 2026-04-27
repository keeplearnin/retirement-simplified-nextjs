'use client';

import { useState, useMemo } from 'react';
import { usePlan } from '@/components/PlanProvider';
import { computeProjection, findBreakingShock } from '@/lib/computeProjection';
import { fmt } from '@/lib/format';

// ---------------------------------------------------------------------------
// MyPlanV2 — "Honest" dashboard view.
//
// Reads inputs from the existing My Plan tab (PlanProvider). This view
// surfaces:
//   • money-lasts-to-age (deterministic), with sensitivity to return shock
//   • portfolio trajectory chart with the inflections users plan around
//     (retire age, RMD@73, slow-go transition)
//   • year-by-year and retirement-detail tables
//
// To edit assumptions, switch to the "My Plan" tab.
// ---------------------------------------------------------------------------

export default function MyPlanV2() {
  const { plan } = usePlan();
  const [returnShock, setReturnShock] = useState(0); // percent points subtracted from expected return

  const baseResults = useMemo(() => computeProjection(plan), [plan]);
  const stressResults = useMemo(() => computeProjection({
    ...plan,
    expectedReturn: Math.max(0, (plan.expectedReturn || 7) - 2),
  }), [plan]);
  const breaking = useMemo(() => findBreakingShock(plan), [plan]);
  const liveResults = useMemo(() => returnShock === 0 ? baseResults : computeProjection({
    ...plan,
    expectedReturn: Math.max(0, (plan.expectedReturn || 7) - returnShock),
  }), [plan, returnShock, baseResults]);

  const yearsToRetire = Math.max(0, plan.retireAge - plan.currentAge);
  const moneyLastsBase = baseResults.moneyLastsAge;
  const baseGap = Math.max(0, plan.longevityAge - moneyLastsBase);

  // Inflection events derived from the plan, not hardcoded
  const events = [
    { age: plan.retireAge, label: 'Retire', tone: 'accent' },
    { age: 73, label: 'RMDs begin', tone: 'warn' },
    { age: plan.slowGoEndAge || 85, label: 'Slow-go phase', tone: 'danger' },
  ].filter(e => e.age >= plan.currentAge && e.age <= plan.longevityAge);

  return (
    <div className="slide-in" style={{ paddingTop: 24 }}>
      {/* Honest header */}
      <Header
        currentAge={plan.currentAge}
        longevityAge={plan.longevityAge}
        moneyLastsBase={moneyLastsBase}
        baseGap={baseGap}
        breaking={breaking}
      />

      {/* Stat strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 24,
      }} className="grid-stat">
        <Stat label="Total saved" value={fmt(baseResults.startingBalance)} sub={`across all accounts`} tone="neutral" />
        <Stat
          label="Money lasts to (planned)"
          value={`age ${moneyLastsBase}`}
          sub={baseGap === 0 ? `covers planned ${plan.longevityAge}` : `${baseGap}-yr gap vs ${plan.longevityAge}`}
          tone={baseGap === 0 ? 'good' : 'warn'}
        />
        <BreakingStat breaking={breaking} longevityAge={plan.longevityAge} />
        <Stat
          label="Years to retirement"
          value={yearsToRetire}
          sub={`retire at ${plan.retireAge}`}
          tone="neutral"
        />
      </div>

      {/* Sensitivity widget */}
      <SensitivityPanel
        baseReturn={plan.expectedReturn || 7}
        shock={returnShock}
        setShock={setReturnShock}
        liveLastsAge={liveResults.moneyLastsAge}
        longevityAge={plan.longevityAge}
      />

      {/* Hero chart */}
      <ProjectionChart
        rows={liveResults.combined}
        events={events}
        retireAge={plan.retireAge}
        longevityAge={plan.longevityAge}
        baseRows={baseResults.combined}
        stressRows={stressResults.combined}
      />

      {/* Year-by-year summary table */}
      <SummaryCard title="Year-by-year (every 5 years)" subtitle="Click 'Show all years' below for the full retirement detail.">
        <SummaryTable rows={liveResults.combined} />
      </SummaryCard>

      {/* Retirement detail table */}
      <RetirementDetailCard rows={liveResults.combined} retireAge={plan.retireAge} />

      {/* Footnote */}
      <div style={{
        marginTop: 24, padding: '14px 18px', background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
      }}>
        Money-lasts-to-age is the first year retired liquid assets hit zero AND income falls short of expenses.
        It uses your current return assumption ({(plan.expectedReturn || 7).toFixed(1)}%); the slider above stress-tests
        a uniform return shortfall. To change inputs, switch to the <b>My Plan</b> tab.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({ currentAge, longevityAge, moneyLastsBase, baseGap, breaking }) {
  const baseTone = baseGap === 0 ? 'var(--accent)' : 'var(--danger)';
  const breakColor = breaking.robust
    ? 'var(--accent)'
    : breaking.shock < 1.5
      ? 'var(--danger)'
      : 'var(--warn)';

  // Sentence varies by plan health so the headline always carries information.
  let breakingClause;
  if (breaking.robust) {
    breakingClause = (
      <>Stays solvent even with a <span style={{ color: breakColor }}>−7%+</span> return shock.</>
    );
  } else if (breaking.shock === 0) {
    breakingClause = (
      <>The plan is already <span style={{ color: 'var(--danger)' }}>under water</span> at your stated assumptions.</>
    );
  } else {
    breakingClause = (
      <>Plan breaks at a <span style={{ color: breakColor }}>−{breaking.shock.toFixed(1)}%</span> return shock — money runs short at age {breaking.lastsAge}.</>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 600, marginBottom: 8 }}>
        Plan from age {currentAge} to {longevityAge}
      </div>
      <h1 style={{
        fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.25, margin: 0, color: 'var(--text)',
      }}>
        Money lasts to <span style={{ color: baseTone }}>age {moneyLastsBase}</span>.{' '}
        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{breakingClause}</span>
      </h1>
      <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Plan against the worst case, not the median. The deterministic projection assumes your inputs hold;
        sensitivity below shows what changes if returns disappoint.
      </div>
    </div>
  );
}

// "Plan breaks at" stat card — always carries information whether the plan is
// fragile, healthy, or underwater.
function BreakingStat({ breaking, longevityAge }) {
  if (breaking.robust) {
    return (
      <Stat
        label="Plan breaks at"
        value="−7%+"
        sub="robust — no shock tested broke it"
        tone="good"
      />
    );
  }
  if (breaking.shock === 0) {
    return (
      <Stat
        label="Plan breaks at"
        value="0% shock"
        sub={`already underwater · ends ${breaking.lastsAge}`}
        tone="danger"
      />
    );
  }
  const tone = breaking.shock < 1.5 ? 'danger' : breaking.shock < 3 ? 'warn' : 'good';
  return (
    <Stat
      label="Plan breaks at"
      value={`−${breaking.shock.toFixed(1)}%`}
      sub={`runs short at age ${breaking.lastsAge}`}
      tone={tone}
    />
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function Stat({ label, value, sub, tone }) {
  const toneColor = tone === 'good' ? 'var(--accent)'
                  : tone === 'warn' ? 'var(--warn)'
                  : tone === 'danger' ? 'var(--danger)'
                  : 'var(--text-dim)';
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: toneColor, marginTop: 4, fontWeight: 500 }}>{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sensitivity slider — explicit knob for "what if returns are X% lower"
// ---------------------------------------------------------------------------

function SensitivityPanel({ baseReturn, shock, setShock, liveLastsAge, longevityAge }) {
  const stressedReturn = Math.max(0, baseReturn - shock);
  const gap = Math.max(0, longevityAge - liveLastsAge);
  const tone = gap === 0 ? 'var(--accent)' : gap < 5 ? 'var(--warn)' : 'var(--danger)';

  return (
    <div className="card" style={{ padding: '18px 20px', marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Return sensitivity</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            What if your portfolio averages less than {baseReturn.toFixed(1)}%?
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Stressed return</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{stressedReturn.toFixed(1)}%</div>
          </div>
          <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Money lasts to</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: tone, fontVariantNumeric: 'tabular-nums' }}>age {liveLastsAge}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 60 }}>0% shock</span>
        <input
          type="range"
          min={0}
          max={3}
          step={0.25}
          value={shock}
          onChange={e => setShock(parseFloat(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 70, textAlign: 'right' }}>−3% shock</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Projection chart
// ---------------------------------------------------------------------------

function ProjectionChart({ rows, events, retireAge, longevityAge, baseRows, stressRows }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  if (!rows || rows.length === 0) return null;

  const W = 1000, H = 320, padL = 60, padR = 24, padT = 30, padB = 36;
  const maxY = Math.max(
    ...rows.map(r => r.portfolioBalance),
    ...baseRows.map(r => r.portfolioBalance),
    1,
  ) * 1.1;
  const xAt = i => padL + (i / Math.max(1, rows.length - 1)) * (W - padL - padR);
  const yAt = v => padT + (1 - v / maxY) * (H - padT - padB);

  const linePath = (arr) => arr.map((r, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(r.portfolioBalance).toFixed(1)}`).join(' ');

  const showIdx = hoverIdx ?? rows.findIndex(r => r.age === retireAge);
  const cur = rows[Math.max(0, showIdx)] || rows[0];

  // Y-axis grid lines (5 evenly spaced)
  const yTicks = 5;
  const yStep = maxY / yTicks;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => Math.round(i * yStep));

  // X-axis labels (every 5 years + endpoints)
  const xLabels = rows.filter((r, i) => i === 0 || i === rows.length - 1 || r.age % 5 === 0);

  return (
    <div className="card" style={{ padding: '20px 24px', marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Portfolio over time</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            Solid line uses your current assumptions. Dashed line is the −2% return stress.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--text-muted)', alignItems: 'center' }}>
          <Legend swatch="var(--accent)" label="Current plan" />
          <Legend swatch="var(--danger)" label="Returns −2%" dashed />
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width * W;
          const i = Math.round(((x - padL) / (W - padL - padR)) * (rows.length - 1));
          setHoverIdx(Math.max(0, Math.min(rows.length - 1, i)));
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Y grid + labels */}
        {yLabels.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yAt(v)} y2={yAt(v)} stroke="var(--border)" />
            <text x={padL - 8} y={yAt(v) + 3} fontSize="10" fill="var(--text-dim)" textAnchor="end">{fmt(v)}</text>
          </g>
        ))}
        {/* X labels */}
        {xLabels.map((r) => {
          const i = rows.indexOf(r);
          return <text key={r.age} x={xAt(i)} y={H - 14} fontSize="10" fill="var(--text-dim)" textAnchor="middle">{r.age}</text>;
        })}
        {/* Lifespan target */}
        {(() => {
          const i = rows.findIndex(r => r.age === longevityAge);
          if (i < 0) return null;
          return (
            <g>
              <line x1={xAt(i)} x2={xAt(i)} y1={padT} y2={H - padB} stroke="var(--text-dim)" strokeDasharray="4 4" opacity="0.6" />
              <text x={xAt(i) - 4} y={padT - 8} fontSize="10" fill="var(--text-dim)" textAnchor="end">plan to age {longevityAge}</text>
            </g>
          );
        })()}
        {/* Event markers */}
        {events.map(ev => {
          const i = rows.findIndex(r => r.age === ev.age);
          if (i < 0) return null;
          const c = ev.tone === 'accent' ? 'var(--accent)' : ev.tone === 'warn' ? 'var(--warn)' : 'var(--danger)';
          return (
            <g key={ev.age + ev.label}>
              <line x1={xAt(i)} x2={xAt(i)} y1={padT} y2={H - padB} stroke={c} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
              <text x={xAt(i)} y={padT - 8} fontSize="10" fill={c} textAnchor="middle" fontWeight="600">{ev.label}</text>
            </g>
          );
        })}
        {/* Stress (dashed danger) */}
        <path d={linePath(stressRows)} fill="none" stroke="var(--danger)" strokeWidth="1.8" strokeDasharray="5 4" opacity="0.85" />
        {/* Live (current settings) */}
        <path d={linePath(rows)} fill="none" stroke="var(--accent)" strokeWidth="2.4" />
        {/* Hover */}
        {showIdx >= 0 && (
          <g>
            <line x1={xAt(showIdx)} x2={xAt(showIdx)} y1={padT} y2={H - padB} stroke="var(--text-muted)" strokeWidth="1" opacity="0.25" />
            <circle cx={xAt(showIdx)} cy={yAt(cur.portfolioBalance)} r="4.5" fill="var(--card)" stroke="var(--accent)" strokeWidth="2.2" />
            <g transform={`translate(${Math.min(W - 200, Math.max(padL, xAt(showIdx) + 10))}, ${Math.max(padT, yAt(cur.portfolioBalance) - 56)})`}>
              <rect width="190" height="50" rx="6" fill="var(--bg)" stroke="var(--border)" />
              <text x="12" y="16" fontSize="10" fill="var(--text-dim)">Age {cur.age}</text>
              <text x="12" y="32" fontSize="13" fontWeight="600" fill="var(--text)">{fmt(cur.portfolioBalance)} <tspan fill="var(--text-dim)" fontWeight="400" fontSize="10">portfolio</tspan></text>
              <text x="12" y="45" fontSize="10" fill="var(--text-muted)">Income {fmt(cur.totalIncome)} · Tax {fmt(cur.totalTax)}</text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

function Legend({ swatch, label, dashed }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {dashed
        ? <span style={{ width: 14, height: 0, borderTop: `2px dashed ${swatch}` }} />
        : <span style={{ width: 10, height: 10, borderRadius: 5, background: swatch }} />}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Summary card wrapper
// ---------------------------------------------------------------------------

function SummaryCard({ title, subtitle, children }) {
  return (
    <div className="card" style={{ padding: '18px 20px', marginTop: 16 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Year-by-year table (lifted from MyPlan.jsx, slightly trimmed)
// ---------------------------------------------------------------------------

function SummaryTable({ rows }) {
  if (!rows || rows.length === 0) return null;
  const displayRows = rows.filter((_, i) => i % 5 === 0 || i === rows.length - 1);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--sans)' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {['Age', 'Portfolio', 'Salary', 'SS + Other', 'Withdrawals', 'Expenses', 'Tax', 'Status'].map(h => (
              <th key={h} style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((r, i) => {
            const prevBal = i > 0 ? displayRows[i - 1].portfolioBalance : 0;
            const balColor = r.portfolioBalance >= prevBal ? 'var(--accent)' : 'var(--warn)';
            const liquid = r.liquidBalance || 0;

            let statusText, statusColor;
            if (!r.isRetired) {
              statusText = 'Saving';
              statusColor = 'var(--accent)';
            } else if (r.totalWithdrawals > 0) {
              statusText = `${fmt(r.totalWithdrawals)} drawn`;
              statusColor = 'var(--accent)';
            } else if (r.gap >= 0) {
              statusText = 'Covered';
              statusColor = 'var(--accent)';
            } else if (liquid <= 0) {
              statusText = `${fmt(Math.abs(r.gap))} short`;
              statusColor = 'var(--danger)';
            } else {
              statusText = `${fmt(r.totalWithdrawals || 0)} drawn`;
              statusColor = 'var(--warn)';
            }

            return (
              <tr key={r.age} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: r.isRetireYear ? 700 : 400, color: r.isRetireYear ? 'var(--accent)' : 'var(--text)' }}>{r.age}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: balColor, fontWeight: 600 }}>{fmt(r.portfolioBalance)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: r.salary > 0 ? 'var(--text)' : 'var(--text-dim)' }}>{r.salary > 0 ? fmt(r.salary) : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: r.ssAndOther > 0 ? 'var(--blue)' : 'var(--text-dim)' }}>{r.ssAndOther > 0 ? fmt(r.ssAndOther) : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: r.totalWithdrawals > 0 ? 'var(--purple)' : 'var(--text-dim)' }}>{r.totalWithdrawals > 0 ? fmt(r.totalWithdrawals) : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text)' }}>{fmt(r.totalExpense)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(r.totalTax)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: statusColor, fontWeight: 600, fontSize: 11 }}>{statusText}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Retirement detail (lifted from MyPlan.jsx)
// ---------------------------------------------------------------------------

function RetirementDetailCard({ rows, retireAge }) {
  const [open, setOpen] = useState(false);
  const retireRows = rows.filter(r => r.age >= retireAge);
  if (retireRows.length === 0) return null;

  const cellStyle = { padding: '6px 8px', textAlign: 'right', fontSize: 11 };
  const thStyle = { ...cellStyle, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 };

  return (
    <div className="card" style={{ padding: '18px 20px', marginTop: 16 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
        color: 'var(--text)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
      }}>
        <span>Retirement year-by-year detail</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>({retireRows.length} years)</span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0)', marginLeft: 'auto' }}>&#9660;</span>
      </button>
      {open && (
        <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, marginTop: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--sans)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={thStyle}>Age</th>
                <th style={thStyle}>Portfolio</th>
                <th style={thStyle}>Growth</th>
                <th style={thStyle}>SS</th>
                <th style={thStyle}>From 401k</th>
                <th style={thStyle}>From Roth</th>
                <th style={thStyle}>From Taxable</th>
                <th style={thStyle}>From Cash</th>
                <th style={thStyle}>Other Draws</th>
                <th style={thStyle}>Total Drawn</th>
                <th style={thStyle}>Expenses</th>
                <th style={thStyle}>Tax</th>
              </tr>
            </thead>
            <tbody>
              {retireRows.map(r => {
                const otherDraws = (r.withdrawalCrypto || 0) + (r.withdrawalAnnuity || 0) + (r.withdrawalPension || 0);
                return (
                  <tr key={r.age} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...cellStyle, fontWeight: r.isRetireYear ? 700 : 400, color: r.isRetireYear ? 'var(--accent)' : 'var(--text)' }}>{r.age}</td>
                    <td style={{ ...cellStyle, color: 'var(--accent)', fontWeight: 600 }}>{fmt(r.portfolioBalance)}</td>
                    <td style={{ ...cellStyle, color: r.portfolioGrowth >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{r.portfolioGrowth >= 0 ? '+' : ''}{fmt(r.portfolioGrowth)}</td>
                    <td style={{ ...cellStyle, color: r.socialSecurity > 0 ? 'var(--blue)' : 'var(--text-dim)' }}>{r.socialSecurity > 0 ? fmt(r.socialSecurity) : '—'}</td>
                    <td style={{ ...cellStyle, color: r.withdrawal401k > 0 ? 'var(--text)' : 'var(--text-dim)' }}>{r.withdrawal401k > 0 ? fmt(r.withdrawal401k) : '—'}</td>
                    <td style={{ ...cellStyle, color: r.withdrawalRoth > 0 ? 'var(--accent)' : 'var(--text-dim)' }}>{r.withdrawalRoth > 0 ? fmt(r.withdrawalRoth) : '—'}</td>
                    <td style={{ ...cellStyle, color: r.withdrawalTaxable > 0 ? 'var(--text)' : 'var(--text-dim)' }}>{r.withdrawalTaxable > 0 ? fmt(r.withdrawalTaxable) : '—'}</td>
                    <td style={{ ...cellStyle, color: (r.withdrawalCash || 0) > 0 ? 'var(--text)' : 'var(--text-dim)' }}>{(r.withdrawalCash || 0) > 0 ? fmt(r.withdrawalCash) : '—'}</td>
                    <td style={{ ...cellStyle, color: otherDraws > 0 ? 'var(--text)' : 'var(--text-dim)' }}>{otherDraws > 0 ? fmt(otherDraws) : '—'}</td>
                    <td style={{ ...cellStyle, color: r.totalWithdrawals > 0 ? 'var(--purple)' : 'var(--text-dim)', fontWeight: 600 }}>{r.totalWithdrawals > 0 ? fmt(r.totalWithdrawals) : '—'}</td>
                    <td style={{ ...cellStyle, color: 'var(--text)' }}>{fmt(r.totalExpense)}</td>
                    <td style={{ ...cellStyle, color: r.totalTax > 0 ? 'var(--text-muted)' : 'var(--text-dim)' }}>{r.totalTax > 0 ? fmt(r.totalTax) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
