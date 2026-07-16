'use client';

import { useState, useMemo, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Slider from '@/components/ui/Slider';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt, fmtFull } from '@/lib/format';
import { usePlan, INCOME_TEMPLATES, DEBT_TEMPLATES } from '@/components/PlanProvider';
import { computeProjection } from '@/lib/computeProjection';
import { detectIrmaaCliff } from '@/lib/taxEngine';
import { RMD_TABLE, RMD_START_AGE } from '@/lib/constants';
import HealthcareBreakdown from '@/components/HealthcareBreakdown';
import BridgeOptionsCard from '@/components/BridgeOptionsCard';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
];

const EXPENSE_CATEGORIES = [
  { key: 'housing', label: 'Housing', type: 'essential', default: 0.30 },
  { key: 'food', label: 'Food & Groceries', type: 'essential', default: 0.12 },
  { key: 'utilities', label: 'Utilities', type: 'essential', default: 0.05 },
  { key: 'transport', label: 'Transportation', type: 'essential', default: 0.08 },
  { key: 'insurance', label: 'Insurance', type: 'essential', default: 0.05 },
  { key: 'travel', label: 'Travel', type: 'discretionary', default: 0.10 },
  { key: 'dining', label: 'Dining Out', type: 'discretionary', default: 0.06 },
  { key: 'entertainment', label: 'Entertainment', type: 'discretionary', default: 0.05 },
  { key: 'hobbies', label: 'Hobbies & Fitness', type: 'discretionary', default: 0.04 },
  { key: 'giving', label: 'Gifts & Charity', type: 'discretionary', default: 0.05 },
  { key: 'other', label: 'Other / Misc', type: 'discretionary', default: 0.10 },
];

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function Collapsible({ title, defaultOpen = true, children, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, color: 'var(--text)', fontFamily: 'var(--sans)',
          gap: 8,
        }}
      >
        {/* Title + badge wrap as a flex group so the badge sits below the title
            on narrow screens instead of orphaning to the next line mid-word. */}
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10, rowGap: 2, textAlign: 'left' }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}>{title}</span>
          {badge && <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--sans)', fontWeight: 600, whiteSpace: 'nowrap' }}>{badge}</span>}
        </span>
        <span style={{ fontSize: 14, color: 'var(--text-dim)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0)', flexShrink: 0 }}>
          &#9660;
        </span>
      </button>
      {open && <div style={{ marginTop: 16 }}>{children}</div>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Income Source Card
// ---------------------------------------------------------------------------

function IncomeSourceCard({ source, onChange, onRemove, retireAge, hasSpouse }) {
  const update = (key, val) => onChange({ ...source, [key]: val });
  const owner = source.owner || 'primary';
  // Rental is household-level in the projection engine (no owner semantics),
  // so it gets no You/Spouse toggle.
  const ownable = source.type !== 'rental';

  const setOwner = (nextOwner) => {
    if (nextOwner === owner) return;
    const baseLabel = (source.label || '').replace(/^Spouse /, '');
    onChange({
      ...source,
      owner: nextOwner,
      label: nextOwner === 'spouse' ? `Spouse ${baseLabel}` : baseLabel,
    });
  };

  return (
    <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12, background: 'var(--bg2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{source.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasSpouse && ownable && (
            <div style={{ display: 'flex', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {[['primary', 'You'], ['spouse', 'Spouse']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setOwner(val)}
                  style={{
                    padding: '4px 12px', border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)',
                    background: owner === val ? 'var(--accent)' : 'transparent',
                    color: owner === val ? '#fff' : 'var(--text-dim)',
                    transition: 'all .15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 18 }} title="Remove">&times;</button>
        </div>
      </div>

      {source.type === 'salary' && (
        <>
          <Slider label="Annual Salary" value={source.amount} onChange={v => update('amount', v)} min={20000} max={500000} step={5000} prefix="$" format={v => (v/1000).toFixed(0) + 'K'} />
          <Slider label="Annual Growth" value={source.growthRate} onChange={v => update('growthRate', v)} min={0} max={8} step={0.5} suffix="%" />
          <Slider
            label="Salary stops at age"
            value={source.endAge ?? retireAge}
            onChange={v => update('endAge', v)}
            min={40} max={80} step={1}
          />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Default is your retirement age ({retireAge}). For phased retirement (full-time → part-time → full retirement), set this earlier and add a Part-time / consulting income source below.
          </div>
        </>
      )}

      {source.type === 'partTime' && (
        <>
          <Slider label="Annual Amount" value={source.annualAmount} onChange={v => update('annualAmount', v)} min={5000} max={200000} step={1000} prefix="$" format={v => (v/1000).toFixed(0) + 'K'} />
          <Slider label="Start Age" value={source.startAge} onChange={v => update('startAge', v)} min={40} max={75} step={1} />
          <Slider label="End Age" value={source.endAge} onChange={v => update('endAge', Math.max(v, source.startAge + 1))} min={Math.max(source.startAge + 1, 41)} max={80} step={1} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Phased retirement: covers the gap between full-time salary ending and full retirement. Pair this with a salary source whose &quot;stops at age&quot; matches this start age.
          </div>
        </>
      )}

      {source.type === 'socialSecurity' && (
        <>
          <Slider label="Monthly Benefit at FRA" value={source.monthlyBenefit} onChange={v => update('monthlyBenefit', v)} min={500} max={5000} step={50} prefix="$" format={v => v.toLocaleString()} />
          <Slider label="Start Age" value={source.startAge} onChange={v => update('startAge', v)} min={62} max={70} step={1} />
        </>
      )}

      {source.type === 'pension' && (
        <>
          <Slider label="Monthly Amount" value={source.monthlyAmount} onChange={v => update('monthlyAmount', v)} min={500} max={10000} step={100} prefix="$" format={v => v.toLocaleString()} />
          <Slider label="Start Age" value={source.startAge} onChange={v => update('startAge', v)} min={50} max={75} step={1} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>COLA (2%/yr)</label>
            <input type="checkbox" checked={source.cola || false} onChange={e => update('cola', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
          </div>
        </>
      )}

      {source.type === 'rental' && (
        <>
          <Slider label="Monthly Net Income" value={source.monthlyNet} onChange={v => update('monthlyNet', v)} min={500} max={10000} step={100} prefix="$" format={v => v.toLocaleString()} />
          <Slider label="Annual Appreciation" value={source.appreciation} onChange={v => update('appreciation', v)} min={0} max={8} step={0.5} suffix="%" />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Debt Card
// ---------------------------------------------------------------------------

function DebtCard({ debt, onChange, onRemove, currentAge }) {
  const update = (key, val) => onChange({ ...debt, [key]: val });
  // Auto-calculate payoff age
  const monthlyRate = (debt.interestRate || 0) / 100 / 12;
  let payoffMonths = 0;
  // If monthly interest >= monthly payment, the balance never shrinks.
  const cannotPayOff = monthlyRate > 0 && monthlyRate * debt.remainingBalance >= debt.monthlyPayment;
  if (debt.monthlyPayment > 0 && debt.remainingBalance > 0 && !cannotPayOff) {
    if (monthlyRate > 0) {
      payoffMonths = Math.ceil(-Math.log(1 - monthlyRate * debt.remainingBalance / debt.monthlyPayment) / Math.log(1 + monthlyRate));
      if (!isFinite(payoffMonths) || payoffMonths < 0) payoffMonths = 0;
    } else {
      payoffMonths = Math.ceil(debt.remainingBalance / debt.monthlyPayment);
    }
  }
  const payoffAge = currentAge + Math.ceil(payoffMonths / 12);

  return (
    <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12, background: 'var(--bg2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{debt.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: cannotPayOff ? 'var(--danger)' : payoffAge <= 65 ? 'var(--accent)' : 'var(--warn)' }}>
            {cannotPayOff ? 'Payment too low to pay off' : `Paid off at ${payoffAge}`}
          </span>
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 18 }} title="Remove">&times;</button>
        </div>
      </div>
      <Slider label="Balance" value={debt.remainingBalance} onChange={v => update('remainingBalance', v)} min={0} max={debt.type === 'mortgage' ? 1000000 : 200000} step={1000} format={fmt} />
      <Slider label="Monthly Payment" value={debt.monthlyPayment} onChange={v => update('monthlyPayment', v)} min={50} max={debt.type === 'mortgage' ? 5000 : 2000} step={50} format={fmt} />
      <Slider label="Interest Rate" value={debt.interestRate} onChange={v => update('interestRate', v)} min={0} max={30} step={0.25} suffix="%" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggestion Engine
// ---------------------------------------------------------------------------

function generateSuggestions(plan, results) {
  const suggestions = [];
  const salary = plan.incomeSources?.find(s => s.type === 'salary')?.amount || 0;
  const hasSS = plan.incomeSources?.some(s => s.type === 'socialSecurity');
  const debts = plan.debts || [];
  const monthlyExpense = (plan.annualSpending || 0) / 12;
  const savingsRate = salary > 0 ? ((salary - plan.annualSpending) / salary * 100) : 0;

  if (!hasSS) {
    suggestions.push({ id: 'missing-ss', severity: 'warn', title: 'Add Social Security', detail: 'Include your estimated SS benefit for more accurate retirement projections.' });
  }
  if ((plan.savingsCash || 0) < monthlyExpense * 3 && monthlyExpense > 0) {
    suggestions.push({ id: 'emergency-fund', severity: 'info', title: 'Build an emergency fund', detail: `You have ${fmt(plan.savingsCash || 0)} in cash — aim for ${fmt(Math.round(monthlyExpense * 3))} to ${fmt(Math.round(monthlyExpense * 6))} (3-6 months expenses).` });
  }
  const highDebt = debts.find(d => d.interestRate > 10);
  if (highDebt) {
    suggestions.push({ id: 'high-debt', severity: 'danger', title: `Pay off ${highDebt.name} (${highDebt.interestRate}%)`, detail: 'High-interest debt costs more than investment returns. Prioritize paying this off.' });
  }
  if (results.moneyLastsAge < plan.longevityAge) {
    const gap = results.moneyLastsAge;
    // If they hold real estate but haven't opted to draw on it, that's the
    // most likely fix — the projection is ignoring their biggest asset.
    const untappedRE = !plan.useRealEstateInRetirement && (plan.savingsRealEstate || 0) > 0;
    suggestions.push({
      id: 'portfolio-gap', severity: 'danger',
      title: `Savings run out at age ${gap}`,
      detail: untappedRE
        ? `You hold ${fmt(plan.savingsRealEstate)} in real estate the plan isn't touching. If downsizing, selling, or a reverse mortgage is part of your plan, enable "Draw from real estate in retirement" in Assumptions — otherwise increase savings or reduce spending to reach age ${plan.longevityAge}.`
        : `Increase monthly savings or reduce spending to extend your money to age ${plan.longevityAge}.`,
    });
  }
  if (plan.savings401k > 500000) {
    suggestions.push({ id: 'rmd-warning', severity: 'info', title: 'Large 401(k) — plan for RMDs', detail: `Your ${fmt(plan.savings401k)} 401(k) will trigger Required Minimum Distributions at 73. Consider Roth conversions to reduce future tax burden.` });
  }
  if (salary > 0 && savingsRate < 15) {
    suggestions.push({ id: 'low-savings', severity: 'warn', title: `Savings rate is ${Math.round(savingsRate)}%`, detail: 'Financial planners recommend saving 15-20% of gross income for retirement.' });
  }
  if (plan.stateCode === 'CA' && plan.filingStatus === 'single' && plan.currentAge === 40) {
    // Only show if all defaults — user hasn't personalized
    suggestions.push({ id: 'personalize', severity: 'info', title: 'Personalize your plan', detail: 'Update your age, state, and filing status for accurate tax projections.' });
  }
  return suggestions;
}

// ---------------------------------------------------------------------------
// SVG Area Chart
// ---------------------------------------------------------------------------

function IncomeExpenseChart({ projections, retireAge, plan }) {
  const W = 700, H = 360, PAD = { top: 24, right: 20, bottom: 44, left: 70 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  if (!projections || projections.length === 0) return null;

  const ages = projections.map(p => p.age);
  const minAge = ages[0];
  const maxAge = ages[ages.length - 1];

  // Find max value across portfolio balance, income, and expenses
  const maxVal = Math.max(
    ...projections.map(p => Math.max(p.portfolioBalance || 0, p.totalIncome, p.totalExpense))
  ) * 1.1;

  const x = (age) => PAD.left + ((age - minAge) / (maxAge - minAge)) * plotW;
  const y = (val) => PAD.top + plotH - (Math.max(0, val) / maxVal) * plotH;

  // Portfolio balance area (the big one — shows wealth over time, INCLUDES
  // illiquid RE + 529).
  const portfolioPoints = projections.map(p => `${x(p.age)},${y(p.portfolioBalance || 0)}`).join(' ');
  const portfolioArea = `M ${x(minAge)},${y(0)} L ${portfolioPoints} L ${x(maxAge)},${y(0)} Z`;

  // Liquid balance line — what's actually spendable (excludes RE + 529).
  // Surfaces the difference for users with significant illiquid holdings:
  // total wealth can keep growing (RE appreciates) while liquid is exhausted.
  // Only show this line when illiquid assets are non-trivial enough to make
  // the two diverge meaningfully.
  const hasIlliquidWealth = projections.some(p =>
    (p.portfolioBalance || 0) - (p.liquidBalance || 0) > 25_000
  );
  const liquidPoints = hasIlliquidWealth
    ? projections.map(p => `${x(p.age)},${y(p.liquidBalance || 0)}`).join(' ')
    : null;

  // Income line (stacked)
  const incomeKeys = ['salary', 'socialSecurity', 'pension', 'rental'];
  const incomeColors = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa'];
  const stackedAreas = [];
  for (let k = 0; k < incomeKeys.length; k++) {
    const key = incomeKeys[k];
    const topPts = [], bottomPts = [];
    for (const p of projections) {
      let bot = 0;
      for (let j = 0; j < k; j++) bot += p[incomeKeys[j]] || 0;
      topPts.push(`${x(p.age)},${y(bot + (p[key] || 0))}`);
      bottomPts.push(`${x(p.age)},${y(bot)}`);
    }
    bottomPts.reverse();
    stackedAreas.push({ key, color: incomeColors[k], path: `M ${topPts.join(' L ')} L ${bottomPts.join(' L ')} Z` });
  }

  // Expense line
  const expenseLine = projections.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.age)},${y(p.totalExpense)}`).join(' ');

  // Y-axis ticks
  const yTicks = [];
  const tickStep = maxVal > 2000000 ? 500000 : maxVal > 500000 ? 200000 : maxVal > 200000 ? 50000 : 25000;
  for (let v = 0; v <= maxVal; v += tickStep) yTicks.push(v);

  // X-axis ticks every 5 years
  const xTicks = [];
  for (let a = Math.ceil(minAge / 5) * 5; a <= maxAge; a += 5) xTicks.push(a);

  const retireX = x(retireAge);
  const lastRow = projections[projections.length - 1];
  // Legacy split: total wealth at end-of-life vs. spendable (liquid) wealth.
  // Total includes real estate + 529 which keep appreciating; liquid is what
  // heirs would receive without having to sell illiquid assets. Tester
  // reported confusion where total was $5M while score was 66% — both
  // technically correct but contradictory. Fixed by surfacing the split
  // explicitly and flagging the case where spending exhausts liquid early
  // (the score's "Needs Work" condition).
  const totalLegacy = lastRow?.portfolioEndBalance ?? lastRow?.portfolioBalance ?? 0;
  const liquidLegacy = lastRow?.liquidBalance ?? 0;
  const illiquidLegacy = Math.max(0, totalLegacy - liquidLegacy);
  // Did the plan run liquid dry at any retired year? (Same condition as
  // SuccessScore's brokeAge — keeps the two displays consistent.)
  const liquidExhaustedAtAge = projections.find(p => p.isRetired && p.availableBalance <= 0 && p.gap < 0)?.age;
  const legacy = totalLegacy;

  // Couples: the projection runs until the LONGER-lived spouse dies, so
  // maxAge reflects the spouse's longevity in the primary's age frame —
  // not the user's own longevityAge. Compute both so the label is honest.
  const userLongevity = plan?.longevityAge ?? maxAge;
  const hasSpouse = !!plan?.hasSpouse;
  const primaryDeathRow = hasSpouse ? projections.find(p => p.age === userLongevity) : null;
  const legacyAtUserDeath = primaryDeathRow
    ? (primaryDeathRow.portfolioEndBalance ?? primaryDeathRow.portfolioBalance ?? 0)
    : null;
  const projectionExtendsBeyondUser = hasSpouse && maxAge > userLongevity;

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
          {/* Grid */}
          {yTicks.map(v => (
            <line key={v} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={0.5} />
          ))}

          {/* Portfolio balance area — the hero curve (incl. illiquid RE + 529) */}
          <path d={portfolioArea} fill="url(#portfolioGrad)" opacity={0.25} />
          <path d={`M ${portfolioPoints}`} fill="none" stroke="var(--accent)" strokeWidth={2.5} />

          {/* Liquid balance line — only spendable assets. Diverges from total
              wealth when RE / 529 hold value the user can't actually draw. */}
          {liquidPoints && (
            <path d={`M ${liquidPoints}`} fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5,3" />
          )}

          {/* Stacked income areas (smaller, behind) */}
          {stackedAreas.map(sa => (
            <path key={sa.key} d={sa.path} fill={sa.color} opacity={0.2} />
          ))}

          {/* Expense line */}
          <path d={expenseLine} fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="6,3" />

          {/* Retirement marker */}
          <line x1={retireX} x2={retireX} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4,4" />
          <text x={retireX} y={PAD.top - 6} textAnchor="middle" fill="var(--accent)" fontSize={10} fontWeight={600} fontFamily="var(--sans)">Retire {retireAge}</text>

          {/* Peak portfolio label */}
          {(() => {
            const peakRow = projections.reduce((max, p) => (p.portfolioBalance || 0) > (max.portfolioBalance || 0) ? p : max, projections[0]);
            return (
              <text x={x(peakRow.age)} y={y(peakRow.portfolioBalance) - 8} textAnchor="middle" fill="var(--accent)" fontSize={10} fontWeight={700} fontFamily="var(--sans)">
                Peak: {fmt(peakRow.portfolioBalance)}
              </text>
            );
          })()}

          {/* Legacy label at end. Color follows the same logic as the
              callout below: green when liquid lasts, amber when liquid
              ran dry but illiquid (RE / 529) remains. */}
          {legacy > 0 && (() => {
            const labelColor = liquidExhaustedAtAge ? '#f59e0b' : 'var(--accent)';
            const labelText = liquidExhaustedAtAge
              ? `Legacy: ${fmt(legacy)} (mostly illiquid)`
              : `Legacy: ${fmt(legacy)}`;
            return (
              <>
                <circle cx={x(maxAge)} cy={y(legacy)} r={4} fill={labelColor} />
                <text x={x(maxAge) - 8} y={y(legacy) - 10} textAnchor="end" fill={labelColor} fontSize={10} fontWeight={600} fontFamily="var(--sans)">
                  {labelText}
                </text>
              </>
            );
          })()}
          {legacy <= 0 && (
            (() => {
              // Use liquidBalance — real estate / 529 can't be drawn down, so
              // "depletion" should fire when the spendable buckets hit zero.
              const brokeRow = projections.find(p => p.isRetired && p.availableBalance <= 0);
              if (!brokeRow) return null;
              return (
                <>
                  <circle cx={x(brokeRow.age)} cy={y(0)} r={5} fill="#ef4444" />
                  <text x={x(brokeRow.age)} y={y(0) - 10} textAnchor="middle" fill="#ef4444" fontSize={10} fontWeight={700} fontFamily="var(--sans)">
                    Depleted at {brokeRow.age}
                  </text>
                </>
              );
            })()
          )}

          {/* Y-axis labels */}
          {yTicks.map(v => (
            <text key={v} x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fill="var(--text-dim)" fontSize={10} fontFamily="var(--sans)">{fmt(v)}</text>
          ))}

          {/* X-axis labels */}
          {xTicks.map(a => (
            <text key={a} x={x(a)} y={H - 10} textAnchor="middle" fill="var(--text-dim)" fontSize={10} fontFamily="var(--sans)">{a}</text>
          ))}

          {/* Axes */}
          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--border)" />
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="var(--border)" />

          {/* Gradient defs */}
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.05" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, justifyContent: 'center', fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontWeight: 600 }}>
          <div style={{ width: 14, height: 3, background: 'var(--accent)', borderRadius: 2 }} /> Total Net Worth (incl. RE)
        </div>
        {liquidPoints && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#3b82f6', fontWeight: 600 }}>
            <svg width={14} height={3} style={{ overflow: 'visible' }}>
              <line x1={0} y1={1.5} x2={14} y2={1.5} stroke="#3b82f6" strokeWidth={2} strokeDasharray="3,2" />
            </svg> Liquid (spendable)
          </div>
        )}
        {incomeKeys.map((key, i) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: incomeColors[i], opacity: 0.5 }} />
            {key === 'socialSecurity' ? 'SS' : key.charAt(0).toUpperCase() + key.slice(1)}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
          <div style={{ width: 14, height: 2, background: '#ef4444', borderRadius: 2 }} /> Expenses
        </div>
      </div>

      {/* "Why doesn't this match my mental math?" disclosure.
          Tester reported the projection came in ~7% below their
          back-of-napkin compounding. The math is honest, but the gap is
          invisible — this small expandable lays out what's in the model
          beyond simple compounding. Copy is static (this sub-component
          doesn't take `plan` as a prop) — references the user-editable
          assumptions by name so they can find them on the inputs panel. */}
      <details style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--sans)', userSelect: 'none' }}>
          Why does this differ from a simple compound-interest calculator?
        </summary>
        <div style={{ marginTop: 10, lineHeight: 1.6 }}>
          A back-of-napkin <code>balance × (1 + r)<sup>n</sup></code> assumes you earn the same rate every year on the entire portfolio with no drag. Our projection is more conservative on purpose:
          <ul style={{ marginTop: 6, paddingLeft: 18, lineHeight: 1.7 }}>
            <li><strong>Retirement allocation drag.</strong> Your expected return drops in retirement (default: 60% of working-years return — set by the &quot;Retirement return %&quot; assumption on the inputs panel). Most retirees shift to a bond-heavier mix, lowering expected return.</li>
            <li><strong>Cash drag.</strong> Cash holdings earn ~3% (working) / 2.5% (retired), not the equity return.</li>
            <li><strong>Tax gross-up on withdrawals.</strong> To net $80K of spending from a 401(k), you withdraw ~$100K and pay tax on the difference. Simple compounding ignores this — we model it iteratively across brackets.</li>
            <li><strong>Real estate &amp; 529 are shown but excluded from spendable.</strong> The blue dashed line (&quot;Liquid&quot;) is what you can actually draw from; the green line includes appreciating illiquid assets.</li>
          </ul>
          Numbers on the chart are <strong>nominal</strong> (not inflation-adjusted). Spending grows with your set inflation rate so the &quot;money lasts to age X&quot; comparison stays apples-to-apples.
        </div>
      </details>

      {/* Legacy callout — three states:
          1. Liquid lasts through longevity: green, total + breakdown
          2. Liquid exhausted but illiquid (RE/529) remains: amber warning,
             "legacy is illiquid — would need to be sold to cover late-life
             expenses" (matches SuccessScore's "Needs Work" / "At Risk")
          3. Total = 0: red "savings depleted" */}
      {legacy > 0 && !liquidExhaustedAtAge && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Estate / Legacy for Family</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {projectionExtendsBeyondUser
                  ? `Projected portfolio at end of plan — you ${userLongevity} / spouse ${maxAge}`
                  : `Projected portfolio remaining at age ${maxAge}`}
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--sans)' }}>{fmt(legacy)}</div>
          </div>
          {projectionExtendsBeyondUser && legacyAtUserDeath !== null && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(52,211,153,0.15)', fontSize: 11, color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
              <span>At your longevity (age {userLongevity}): <strong style={{ color: 'var(--text)' }}>{fmt(legacyAtUserDeath)}</strong></span>
              <span style={{ opacity: 0.7 }}>passed to surviving spouse</span>
            </div>
          )}
          {illiquidLegacy > 1000 && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(52,211,153,0.15)', fontSize: 11, color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{fmt(liquidLegacy)} liquid · {fmt(illiquidLegacy)} real estate / 529</span>
            </div>
          )}
        </div>
      )}
      {legacy > 0 && liquidExhaustedAtAge && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>Legacy is illiquid — spendable savings exhausted at age {liquidExhaustedAtAge}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 4 }}>
                Total of {fmt(legacy)} at age {maxAge}{projectionExtendsBeyondUser ? ` (longer-lived spouse's longevity — you live to ${userLongevity})` : ''} = <strong>{fmt(liquidLegacy)} liquid</strong> + <strong>{fmt(illiquidLegacy)} real estate / 529</strong>. The illiquid portion isn't available for spending without selling the underlying assets — late-life expenses from age {liquidExhaustedAtAge} onward would require selling real estate, taking a reverse mortgage, or reducing spending. The plan score reflects this cash-flow gap, not the total net worth.
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--sans)', flexShrink: 0 }}>{fmt(legacy)}</div>
          </div>
        </div>
      )}
      {legacy <= 0 && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--danger-dim)', border: '1px solid rgba(248,113,113,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>No Legacy — Savings Depleted</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Consider: saving more, working longer, or reducing spending</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)', fontFamily: 'var(--sans)' }}>$0</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success Score
// ---------------------------------------------------------------------------

function SuccessScore({ projections }) {
  if (!projections || projections.length < 2) return null;

  const firstAge = projections[0].age;
  const lastAge = projections[projections.length - 1].age;
  const retireAge = projections.find(p => p.isRetired)?.age || lastAge;
  const ageRange = lastAge - firstAge;
  if (ageRange <= 0) return null;

  // Find when liquid savings run out AND there's a gap (income < expenses).
  // Uses liquidBalance (excludes illiquid RE + 529) to match moneyLastsAge.
  // Bug history: previously used portfolioBalance, which kept growing forever
  // for users with real estate even after liquid hit zero — producing a 100%
  // "Fully Funded" score that contradicted the year-by-year Status column.
  const brokeAge = projections.find(p => p.isRetired && p.availableBalance <= 0 && p.gap < 0)?.age;
  let score, color, label;

  if (brokeAge === undefined) {
    // Portfolio + income covers everything through longevity
    score = 100;
    color = '#34d399';
    label = 'Fully Funded';
  } else if (brokeAge >= lastAge - 5) {
    score = Math.max(70, Math.min(99, Math.round(((brokeAge - retireAge) / (lastAge - retireAge)) * 100)));
    color = '#f59e0b';
    label = 'Nearly There';
  } else if (brokeAge >= retireAge + 10) {
    score = Math.max(30, Math.min(69, Math.round(((brokeAge - retireAge) / (lastAge - retireAge)) * 100)));
    color = '#f59e0b';
    label = 'Needs Work';
  } else {
    score = Math.max(0, Math.min(29, Math.round(((brokeAge - retireAge) / (lastAge - retireAge)) * 100)));
    color = '#ef4444';
    label = 'At Risk';
  }

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={180} height={180} viewBox="0 0 180 180">
        <circle cx={90} cy={90} r={radius} fill="none" stroke="var(--border)" strokeWidth={10} />
        <circle
          cx={90} cy={90} r={radius} fill="none" stroke={color} strokeWidth={10}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 90 90)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x={90} y={82} textAnchor="middle" fill={color} fontSize={36} fontWeight={700} fontFamily="var(--sans)">{score}%</text>
        <text x={90} y={106} textAnchor="middle" fill="var(--text-muted)" fontSize={12} fontFamily="var(--sans)">{label}</text>
      </svg>
      {brokeAge && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
          Savings run out at age {brokeAge}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="glass-card" style={{ padding: '12px 16px', transition: 'all .2s' }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div className="animate-number" style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text)', fontFamily: 'var(--sans)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Year-by-Year Table
// ---------------------------------------------------------------------------

function SummaryTable({ rows }) {
  if (!rows || rows.length === 0) return null;
  // Always include rows where the user's cashflow shifts: retirement start,
  // first SS year, RMD-start age (73), longevity. Then thin to every 5 years
  // for context.
  const include = new Set();
  rows.forEach((r, i) => {
    if (i === 0 || i === rows.length - 1) include.add(i);
    if (i % 5 === 0) include.add(i);
    if (r.isRetireYear) include.add(i);
    if (r.age === 73) include.add(i);
    const prev = i > 0 ? rows[i - 1] : null;
    if (r.socialSecurity > 0 && (!prev || prev.socialSecurity === 0)) include.add(i);
    if (r.pension > 0 && (!prev || prev.pension === 0)) include.add(i);
  });
  const displayRows = rows.filter((_, i) => include.has(i));

  return (
    <div style={{ overflowX: 'auto', marginTop: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--sans)' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {['Age', 'Portfolio', 'Salary', 'SS + Other', 'Withdrawals', 'Expenses', 'Tax', 'Status'].map(h => (
              <th key={h} style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((r, i) => {
            // Status: use liquidBalance (excludes illiquid RE and 529) for coverage check
            const prevBal = i > 0 ? displayRows[i - 1].portfolioBalance : 0;
            const balColor = r.portfolioBalance >= prevBal ? 'var(--accent)' : 'var(--warn)';
            const liquid = r.liquidBalance || 0;

            // "Covered" = income (incl. forced RMDs) was enough — user did not need
            // to dip into savings. "Drawn" = voluntary withdrawal beyond RMD was required.
            // "Short" = liquid depleted and a gap remains.
            const voluntaryWithdrawal = Math.max(0, (r.totalWithdrawals || 0) - (r.rmd || 0));
            let statusText, statusColor;
            if (!r.isRetired) {
              statusText = 'Saving';
              statusColor = 'var(--accent)';
            } else if (liquid <= 0 && r.gap < 0) {
              statusText = `${fmt(Math.abs(r.gap))} short`;
              statusColor = 'var(--danger)';
            } else if (voluntaryWithdrawal > 0) {
              statusText = `${fmt(r.totalWithdrawals)} drawn`;
              statusColor = 'var(--warn)';
            } else {
              statusText = 'Covered';
              statusColor = 'var(--accent)';
            }

            return (
              <tr key={r.age} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: r.isRetireYear ? 700 : 400, color: r.isRetireYear ? 'var(--accent)' : 'var(--text)' }}>{r.age}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: balColor, fontWeight: 600 }}>{fmt(r.portfolioBalance)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: r.salary > 0 ? 'var(--text)' : 'var(--text-dim)' }}>{r.salary > 0 ? fmt(r.salary) : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: r.ssAndOther > 0 ? 'var(--blue)' : 'var(--text-dim)' }}>{r.ssAndOther > 0 ? fmt(r.ssAndOther) : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: r.totalWithdrawals > 0 ? 'var(--purple)' : 'var(--text-dim)' }}>{r.totalWithdrawals > 0 ? fmt(r.totalWithdrawals) : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text)' }}>{fmt(r.totalExpense)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(r.totalTax)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: statusColor, fontWeight: 600, fontSize: 11 }}>
                  {statusText}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Retirement Detail Table (every year after retirement)
// ---------------------------------------------------------------------------

function RetirementDetailTable({ rows, retireAge }) {
  const [open, setOpen] = useState(false);
  const retireRows = rows.filter(r => r.age >= retireAge);
  if (retireRows.length === 0) return null;

  const cellStyle = { padding: '6px 8px', textAlign: 'right', fontSize: 11 };
  const thStyle = { ...cellStyle, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 };

  return (
    <div style={{ marginTop: 16 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0',
        color: 'var(--text)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
      }}>
        <span>Retirement Year-by-Year Detail</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>({retireRows.length} years)</span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0)', marginLeft: 'auto' }}>&#9660;</span>
      </button>
      {open && (
        <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--sans)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={thStyle}>Age</th>
                <th style={thStyle}>Portfolio</th>
                <th style={thStyle}>Return</th>
                <th style={thStyle}>SS</th>
                <th style={thStyle}>From 401k</th>
                <th style={thStyle}>From Roth</th>
                <th style={thStyle}>From Taxable</th>
                <th style={thStyle}>From Cash</th>
                <th style={thStyle}>Other Draws</th>
                <th style={thStyle}>Total Drawn</th>
                <th style={thStyle}>Expenses</th>
                <th style={thStyle}>Tax</th>
              </tr>
            </thead>
            <tbody>
              {retireRows.map(r => {
                const otherDraws = (r.withdrawalCrypto || 0) + (r.withdrawalAnnuity || 0) + (r.withdrawalPension || 0) + (r.withdrawalHSA || 0);
                return (
                  <tr key={r.age} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...cellStyle, fontWeight: r.isRetireYear ? 700 : 400, color: r.isRetireYear ? 'var(--accent)' : 'var(--text)' }}>{r.age}</td>
                    <td style={{ ...cellStyle, color: 'var(--accent)', fontWeight: 600 }}>{fmt(r.portfolioBalance)}</td>
                    <td style={{ ...cellStyle, color: r.portfolioReturn >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{r.portfolioReturn >= 0 ? '+' : ''}{fmt(r.portfolioReturn)}</td>
                    <td style={{ ...cellStyle, color: r.socialSecurity > 0 ? 'var(--blue)' : 'var(--text-dim)' }}>{r.socialSecurity > 0 ? fmt(r.socialSecurity) : '—'}</td>
                    <td style={{ ...cellStyle, color: r.withdrawal401k > 0 ? 'var(--text)' : 'var(--text-dim)' }}>{r.withdrawal401k > 0 ? fmt(r.withdrawal401k) : '—'}</td>
                    <td style={{ ...cellStyle, color: r.withdrawalRoth > 0 ? 'var(--accent)' : 'var(--text-dim)' }}>{r.withdrawalRoth > 0 ? fmt(r.withdrawalRoth) : '—'}</td>
                    <td style={{ ...cellStyle, color: r.withdrawalTaxable > 0 ? 'var(--text)' : 'var(--text-dim)' }}>{r.withdrawalTaxable > 0 ? fmt(r.withdrawalTaxable) : '—'}</td>
                    <td style={{ ...cellStyle, color: (r.withdrawalCash || 0) > 0 ? 'var(--text)' : 'var(--text-dim)' }}>{(r.withdrawalCash || 0) > 0 ? fmt(r.withdrawalCash) : '—'}</td>
                    <td style={{ ...cellStyle, color: otherDraws > 0 ? 'var(--text)' : 'var(--text-dim)' }}>{otherDraws > 0 ? fmt(otherDraws) : '—'}</td>
                    <td style={{ ...cellStyle, color: r.totalWithdrawals > 0 ? 'var(--purple)' : 'var(--text-dim)', fontWeight: 600 }}>{r.totalWithdrawals > 0 ? fmt(r.totalWithdrawals) : '—'}</td>
                    <td style={{ ...cellStyle, color: 'var(--text)' }}>{fmt(r.totalExpense)}</td>
                    <td style={{ ...cellStyle, color: r.totalTax > 0 ? 'var(--text-muted)' : 'var(--text-dim)' }}>{r.totalTax > 0 ? fmt(r.totalTax) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RMD Projection Table — shows the year-by-year forced withdrawal once the
// user hits age 73, alongside which years trigger SS taxation or IRMAA.
// ---------------------------------------------------------------------------

function RmdProjectionTable({ rows }) {
  const [open, setOpen] = useState(false);
  const rmdRows = rows.filter(r => r.age >= 73);
  if (rmdRows.length === 0) return null;
  const totalLifetimeRmds = rmdRows.reduce((s, r) => s + (r.rmd || 0), 0);
  const peakRmd = rmdRows.reduce((m, r) => Math.max(m, r.rmd || 0), 0);

  const cellStyle = { padding: '6px 8px', textAlign: 'right', fontSize: 11 };
  const thStyle = { ...cellStyle, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 };

  return (
    <div style={{ marginTop: 16 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0',
        color: 'var(--text)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
      }}>
        <span>RMD Projection (age 73+)</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Lifetime RMDs: {fmt(totalLifetimeRmds)} · Peak: {fmt(peakRmd)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0)', marginLeft: 'auto' }}>&#9660;</span>
      </button>
      {open && (
        <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--sans)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={thStyle}>Age</th>
                <th style={thStyle}>IRS Divisor</th>
                <th style={thStyle}>RMD</th>
                <th style={thStyle}>Marginal Bracket</th>
                <th style={thStyle}>SS Taxable</th>
                <th style={thStyle}>IRMAA Surcharge</th>
                <th style={thStyle}>Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {rmdRows.map(r => {
                const divisor = RMD_TABLE[Math.min(r.age, 110)] || '—';
                const triggersSS = (r.socialSecurity || 0) > 0 && (r.ssTaxablePercent || 0) > 0;
                const triggersIrmaa = (r.irmaa || 0) > 0;
                return (
                  <tr key={r.age} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...cellStyle, color: 'var(--text)' }}>{r.age}</td>
                    <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{typeof divisor === 'number' ? divisor.toFixed(1) : divisor}</td>
                    <td style={{ ...cellStyle, color: 'var(--purple)', fontWeight: 600 }}>{r.rmd > 0 ? fmt(r.rmd) : '—'}</td>
                    <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{r.marginalRate ? `${(r.marginalRate * 100).toFixed(0)}%` : '—'}</td>
                    <td style={{ ...cellStyle, color: triggersSS ? 'var(--warn)' : 'var(--text-dim)' }}>
                      {triggersSS ? `${r.ssTaxablePercent}% taxable` : '—'}
                    </td>
                    <td style={{ ...cellStyle, color: triggersIrmaa ? 'var(--danger)' : 'var(--text-dim)' }}>
                      {triggersIrmaa ? `+${fmt(r.irmaa)}/mo` : '—'}
                    </td>
                    <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{r.totalTax > 0 ? fmt(r.totalTax) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function MyPlan() {
  const { plan, updatePlan, updateIncome, removeIncome, addIncome, addDebt, updateDebt, removeDebt, bulkUpdate } = usePlan();

  // Dismissed suggestions (read from localStorage after mount to avoid hydration mismatch)
  const [dismissedSuggestions, setDismissedSuggestions] = useState([]);
  useEffect(() => {
    try { setDismissedSuggestions(JSON.parse(localStorage.getItem('suggestions-dismissed') || '[]')); } catch {}
  }, []);

  // ---- Heavy computation ----
  // Single source of truth: lib/computeProjection.js. This component
  // previously carried a full inline copy of the projection that drifted
  // from the lib (it still taxed cash withdrawals after the lib was
  // fixed) — the two views disagreed. Never duplicate the engine again.
  const results = useMemo(() => computeProjection(plan), [plan]);

  const { combined, essentialTotal, discretionaryTotal, retireEssentialTotal, retireDiscretionaryTotal } = results;

  // Monthly snapshot for "now" and "at retirement"
  const nowRow = combined.find(r => r.age === plan.currentAge) || combined[0] || {};
  const nowMonthlyIncome = Math.round((nowRow.totalIncome || 0) / 12);
  const nowMonthlyExpense = Math.round((nowRow.totalExpense || 0) / 12);
  const nowMonthlyNet = nowMonthlyIncome - nowMonthlyExpense;

  // Retirement snapshot: show AT retire age (what user actually set)
  const ssSource = plan.incomeSources.find(s => s.type === 'socialSecurity');
  const ssStartAge = ssSource?.startAge || null;
  const retireRow = combined.find(r => r.age === plan.retireAge) || {};
  const retireMonthlyIncome = Math.round((retireRow.totalIncome || 0) / 12);
  const retireMonthlyExpense = Math.round((retireRow.totalExpense || 0) / 12);
  const retireMonthlyNet = retireMonthlyIncome - retireMonthlyExpense;
  // Also show "full income" age when SS kicks in (if different from retire age)
  const fullIncomeRow = ssStartAge && ssStartAge > plan.retireAge ? combined.find(r => r.age === ssStartAge) : null;
  const fullMonthlyIncome = fullIncomeRow ? Math.round(fullIncomeRow.totalIncome / 12) : null;

  // Add income dropdown
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showDebtMenu, setShowDebtMenu] = useState(false);
  const existingTypes = plan.incomeSources.map(s => s.type);

  // Expense mode
  const expenseMode = plan.expenseMode || 'simple';
  const expenseBreakdown = plan.expenseBreakdown || (() => {
    const b = {};
    EXPENSE_CATEGORIES.forEach(c => { b[c.key] = Math.round(plan.annualSpending * c.default); });
    return b;
  })();
  const detailedTotal = Object.values(expenseBreakdown).reduce((s, v) => s + v, 0);

  return (
    <div className="slide-in myplan-layout">
      {/* ============ INPUTS SIDEBAR ============ */}
      <div className="myplan-inputs">
        <Collapsible title="Personal Info" defaultOpen={false} badge={plan.hasSpouse ? `Couple, ages ${plan.currentAge}/${plan.spouseCurrentAge}` : `Age ${plan.currentAge}, retire ${plan.retireAge}`}>
          {/* Household-type toggle — lets a single user enable couples mode after onboarding */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Household</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ id: false, label: 'Just me' }, { id: true, label: 'Me + spouse' }].map(opt => (
                <button key={String(opt.id)} onClick={() => {
                  // Auto-set filing status when toggling: couples default MFJ; singles default single.
                  // User can override via the filing-status pills below.
                  bulkUpdate({
                    hasSpouse: opt.id,
                    filingStatus: opt.id ? 'mfj' : 'single',
                  });
                }} style={{
                  flex: 1, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                  border: plan.hasSpouse === opt.id ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: plan.hasSpouse === opt.id ? 'var(--accent-dim)' : 'transparent',
                  color: plan.hasSpouse === opt.id ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: plan.hasSpouse === opt.id ? 600 : 400, fontSize: 12, fontFamily: 'var(--sans)',
                  transition: 'all .2s',
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {plan.hasSpouse && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>You</div>
          )}
          <div>
            <Slider label="Current Age" value={plan.currentAge} onChange={v => updatePlan('currentAge', v)} min={20} max={80} />
            <Slider label="Retirement Age" value={plan.retireAge} onChange={v => updatePlan('retireAge', v)} min={Math.max(plan.currentAge + 1, 50)} max={80} />
            <Slider label="Plan Through Age" value={plan.longevityAge} onChange={v => updatePlan('longevityAge', v)} min={Math.max(plan.retireAge + 5, 80)} max={105} />
          </div>
          {plan.hasSpouse && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Your spouse</div>
              <Slider label="Spouse Current Age" value={plan.spouseCurrentAge || 40} onChange={v => updatePlan('spouseCurrentAge', v)} min={20} max={80} />
              <Slider label="Spouse Retirement Age" value={plan.spouseRetireAge || 65} onChange={v => updatePlan('spouseRetireAge', v)} min={Math.max((plan.spouseCurrentAge || 40) + 1, 50)} max={80} />
              <Slider label="Spouse Plan Through Age" value={plan.spouseLongevityAge || 95} onChange={v => updatePlan('spouseLongevityAge', v)} min={Math.max((plan.spouseRetireAge || 65) + 5, 80)} max={105} />
            </div>
          )}
          <div style={{ borderTop: plan.hasSpouse ? '1px solid var(--border)' : 'none', marginTop: plan.hasSpouse ? 14 : 0, paddingTop: plan.hasSpouse ? 14 : 0 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Filing Status</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['single', 'mfj'].map(s => (
                  <button key={s} onClick={() => updatePlan('filingStatus', s)} style={{
                    flex: 1, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                    border: plan.filingStatus === s ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: plan.filingStatus === s ? 'var(--accent-dim)' : 'transparent',
                    color: plan.filingStatus === s ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: plan.filingStatus === s ? 600 : 400, fontSize: 12, fontFamily: 'var(--sans)',
                    transition: 'all .2s',
                  }}>
                    {s === 'single' ? 'Single' : 'Married Filing Jointly'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>State</span>
                <span style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 600 }}>{plan.stateCode}</span>
              </div>
              <select value={plan.stateCode} onChange={e => updatePlan('stateCode', e.target.value)} style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg2)',
                color: 'var(--text)', fontSize: 12, fontFamily: 'var(--sans)', cursor: 'pointer',
              }}>
                {US_STATES.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5, fontStyle: 'italic' }}>
                State tax uses one effective rate per state. For graduated states (CA, NY, OR, etc.), high earners may owe more than this estimator shows.
              </div>
            </div>
          </div>
        </Collapsible>

        <Collapsible title="Savings & Portfolio" defaultOpen={false} badge={fmt(results.startingBalance)}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>{plan.hasSpouse ? 'Your retirement accounts' : 'Retirement Accounts'}</div>
          <Slider label="401(k) / 403(b)" value={plan.savings401k} onChange={v => updatePlan('savings401k', v)} min={0} max={3000000} step={5000} format={fmt} />
          <Slider label="Roth IRA" value={plan.savingsRoth} onChange={v => updatePlan('savingsRoth', v)} min={0} max={1000000} step={5000} format={fmt} />
          <Slider label="Pension Pot" value={plan.savingsPension || 0} onChange={v => updatePlan('savingsPension', v)} min={0} max={2000000} step={5000} format={fmt} />
          <Slider label="Annuity Value" value={plan.savingsAnnuity || 0} onChange={v => updatePlan('savingsAnnuity', v)} min={0} max={1000000} step={5000} format={fmt} />
          <Slider label="HSA" value={plan.savingsHSA} onChange={v => updatePlan('savingsHSA', v)} min={0} max={200000} step={1000} format={fmt} />

          {plan.hasSpouse && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Spouse retirement accounts</div>
              <Slider label="Spouse 401(k) / 403(b)" value={plan.spouseSavings401k || 0} onChange={v => updatePlan('spouseSavings401k', v)} min={0} max={3000000} step={5000} format={fmt} />
              <Slider label="Spouse Roth IRA" value={plan.spouseSavingsRoth || 0} onChange={v => updatePlan('spouseSavingsRoth', v)} min={0} max={1000000} step={5000} format={fmt} />
              <Slider label="Spouse Pension Pot" value={plan.spouseSavingsPension || 0} onChange={v => updatePlan('spouseSavingsPension', v)} min={0} max={2000000} step={5000} format={fmt} />
              <Slider label="Spouse HSA" value={plan.spouseSavingsHSA || 0} onChange={v => updatePlan('spouseSavingsHSA', v)} min={0} max={200000} step={1000} format={fmt} />
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Other Assets</div>
            <Slider label="Taxable Brokerage" value={plan.savingsTaxable} onChange={v => updatePlan('savingsTaxable', v)} min={0} max={2000000} step={5000} format={fmt} />
            <Slider label="Savings / CDs" value={plan.savingsCash || 0} onChange={v => updatePlan('savingsCash', v)} min={0} max={500000} step={1000} format={fmt} />
            <Slider label="Crypto" value={plan.savingsCrypto || 0} onChange={v => updatePlan('savingsCrypto', v)} min={0} max={1000000} step={5000} format={fmt} />
            <Slider label="Real Estate Equity" value={plan.savingsRealEstate || 0} onChange={v => updatePlan('savingsRealEstate', v)} min={0} max={2000000} step={10000} format={fmt} />
            <Slider label="529 Plan" value={plan.savings529 || 0} onChange={v => updatePlan('savings529', v)} min={0} max={500000} step={5000} format={fmt} />
            {(plan.savings529 > 0 || plan.savingsRealEstate > 0) && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -8, marginBottom: 8 }}>
                {plan.savings529 > 0 ? '529: education only, not drawn for retirement. ' : ''}
                {plan.savingsRealEstate > 0 ? 'Real estate: illiquid, counted in net worth but not drawn.' : ''}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Contributions & Growth</div>
            <Slider label={plan.hasSpouse ? 'Your Monthly Investment' : 'Monthly Investment'} value={plan.monthlyContribution} onChange={v => updatePlan('monthlyContribution', v)} min={0} max={10000} step={100} format={fmt} />
            {plan.hasSpouse && (
              <Slider label="Spouse Monthly Investment" value={plan.spouseMonthlyContribution || 0} onChange={v => updatePlan('spouseMonthlyContribution', v)} min={0} max={10000} step={100} format={fmt} />
            )}
            <Slider label="Expected Return" value={plan.expectedReturn} onChange={v => updatePlan('expectedReturn', v)} min={3} max={12} step={0.5} suffix="%" />
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -16, marginBottom: 8 }}>
              Retirement return: {((plan.expectedReturn || 7) * 0.6).toFixed(1)}% (60% of working)
            </div>
          </div>
        </Collapsible>

        <Collapsible title="Income Sources" defaultOpen={false} badge={`${plan.incomeSources.length} source${plan.incomeSources.length !== 1 ? 's' : ''}`}>
          {/* The projection reads ONE source per (type, owner) pair — a second
              "Your Salary" would be silently ignored. Surface it. */}
          {(() => {
            const seen = new Set();
            const dupes = [];
            for (const s of plan.incomeSources) {
              const key = `${s.type}:${s.owner || 'primary'}`;
              if (seen.has(key) && s.type !== 'rental') dupes.push(s.label);
              seen.add(key);
            }
            return dupes.length > 0 ? (
              <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--warn)', background: 'rgba(251,191,36,0.06)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Duplicate source{dupes.length > 1 ? 's' : ''} ({dupes.join(', ')}): the projection only
                uses the first of each type per person — remove the extra or switch its owner to Spouse.
              </div>
            ) : null;
          })()}
          {plan.incomeSources.map(src => (
            <IncomeSourceCard
              key={src.id}
              source={src}
              onChange={updated => updateIncome(src.id, updated)}
              onRemove={() => removeIncome(src.id)}
              retireAge={plan.retireAge}
              hasSpouse={!!plan.hasSpouse}
            />
          ))}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              style={{
                padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
                border: '1px dashed var(--accent)', background: 'transparent',
                color: 'var(--accent)', fontSize: 13, fontWeight: 600,
                fontFamily: 'var(--sans)',
              }}
            >
              + Add Income Source
            </button>
            {showAddMenu && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20,
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
                padding: 4, minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,.3)',
              }}>
                {plan.hasSpouse && (
                  <div style={{ padding: '6px 14px 2px', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Yours</div>
                )}
                {Object.entries(INCOME_TEMPLATES).map(([key, tmpl]) => (
                  <button
                    key={key}
                    onClick={() => { addIncome(key); setShowAddMenu(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 14px', border: 'none', cursor: 'pointer',
                      background: 'transparent', color: 'var(--text)',
                      fontSize: 13, fontFamily: 'var(--sans)', borderRadius: 6,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {tmpl.label}
                  </button>
                ))}
                {plan.hasSpouse && (
                  <>
                    <div style={{ padding: '8px 14px 2px', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, borderTop: '1px solid var(--border)', marginTop: 4 }}>Spouse&apos;s</div>
                    {/* Rental is household-level in the engine — no spouse variant. */}
                    {Object.entries(INCOME_TEMPLATES).filter(([key]) => key !== 'rental').map(([key, tmpl]) => (
                      <button
                        key={`spouse-${key}`}
                        onClick={() => { addIncome(key, 'spouse'); setShowAddMenu(false); }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '10px 14px', border: 'none', cursor: 'pointer',
                          background: 'transparent', color: 'var(--text)',
                          fontSize: 13, fontFamily: 'var(--sans)', borderRadius: 6,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        Spouse {tmpl.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </Collapsible>

        {/* ---- Debts ---- */}
        <Collapsible title="Debts" defaultOpen={false} badge={(plan.debts || []).length > 0 ? `${fmt((plan.debts || []).reduce((s, d) => s + d.monthlyPayment, 0))}/mo` : 'None'}>
          {(plan.debts || []).map(debt => (
            <DebtCard
              key={debt.id}
              debt={debt}
              onChange={updated => updateDebt(debt.id, updated)}
              onRemove={() => removeDebt(debt.id)}
              currentAge={plan.currentAge}
            />
          ))}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => setShowDebtMenu(!showDebtMenu)}
              style={{
                padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
                border: '1px dashed var(--warn)', background: 'transparent',
                color: 'var(--warn)', fontSize: 13, fontWeight: 600,
                fontFamily: 'var(--sans)',
              }}
            >
              + Add Debt
            </button>
            {showDebtMenu && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20,
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
                padding: 4, minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,.3)',
              }}>
                {Object.entries(DEBT_TEMPLATES).map(([key, tmpl]) => (
                  <button
                    key={key}
                    onClick={() => { addDebt(key); setShowDebtMenu(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 14px', border: 'none', cursor: 'pointer',
                      background: 'transparent', color: 'var(--text)',
                      fontSize: 13, fontFamily: 'var(--sans)', borderRadius: 6,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Collapsible>

        <Collapsible title="Expenses" defaultOpen={false} badge={expenseMode === 'simple' ? fmt(plan.annualSpending) + '/yr' : fmt(detailedTotal) + '/yr'}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg)', borderRadius: 20, padding: 2, marginBottom: 16, width: 'fit-content' }}>
            {['simple', 'detailed'].map(mode => (
              <button key={mode} onClick={() => updatePlan('expenseMode', mode)} style={{
                padding: '6px 16px', borderRadius: 18, border: 'none', cursor: 'pointer',
                background: expenseMode === mode ? 'var(--accent)' : 'transparent',
                color: expenseMode === mode ? '#fff' : 'var(--text-dim)',
                fontWeight: expenseMode === mode ? 600 : 400, fontSize: 12, fontFamily: 'var(--sans)',
                transition: 'all .2s', textTransform: 'capitalize',
              }}>{mode}</button>
            ))}
          </div>
          {expenseMode === 'simple' ? (
            <>
              <Slider label="Current Annual Spending" value={plan.annualSpending} onChange={v => { updatePlan('annualSpending', v); updatePlan('_expenseManuallySet', true); if (!plan._retireSpendManuallySet) updatePlan('retireSpending', Math.round(v * 0.8 / 1000) * 1000); }} min={30000} max={300000} step={5000} format={fmt} />
              {!plan._expenseManuallySet && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -16, marginBottom: 8 }}>
                  Auto-estimated at 75% of salary.
                </div>
              )}
              <Slider label="Retirement Spending" value={plan.retireSpending || Math.round(plan.annualSpending * 0.8)} onChange={v => { updatePlan('retireSpending', v); updatePlan('_retireSpendManuallySet', true); }} min={20000} max={250000} step={5000} format={fmt} />
              {!plan._retireSpendManuallySet && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -16, marginBottom: 8 }}>
                  Default 80% of current spending.
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
                Customize each category. Total: <strong style={{ color: 'var(--text)' }}>{fmtFull(detailedTotal)}/yr</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                {EXPENSE_CATEGORIES.map(cat => {
                  const val = expenseBreakdown[cat.key] || 0;
                  const isEssential = cat.type === 'essential';
                  return (
                    <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: isEssential ? 'var(--accent)' : 'var(--blue)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{cat.label}</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={val.toLocaleString()}
                        onFocus={e => { e.target.value = String(val); e.target.select(); }}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          const num = Math.max(0, parseInt(raw) || 0);
                          const newBreakdown = { ...expenseBreakdown, [cat.key]: num };
                          updatePlan('expenseBreakdown', newBreakdown);
                          updatePlan('annualSpending', Object.values(newBreakdown).reduce((s, v) => s + v, 0));
                        }}
                        onBlur={e => { e.target.value = (expenseBreakdown[cat.key] || 0).toLocaleString(); }}
                        style={{
                          width: 90, padding: '4px 8px', borderRadius: 6, textAlign: 'right',
                          border: '1px solid var(--border)', background: 'var(--bg)',
                          color: 'var(--text)', fontSize: 12, fontFamily: 'var(--sans)',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Spending Phases</div>
            <Slider label="Go-Go Ends" value={plan.goGoEndAge} onChange={v => updatePlan('goGoEndAge', v)} min={plan.retireAge} max={plan.slowGoEndAge - 1} />
            <Slider label="Slow-Go Ends" value={plan.slowGoEndAge} onChange={v => updatePlan('slowGoEndAge', v)} min={plan.goGoEndAge + 1} max={plan.longevityAge - 1} />
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Go-Go: 100% · Slow-Go: 85% · No-Go ({plan.slowGoEndAge}+): 70%
            </div>
          </div>
        </Collapsible>

        {/* ---- Assumptions ---- */}
        <Collapsible title="Assumptions" defaultOpen={false} badge={`${plan.inflationRate || 2.5}% infl`}>
          <Slider label="General Inflation" value={plan.inflationRate || 2.5} onChange={v => updatePlan('inflationRate', v)} min={1} max={5} step={0.25} suffix="%" />
          <Slider label="Healthcare Inflation" value={plan.healthcareInflation || 3.5} onChange={v => updatePlan('healthcareInflation', v)} min={2} max={7} step={0.25} suffix="%" />
          <Slider
            label="Healthcare cost multiplier"
            value={plan.healthcareMultiplier || 1.0}
            onChange={v => updatePlan('healthcareMultiplier', v)}
            min={0.5} max={3.0} step={0.1} suffix="x"
          />
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -16, marginBottom: 8, lineHeight: 1.5 }}>
            1.0× = average healthy retiree (Fidelity benchmark). 1.5× = chronic conditions. 2.0×+ = significant ongoing care needs. Applies to ACA premiums and Medicare baseline costs.
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
            <Slider label="Retirement Return (% of working)" value={plan.retiredReturnPct || 60} onChange={v => updatePlan('retiredReturnPct', v)} min={40} max={100} step={5} suffix="%" />
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -16, marginBottom: 8 }}>
              {plan.expectedReturn || 7}% working → {((plan.expectedReturn || 7) * (plan.retiredReturnPct || 60) / 100).toFixed(1)}% retired
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Asset-Specific Returns</div>
            <Slider label="Cash / Savings" value={plan.cashReturn || 3} onChange={v => updatePlan('cashReturn', v)} min={1} max={5} step={0.25} suffix="%" />
            <Slider label="Real Estate Appreciation" value={plan.realEstateAppreciation || 3} onChange={v => updatePlan('realEstateAppreciation', v)} min={1} max={6} step={0.25} suffix="%" />
            <Slider label="Annuity Return" value={plan.annuityReturn || 3.5} onChange={v => updatePlan('annuityReturn', v)} min={2} max={5} step={0.25} suffix="%" />
            {/* Real-estate-as-retirement-asset toggle. When on, RE counts
                toward "available wealth" for the broke-age detection — the
                plan score, legacy callout, and money-lasts-to age all
                acknowledge the user's intent to sell or downsize in late
                retirement. Default off (conservative). */}
            <label style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!plan.useRealEstateInRetirement}
                onChange={e => updatePlan('useRealEstateInRetirement', e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Plan to draw from real estate</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 2 }}>
                  Counts RE toward spendable wealth for the plan score and money-lasts age. Applies to users who plan to sell, downsize, or take a reverse mortgage in late retirement. The chart's blue &quot;Liquid&quot; line still shows true cash today.
                </div>
              </div>
            </label>
          </div>
        </Collapsible>
      </div>

      {/* ============ RESULTS COLUMN ============ */}
      <div className="myplan-results">
      {/* ---- Action Items (suggestions) ---- */}
      {(() => {
        const suggestions = generateSuggestions(plan, results);
        const active = suggestions.filter(s => !dismissedSuggestions.includes(s.id));
        if (active.length === 0) return null;
        const colors = { danger: 'var(--danger)', warn: 'var(--warn)', info: 'var(--blue)' };
        return (
          <Card style={{ marginBottom: 16, borderLeft: '3px solid var(--warn)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12, fontFamily: 'var(--serif)' }}>
              Action Items ({active.length})
            </div>
            {active.map(s => (
              <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[s.severity] || 'var(--blue)', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.detail}</div>
                </div>
                <button onClick={() => {
                  const next = [...dismissedSuggestions, s.id];
                  setDismissedSuggestions(next);
                  localStorage.setItem('suggestions-dismissed', JSON.stringify(next));
                }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 16, padding: '0 4px' }} title="Dismiss">&times;</button>
              </div>
            ))}
          </Card>
        );
      })()}
      {/* ============ HERO: 3-column snapshot ============ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }} className="grid-2">
        {/* Current Savings */}
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600, marginBottom: 10 }}>
            My Savings
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--sans)', marginBottom: 6 }}>
            {fmt(results.startingBalance)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {plan.savings401k > 0 && <span style={{ color: 'var(--text-muted)' }}>401(k): {fmt(plan.savings401k)}</span>}
            {plan.savingsRoth > 0 && <span style={{ color: 'var(--text-muted)' }}>Roth: {fmt(plan.savingsRoth)}</span>}
            {plan.savingsTaxable > 0 && <span style={{ color: 'var(--text-muted)' }}>Taxable: {fmt(plan.savingsTaxable)}</span>}
            {plan.savingsHSA > 0 && <span style={{ color: 'var(--text-muted)' }}>HSA: {fmt(plan.savingsHSA)}</span>}
            {plan.savingsCash > 0 && <span style={{ color: 'var(--text-muted)' }}>Cash: {fmt(plan.savingsCash)}</span>}
            {plan.savingsCrypto > 0 && <span style={{ color: 'var(--text-muted)' }}>Crypto: {fmt(plan.savingsCrypto)}</span>}
            {plan.savingsPension > 0 && <span style={{ color: 'var(--text-muted)' }}>Pension: {fmt(plan.savingsPension)}</span>}
            {plan.savingsAnnuity > 0 && <span style={{ color: 'var(--text-muted)' }}>Annuity: {fmt(plan.savingsAnnuity)}</span>}
            {plan.savingsRealEstate > 0 && <span style={{ color: 'var(--text-muted)' }}>RE: {fmt(plan.savingsRealEstate)}</span>}
            {plan.savings529 > 0 && <span style={{ color: 'var(--text-muted)' }}>529: {fmt(plan.savings529)}</span>}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 6, fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }} title={`Balance the day you retire at age ${plan.retireAge}, before that year's withdrawals`}>Entering retirement</span>
              <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{fmt(results.portfolioAtRetire)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ color: 'var(--text-dim)' }}>Money lasts to</span>
              <span style={{ fontWeight: 700, color: results.moneyLastsAge >= plan.longevityAge ? 'var(--accent)' : 'var(--danger)' }}>
                Age {results.moneyLastsAge}
              </span>
            </div>
          </div>
        </div>

        {/* Today */}
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600, marginBottom: 10 }}>
            Today (Age {plan.currentAge})
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Income</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{fmtFull(nowMonthlyIncome)}/mo</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Expenses</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{fmtFull(nowMonthlyExpense)}/mo</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Left Over</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: nowMonthlyNet >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
              {nowMonthlyNet >= 0 ? '+' : '-'}{fmtFull(Math.abs(nowMonthlyNet))}/mo
            </span>
          </div>
          {nowMonthlyIncome > 0 && nowMonthlyNet > 0 && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'right', marginTop: 2 }}>
              {Math.round(nowMonthlyNet / nowMonthlyIncome * 100)}% savings rate · {fmt(plan.monthlyContribution || 0)}/mo investing
            </div>
          )}
        </div>

        {/* At Retirement */}
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600, marginBottom: 10 }}>
            Retirement (Age {plan.retireAge})
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Income</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: retireMonthlyIncome > 0 ? 'var(--blue)' : 'var(--text-dim)' }}>{fmtFull(retireMonthlyIncome)}/mo</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Expenses</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{fmtFull(retireMonthlyExpense)}/mo</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
            {retireMonthlyNet >= 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Surplus</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>+{fmtFull(retireMonthlyNet)}/mo</span>
              </div>
            ) : results.portfolioAtRetire > 0 ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>From Savings</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--blue)' }}>{fmtFull(Math.abs(retireMonthlyNet))}/mo</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'right', marginTop: 2 }}>
                  {fmt(results.portfolioAtRetire)} portfolio covers {Math.abs(retireMonthlyNet) > 0 ? Math.round(results.portfolioAtRetire / (Math.abs(retireMonthlyNet) * 12)) : '∞'} years
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>Shortfall</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--danger)' }}>{fmtFull(Math.abs(retireMonthlyNet))}/mo</span>
              </div>
            )}
          </div>
          {ssStartAge && ssStartAge > plan.retireAge && (
            <div style={{ fontSize: 10, color: 'var(--blue)', marginTop: 4, padding: '4px 8px', background: 'var(--blue-dim)', borderRadius: 4, textAlign: 'center' }}>
              SS starts at {ssStartAge}{fullMonthlyIncome ? ` → income becomes ${fmtFull(fullMonthlyIncome)}/mo` : ''}
            </div>
          )}
        </div>
      </div>

      {/* ============ SCORE + CHART ============ */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, marginBottom: 20, alignItems: 'start' }} className="grid-2">
        <div className="glass-card" style={{ textAlign: 'center', padding: '20px 24px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6, fontWeight: 600 }}>Plan Score</div>
          <SuccessScore projections={combined} />
        </div>

        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Income vs. Expenses</div>
          <IncomeExpenseChart projections={combined} retireAge={plan.retireAge} plan={plan} />
        </div>
      </div>

      {/* Key Metrics — horizontal strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 20 }}>
        <MetricCard label="Portfolio Entering Retirement" value={fmt(results.portfolioAtRetire)} color="var(--blue)" sub={`Balance at age ${plan.retireAge}, before withdrawals`} />
        <MetricCard label="Money Lasts To" value={`Age ${results.moneyLastsAge}`} color={results.moneyLastsAge >= plan.longevityAge ? '#34d399' : '#ef4444'} />
        <MetricCard label="Lifetime Income" value={fmt(results.totalLifetimeIncome)} />
        <MetricCard label="Lifetime Taxes" value={fmt(results.totalLifetimeTax)} color="#f59e0b" />
        <MetricCard label="Lifetime Expenses" value={fmt(results.totalLifetimeExpense)} />
        <MetricCard label="Avg Tax Rate" value={`${(results.avgEffectiveRate * 100).toFixed(1)}%`} color="#a78bfa" />
      </div>

      {/* Year-by-Year & Tax */}
      <Collapsible title="Year-by-Year Summary" defaultOpen={false} badge="Every 5 years">
        <SummaryTable rows={combined} />
        <RetirementDetailTable rows={combined} retireAge={plan.retireAge} />
        <RmdProjectionTable rows={combined} />
      </Collapsible>

      <Collapsible title="Tax Summary" defaultOpen={false}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Effective Tax Rate by Phase</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {(() => {
              const working = combined.filter(r => !r.isRetired);
              const retired = combined.filter(r => r.isRetired);
              const workingAvg = working.length > 0 ? working.reduce((s, r) => s + r.effectiveRate, 0) / working.length : 0;
              const retiredAvg = retired.length > 0 ? retired.reduce((s, r) => s + r.effectiveRate, 0) / retired.length : 0;
              return (
                <>
                  <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>Working Years</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{(workingAvg * 100).toFixed(1)}%</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>avg effective rate</div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>Retirement Years</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{(retiredAvg * 100).toFixed(1)}%</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>avg effective rate</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Phase F: Survivor Analysis banner.
            Fires only when hasSpouse and the projection includes years
            where one spouse is dead and the other lives on. Shows who
            dies first, when, and the SS step-up the survivor receives
            (often a meaningful jump for non-working / lower-earning
            spouses). The math is honest about what survivor planning
            actually looks like — most free tools skip this entirely. */}
        {plan.hasSpouse && (() => {
          const widowedRows = combined.filter(r => r.widowed);
          if (widowedRows.length === 0) return null;
          const firstWidowedRow = combined.find(r => r.widowed);
          // Who died: in the first-widowed row, the dead one has alive=false.
          const primaryDied = !firstWidowedRow.primaryAlive;
          const survivorYears = widowedRows.length;
          return (
            <InfoBox
              title={`Survivor analysis: ${primaryDied ? 'spouse outlives you' : 'you outlive spouse'} by ${survivorYears} year${survivorYears === 1 ? '' : 's'}`}
              color="var(--purple)"
              bgColor="rgba(139,92,246,0.08)"
              style={{ marginTop: 16 }}
            >
              The plan models {primaryDied ? 'your spouse' : 'you'} as the surviving partner from age {primaryDied ? firstWidowedRow.spouseAge : firstWidowedRow.age} onward.
              Three things change at that point: (1) <strong>SS step-up</strong> — the survivor automatically claims the higher of the two benefits going forward, often a meaningful jump for the lower-earning spouse;
              (2) <strong>Filing status flips MFJ → single</strong> in the year after death (we hold MFJ for the calendar year of death itself per IRS rule);
              (3) <strong>Tax-deferred balances roll over</strong> to the survivor's name (no immediate distribution required).
              The single-filer brackets compress at the top — survivor years often see a higher effective rate even on the same income.
            </InfoBox>
          );
        })()}

        {/* Bridge Options card — shows 4 explicit alternatives when liquid
            CASH is exhausted before longevity. Uses raw liquidBalance (not
            availableBalance) so the card stays visible even after the user
            flips on "include RE in retirement plan" — option 1 then shows
            as "active" so the strategy state is obvious. Without this, the
            whole card would disappear the instant the user clicked the
            toggle, which is confusing. */}
        {(() => {
          const liquidExhaustedAtAge = combined.find(p => p.isRetired && p.liquidBalance <= 0 && p.gap < 0)?.age;
          if (!liquidExhaustedAtAge) return null;
          const lastRow = combined[combined.length - 1];
          const realEstateBalance = lastRow?.realEstateBalance || 0;
          // Approximate annual gap = retirement spending (today's $).
          // Engine has more nuanced numbers but spend is the right magnitude
          // for the bridge-options copy.
          const retireSpending = plan.retireSpending || Math.round((plan.annualSpending || 60000) * 0.8);
          return (
            <BridgeOptionsCard
              plan={plan}
              liquidExhaustedAtAge={liquidExhaustedAtAge}
              longevityAge={plan.longevityAge || 95}
              retireAge={plan.retireAge}
              realEstateBalance={realEstateBalance}
              retireSpending={retireSpending}
              onToggleRealEstate={(v) => updatePlan('useRealEstateInRetirement', v)}
            />
          );
        })()}

        {/* Healthcare in retirement breakdown.
            Surfaces the pre-65 ACA bridge (the #1 surprise cost for early
            retirees per tester feedback) separately from Medicare-era cost.
            Includes year-by-year ACA premiums + subsidy, contrasts the
            household lifetime total against Fidelity's benchmark. */}
        <div style={{ marginTop: 16 }}>
          <HealthcareBreakdown plan={plan} />
        </div>

        {/* State Tax Warning — fires only for states still on flat-rate
            modeling. CA, NY, NJ, OR now use proper graduated brackets in
            taxEngine.ts (the four states with the steepest top brackets and
            the largest user-impact). The remaining high-graduated states
            (HI, MN, MA, WI) still flat — warning preserved for those until
            we add bracket math. */}
        {(() => {
          const FLAT_RATE_GRADUATED_STATES = ['HI', 'MN', 'MA', 'WI'];
          if (!FLAT_RATE_GRADUATED_STATES.includes(plan.stateCode)) return null;
          const isMFJ = plan.filingStatus === 'mfj';
          const highIncomeThreshold = isMFJ ? 250000 : 150000;
          // Trigger if any working year hits the threshold. baseIncome on
          // working years ≈ salary; this catches high earners pre-retirement.
          const hasHighIncomeYear = combined.some(r => !r.isRetired && (r.salary || 0) > highIncomeThreshold);
          if (!hasHighIncomeYear) return null;
          const stateNames = { HI: 'Hawaii', MN: 'Minnesota', MA: 'Massachusetts', WI: 'Wisconsin' };
          return (
            <InfoBox title={`${stateNames[plan.stateCode]} state tax is likely understated`} color="var(--warn)" bgColor="rgba(251,191,36,.08)">
              At your income level, your state's graduated brackets push the marginal rate above the single effective rate this tool uses. Real {stateNames[plan.stateCode]} liability is likely higher than the projection shows — possibly several thousand dollars per year. Graduated-bracket modeling for {stateNames[plan.stateCode]} is on the roadmap; CA, NY, NJ, and OR are already on full graduated brackets.
            </InfoBox>
          );
        })()}

        {/* IRMAA Warning */}
        {combined.some(r => r.irmaa > 0) && (
          <InfoBox icon="&#9888;&#65039;" title="IRMAA Surcharge" color="#f59e0b" bgColor="rgba(245,158,11,.08)">
            Your projected income triggers Medicare Part B IRMAA surcharges in some years.
            The highest surcharge is ${Math.max(...combined.map(r => r.irmaa)).toFixed(0)}/month.
            Consider Roth conversions or income timing strategies to reduce MAGI.
          </InfoBox>
        )}

        {/* IRMAA Cliff Detector — flag years within $5K of crossing a threshold */}
        {(() => {
          const cliffYears = combined
            .filter(r => r.isRetired && r.age >= 63 && r.magi != null)
            .map(r => ({ age: r.age, magi: r.magi, cliff: detectIrmaaCliff(r.magi, plan.filingStatus === 'mfj' ? 'mfj' : 'single') }))
            .filter(x => x.cliff.atRisk);
          if (cliffYears.length === 0) return null;
          const first = cliffYears[0];
          const nextSurchargePerBeneficiary = (() => {
            // Cost of crossing into the next tier (annual, per beneficiary)
            const currentAnnual = first.cliff.annualSurcharge;
            // Synthesize a magi just past the threshold to read the next tier
            const justOver = first.cliff.nextThreshold + 1;
            const next = detectIrmaaCliff(justOver, plan.filingStatus === 'mfj' ? 'mfj' : 'single');
            return Math.max(0, next.annualSurcharge - currentAnnual);
          })();
          return (
            <InfoBox icon="&#127919;" title="IRMAA cliff ahead" color="var(--warn)" bgColor="rgba(251,191,36,.08)">
              At age {first.age}, your projected MAGI lands within {fmt(first.cliff.distanceToNextCliff)} of the next IRMAA threshold ({fmt(first.cliff.nextThreshold)}).
              A small Roth conversion, RMD increase, or capital gain could push you over — costing roughly {fmt(nextSurchargePerBeneficiary)}/yr per Medicare beneficiary in extra Part B premiums.
              {plan.filingStatus === 'mfj' ? ' Married couples on Medicare pay the surcharge twice.' : ''}
            </InfoBox>
          );
        })()}

        {/* SS Taxability */}
        {combined.some(r => r.ssTaxablePercent > 0) && (
          <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Social Security Taxability</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              {(() => {
                const ssYears = combined.filter(r => r.socialSecurity > 0);
                const pct85 = ssYears.filter(r => r.ssTaxablePercent === 85).length;
                const pct50 = ssYears.filter(r => r.ssTaxablePercent === 50).length;
                const pct0 = ssYears.filter(r => r.ssTaxablePercent === 0).length;
                return (
                  <>
                    {pct85 > 0 && <div>{pct85} year{pct85 !== 1 ? 's' : ''} at 85% taxable</div>}
                    {pct50 > 0 && <div>{pct50} year{pct50 !== 1 ? 's' : ''} at 50% taxable</div>}
                    {pct0 > 0 && <div>{pct0} year{pct0 !== 1 ? 's' : ''} at 0% taxable</div>}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </Collapsible>
      </div>{/* end myplan-results */}
    </div>
  );
}
