'use client';

import { useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import Slider from '@/components/ui/Slider';
import SectionLabel from '@/components/ui/SectionLabel';
import CalcShell from '@/components/calculators/CalcShell';
import { analyzeTaxTorpedo, sweepTaxTorpedo } from '@/lib/taxTorpedo';
import { fmt } from '@/lib/format';

export default function TaxTorpedoCalc() {
  const [filingStatus, setFilingStatus] = useState('single');
  const [ssAnnual, setSsAnnual] = useState(30000);
  const [otherIncome, setOtherIncome] = useState(10000);
  const [withdrawal, setWithdrawal] = useState(20000);

  const base = useMemo(() => ({
    filingStatus,
    socialSecurityBenefit: ssAnnual,
    otherOrdinaryIncome: otherIncome,
    capitalGains: 0,
    stateCode: 'TX', // federal-only view for the standalone calculator
    age: 68,
  }), [filingStatus, ssAnnual, otherIncome]);

  const result = useMemo(() => analyzeTaxTorpedo({ ...base, iraWithdrawal: withdrawal }), [base, withdrawal]);
  const sweep = useMemo(() => sweepTaxTorpedo(base, 80000, 40), [base]);

  const maxRate = Math.max(...sweep.map((p) => p.effectiveMarginalRate), 0.01);
  const peak = sweep.reduce((a, b) => (b.effectiveMarginalRate > a.effectiveMarginalRate ? b : a));

  return (
    <CalcShell
      slug="tax-torpedo"
      title="Social Security Tax Torpedo Calculator"
      intro="In a specific income window, every extra $1 you withdraw from an IRA drags up to $0.85 of your Social Security into taxable income too — so your real marginal tax rate can hit 40%+ while you think you're in the 12% or 22% bracket. See exactly where the torpedo zone sits for your numbers."
    >
      <Card>
        <SectionLabel>Your Inputs</SectionLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['single', 'Single'], ['mfj', 'Married filing jointly']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilingStatus(val)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                border: filingStatus === val ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: filingStatus === val ? 'var(--accent-dim, rgba(16,185,129,0.08))' : 'transparent',
                color: filingStatus === val ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--sans)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <Slider label="Annual Social Security benefit (gross)" value={ssAnnual} onChange={setSsAnnual} min={12000} max={70000} step={1000} format={fmt} />
        <Slider label="Other ordinary income (pension, part-time, interest)" value={otherIncome} onChange={setOtherIncome} min={0} max={80000} step={1000} format={fmt} />
        <Slider label="IRA / 401(k) withdrawal this year" value={withdrawal} onChange={setWithdrawal} min={0} max={80000} step={1000} format={fmt} />
      </Card>

      <div className="stats-row" style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <Stat
          icon={result.inTorpedoZone ? '🚨' : '🎯'}
          label="Effective Marginal Rate"
          value={`${(result.effectiveMarginalRate * 100).toFixed(1)}%`}
          sub="Federal tax on your NEXT $1,000 withdrawn"
          color={result.inTorpedoZone ? 'var(--danger)' : 'var(--accent)'}
        />
        <Stat
          icon="🧾"
          label="SS Currently Taxable"
          value={`${result.ssTaxablePercent}%`}
          sub={`Provisional income: ${fmt(Math.round(result.provisionalIncome))}`}
          color="var(--blue)"
        />
        <Stat
          icon="🌊"
          label="Peak Torpedo Rate"
          value={`${(peak.effectiveMarginalRate * 100).toFixed(1)}%`}
          sub={`At ~${fmt(Math.round(peak.withdrawal))} withdrawn`}
          color="var(--warn)"
        />
      </div>

      {result.inTorpedoZone && (
        <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--danger)', background: 'rgba(239,68,68,0.06)', fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--danger)' }}>You&apos;re in the torpedo zone.</strong>{' '}
          Each extra dollar withdrawn is also making Social Security taxable, compounding the rate. Escape routes:
          spend from Roth or taxable accounts at the margin, or do Roth conversions in years <em>before</em> you claim SS.
        </div>
      )}

      {/* Marginal-rate curve */}
      <Card style={{ marginTop: 16 }}>
        <SectionLabel>Effective Marginal Rate vs. IRA Withdrawal</SectionLabel>
        <svg viewBox="0 0 600 200" style={{ width: '100%', height: 'auto', display: 'block' }}>
          {[0.1, 0.2, 0.3, 0.4].map((rate) => {
            const y = 175 - (rate / Math.max(maxRate, 0.45)) * 160;
            return (
              <g key={rate}>
                <line x1={45} y1={y} x2={590} y2={y} stroke="var(--border)" strokeWidth={0.5} />
                <text x={40} y={y + 3} textAnchor="end" fill="var(--text-dim)" fontSize={9}>{Math.round(rate * 100)}%</text>
              </g>
            );
          })}
          <path
            d={sweep.map((p, i) => {
              const x = 45 + (i / (sweep.length - 1)) * 545;
              const y = 175 - (Math.max(0, p.effectiveMarginalRate) / Math.max(maxRate, 0.45)) * 160;
              return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ')}
            fill="none" stroke="var(--danger)" strokeWidth={2.5}
          />
          {(() => {
            const i = Math.round((withdrawal / 80000) * (sweep.length - 1));
            const p = sweep[Math.min(i, sweep.length - 1)];
            const x = 45 + (Math.min(i, sweep.length - 1) / (sweep.length - 1)) * 545;
            const y = 175 - (Math.max(0, p.effectiveMarginalRate) / Math.max(maxRate, 0.45)) * 160;
            return <circle cx={x} cy={y} r={5} fill="var(--accent)" stroke="var(--bg, #fff)" strokeWidth={2} />;
          })()}
          {[0, 20000, 40000, 60000, 80000].map((w) => (
            <text key={w} x={45 + (w / 80000) * 545} y={195} textAnchor="middle" fill="var(--text-dim)" fontSize={9}>{fmt(w)}</text>
          ))}
        </svg>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.6 }}>
          The dot is your current withdrawal. The hump is the torpedo: the range where SS taxability stacks on top of
          your bracket. Federal only; 2026 brackets and the never-indexed 1983 provisional-income thresholds
          ({fmt(result.torpedoZone.start)} / {fmt(result.torpedoZone.end)} for your filing status).
        </p>
      </Card>
    </CalcShell>
  );
}
