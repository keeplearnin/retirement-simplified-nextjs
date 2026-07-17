'use client';

import { useState, useMemo, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import Slider from '@/components/ui/Slider';
import FormInput from '@/components/ui/FormInput';
import FormSelect from '@/components/ui/FormSelect';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt } from '@/lib/format';
import { useLocalState } from '@/lib/useLocalState';
import { usePlan, getTotalSavings } from '@/components/PlanProvider';
import { computeTax } from '@/lib/taxEngine';
import {
  projectVesting,
  analyzeRSU,
  analyzeISO,
  analyzeESPP,
  concentrationRisk,
  summarizeEquity,
} from '@/lib/equityComp';

/* ── Grant type metadata ──────────────────────────────────── */
const GRANT_META = {
  rsu: { label: 'RSU', full: 'Restricted Stock Units', color: 'var(--accent)' },
  iso: { label: 'ISO', full: 'Incentive Stock Options', color: 'var(--purple)' },
  nso: { label: 'NSO', full: 'Non-Qualified Options', color: 'var(--blue)' },
  espp: { label: 'ESPP', full: 'Employee Stock Purchase Plan', color: 'var(--warn)' },
};

const THIS_YEAR = new Date().getFullYear();

function defaultGrant(type) {
  const base = {
    id: crypto.randomUUID(),
    type,
    label: `${GRANT_META[type].label} grant`,
    grantDate: `${THIS_YEAR}-01-01`,
    shares: type === 'espp' ? 200 : 4000,
    grantPrice: 40,
  };
  if (type === 'iso' || type === 'nso') {
    return { ...base, strikePrice: 40, vestYears: 4, cliffMonths: 12, vestFrequency: 'monthly' };
  }
  if (type === 'espp') {
    return { ...base, discountPct: 15, lookback: true, offeringPrice: 40 };
  }
  return { ...base, vestYears: 4, cliffMonths: 12, vestFrequency: 'monthly' };
}

const RISK_COLOR = {
  low: 'var(--accent)',
  moderate: 'var(--blue)',
  high: 'var(--warn)',
  severe: 'var(--danger)',
};

/* ── Editable grant card ──────────────────────────────────── */
function GrantCard({ grant, market, onChange, onRemove }) {
  const meta = GRANT_META[grant.type];
  const set = (k, v) => onChange({ ...grant, [k]: v });
  const isOption = grant.type === 'iso' || grant.type === 'nso';
  const isEspp = grant.type === 'espp';

  const events = projectVesting(grant, market);
  const totalValue = events.reduce((s, e) => s + e.value, 0);

  return (
    <Card variant="input" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', padding: '2px 8px',
            borderRadius: 999, color: meta.color, border: `1px solid ${meta.color}`,
          }}>{meta.label}</span>
          <FormInput value={grant.label} onChange={v => set('label', v)} style={{ width: 180, padding: '4px 8px' }} />
        </div>
        <button onClick={onRemove} className="dim f12" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <label className="f11 dim upcase">
          {isEspp ? 'Shares purchased' : 'Total shares'}
          <FormInput type="number" value={grant.shares} onChange={v => set('shares', +v || 0)} style={{ marginTop: 4 }} />
        </label>

        {isOption && (
          <label className="f11 dim upcase">
            Strike price
            <FormInput type="number" value={grant.strikePrice} onChange={v => set('strikePrice', +v || 0)} style={{ marginTop: 4 }} />
          </label>
        )}

        <label className="f11 dim upcase">
          {isEspp ? 'Purchase date' : 'Grant date'}
          <FormInput type="date" value={grant.grantDate} onChange={v => set('grantDate', v)} style={{ marginTop: 4 }} />
        </label>

        {isEspp ? (
          <>
            <label className="f11 dim upcase">
              Discount %
              <FormInput type="number" value={grant.discountPct} onChange={v => set('discountPct', +v || 0)} style={{ marginTop: 4 }} />
            </label>
            <label className="f11 dim upcase">
              Offering-start price
              <FormInput type="number" value={grant.offeringPrice} onChange={v => set('offeringPrice', +v || 0)} style={{ marginTop: 4 }} />
            </label>
            <label className="f11 dim upcase" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              Lookback
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={!!grant.lookback} onChange={e => set('lookback', e.target.checked)} />
                <span className="f12 muted" style={{ textTransform: 'none', letterSpacing: 0 }}>Price off lower of offer/purchase</span>
              </span>
            </label>
          </>
        ) : (
          <>
            <label className="f11 dim upcase">
              Vest years
              <FormInput type="number" value={grant.vestYears} onChange={v => set('vestYears', +v || 0)} style={{ marginTop: 4 }} />
            </label>
            <label className="f11 dim upcase">
              Cliff (months)
              <FormInput type="number" value={grant.cliffMonths} onChange={v => set('cliffMonths', +v || 0)} style={{ marginTop: 4 }} />
            </label>
            <label className="f11 dim upcase">
              Vest cadence
              <FormSelect value={grant.vestFrequency} onChange={v => set('vestFrequency', v)}
                options={[{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'annual', label: 'Annual' }]}
                style={{ marginTop: 4, width: '100%' }} />
            </label>
          </>
        )}
      </div>

      <div className="f12 dim" style={{ marginTop: 12 }}>
        {isEspp
          ? `Projected value at current price: ${fmt(totalValue)}`
          : `${events.length} tranche${events.length !== 1 ? 's' : ''} · projected total value ${fmt(totalValue)} at ${market.annualGrowth >= 0 ? '+' : ''}${(market.annualGrowth * 100).toFixed(0)}%/yr`}
      </div>
    </Card>
  );
}

