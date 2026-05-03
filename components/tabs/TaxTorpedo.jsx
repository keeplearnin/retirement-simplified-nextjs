'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt } from '@/lib/format';
import { usePlan } from '@/components/PlanProvider';
import { analyzeTaxTorpedo, sweepTaxTorpedo } from '@/lib/taxTorpedo';

export default function TaxTorpedo() {
  const { plan } = usePlan();
  const ssSource = plan.incomeSources?.find(s => s.type === 'socialSecurity');
  const pensionSource = plan.incomeSources?.find(s => s.type === 'pension');

  const [iraWithdrawal, setIraWithdrawal] = useState(20000);
  const [otherIncome, setOtherIncome] = useState(
    (pensionSource?.monthlyAmount || 0) * 12,
  );
  const [ssAnnual, setSsAnnual] = useState(
    (ssSource?.monthlyBenefit || 2500) * 12,
  );
  const filingStatus = plan.filingStatus === 'mfj' ? 'mfj' : 'single';

  const baseInput = {
    filingStatus,
    socialSecurityBenefit: ssAnnual,
    otherOrdinaryIncome: otherIncome,
    capitalGains: 0,
    stateCode: plan.stateCode || 'CA',
    age: plan.retireAge || 67,
  };

  const result = useMemo(
    () => analyzeTaxTorpedo({ ...baseInput, iraWithdrawal }),
    [iraWithdrawal, otherIncome, ssAnnual, filingStatus],
  );
  const sweep = useMemo(
    () => sweepTaxTorpedo(baseInput, 100_000, 60),
    [otherIncome, ssAnnual, filingStatus],
  );

  // Build an SVG chart of the marginal-rate sweep
  const chartW = 720, chartH = 220;
  const pad = { top: 10, right: 16, bottom: 28, left: 40 };
  const innerW = chartW - pad.left - pad.right;
  const innerH = chartH - pad.top - pad.bottom;
  const maxRate = Math.max(0.5, ...sweep.map(s => s.effectiveMarginalRate));
  const xScale = (x) => pad.left + (x / 100_000) * innerW;
  const yScale = (r) => pad.top + (1 - r / maxRate) * innerH;
  const linePath = sweep
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.withdrawal).toFixed(1)} ${yScale(p.effectiveMarginalRate).toFixed(1)}`)
    .join(' ');
  const torpedoStart = xScale(Math.max(0, result.torpedoZone.start - otherIncome - ssAnnual * 0.5));
  const torpedoEnd = xScale(Math.max(0, result.torpedoZone.end - otherIncome - ssAnnual * 0.5));

  // Cursor for current withdrawal
  const cursorX = xScale(iraWithdrawal);
  const cursorY = yScale(result.effectiveMarginalRate);

  return (
    <div>
      <InfoBox icon="🚀" title="When pulling from your IRA spikes your tax rate" color="var(--purple)" bgColor="rgba(139,92,246,0.08)">
        <strong>The short version:</strong> in retirement, every $1 you withdraw from a 401(k) or traditional IRA can drag $0.50–$0.85 of your Social Security check into taxable income too. In that zone, your <em>effective</em> marginal rate spikes to 40%+ even while you're nominally in the 22% federal bracket. The industry calls it the <strong>Social Security Tax Torpedo</strong>. Move the slider below to see where your numbers fall.
      </InfoBox>

      <Card style={{ marginTop: 16 }}>
        <SectionLabel>Inputs</SectionLabel>
        <Slider
          label="IRA / 401(k) Withdrawal"
          value={iraWithdrawal} onChange={setIraWithdrawal}
          min={0} max={100000} step={1000} format={fmt}
        />
        <Slider
          label="Other Ordinary Income (pension, salary, etc.)"
          value={otherIncome} onChange={setOtherIncome}
          min={0} max={100000} step={1000} format={fmt}
        />
        <Slider
          label="Annual Social Security Benefit"
          value={ssAnnual} onChange={setSsAnnual}
          min={0} max={60000} step={500} format={fmt}
        />
      </Card>

      <div className="stats-row" style={{ display: 'flex', gap: 12, marginTop: 14 }}>
        <Stat
          icon="📊"
          label="Effective Marginal Rate"
          value={`${(result.effectiveMarginalRate * 100).toFixed(1)}%`}
          sub="On next $1,000 of withdrawal"
          color={result.inTorpedoZone ? 'var(--danger)' : 'var(--accent)'}
        />
        <Stat
          icon="💵"
          label="Taxable SS"
          value={`${result.ssTaxablePercent}%`}
          sub={`of ${fmt(ssAnnual)} in ${result.ssTaxablePercent === 0 ? 'no' : 'taxable'} base`}
          color="var(--blue)"
        />
        <Stat
          icon="📈"
          label="Provisional Income"
          value={fmt(result.provisionalIncome)}
          sub={`Threshold: ${fmt(result.torpedoZone.end)}`}
          color="var(--text-muted)"
        />
      </div>

      <Card style={{ marginTop: 14 }}>
        <SectionLabel>Marginal Rate vs. IRA Withdrawal</SectionLabel>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
          Red shaded zone = torpedo region for your filing status (provisional income between {fmt(result.torpedoZone.start)} and {fmt(result.torpedoZone.end)}).
        </div>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Y-axis grid */}
          {[0, 0.1, 0.2, 0.3, 0.4, 0.5].filter(r => r <= maxRate).map((r, i) => (
            <g key={i}>
              <line x1={pad.left} y1={yScale(r)} x2={chartW - pad.right} y2={yScale(r)} stroke="var(--border)" strokeWidth={0.5} />
              <text x={pad.left - 6} y={yScale(r) + 3} textAnchor="end" fill="var(--text-muted)" fontSize={9}>
                {(r * 100).toFixed(0)}%
              </text>
            </g>
          ))}
          {/* Torpedo zone shading */}
          {torpedoEnd > torpedoStart && (
            <rect
              x={Math.max(pad.left, torpedoStart)}
              y={pad.top}
              width={Math.min(chartW - pad.right, torpedoEnd) - Math.max(pad.left, torpedoStart)}
              height={innerH}
              fill="rgba(239,68,68,0.12)"
            />
          )}
          {/* Marginal-rate line */}
          <path d={linePath} stroke="var(--purple)" strokeWidth={2} fill="none" />
          {/* Cursor for current withdrawal */}
          <line x1={cursorX} y1={pad.top} x2={cursorX} y2={chartH - pad.bottom} stroke="var(--accent)" strokeWidth={1} strokeDasharray="3,2" />
          <circle cx={cursorX} cy={cursorY} r={4} fill="var(--accent)" stroke="var(--bg)" strokeWidth={1.5} />
          {/* X-axis labels */}
          {[0, 25000, 50000, 75000, 100000].map((x, i) => (
            <text key={i} x={xScale(x)} y={chartH - 8} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>
              {fmt(x)}
            </text>
          ))}
          <text x={chartW / 2} y={chartH - 1} textAnchor="middle" fill="var(--text-dim)" fontSize={9}>
            IRA/401(k) Withdrawal
          </text>
        </svg>
      </Card>

      {result.inTorpedoZone && (
        <InfoBox icon="⚠️" title="You're in the torpedo zone" color="var(--danger)" bgColor="rgba(239,68,68,0.08)" style={{ marginTop: 14 }}>
          At your current withdrawal of {fmt(iraWithdrawal)}, the next $1,000 of IRA money costs {fmt(Math.round(1000 * result.effectiveMarginalRate))} in extra tax — an effective rate of {(result.effectiveMarginalRate * 100).toFixed(1)}%. Strategies to consider: Roth conversions in low-income years before claiming SS, drawing from taxable accounts first, or partial-year withdrawals timed around income.
        </InfoBox>
      )}
    </div>
  );
}
