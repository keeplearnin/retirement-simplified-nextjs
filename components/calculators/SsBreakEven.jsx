'use client';

import { useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import Slider from '@/components/ui/Slider';
import SectionLabel from '@/components/ui/SectionLabel';
import CalcShell from '@/components/calculators/CalcShell';
import { compareClaimingAges, SS_FRA } from '@/lib/ssClaiming';
import { fmt } from '@/lib/format';

export default function SsBreakEven() {
  const [fraMonthly, setFraMonthly] = useState(2500);
  const [longevity, setLongevity] = useState(90);

  const { options, best } = useMemo(
    () => compareClaimingAges({ fraMonthlyBenefit: fraMonthly, longevityAge: longevity }),
    [fraMonthly, longevity]
  );

  const at62 = options.find((o) => o.claimAge === 62);
  const at70 = options.find((o) => o.claimAge === 70);

  return (
    <CalcShell
      slug="social-security-break-even"
      title="Social Security Break-Even Calculator: Claim at 62, 67, or 70?"
      intro="Claiming at 62 means smaller checks for more years; waiting until 70 means 24% larger checks (vs FRA) for fewer years. The break-even age is where waiting overtakes claiming early — and whether you'll reach it depends on how long you expect to live. Enter your benefit and see every age side by side."
    >
      <Card>
        <SectionLabel>Your Inputs</SectionLabel>
        <Slider label="Monthly benefit at Full Retirement Age (67)" value={fraMonthly} onChange={setFraMonthly} min={800} max={5000} step={50} format={fmt} />
        <Slider label="Planning to age (longevity)" value={longevity} onChange={setLongevity} min={75} max={100} suffix=" yrs" />
      </Card>

      <div className="stats-row" style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <Stat
          label="Best Claiming Age"
          value={`Age ${best.claimAge}`}
          sub={`${fmt(best.lifetimeToLongevity)} lifetime to ${longevity}`}
          color="var(--accent)"
        />
        <Stat
          label="62 vs 70 Difference"
          value={fmt(Math.abs(at70.lifetimeToLongevity - at62.lifetimeToLongevity))}
          sub={at70.lifetimeToLongevity > at62.lifetimeToLongevity ? 'Waiting until 70 collects more' : 'Claiming at 62 collects more'}
          color="var(--blue)"
        />
        <Stat
          label="Check Size: 62 → 70"
          value={`${fmt(at62.monthlyBenefit)} → ${fmt(at70.monthlyBenefit)}`}
          sub="Monthly benefit range"
          color="var(--warn)"
        />
      </div>

      <Card style={{ marginTop: 16 }}>
        <SectionLabel>Every Claiming Age Compared</SectionLabel>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520, fontFamily: 'var(--sans)', fontSize: 13 }}>
            <thead>
              <tr>
                {['Claim at', 'Monthly check', '% of FRA', `Lifetime to ${longevity}`, 'Break-even vs 67'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: i === 0 ? '8px 12px 8px 0' : '8px 0 8px 12px', fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {options.map((o) => {
                const isBest = o.claimAge === best.claimAge;
                return (
                  <tr key={o.claimAge} style={{ borderTop: '1px solid var(--border)', background: isBest ? 'var(--accent-dim, rgba(16,185,129,0.07))' : 'transparent' }}>
                    <td style={{ padding: '9px 12px 9px 0', fontWeight: isBest ? 700 : 500, color: 'var(--text)' }}>
                      {o.claimAge}{o.claimAge === SS_FRA ? ' (FRA)' : ''}{isBest ? ' ' : ''}
                    </td>
                    <td style={{ textAlign: 'right', padding: '9px 0 9px 12px', color: 'var(--text)' }}>{fmt(o.monthlyBenefit)}</td>
                    <td style={{ textAlign: 'right', padding: '9px 0 9px 12px', color: 'var(--text-muted)' }}>{Math.round(o.factor * 100)}%</td>
                    <td style={{ textAlign: 'right', padding: '9px 0 9px 12px', fontWeight: 600, color: isBest ? 'var(--accent)' : 'var(--text)' }}>{fmt(o.lifetimeToLongevity)}</td>
                    <td style={{ textAlign: 'right', padding: '9px 0 9px 12px', color: 'var(--text-dim)' }}>
                      {o.breakevenAgeVsFRA ? `age ${o.breakevenAgeVsFRA}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.6 }}>
          Assumes FRA of 67 (born 1960+), 2% COLA, and SSA&apos;s statutory early-claiming reductions and delayed
          credits. Ignores taxes, spousal/survivor benefits, and the bridge-year withdrawals a real plan needs —
          the full planner models all of those together.
        </p>
      </Card>
    </CalcShell>
  );
}