/* ── Vesting timeline (income by calendar year) ───────────── */
function VestingTimeline({ summary }) {
  const byYear = useMemo(() => {
    const m = new Map();
    for (const e of summary.vestEvents) {
      if (e.vested) continue; // future income only
      m.set(e.year, (m.get(e.year) || 0) + e.value);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).slice(0, 8);
  }, [summary]);

  if (byYear.length === 0) return null;
  const max = Math.max(...byYear.map(([, v]) => v));
  const W = 720, H = 220, pad = { top: 16, right: 16, bottom: 34, left: 56 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const barW = innerW / byYear.length * 0.6;
  const gap = innerW / byYear.length;

  return (
    <Card style={{ marginTop: 16 }}>
      <SectionLabel>Upcoming vesting income by year</SectionLabel>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {[0, 0.5, 1].map(f => {
          const y = pad.top + innerH * (1 - f);
          return (
            <g key={f}>
              <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={pad.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-dim)">{fmt(max * f)}</text>
            </g>
          );
        })}
        {byYear.map(([year, val], i) => {
          const h = max > 0 ? (val / max) * innerH : 0;
          const x = pad.left + gap * i + (gap - barW) / 2;
          const y = pad.top + innerH - h;
          return (
            <g key={year}>
              <rect x={x} y={y} width={barW} height={h} rx={4} fill="var(--accent)" opacity={0.85} />
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)">{fmt(val)}</text>
              <text x={x + barW / 2} y={H - 12} textAnchor="middle" fontSize="11" fill="var(--text-dim)">{year}</text>
            </g>
          );
        })}
      </svg>
    </Card>
  );
}

/* ── Concentration meter ──────────────────────────────────── */
function ConcentrationMeter({ result }) {
  const pct = Math.round(result.pct * 100);
  const color = RISK_COLOR[result.level];
  return (
    <Card style={{ marginTop: 16 }}>
      <SectionLabel>Single-stock concentration</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
        <span className="serif" style={{ fontSize: 40, color }}>{pct}%</span>
        <span className="f12 upcase" style={{ color, fontWeight: 700, letterSpacing: '0.05em' }}>{result.level} risk</span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: 'var(--bg2)', overflow: 'hidden', marginTop: 10 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 250ms var(--ease-out)' }} />
      </div>
      <div className="f13 muted lh-loose" style={{ marginTop: 12 }}>{result.message}</div>
      <div className="f12 dim" style={{ marginTop: 8 }}>
        {fmt(result.equityValue)} in company stock vs {fmt(result.netWorth)} total net worth.
      </div>
    </Card>
  );
}

