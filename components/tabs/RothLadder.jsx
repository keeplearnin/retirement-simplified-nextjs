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

  // Build the input once — the active result reuses it, the optimizer sweeps
  // the targetBracket value across BRACKETS to find the highest-savings option.
  const baseInput = useMemo(() => ({
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
    conversionStartAge,
    conversionEndAge,
  }), [plan, filingStatus, tradBalance, rothBalance, ssSource, pensionSource, conversionStartAge, conversionEndAge]);

  const result = useMemo(() =>
    modelRothLadder({ ...baseInput, targetBracket }),
    [baseInput, targetBracket],
  );

  // Optimizer: run every conversion target bracket and surface the winner.
  // Reviewer feedback: "Tax Torpedo shows you the problem but doesn't help
  // you solve it." The recommendation closes that loop — instead of asking
  // the user which bracket to fill, we tell them.
  const optimizer = useMemo(() => {
    const candidates = BRACKETS.filter(b => b.value > 0).map(b => {
      const r = modelRothLadder({ ...baseInput, targetBracket: b.value });
      return { value: b.value, label: b.label, taxSaved: r.taxSaved, irmaaTrippedYears: r.irmaaTrippedAges?.length || 0 };
    });
    candidates.sort((a, b) => b.taxSaved - a.taxSaved);
    const best = candidates[0];
    // Recommend "Off" if even the best bracket loses money — the user is
    // already in a low-enough future bracket that conversions don't help.
    if (!best || best.taxSaved <= 0) {
      return { recommended: 0, label: 'Off', taxSaved: 0, candidates };
    }
    return { recommended: best.value, label: best.label, taxSaved: best.taxSaved, irmaaTrippedYears: best.irmaaTrippedYears, candidates };
  }, [baseInput]);

  const taxSavedColor = result.taxSaved > 1000 ? 'var(--accent)'
    : result.taxSaved < -1000 ? 'var(--danger)'
    : 'var(--text-muted)';
  const isWorthwhile = result.taxSaved > 0 && targetBracket > 0;

  return (
    <div>
      <InfoBox title="Roth Conversion Ladder" color="var(--purple)" bgColor="rgba(139,92,246,0.08)">
        Between retirement and age 73 (when RMDs begin), you can convert traditional 401(k)/IRA dollars to Roth — paying tax now to avoid forced withdrawals at higher rates later. This planner shows whether filling a target bracket each year actually saves money over a lifetime.
      </InfoBox>

      {/* Optimizer recommendation — runs every bracket, recommends the winner.
          Closes the loop the Tax Torpedo / Roth Ladder pair otherwise leaves
          open ("you've shown me the problem; what's the optimal answer?"). */}
      {optimizer.recommended === 0 ? (
        <InfoBox title="Optimizer: skip conversions for your situation" color="var(--text-muted)" bgColor="var(--bg2)" style={{ marginTop: 14 }}>
          We ran every target bracket (12%, 22%, 24%, 32%) against your numbers and none of them save money over the baseline. Your projected retirement income is modest enough that future RMDs stay in the 10–12% bracket — paying 22%+ today to convert is a net loss. The math is doing you a favor here: keep the dollars in the traditional account and let them compound.
        </InfoBox>
      ) : (
        <InfoBox title={`Optimizer recommends filling the ${optimizer.label} bracket — saves ${fmt(optimizer.taxSaved)} lifetime`} color="var(--purple)" bgColor="rgba(139,92,246,0.10)" style={{ marginTop: 14 }}>
          <div style={{ marginBottom: 8 }}>
            We ran your numbers against every target bracket. Filling the <strong>{optimizer.label}</strong> bracket each year between ages {conversionStartAge} and {conversionEndAge} produces the largest lifetime tax saving.
            {optimizer.irmaaTrippedYears > 0 && (
              <> Note: this strategy crosses an IRMAA threshold in {optimizer.irmaaTrippedYears} year{optimizer.irmaaTrippedYears === 1 ? '' : 's'} — surfaced in the IRMAA banner below.</>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
            {optimizer.candidates.map(c => (
              <span key={c.value} style={{
                padding: '4px 8px', borderRadius: 6,
                background: c.value === optimizer.recommended ? 'var(--purple)' : 'var(--bg)',
                color: c.value === optimizer.recommended ? '#fff' : c.taxSaved > 0 ? 'var(--accent)' : 'var(--text-dim)',
                fontWeight: c.value === optimizer.recommended ? 700 : 500,
              }}>
                {c.label}: {c.taxSaved >= 0 ? '+' : ''}{fmt(c.taxSaved)}
              </span>
            ))}
            {targetBracket !== optimizer.recommended && (
              <button
                onClick={() => setTargetBracket(optimizer.recommended)}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none',
                  background: 'var(--purple)', color: '#fff',
                  fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)', cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                Apply ({optimizer.label})
              </button>
            )}
          </div>
        </InfoBox>
      )}

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
          label="Lifetime tax saved"
          value={result.taxSaved >= 0 ? `+${fmt(result.taxSaved)}` : fmt(result.taxSaved)}
          sub={targetBracket === 0 ? 'No conversions configured' : `${result.conversionWindowYears} years of conversions`}
          color={taxSavedColor}
        />
        <Stat
          label="Total converted"
          value={fmt(result.ladderConversionTotal)}
          sub="From Traditional → Roth"
          color="var(--blue)"
        />
        <Stat
          label="RMD at 73"
          value={`${fmt(result.ladder.rmdAt73)}`}
          sub={`Was ${fmt(result.baseline.rmdAt73)} without ladder`}
          color="var(--text-muted)"
        />
      </div>

      {/* Plain-English interpretation of the headline result. The stat block
          above shows the raw dollar number, but a negative value with no
          context (tester report: "-$27,833 with zero context") reads as
          either a bug or a scam. This banner translates the math. */}
      {targetBracket > 0 && (() => {
        const saved = result.taxSaved;
        if (saved > 1000) {
          return (
            <InfoBox title={`This ladder saves you ${fmt(saved)} over your lifetime`} color="var(--accent)" bgColor="var(--accent-dim)" style={{ marginTop: 14 }}>
              Converting Traditional dollars to Roth at today's {result.targetBracketLabel || `${targetBracket}%`} bracket beats paying tax on those dollars later — your projection has them taxed at a higher rate down the road (RMDs stacked with Social Security, possibly with IRMAA). Locking in the lower rate now is the win.
            </InfoBox>
          );
        }
        if (saved < -1000) {
          return (
            <InfoBox title={`This ladder costs you ${fmt(Math.abs(saved))} — skip it or lower the target bracket`} color="var(--warn)" bgColor="var(--warn-dim)" style={{ marginTop: 14 }}>
              The ladder is paying tax now at the {result.targetBracketLabel || `${targetBracket}%`} bracket on dollars that would have been taxed at a <em>lower</em> rate later. That happens when your retirement income is modest enough to keep you in the 10–12% bracket without conversions, so paying 22%+ today to convert is a net loss. Try a lower target bracket (12% or "no conversions"), or accept that conversions don't help your situation. This isn't a bug — it's the math telling you the strategy doesn't fit.
            </InfoBox>
          );
        }
        return (
          <InfoBox icon="ℹ" title="Ladder is roughly tax-neutral for your situation" color="var(--blue)" bgColor="var(--blue-dim)" style={{ marginTop: 14 }}>
            Converting at today's bracket and paying that tax later land in roughly the same place for your projection. Conversions can still help for non-tax reasons (no RMDs at 73, more flexibility for heirs), but the headline lifetime-tax number is close to zero either way.
          </InfoBox>
        );
      })()}

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
        <InfoBox title="IRMAA tripped by conversions" color="var(--warn)" bgColor="rgba(251,191,36,0.08)" style={{ marginTop: 14 }}>
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
