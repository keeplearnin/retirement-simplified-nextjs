'use client';

import { useMemo } from 'react';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import { fmt, fmtFull } from '@/lib/format';

/**
 * Bridge Options card — explicit alternatives when liquid savings are
 * exhausted before longevity. Most planners just show "your money runs out
 * at age X" and stop. This card shows four concrete paths to close the gap,
 * each with computed numbers from the user's actual plan:
 *
 *   1. Sell real estate (if user has RE)
 *   2. Reverse mortgage / HECM (if homeowner 62+)
 *   3. Reduce retirement spending
 *   4. Delay retirement / extend part-time work
 *
 * The card fires whenever the projection shows a cash-flow gap — i.e.,
 * `liquidExhaustedAtAge` is set, regardless of useRealEstateInRetirement.
 * If RE is already toggled on, option 1 is shown as "you've already
 * planned to do this" with the math.
 */
export default function BridgeOptionsCard({
  plan,
  liquidExhaustedAtAge,    // age when liquid hits zero
  longevityAge,            // age the projection runs to
  retireAge,
  realEstateBalance,       // last-row RE balance (illiquid wealth at end)
  retireSpending,          // user's annual retirement spend (today's $)
  liquidShortfallAtBrokeAge, // approximate annual gap at the broke age
  onToggleRealEstate,      // (bool) => void — flips plan.useRealEstateInRetirement
}) {
  const yearsShort = useMemo(() => {
    if (!liquidExhaustedAtAge) return 0;
    return Math.max(0, longevityAge - liquidExhaustedAtAge);
  }, [liquidExhaustedAtAge, longevityAge]);

  // 1. Real estate sale — how many years of spending would the RE cover?
  // Use ANNUAL retirement spending as the rough cost-of-a-year-late-in-life.
  // RE is in nominal dollars at end-of-life; spending is in today's dollars
  // — close enough for a directional estimate.
  const reYearsCovered = useMemo(() => {
    if (!realEstateBalance || !retireSpending) return 0;
    return Math.round(realEstateBalance / retireSpending);
  }, [realEstateBalance, retireSpending]);

  // 2. Reverse mortgage / HECM. Rule of thumb: at age 62, principal limit
  // factor ~50% of home value; at 75, ~60%; at 85+, ~70%. We approximate as
  // 55% of RE value (assumes a ~70-year-old retiree, the common HECM age).
  // HECM is typically taken as monthly tenure payments — divide PLF by
  // remaining longevity for an annual income estimate.
  const hecmAnnualIncome = useMemo(() => {
    if (!realEstateBalance) return 0;
    const principalLimit = realEstateBalance * 0.55;
    const remainingYears = Math.max(1, longevityAge - 70);
    return Math.round(principalLimit / remainingYears);
  }, [realEstateBalance, longevityAge]);

  // 3. Spending reduction needed. Approximate: shortfall years × annual gap
  // / total retirement years = % of current spend you'd need to cut.
  const spendingCutPct = useMemo(() => {
    if (!liquidExhaustedAtAge || !retireSpending) return 0;
    const totalRetirementYears = longevityAge - retireAge;
    if (totalRetirementYears <= 0) return 0;
    // Rough: if liquid runs out X years short, you needed (X/total) more
    // savings per year, so cut current spend by approximately that fraction.
    const shortfallFraction = yearsShort / totalRetirementYears;
    return Math.round(shortfallFraction * 100);
  }, [liquidExhaustedAtAge, longevityAge, retireAge, yearsShort, retireSpending]);

  // 4. Delay retirement — if the user works the same shortfall years,
  // they avoid drawing during that time AND keep contributing.
  const yearsToDelay = yearsShort > 0 ? Math.min(yearsShort, 10) : 0;

  if (!liquidExhaustedAtAge) return null;
  const usingRE = !!plan.useRealEstateInRetirement;

  return (
    <Card style={{ marginTop: 16, borderLeft: '3px solid #f59e0b' }}>
      <SectionLabel>Bridge options — closing the cash-flow gap</SectionLabel>
      <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.08)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Your projection shows liquid savings exhausted at age <strong>{liquidExhaustedAtAge}</strong>{yearsShort > 0 ? ` — ${yearsShort} year${yearsShort === 1 ? '' : 's'} short of your longevity (${longevityAge})` : ''}. Most plans hide this gap; honest plans state it and show the moves to close it. Here are four explicit paths:
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 14 }}>

        {/* Option 1: Real estate */}
        {realEstateBalance > 50_000 && (
          <div style={{
            padding: '14px 16px', borderRadius: 10,
            background: usingRE ? 'var(--accent-dim)' : 'var(--bg2)',
            border: `1px solid ${usingRE ? 'var(--accent)' : 'var(--border)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: usingRE ? 'var(--accent)' : 'var(--text)' }}>
                Sell or downsize real estate
              </div>
              {usingRE && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>active</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8 }}>
              Your real estate is projected at <strong>{fmt(realEstateBalance)}</strong> at age {longevityAge}. Selling or downsizing covers roughly <strong>{reYearsCovered} year{reYearsCovered === 1 ? '' : 's'}</strong> of your retirement spending ({fmt(retireSpending)}/yr in today's dollars).
            </div>
            <button
              onClick={() => onToggleRealEstate(!usingRE)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none',
                background: usingRE ? 'var(--text-dim)' : 'var(--accent)',
                color: '#fff', fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--sans)', cursor: 'pointer',
              }}
            >
              {usingRE ? 'Remove RE from retirement plan' : 'Include RE in retirement plan'}
            </button>
          </div>
        )}

        {/* Option 2: Reverse mortgage */}
        {realEstateBalance > 200_000 && (
          <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              Reverse mortgage (HECM)
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Available at age 62+. You keep the home; the lender pays you. On your projected RE value, an HECM at age 70 yields roughly <strong>{fmt(hecmAnnualIncome)}/yr</strong> in tenure payments — non-taxable, no monthly mortgage payment required (you stay in the home).
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                Trade-off: heirs receive less. Most useful when the home is the primary asset and the user wants to age in place.
              </div>
            </div>
          </div>
        )}

        {/* Option 3: Reduce spending */}
        {spendingCutPct > 0 && (
          <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              Reduce retirement spending
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Cutting your retirement spending by approximately <strong>{spendingCutPct}%</strong> ({fmt(retireSpending)} → {fmt(Math.round(retireSpending * (1 - spendingCutPct / 100)))}/yr) closes the cash-flow gap without touching your assets. Drag the &quot;Retirement Spending&quot; slider on My Plan to see the effect.
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                Honest about: most retirees naturally spend less in their late 70s and 80s (the &quot;slow-go&quot; and &quot;no-go&quot; phases). The default plan already models this; further cuts compound the effect.
              </div>
            </div>
          </div>
        )}

        {/* Option 4: Delay retirement / extend part-time */}
        {yearsToDelay > 0 && (
          <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              ⏰ Work {yearsToDelay} more year{yearsToDelay === 1 ? '' : 's'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Each additional working year doubles up: contributions go in instead of out, and the portfolio compounds for an extra year before drawdown begins. <strong>{yearsToDelay} more year{yearsToDelay === 1 ? '' : 's'}</strong> in full-time work — or part-time / consulting through that age — typically closes a {yearsShort}-year cash-flow gap.
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                Set up a Part-time / consulting income source (Income → + Add) to model this directly.
              </div>
            </div>
          </div>
        )}

      </div>

      <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: 8, background: 'var(--bg)', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        <strong>Pick one or combine.</strong> A common mass-affluent plan uses a mix: include RE in the plan so the score doesn&apos;t panic, dial spending back ~10% in the slow-go phase, and keep an HECM as a contingency rather than the primary lever.
      </div>
    </Card>
  );
}
