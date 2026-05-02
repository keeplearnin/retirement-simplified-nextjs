'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt } from '@/lib/format';
import { usePlan } from '@/components/PlanProvider';
import { modelRothLadder } from '@/lib/rothConversion';

const BRACKETS = [
  { value: 0,  label: 'Off',  desc: 'No conversion (baseline)' },
  { value: 12, label: '12%',  desc: 'Fill the 12% bracket' },
  { value: 22, label: '22%',  desc: 'Fill the 22% bracket' },
  { value: 24, label: '24%',  desc: 'Fill the 24% bracket' },
  { value: 32, label: '32%',  desc: 'Fill the 32% bracket' },
];

export default function RothLadder() {
  const { plan } = usePlan();
  const filingStatus = plan.filingStatus === 'mfj' ? 'mfj' : 'single';
  const ssSource = plan.incomeSources?.find(s => s.type === 'socialSecurity' && (s.owner || 'primary') === 'primary');
  const pensionSource = plan.incomeSources?.find(s => s.type === 'pension' && (s.owner || 'primary') === 'primary');

  // Trad balance combines 401k + pension pot (both tax-deferred); plus spouse if applicable.
  const tradBalance = (plan.savings401k || 0)
    + (plan.savingsPension || 0)
    + (plan.hasSpouse ? (plan.spouseSavings401k || 0) + (plan.spouseSavingsPension || 0) : 0);
  const rothBalance = (plan.savingsRoth || 0)
    + (plan.hasSpouse ? (plan.spouseSavingsRoth || 0) : 0);

  // Strategy controls
  const [targetBracket, setTargetBracket] = useState(22);
  const [conversionStartAge, setConversionStartAge] = useState(plan.retireAge || 65);
  // Default end at 72 (year before RMD start).
  const [conversionEndAge, setConversionEndAge] = useState(Math.min(72, (plan.longevityAge || 95) - 1));

  const result = useMemo(() => modelRothLadder({
    currentAge: plan.currentAge,
    retireAge: plan.retireAge,
    longevityAge: plan.longevityAge,
    tradBalance,
    rothBalance,
    expectedReturn: (plan.expectedReturn || 7) / 100,
    retiredReturnPct: (plan.retiredReturnPct || 60) / 100,
    filingStatus,
    stateCode: plan.stateCode || 'CA',
    ssMonthlyBenefit: ssSource?.monthlyBenefit || 0,
    ssStartAge: ssSource?.startAge || 67,
    pensionMonthlyAmount: pensionSource?.monthlyAmount,
    pensionStartAge: pensionSource?.startAge,
    targetBracket,
    conversionStartAge,
    conversionEndAge,
  }), [plan, filingStatus, tradBalance, rothBalance, ssSource, pensionSource, targetBracket, conversionStartAge, conversionEndAge]);

  const taxSavedColor = result.taxSaved > 1000 ? 'var(--accent)'
    : result.taxSaved < -1000 ? 'var(--danger)'
    : 'var(--text-muted)';
  const isWorthwhile = result.taxSaved > 0 && targetBracket > 0;

  return (
    <div>
      <InfoBox icon="🪜" title="Roth Conversion Ladder" color="var(--purple)" bgColor="rgba(139,92,246,0.08)">
        Between retirement and age 73 (when RMDs begin), you can convert traditional 401(k)/IRA dollars to Roth — paying tax now to avoid forced withdrawals at higher rates later. This planner shows whether filling a target bracket each year actually saves money over a lifetime.
      </InfoBox>

      <Card style={{ marginTop: 16 }}>
        <SectionLabel>Strategy</SectionLabel>
        <div style={{ marginBottom: 14, fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
          Target bracket to fill
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {BRACKETS.map(b => (
            <button
              key={b.value}
              onClick={() => setTargetBracket(b.value)}
              title={b.desc}
              style={{
                flex: '1 1 90px', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                border: targetBracket === b.value ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: targetBracket === b.value ? 'var(--accent-dim)' : 'transparent',
                color: targetBracket === b.value ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: targetBracket === b.value ? 700 : 500, fontSize: 13, fontFamily: 'var(--sans)',
                transition: 'all .15s',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
        <Slider
          label="Conversion start age"
          value={conversionStartAge} onChange={setConversionStartAge}
          min={plan.currentAge} max={Math.min(80, conversionEndAge)}
        />
        <Slider
          label="Conversion end age"
          value={conversionEndAge} onChange={setConversionEndAge}
          min={Math.max(conversionStartAge, plan.currentAge)} max={Math.min((plan.longevityAge || 95) - 1, 80)}
        />
        <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, background: 'var(--bg2)', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--sans)' }}>
          The conversion window typically opens at retirement and closes the year before RMDs start (age 73). After that, RMDs force withdrawals so converting on top is rarely worthwhile.
        </div>
      </Card>

      {/* Headline outcome */}
      <div className="stats-row" style={{ display: 'flex', gap: 12, marginTop: 14 }}>
        <Stat
          icon="💰"
          label="Lifetime tax saved"
          value={result.taxSaved >= 0 ? `+${fmt(result.taxSaved)}` : fmt(result.taxSaved)}
          sub={targetBracket === 0 ? 'No conversions configured' : `${result.conversionWindowYears} years of conversions`}
          color={taxSavedColor}
        />
        <Stat
          icon="📦"
          label="Total converted"
          value={fmt(result.ladderConversionTotal)}
          sub="From Traditional → Roth"
          color="var(--blue)"
        />
        <Stat
          icon="📉"
          label="RMD at 73"
          value={`${fmt(result.ladder.rmdAt73)}`}
          sub={`Was ${fmt(result.baseline.rmdAt73)} without ladder`}
          color="var(--text-muted)"
        />
      </div>

      {/* Side-by-side scenario summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <ScenarioCard
          title="Without ladder"
          accent="var(--text-muted)"
          lifetimeTax={result.baseline.lifetimeTax}
          finalBalance={result.baseline.finalBalance}
          rmdAt73={result.baseline.rmdAt73}
        />
        <ScenarioCard
          title="With ladder"
          accent={isWorthwhile ? 'var(--accent)' : 'var(--warn)'}
          lifetimeTax={result.ladder.lifetimeTax}
          finalBalance={result.ladder.finalBalance}
          rmdAt73={result.ladder.rmdAt73}
          highlight={isWorthwhile}
        />
      </div>

      {/* IRMAA warning */}
      {result.irmaaTrippedAges.length > 0 && (
        <InfoBox icon="⚠️" title="IRMAA tripped by conversions" color="var(--warn)" bgColor="rgba(251,191,36,0.08)" style={{ marginTop: 14 }}>
          The ladder pushes MAGI above an IRMAA threshold in {result.irmaaTrippedAges.length} year{result.irmaaTrippedAges.length === 1 ? '' : 's'} (ages: {result.irmaaTrippedAges.slice(0, 6).join(', ')}{result.irmaaTrippedAges.length > 6 ? '…' : ''}). Each Medicare beneficiary pays a higher Part B premium for two years after each high-income year. Consider stopping conversions a couple of years before age 65 to avoid the two-year lookback hitting Medicare premiums.
        </InfoBox>
      )}

      {/* Year-by-year detail */}
      <Card style={{ marginTop: 14 }}>
        <SectionLabel>Year-by-year (ladder scenario)</SectionLabel>
        <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--sans)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Age', 'Ordinary Income', 'Conversion', 'RMD', 'Total Tax', 'Trad End', 'Roth End', 'IRMAA'].map(h => (
                  <th key={h} style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10, position: 'sticky', top: 0, background: 'var(--card)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.ladder.years.map(r => (
                <tr key={r.age} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text)' }}>{r.age}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>{r.ordinaryIncome > 0 ? fmt(r.ordinaryIncome) : '—'}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: r.conversion > 0 ? 'var(--purple)' : 'var(--text-dim)', fontWeight: r.conversion > 0 ? 600 : 400 }}>
                    {r.conversion > 0 ? fmt(r.conversion) : '—'}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: r.rmd > 0 ? 'var(--warn)' : 'var(--text-dim)' }}>
                    {r.rmd > 0 ? fmt(r.rmd) : '—'}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>{r.totalTax > 0 ? fmt(r.totalTax) : '—'}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(r.tradBalanceEnd)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--accent)' }}>{fmt(r.rothBalanceEnd)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: r.triggersIrmaa ? 'var(--danger)' : 'var(--text-dim)' }}>
                    {r.triggersIrmaa ? 'yes' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--bg2)', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, fontStyle: 'italic' }}>
        Simplifying assumptions: portfolio grows at retirement-allocation rate (60% of pre-retirement return by default); SS COLA = 2.5%/yr; conversions are taxed at the marginal rate of the year they happen; ACA subsidy clawback (pre-65) is not yet modeled — if you're between retirement and 65 and counting on subsidies, conversions can erase them.
      </div>
    </div>
  );
}

function ScenarioCard({ title, accent, lifetimeTax, finalBalance, rmdAt73, highlight }) {
  return (
    <Card style={{ borderLeft: `3px solid ${accent}`, background: highlight ? 'rgba(52,211,153,0.04)' : undefined }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Lifetime tax</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: accent }}>{fmt(lifetimeTax)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Final balance</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{fmt(finalBalance)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>RMD at 73</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>{fmt(rmdAt73)}</div>
        </div>
      </div>
    </Card>
  );
}
