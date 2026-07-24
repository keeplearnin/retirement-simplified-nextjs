'use client';

import { useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import Slider from '@/components/ui/Slider';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt } from '@/lib/format';
import { usePlan } from '@/components/PlanProvider';
import { computeProjection } from '@/lib/computeProjection';
import { analyzeBridgeYears, compareCobra, computeAcaYear, estimateBenchmarkMonthly } from '@/lib/acaBridge';

/**
 * HealthcareBridge — the pre-65 coverage gap, priced from the REAL plan.
 * Retire before Medicare and every bridge year's health premium hinges on
 * MAGI: under 400% of the poverty line the marketplace credit pays most of
 * the benchmark premium; $1 over forfeits it (the 2026 cliff). This tab
 * prices each bridge year from the projection, shows the subsidy-vs-MAGI
 * curve, and compares COBRA for the first 18 months.
 */
export default function HealthcareBridge() {
  const { plan } = usePlan();
  const [base21, setBase21] = useState(400);
  const [cobraMonthly, setCobraMonthly] = useState(0);

  const projection = useMemo(() => {
    try { return computeProjection(plan); } catch { return null; }
  }, [plan]);

  const bridge = useMemo(() => {
    if (!projection) return null;
    return analyzeBridgeYears(plan, projection.combined, { base21Monthly: base21 });
  }, [plan, projection, base21]);

  const cobra = useMemo(() => {
    if (!bridge || !bridge.anyBridge) return null;
    return compareCobra({ cobraMonthly, bridgeYears: bridge.years });
  }, [bridge, cobraMonthly]);

  // Subsidy-vs-MAGI curve for the FIRST bridge year's household shape —
  // the visual that teaches the cliff.
  const curve = useMemo(() => {
    if (!bridge || !bridge.anyBridge) return null;
    const y0 = bridge.years[0];
    const coveredAges = y0.coveredAges;
    const maxMagi = Math.max(y0.cliffMagi * 1.35, (y0.magi || 0) * 1.15, 120_000);
    const priceAt = (magi) => computeAcaYear({
      magi, householdSize: plan.hasSpouse ? 2 : 1, coveredAges, base21Monthly: base21,
    }).subsidy;
    const pts = [];
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const magi = (i / steps) * maxMagi;
      pts.push({ magi, subsidy: priceAt(magi) });
    }
    // Render the cliff as the vertical drop it actually is — without these
    // two points the line between adjacent samples drew it as a ~$1,500-wide
    // diagonal.
    pts.push({ magi: y0.cliffMagi, subsidy: priceAt(y0.cliffMagi) });
    pts.push({ magi: y0.cliffMagi + 1, subsidy: 0 });
    pts.sort((a, b) => a.magi - b.magi);
    // The "you are here" dot uses the EXACT subsidy at the year's MAGI —
    // snapping to the nearest sample could draw the dot on the wrong side
    // of the cliff (top of the cliff while the table said $0).
    const dot = { magi: Math.min(y0.magi, maxMagi), subsidy: priceAt(Math.min(y0.magi, maxMagi)) };
    return { pts, maxMagi, year: y0, dot };
  }, [bridge, plan.hasSpouse, base21]);

  if (!bridge || !bridge.anyBridge) {
    return (
      <div className="fade-up">
        <InfoBox title="No bridge years to cover" color="var(--accent)" bgColor="var(--accent-dim, rgba(16,185,129,0.08))">
          {plan.retireAge >= 65
            ? 'You retire at 65 or later, so Medicare picks up right where employer coverage ends — no marketplace bridge needed. If you move retirement earlier, this tab prices the gap years.'
            : 'No pre-65 coverage years found in the current projection.'}
        </InfoBox>
      </div>
    );
  }

  const { years, totals } = bridge;
  const maxSubsidy = curve ? Math.max(...curve.pts.map(p => p.subsidy), 1) : 1;

  return (
    <div className="fade-up">
      <InfoBox title="The 400% Cliff Is Back for 2026" color="var(--warn)" bgColor="var(--warn-dim)">
        The enhanced pandemic-era subsidies expired after 2025. For 2026 coverage, marketplace premium
        credits end abruptly at 400% of the federal poverty line — one extra dollar of MAGI (a Roth
        conversion, a capital gain, a 401(k) withdrawal) can forfeit the whole year&apos;s credit. Every
        number below comes from your actual plan&apos;s projected MAGI in each bridge year.
      </InfoBox>

      <div className="stats-row" style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <Stat
          label="Bridge Years"
          value={`${years.length}`}
          sub={`Age ${years[0].coveredAges[0]} until Medicare at 65`}
          color="var(--text)"
        />
        <Stat
          label="Subsidies Captured"
          value={fmt(totals.subsidies)}
          sub="Premium credits across the bridge"
          color="var(--accent)"
        />
        <Stat
          label="Your Net Premiums"
          value={fmt(totals.netPremiums)}
          sub={`Of ${fmt(totals.benchmark)} full benchmark cost`}
          color="var(--text)"
        />
        <Stat
          label="Forfeited at the Cliff"
          value={totals.cliffYears > 0 ? fmt(totals.regainable) : '$0'}
          sub={totals.cliffYears > 0
            ? `${totals.cliffYears} year${totals.cliffYears > 1 ? 's' : ''} over 400% FPL — regainable by trimming MAGI`
            : 'No bridge year crosses the cliff'}
          color={totals.cliffYears > 0 ? 'var(--danger)' : 'var(--accent)'}
        />
        {totals.floorYears > 0 && (
          <Stat
            label="MAGI Too Low"
            value={fmt(totals.floorRegainable)}
            sub={`${totals.floorYears} year${totals.floorYears > 1 ? 's' : ''} under 100% FPL — realize income to restore credits`}
            color="var(--warn)"
          />
        )}
      </div>

      <Card style={{ marginTop: 16 }}>
        <SectionLabel>Premium Assumptions</SectionLabel>
        <Slider
          label="Benchmark premium at age 21 (drives the age curve)"
          value={base21} onChange={setBase21} min={250} max={700} step={10} format={fmt}
        />
        <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginTop: 4 }}>
          At this setting a 60-year-old&apos;s benchmark silver plan is ~{fmt(Math.round(estimateBenchmarkMonthly(60, base21)))}/mo
          and a 64-year-old&apos;s ~{fmt(Math.round(estimateBenchmarkMonthly(64, base21)))}/mo (federal 3:1 age curve).
          This is an estimate — get your real quote at healthcare.gov and tune the slider to match.
        </p>
        <Slider
          label="Your COBRA quote, total household $/month (0 = skip comparison)"
          value={cobraMonthly} onChange={setCobraMonthly} min={0} max={4000} step={50} format={fmt}
        />
      </Card>

      {/* The cliff curve */}
      {curve && (
        <Card style={{ marginTop: 16 }}>
          <SectionLabel>Subsidy vs. MAGI — Age {curve.year.coveredAges.join(' / ')}{curve.year.coveredCount === 2 ? ' (both covered)' : ''}</SectionLabel>
          <svg viewBox="0 0 600 210" style={{ width: '100%', height: 'auto', display: 'block' }}>
            {[0.25, 0.5, 0.75, 1].map((f) => {
              const y = 180 - f * 160;
              return (
                <g key={f}>
                  <line x1={55} y1={y} x2={590} y2={y} stroke="var(--border)" strokeWidth={0.5} />
                  <text x={50} y={y + 3} textAnchor="end" fill="var(--text-dim)" fontSize={9}>
                    {fmt(Math.round(maxSubsidy * f / 1000) * 1000)}
                  </text>
                </g>
              );
            })}
            <path
              d={curve.pts.map((p, i) => {
                const x = 55 + (p.magi / curve.maxMagi) * 535;
                const y = 180 - (p.subsidy / maxSubsidy) * 160;
                return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
              }).join(' ')}
              fill="none" stroke="var(--accent)" strokeWidth={2.5}
            />
            {/* Cliff marker */}
            {(() => {
              const x = 55 + (curve.year.cliffMagi / curve.maxMagi) * 535;
              return (
                <g>
                  <line x1={x} y1={20} x2={x} y2={180} stroke="var(--danger)" strokeWidth={1} strokeDasharray="4 3" />
                  <text x={x + 4} y={30} fill="var(--danger)" fontSize={9}>400% FPL cliff · {fmt(curve.year.cliffMagi)}</text>
                </g>
              );
            })()}
            {/* Your position — exact computed point, never a snapped sample */}
            {(() => {
              const x = 55 + (curve.dot.magi / curve.maxMagi) * 535;
              const y = 180 - (curve.dot.subsidy / maxSubsidy) * 160;
              return <circle cx={x} cy={y} r={5} fill="var(--warn)" stroke="var(--bg, #fff)" strokeWidth={2} />;
            })()}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <text key={f} x={55 + f * 535} y={200} textAnchor="middle" fill="var(--text-dim)" fontSize={9}>
                {fmt(Math.round(curve.maxMagi * f / 1000) * 1000)}
              </text>
            ))}
          </svg>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.6 }}>
            The dot is your projected MAGI that year. The vertical drop at the dashed line is the cliff —
            crossing it forfeits ~{fmt(curve.year.subsidyAtCliff)} of credit in one dollar of income.
          </p>
        </Card>
      )}

      {/* Year-by-year table */}
      <Card style={{ marginTop: 16 }}>
        <SectionLabel>Every Bridge Year</SectionLabel>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560, fontFamily: 'var(--sans)', fontSize: 13 }}>
            <thead>
              <tr>
                {['Age', 'MAGI', '% of FPL', 'Benchmark', 'Credit', 'You pay'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: i === 0 ? '8px 12px 8px 0' : '8px 0 8px 12px', fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.age} style={{ borderTop: '1px solid var(--border)' }}>
                  {/* Ages of the members actually covered — a spouse-only
                      year shows the spouse's age, not the primary's. */}
                  <td style={{ padding: '9px 12px 9px 0', color: 'var(--text)', fontWeight: 500 }}>
                    {y.coveredAges.join(' / ')}
                  </td>
                  <td style={{ textAlign: 'right', padding: '9px 0 9px 12px', color: 'var(--text)' }}>{fmt(y.magi)}</td>
                  <td style={{ textAlign: 'right', padding: '9px 0 9px 12px', fontWeight: 600, color: y.overCliff ? 'var(--danger)' : y.belowFloor ? 'var(--warn)' : 'var(--text-muted)' }}>
                    {Math.round(y.fplRatio * 100)}%{y.overCliff ? ' — over cliff' : y.belowFloor ? ' — Medicaid range' : ''}
                  </td>
                  <td style={{ textAlign: 'right', padding: '9px 0 9px 12px', color: 'var(--text-muted)' }}>{fmt(y.benchmarkAnnual)}</td>
                  <td style={{ textAlign: 'right', padding: '9px 0 9px 12px', color: y.subsidy > 0 ? 'var(--accent)' : 'var(--text-dim)' }}>
                    {y.subsidy > 0 ? fmt(y.subsidy) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '9px 0 9px 12px', fontWeight: 600, color: 'var(--text)' }}>{fmt(y.netPremium)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* COBRA comparison */}
      {cobra && (() => {
        // Fewer than 18 months when Medicare arrives first — label honestly.
        const cobraMonths = cobra.periods.reduce((s, p) => s + p.months, 0);
        return (
        <Card style={{ marginTop: 16 }}>
          <SectionLabel>COBRA vs. Marketplace — First {cobraMonths} Months</SectionLabel>
          <div className="stats-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Stat label={`COBRA (${cobraMonths} mo)`} value={fmt(cobra.cobraTotal)} sub={`${fmt(cobraMonthly)}/mo, your quote`} color="var(--text)" />
            <Stat label={`Marketplace (${cobraMonths} mo)`} value={fmt(cobra.marketplaceTotal)} sub="Net of projected credits" color="var(--text)" />
            <Stat
              label={cobra.marketplaceSaves >= 0 ? 'Marketplace Saves' : 'COBRA Saves'}
              value={fmt(Math.abs(cobra.marketplaceSaves))}
              sub={cobra.marketplaceSaves >= 0
                ? 'Subsidies beat continuity — but check your doctors/deductible carryover'
                : 'Your credits are small (or forfeited) — COBRA continuity wins on price too'}
              color={cobra.marketplaceSaves >= 0 ? 'var(--accent)' : 'var(--warn)'}
            />
          </div>
        </Card>
        );
      })()}

      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 18, lineHeight: 1.6 }}>
        2026 coverage-year figures: 2025 federal poverty guidelines (contiguous US) and the post-sunset
        applicable-percentage schedule (2.10%–9.96%, hard cliff above 400% FPL). MAGI here is your plan&apos;s
        projected taxable income plus untaxed Social Security — close, but confirm against your tax return&apos;s
        ACA worksheet. Below 100% FPL, credits stop (Medicaid in expansion states). Cost-sharing reductions,
        the family glitch, and state-specific programs aren&apos;t modeled — treat this as a planning map, and
        price real plans at healthcare.gov before deciding.
      </p>
    </div>
  );
}