/* ── Main tab ─────────────────────────────────────────────── */
export default function EquityComp() {
  const { plan } = usePlan();

  const [grants, setGrants] = useLocalState('equity-grants-v1', [defaultGrant('rsu')]);

  // Market + tax assumptions.
  const [currentPrice, setCurrentPrice] = useState(60);
  const [annualGrowth, setAnnualGrowth] = useState(0.08);
  const [marginalRate, setMarginalRate] = useState(0.32);
  const filingStatus = plan.filingStatus === 'mfj' ? 'mfj' : 'single';
  const salary = plan.incomeSources?.find(s => s.type === 'salary')?.amount || 150000;

  const market = useMemo(() => ({
    currentPrice,
    annualGrowth,
    marginalRate,
    withholdingRate: 0.22,
    filingStatus,
    otherOrdinaryIncome: salary,
    ltcgRate: 0.15,
  }), [currentPrice, annualGrowth, marginalRate, filingStatus, salary]);

  const addGrant = useCallback((type) => setGrants(prev => [...prev, defaultGrant(type)]), [setGrants]);
  const updateGrant = useCallback((g) => setGrants(prev => prev.map(x => x.id === g.id ? g : x)), [setGrants]);
  const removeGrant = useCallback((id) => setGrants(prev => prev.filter(x => x.id !== id)), [setGrants]);

  const summary = useMemo(() => summarizeEquity(grants, market), [grants, market]);

  const netWorth = getTotalSavings(plan) + summary.vestedValue;
  const concentration = useMemo(
    () => concentrationRisk(summary.totalValue, netWorth),
    [summary.totalValue, netWorth],
  );

  // Regular federal tax for the AMT comparison. AMT is only owed when the
  // tentative minimum tax EXCEEDS regular tax, so this baseline has to be the
  // real bracket-based tax — not marginal × income, which would overstate it
  // and make the tool under-warn about AMT. Reuse the app's tax engine.
  const regularTaxEstimate = useMemo(
    () => computeTax({
      filingStatus,
      ordinaryIncome: salary,
      socialSecurityBenefit: 0,
      capitalGains: 0,
      stateCode: plan.stateCode || 'CA',
      age: plan.currentAge || 45,
    }).federalTax,
    [filingStatus, salary, plan.stateCode, plan.currentAge],
  );

  const rsuGrants = grants.filter(g => g.type === 'rsu');
  const isoGrants = grants.filter(g => g.type === 'iso');
  const esppGrants = grants.filter(g => g.type === 'espp');

  const rsuGap = rsuGrants.reduce((acc, g) => {
    for (const y of analyzeRSU(g, market)) acc += Math.max(0, y.withholdingGap);
    return acc;
  }, 0);

  return (
    <div>
      <InfoBox title="Equity compensation, modeled the way it actually taxes" color="var(--purple)" bgColor="rgba(139,92,246,0.08)">
        RSUs, options, and ESPP are where high earners leave the most on the table — and where generic retirement tools go silent. This models your <strong>vesting schedule</strong>, the <strong>RSU withholding gap</strong> (the 22% employer default vs. your real bracket), the <strong>ISO/AMT crossover</strong> ("how many can I exercise before AMT bites?"), <strong>ESPP</strong> discount return, and your <strong>single-stock concentration</strong> against the rest of your net worth.
      </InfoBox>

      <Card style={{ marginTop: 16 }}>
        <SectionLabel>Stock &amp; tax assumptions</SectionLabel>
        <Slider label="Current share price" value={currentPrice} onChange={setCurrentPrice} min={1} max={1000} step={1} prefix="$" />
        <Slider label="Expected annual growth" value={Math.round(annualGrowth * 100)} onChange={v => setAnnualGrowth(v / 100)} min={-20} max={40} step={1} suffix="%" />
        <Slider label="Your marginal tax rate" value={Math.round(marginalRate * 100)} onChange={v => setMarginalRate(v / 100)} min={10} max={50} step={1} suffix="%" />
        <div className="f12 dim" style={{ marginTop: 4 }}>
          Filing status <strong>{filingStatus === 'mfj' ? 'Married filing jointly' : 'Single'}</strong> and salary <strong>{fmt(salary)}</strong> pulled from your plan; used for the SS/AMT math.
        </div>
      </Card>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
        <Stat label="Vested value" value={fmt(summary.vestedValue)} sub="Yours today (pre-tax)" />
        <Stat label="Unvested value" value={fmt(summary.unvestedValue)} color="var(--blue)" sub="Golden handcuffs" />
        <Stat label="Vesting next 12 mo" value={fmt(summary.next12moVestIncome)} color="var(--purple)" sub="Added ordinary income" />
        <Stat label="Est. under-withheld" value={fmt(summary.next12moWithholdingGap)} color={summary.next12moWithholdingGap > 0 ? 'var(--warn)' : 'var(--accent)'} sub="Set this aside for April" />
      </div>

      {summary.totalValue > 0 && <ConcentrationMeter result={concentration} />}
      <VestingTimeline summary={summary} />

      {/* Grants */}
      <div style={{ marginTop: 24 }}>
        <SectionLabel>Your grants</SectionLabel>
        {grants.map(g => (
          <GrantCard key={g.id} grant={g} market={market} onChange={updateGrant} onRemove={() => removeGrant(g.id)} />
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {Object.entries(GRANT_META).map(([type, meta]) => (
            <button key={type} onClick={() => addGrant(type)}
              style={{
                background: 'var(--bg2)', border: `1px solid ${meta.color}`, color: meta.color,
                borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
              + {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* RSU withholding gap */}
      {rsuGrants.length > 0 && (
        <Card style={{ marginTop: 24 }} glow={rsuGap > 0 ? 'var(--warn)' : undefined}>
          <SectionLabel>RSU withholding gap</SectionLabel>
          <p className="f13 muted lh-loose">
            Employers withhold a flat <strong>22%</strong> on RSU vests (37% over $1M). If your real marginal rate is {Math.round(marginalRate * 100)}%,
            every vest is under-withheld — and the shortfall lands as a surprise tax bill.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
            <Stat label="Lifetime RSU income" value={fmt(rsuGrants.reduce((s, g) => s + analyzeRSU(g, market).reduce((a, y) => a + y.ordinaryIncome, 0), 0))} />
            <Stat label="Under-withheld total" value={fmt(rsuGap)} color={rsuGap > 0 ? 'var(--warn)' : 'var(--accent)'} sub="Owed beyond the 22% default" />
          </div>
        </Card>
      )}

      {/* ISO / AMT */}
      {isoGrants.length > 0 && (
        <Card style={{ marginTop: 16 }} variant="output">
          <SectionLabel>ISO exercise &amp; AMT crossover</SectionLabel>
          <p className="f13 muted lh-loose">
            Exercising ISOs isn't taxed for regular tax — but the bargain element (price − strike) is an <strong>AMT preference item</strong>.
            Below is the largest chunk you can exercise this year before the alternative minimum tax kicks in.
          </p>
          {isoGrants.map(g => {
            const iso = analyzeISO(g, market, regularTaxEstimate);
            return (
              <div key={g.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
                <div className="f12 dim upcase" style={{ marginBottom: 8 }}>{g.label}</div>
                {!iso.inTheMoney ? (
                  <div className="f13 muted">Underwater — strike {fmt(g.strikePrice)} is above the {fmt(market.currentPrice)} price. No AMT exposure and nothing to gain by exercising yet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                    <Stat label="Vested & exercisable" value={Math.round(iso.vestedShares).toLocaleString()} sub="shares" />
                    <Stat label="Bargain element" value={fmt(iso.totalBargainElement)} color="var(--purple)" sub={`${fmt(iso.bargainElementPerShare)}/share`} />
                    <Stat label="AMT if you exercise all" value={fmt(iso.amtDue)} color={iso.amtDue > 0 ? 'var(--warn)' : 'var(--accent)'} />
                    <Stat label="AMT-free this year" value={Math.round(iso.amtFreeShares).toLocaleString()} color="var(--accent)" sub={`≈ ${fmt(iso.amtFreeValue)} of stock`} />
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* ESPP */}
      {esppGrants.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <SectionLabel>ESPP return</SectionLabel>
          <p className="f13 muted lh-loose">
            An ESPP discount is close to free money. Here's the instant gain and the annualized return on the cash you tie up for the offering period.
          </p>
          {esppGrants.map(g => {
            const e = analyzeESPP(g, market);
            return (
              <div key={g.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
                <div className="f12 dim upcase" style={{ marginBottom: 8 }}>{g.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  <Stat label="Purchase price" value={fmt(e.purchasePrice)} sub={`${Math.round(e.discountPct * 100)}% below market`} />
                  <Stat label="Instant gain" value={fmt(e.discountValue)} color="var(--accent)" />
                  <Stat label="Annualized return" value={`${Math.round(e.annualizedReturn * 100)}%`} color="var(--accent)" sub="On capital tied up" />
                  <Stat label="Ordinary income if sold now" value={fmt(e.disqualifyingOrdinary)} color="var(--warn)" sub="Disqualifying disposition" />
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
