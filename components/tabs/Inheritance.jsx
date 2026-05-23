'use client';

import { useMemo, useState } from 'react';
import { usePlan } from '@/components/PlanProvider';
import { computeInheritance, compareStepUpStrategies } from '@/lib/inheritanceEngine';
import { fmt } from '@/lib/format';
import Card from '@/components/ui/Card';
import AnimatedNumber from '@/components/ui/AnimatedNumber';

/**
 * Inheritance — net-of-tax legacy planning tab.
 *
 * Answers the HNW user's central question that no other DIY tool answers
 * well: "If I die, what do my heirs actually receive after estate tax
 * and income tax on inherited IRAs?"
 *
 * Two sections in this phase:
 *   1. WHAT YOUR HEIRS RECEIVE TODAY — net-of-tax breakdown today
 *   2. THE STEP-UP LEVER — comparison of default vs. step-up-aware
 *      spend strategy and the net-to-heir delta
 *
 * Future (Phase 2): Roth-for-legacy slider, estate tax exposure chart,
 * QCD modeling, annual gifting strategy.
 */
export default function Inheritance() {
  const { plan } = usePlan();

  // User-tunable assumptions (defaults are conservative)
  const [taxableBasisRatio, setTaxableBasisRatio] = useState(0.6);
  const [heirEffectiveTaxRate, setHeirEffectiveTaxRate] = useState(0.22);

  // Total balances available from the plan (combine both spouses).
  // Convert per-person fields into household totals for the calc.
  const balances = useMemo(() => ({
    trad401k:    (plan.savings401k    || 0) + (plan.spouseSavings401k    || 0),
    roth:        (plan.savingsRoth    || 0) + (plan.spouseSavingsRoth    || 0),
    taxable:     (plan.savingsTaxable || 0),
    hsa:         (plan.savingsHSA     || 0) + (plan.spouseSavingsHSA     || 0),
    cash:        (plan.savingsCash    || 0),
    realEstate:  (plan.savingsRealEstate || 0),
  }), [plan]);

  const inheritance = useMemo(() => computeInheritance({
    ...balances,
    taxableBasisRatio,
    heirEffectiveTaxRate,
    heirStateTaxRate: 0.05,
    filingStatus: plan.filingStatus || 'single',
    stateCode: plan.stateCode || 'CA',
    yearOfDeath: new Date().getFullYear(),
  }), [balances, taxableBasisRatio, heirEffectiveTaxRate, plan.filingStatus, plan.stateCode]);

  // Step-up lever — uses retireSpending × years as a rough total
  const yearsInRetirement = Math.max(
    1,
    (plan.longevityAge || 90) - (plan.retireAge || 65),
  );
  const totalRetirementSpending =
    (plan.retireSpending || plan.annualSpending || 60_000) * yearsInRetirement;

  const stepUp = useMemo(() => compareStepUpStrategies({
    ...balances,
    totalSpending: totalRetirementSpending,
    filingStatus: plan.filingStatus || 'single',
    stateCode: plan.stateCode || 'CA',
    heirEffectiveTaxRate,
    heirStateTaxRate: 0.05,
  }), [balances, totalRetirementSpending, plan.filingStatus, plan.stateCode, heirEffectiveTaxRate]);

  // Per-account row colors map to the existing palette
  const ACCT_COLORS = {
    trad401k:   'var(--blue)',
    roth:       'var(--purple)',
    taxable:    'var(--accent)',
    hsa:        '#F472B6',
    cash:       'var(--text-dim)',
    realEstate: 'var(--warn)',
  };

  const ACCT_LABELS = {
    trad401k:   '401(k) / Traditional IRA',
    roth:       'Roth IRA',
    taxable:    'Taxable Brokerage',
    hsa:        'HSA',
    cash:       'Cash / Savings',
    realEstate: 'Real Estate',
  };

  // Order the rows by gross size, descending — biggest first
  const orderedAccounts = useMemo(() => {
    return Object.keys(inheritance.byAccount)
      .filter((k) => inheritance.byAccount[k].gross > 0)
      .sort((a, b) => inheritance.byAccount[b].gross - inheritance.byAccount[a].gross);
  }, [inheritance]);

  return (
    <div style={{ fontFamily: 'var(--sans)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--fw-bold)',
          margin: 0,
          color: 'var(--text)',
          fontFamily: 'var(--serif)',
        }}>
          Inheritance — what your heirs actually receive
        </h2>
        <p style={{
          color: 'var(--text-muted)',
          margin: '4px 0 0',
          fontSize: 'var(--text-md)',
          lineHeight: 1.5,
        }}>
          The DIY tool that answers the question no calculator does — net of estate tax,
          net of income tax on inherited IRAs, accounting for the step-up basis lever
          on taxable accounts. Educational tool only, not personalized advice.
        </p>
      </div>

      {/* SECTION 1: Today snapshot */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', fontWeight: 'var(--fw-bold)' }}>
            If you died today
          </div>
          <div style={{ marginTop: 6, fontSize: 'var(--text-md)', color: 'var(--text-muted)' }}>
            Assuming {plan.filingStatus === 'mfj' ? 'joint' : 'single'} filing in {plan.stateCode || 'CA'} —
            this is what passes to your heirs after every applicable tax.
          </div>
        </div>

        {/* Big hero number */}
        <div style={{
          padding: '20px 24px',
          background: 'var(--accent-dim)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Net to heirs
            </div>
            <div style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: 'var(--fw-black)',
              color: 'var(--text)',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'var(--serif)',
            }}>
              <AnimatedNumber value={inheritance.netToHeirs} format={(v) => fmt(v)} />
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            <div>Gross estate: <strong style={{ color: 'var(--text)' }}>{fmt(inheritance.grossEstate)}</strong></div>
            {inheritance.totalEstateTax > 0 && (
              <div>− Estate tax: <strong style={{ color: 'var(--danger)' }}>{fmt(inheritance.totalEstateTax)}</strong></div>
            )}
            {inheritance.incomeTaxOnInheritedIRAs > 0 && (
              <div>− Income tax on inherited IRAs: <strong style={{ color: 'var(--danger)' }}>{fmt(inheritance.incomeTaxOnInheritedIRAs)}</strong></div>
            )}
          </div>
        </div>

        {/* Sunset warning */}
        {inheritance.grossEstate > 7_000_000 && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--warn-dim)',
            border: '1px solid var(--warn)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 16,
            fontSize: 'var(--text-sm)',
            color: 'var(--text)',
            lineHeight: 1.5,
          }}>
            <strong>Federal exemption sunset:</strong> the federal estate exemption is
            currently {fmt(inheritance.federalExemptionApplied)} but is set to drop roughly
            in half on Jan 1, 2026 unless Congress extends the TCJA. Run the math again
            with year-of-death 2026 if your estate is in this range.
          </div>
        )}

        {/* Per-account breakdown */}
        <div>
          <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', fontWeight: 'var(--fw-bold)', marginBottom: 12 }}>
            By account type
          </div>
          {orderedAccounts.map((key) => {
            const a = inheritance.byAccount[key];
            const lossPercent = a.gross > 0 ? Math.round(((a.gross - a.netToHeirs) / a.gross) * 100) : 0;
            return (
              <div
                key={key}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'start',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: ACCT_COLORS[key],
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>
                      {ACCT_LABELS[key]}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                    {a.taxTreatment}
                    {a.stepUpBenefit !== undefined && a.stepUpBenefit > 0 && (
                      <span> · <strong style={{ color: 'var(--accent)' }}>${Math.round(a.stepUpBenefit / 1000)}K saved</strong></span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(a.netToHeirs)}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: lossPercent > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {lossPercent > 0 ? `${lossPercent}% lost to tax` : 'no tax'}
                    {' · '}from {fmt(a.gross)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Assumption sliders */}
        <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', fontWeight: 'var(--fw-bold)', marginBottom: 10 }}>
            Assumptions
          </div>
          <SliderRow
            label="Taxable cost basis"
            help="What fraction of your taxable brokerage value is your cost basis (vs unrealized gains). Lower basis = more step-up benefit."
            value={Math.round(taxableBasisRatio * 100)}
            onChange={(v) => setTaxableBasisRatio(v / 100)}
            min={20} max={100} suffix="%"
          />
          <SliderRow
            label="Heirs' tax bracket"
            help="Heirs pay ordinary income tax on inherited Traditional IRA/401(k) over 10 years. Most heirs are middle-income (22-24%); HNW heirs are 32-37%."
            value={Math.round(heirEffectiveTaxRate * 100)}
            onChange={(v) => setHeirEffectiveTaxRate(v / 100)}
            min={10} max={37} suffix="%"
          />
        </div>
      </Card>

      {/* SECTION 2: Step-up lever */}
      <Card>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', fontWeight: 'var(--fw-bold)' }}>
            Spend-order matters
          </div>
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-bold)', margin: '6px 0 0', color: 'var(--text)', fontFamily: 'var(--serif)' }}>
            The step-up basis lever
          </h3>
          <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
            Taxable accounts get a step-up basis at death — heirs inherit at fair-market-value and embedded
            capital gains escape tax entirely. Which means: spending your 401(k) FIRST in retirement (and
            preserving your taxable account for the step-up) can leave more to heirs than the conventional
            "Roth last" wisdom suggests.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 16,
        }} className="grid-2">
          <SpendStrategyCard
            data={stepUp.defaultStrategy}
            highlight={stepUp.delta < 0}
          />
          <SpendStrategyCard
            data={stepUp.stepUpAware}
            highlight={stepUp.delta > 0}
          />
        </div>

        {stepUp.swingFactor !== 'minor' && (
          <div style={{
            padding: '14px 16px',
            background: stepUp.delta > 0 ? 'var(--accent-dim)' : 'var(--bg2)',
            border: `1px solid ${stepUp.delta > 0 ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-md)',
            color: 'var(--text)',
            lineHeight: 1.6,
          }}>
            {stepUp.delta > 0 ? (
              <>
                <strong>Spending 401(k) first could pass {fmt(Math.abs(stepUp.delta))} more to your heirs.</strong>{' '}
                The default engine waterfall (taxable first) forfeits the step-up benefit on what would otherwise
                be tax-free-to-heirs capital gains.
                {' '}<em>Important:</em> the engine currently uses the default waterfall — this comparison is
                a planning tool, not yet a configurable engine override. The next engine update will let you
                test this as a real scenario.
              </>
            ) : (
              <>
                <strong>For your plan, the default waterfall is fine.</strong>{' '}
                The step-up basis lever matters most for users with significant unrealized gains in a taxable
                account. Your taxable balance ({fmt(plan.savingsTaxable || 0)}) doesn't move the needle enough
                to outweigh the simpler "spend taxable first" approach.
              </>
            )}
          </div>
        )}
      </Card>

      {/* Footer disclaimer */}
      <div style={{
        marginTop: 24,
        fontSize: 'var(--text-xs)',
        color: 'var(--text-dim)',
        lineHeight: 1.6,
        textAlign: 'center',
      }}>
        Estate planning intersects with tax law, family dynamics, and state-specific trust law.
        This page surfaces the math. For your specific situation — especially for estates near
        the federal exemption — work with a fee-only fiduciary and an estates attorney.
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function SpendStrategyCard({ data, highlight }) {
  return (
    <div style={{
      padding: '16px',
      background: highlight ? 'var(--accent-dim)' : 'var(--bg2)',
      border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-sm)',
      transition: 'all var(--motion-base) var(--ease-out)',
    }}>
      <div style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--fw-bold)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: highlight ? 'var(--accent)' : 'var(--text-muted)',
        marginBottom: 8,
      }}>
        {data.label}
      </div>
      <div style={{
        fontSize: 'var(--text-2xl)',
        fontWeight: 'var(--fw-black)',
        color: 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'var(--serif)',
        marginBottom: 8,
      }}>
        <AnimatedNumber value={data.netToHeirs} format={(v) => fmt(v)} />
      </div>
      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
        marginBottom: 12,
      }}>
        net to heirs at end of plan
      </div>
      <div style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--text)',
        lineHeight: 1.5,
      }}>
        {data.description}
      </div>
    </div>
  );
}

function SliderRow({ label, help, value, onChange, min, max, suffix }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text)', fontWeight: 'var(--fw-semi)' }}>
          {label}
        </span>
        <span style={{ fontSize: 'var(--text-md)', color: 'var(--accent)', fontWeight: 'var(--fw-bold)', fontVariantNumeric: 'tabular-nums' }}>
          {value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)' }}
      />
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.5 }}>
        {help}
      </div>
    </div>
  );
}
