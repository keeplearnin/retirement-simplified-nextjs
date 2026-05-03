'use client';

import { useMemo } from 'react';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import { fmt, fmtFull } from '@/lib/format';
import { computeHealthcare, estimateAcaPremium } from '@/lib/healthcare';

/**
 * Healthcare in Retirement breakdown card.
 *
 * Surfaces the math that the rolled-up "Lifetime Healthcare $XK" headline
 * hides: the pre-65 ACA bridge (typically the most expensive years of
 * retirement) shown year-by-year, the Medicare-era baseline, and the
 * comparison against Fidelity's lifetime benchmark.
 *
 * Tester reviewer: "the #1 surprise cost for early retirees... shows
 * 'Lifetime Healthcare in Retirement: $248K' but doesn't break out the
 * expensive pre-65 years."
 *
 * Respects plan.healthcareMultiplier (1.0 = average; 1.5 = chronic
 * conditions; etc.) — applied uniformly to the engine's gross output so
 * this card matches the year-by-year numbers in the projection.
 */
export default function HealthcareBreakdown({ plan }) {
  const householdSize = plan.hasSpouse ? 2 : 1;
  const filingStatus = plan.filingStatus === 'mfj' ? 'mfj' : 'single';

  // Annual income for ACA subsidy calc — use combined salary as a proxy
  // for MAGI in working years; for retirement-spending years, the engine
  // would normally use projected MAGI but for this card we use the user's
  // intended retirement spend as the simple proxy (matches what
  // VerdictResult does today).
  const annualIncome = useMemo(() => {
    const salarySources = (plan.incomeSources || []).filter(s => s.type === 'salary');
    return salarySources.reduce((s, src) => s + (src.amount || 0), 0)
      || plan.retireSpending
      || plan.annualSpending
      || 80_000;
  }, [plan.incomeSources, plan.retireSpending, plan.annualSpending]);

  // Earlier retirement age across the household — that's when the bridge
  // starts (the first spouse to retire needs ACA coverage even if the
  // other still has employer plan).
  const bridgeStartAge = plan.hasSpouse && plan.spouseRetireAge
    ? Math.min(plan.retireAge, plan.spouseRetireAge)
    : plan.retireAge;

  const result = useMemo(() => computeHealthcare({
    currentAge: plan.currentAge,
    retirementAge: bridgeStartAge,
    longevityAge: plan.longevityAge || 95,
    annualIncome,
    householdSize,
    filingStatus,
  }), [plan.currentAge, bridgeStartAge, plan.longevityAge, annualIncome, householdSize, filingStatus]);

  const multiplier = plan.healthcareMultiplier || 1.0;
  // Apply multiplier post-hoc so this card matches the projection year-by-year.
  const adjusted = useMemo(() => ({
    ...result,
    annualAcaGrossPremium: Math.round(result.annualAcaGrossPremium * multiplier),
    annualAcaSubsidy: Math.round(result.annualAcaSubsidy * multiplier),
    annualAcaNetPremium: Math.round(result.annualAcaNetPremium * multiplier),
    preMedicareTotalCost: Math.round(result.preMedicareTotalCost * multiplier),
    annualMedicareCost: Math.round(result.annualMedicareCost * multiplier),
    medicareTotalCost: Math.round(result.medicareTotalCost * multiplier),
    lifetimeHealthcareCost: Math.round(result.lifetimeHealthcareCost * multiplier),
    vsBenchmark: Math.round(result.lifetimeHealthcareCost * multiplier - result.fidelityBenchmark),
  }), [result, multiplier]);

  // Year-by-year pre-65 detail. Re-computes per-year ACA premium since
  // gross premium varies sharply by age (ages 60–64 are 60% more expensive
  // than ages 50–54). Apply multiplier on the way out.
  const bridgeYears = useMemo(() => {
    if (adjusted.preMedicareYears === 0) return [];
    const rows = [];
    for (let y = 0; y < adjusted.preMedicareYears; y++) {
      const age = bridgeStartAge + y;
      const { gross, subsidy, net } = estimateAcaPremium(age, annualIncome, householdSize);
      rows.push({
        age,
        gross: Math.round(gross * multiplier),
        subsidy: Math.round(subsidy * multiplier),
        net: Math.round(net * multiplier),
      });
    }
    return rows;
  }, [adjusted.preMedicareYears, bridgeStartAge, annualIncome, householdSize, multiplier]);

  const lifetimeColor = adjusted.vsBenchmark > 0 ? 'var(--warn)' : 'var(--accent)';
  const hasBridge = adjusted.preMedicareYears > 0;
  const hasSubsidy = adjusted.annualAcaSubsidy > 0;

  return (
    <Card>
      <SectionLabel>Healthcare in retirement</SectionLabel>

      {/* Pre-Medicare bridge — typically the most expensive part of early
          retirement. Suppress the entire section for users retiring at 65+. */}
      {hasBridge && (
        <div style={{
          marginTop: 8, padding: '14px 16px', borderRadius: 10,
          background: 'var(--warn-dim)', border: '1px solid var(--warn)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
              Pre-Medicare bridge: ages {bridgeStartAge}–64
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {adjusted.preMedicareYears} year{adjusted.preMedicareYears === 1 ? '' : 's'}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total bridge cost</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--warn)', fontFamily: 'var(--serif)' }}>
              {fmtFull(adjusted.preMedicareTotalCost)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Average <strong>{fmt(adjusted.annualAcaNetPremium)}/yr</strong> in ACA marketplace premiums
            {hasSubsidy ? <> after a <strong>{fmt(adjusted.annualAcaSubsidy)}/yr</strong> subsidy</> : ' (no subsidy at your income level)'}
            {householdSize === 2 ? ' for the household' : ''}.
            Most retirement planners ignore this — it's frequently the largest line item in early-retirement budgets.
          </div>

          {/* Year-by-year detail */}
          <div style={{ marginTop: 14, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--sans)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-dim)', fontWeight: 600 }}>Age</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--text-dim)', fontWeight: 600 }}>Gross premium</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--text-dim)', fontWeight: 600 }}>ACA subsidy</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--text-dim)', fontWeight: 600 }}>You pay</th>
                </tr>
              </thead>
              <tbody>
                {bridgeYears.map((row, i) => (
                  <tr key={row.age} style={{ borderBottom: i < bridgeYears.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--text)' }}>{row.age}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text-muted)', textAlign: 'right' }}>{fmt(row.gross)}</td>
                    <td style={{ padding: '6px 10px', color: row.subsidy > 0 ? 'var(--accent)' : 'var(--text-dim)', textAlign: 'right' }}>
                      {row.subsidy > 0 ? `−${fmt(row.subsidy)}` : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', color: 'var(--warn)', textAlign: 'right', fontWeight: 600 }}>{fmt(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Medicare era — applies to everyone retiring at 65 or living past 65 */}
      {adjusted.medicareYears > 0 && (
        <div style={{
          marginTop: hasBridge ? 12 : 8,
          padding: '14px 16px', borderRadius: 10,
          background: 'var(--blue-dim)', border: '1px solid var(--blue)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
              Medicare era: ages 65–{plan.longevityAge || 95}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {adjusted.medicareYears} year{adjusted.medicareYears === 1 ? '' : 's'}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Medicare cost</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)', fontFamily: 'var(--serif)' }}>
              {fmtFull(adjusted.medicareTotalCost)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong>{fmt(adjusted.annualMedicareCost)}/yr</strong> per beneficiary — Part B base ($202.90/mo) + Medigap Plan G average ($165/mo) + Part D average ($45/mo). IRMAA surcharges layer on top in years where MAGI crosses a threshold (see IRMAA banner below if it fires for you).
          </div>
        </div>
      )}

      {/* Lifetime total + Fidelity benchmark */}
      <div style={{
        marginTop: 12, padding: '14px 16px', borderRadius: 10,
        background: 'var(--bg2)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
              Lifetime total {householdSize === 2 ? '(household)' : ''}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: lifetimeColor, fontFamily: 'var(--serif)' }}>
              {fmtFull(adjusted.lifetimeHealthcareCost)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
              Fidelity benchmark
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
              {fmt(adjusted.fidelityBenchmark)}
            </div>
            <div style={{ fontSize: 11, color: lifetimeColor, marginTop: 2 }}>
              {adjusted.vsBenchmark > 0
                ? `${fmt(adjusted.vsBenchmark)} above avg`
                : adjusted.vsBenchmark < -1000
                  ? `${fmt(Math.abs(adjusted.vsBenchmark))} below avg`
                  : 'in line with avg'}
            </div>
          </div>
        </div>
        {multiplier !== 1.0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Includes your <strong>{multiplier.toFixed(1)}× healthcare cost multiplier</strong> set under Assumptions. Drop the multiplier to 1.0× to see the average-retiree baseline.
          </div>
        )}
      </div>
    </Card>
  );
}
