'use client';

import { useState, useMemo } from 'react';
import Card from '@/components/ui/Card';
import Slider from '@/components/ui/Slider';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt, fmtFull } from '@/lib/format';
import { usePlan, INCOME_TEMPLATES, DEBT_TEMPLATES } from '@/components/PlanProvider';
import { projectIncome } from '@/lib/incomeEngine';
import { projectExpenses, createDefaultExpensePlan } from '@/lib/expenseEngine';
import { computeTax, computeSSTaxable } from '@/lib/taxEngine';

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
        }}
      >
        <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}>
          {title}
          {badge && <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--sans)', fontWeight: 600 }}>{badge}</span>}
        </span>
        <span style={{ fontSize: 14, color: 'var(--text-dim)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>
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

function IncomeSourceCard({ source, onChange, onRemove, retireAge }) {
  const update = (key, val) => onChange({ ...source, [key]: val });

  return (
    <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12, background: 'var(--bg2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{source.label}</span>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 18 }} title="Remove">&times;</button>
      </div>

      {source.type === 'salary' && (
        <>
          <Slider label="Annual Salary" value={source.amount} onChange={v => update('amount', v)} min={20000} max={500000} step={5000} prefix="$" format={v => (v/1000).toFixed(0) + 'K'} />
          <Slider label="Annual Growth" value={source.growthRate} onChange={v => update('growthRate', v)} min={0} max={8} step={0.5} suffix="%" />
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Stops at retirement age ({retireAge})</div>
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
  if (debt.monthlyPayment > 0 && debt.remainingBalance > 0) {
    if (monthlyRate > 0) {
      payoffMonths = Math.ceil(-Math.log(1 - monthlyRate * debt.remainingBalance / debt.monthlyPayment) / Math.log(1 + monthlyRate));
      if (!isFinite(payoffMonths) || payoffMonths < 0) payoffMonths = 999;
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
          <span style={{ fontSize: 11, color: payoffAge <= 65 ? 'var(--accent)' : 'var(--warn)' }}>
            Paid off at {payoffAge}
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
    suggestions.push({ id: 'portfolio-gap', severity: 'danger', title: `Savings run out at age ${gap}`, detail: `Increase monthly savings or reduce spending to extend your money to age ${plan.longevityAge}.` });
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

function IncomeExpenseChart({ projections, retireAge }) {
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

  // Portfolio balance area (the big one — shows wealth over time)
  const portfolioPoints = projections.map(p => `${x(p.age)},${y(p.portfolioBalance || 0)}`).join(' ');
  const portfolioArea = `M ${x(minAge)},${y(0)} L ${portfolioPoints} L ${x(maxAge)},${y(0)} Z`;

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
  const legacy = lastRow?.portfolioBalance || 0;

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
          {/* Grid */}
          {yTicks.map(v => (
            <line key={v} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={0.5} />
          ))}

          {/* Portfolio balance area — the hero curve */}
          <path d={portfolioArea} fill="url(#portfolioGrad)" opacity={0.25} />
          <path d={`M ${portfolioPoints}`} fill="none" stroke="var(--accent)" strokeWidth={2.5} />

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

          {/* Legacy label at end */}
          {legacy > 0 && (
            <>
              <circle cx={x(maxAge)} cy={y(legacy)} r={4} fill="var(--accent)" />
              <text x={x(maxAge) - 8} y={y(legacy) - 10} textAnchor="end" fill="var(--accent)" fontSize={10} fontWeight={600} fontFamily="var(--sans)">
                Legacy: {fmt(legacy)}
              </text>
            </>
          )}
          {legacy <= 0 && (
            (() => {
              const brokeRow = projections.find(p => p.isRetired && p.portfolioBalance <= 0);
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
          <div style={{ width: 14, height: 3, background: 'var(--accent)', borderRadius: 2 }} /> Portfolio Balance
        </div>
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

      {/* Legacy callout */}
      {legacy > 0 && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid rgba(52,211,153,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Estate / Legacy for Family</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Projected portfolio remaining at age {maxAge}</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--sans)' }}>{fmt(legacy)}</div>
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

  // Find when portfolio runs out AND there's a gap (income < expenses)
  const brokeAge = projections.find(p => p.isRetired && p.portfolioBalance <= 0 && p.gap < 0)?.age;
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
  const displayRows = rows.filter((_, i) => i % 5 === 0 || i === rows.length - 1);

  return (
    <div style={{ overflowX: 'auto', marginTop: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--sans)' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {['Age', 'Portfolio', 'Salary', 'SS + Other', 'Withdrawals', 'Expenses', 'Tax', 'Surplus / Gap'].map(h => (
              <th key={h} style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((r, i) => {
            const gapColor = r.gap >= 0 ? '#34d399' : '#ef4444';
            const prevBal = i > 0 ? displayRows[i - 1].portfolioBalance : 0;
            const balColor = r.portfolioBalance >= prevBal ? 'var(--accent)' : 'var(--warn)';
            return (
              <tr key={r.age} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: r.isRetireYear ? 700 : 400, color: r.isRetireYear ? 'var(--accent)' : 'var(--text)' }}>{r.age}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: balColor, fontWeight: 600 }}>{fmt(r.portfolioBalance)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: r.salary > 0 ? 'var(--text)' : 'var(--text-dim)' }}>{r.salary > 0 ? fmt(r.salary) : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: r.ssAndOther > 0 ? 'var(--blue)' : 'var(--text-dim)' }}>{r.ssAndOther > 0 ? fmt(r.ssAndOther) : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: r.totalWithdrawals > 0 ? 'var(--purple)' : 'var(--text-dim)' }}>{r.totalWithdrawals > 0 ? fmt(r.totalWithdrawals) : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text)' }}>{fmt(r.totalExpense)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(r.totalTax)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: gapColor, fontWeight: 600 }}>
                  {r.gap >= 0 ? '+' : ''}{fmt(Math.abs(r.gap))}{r.gap < 0 ? ' gap' : ''}
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
// Main Component
// ---------------------------------------------------------------------------

export default function MyPlan() {
  const { plan, updatePlan, updateIncome, removeIncome, addIncome, addDebt, updateDebt, removeDebt } = usePlan();

  // ---- Heavy computation ----
  const results = useMemo(() => {
    const { currentAge, retireAge, longevityAge, filingStatus, stateCode, annualSpending, goGoEndAge, slowGoEndAge, incomeSources } = plan;
    const returnRate = (plan.expectedReturn || 7) / 100;
    const monthlyContrib = plan.monthlyContribution || 0;

    // Build income plan
    const salarySource = incomeSources.find(s => s.type === 'salary');
    const ssSource = incomeSources.find(s => s.type === 'socialSecurity');
    const pensionSource = incomeSources.find(s => s.type === 'pension');
    const rentalSource = incomeSources.find(s => s.type === 'rental');

    const incomePlan = {
      currentAge,
      retireAge,
      longevityAge,
      salary: salarySource ? { annualAmount: salarySource.amount, growthRate: salarySource.growthRate / 100 } : undefined,
      socialSecurity: ssSource ? { monthlyBenefitAtFRA: ssSource.monthlyBenefit, startAge: ssSource.startAge, cola: 0.02 } : undefined,
      pension: pensionSource ? { monthlyAmount: pensionSource.monthlyAmount, startAge: pensionSource.startAge, cola: pensionSource.cola ? 0.02 : 0 } : undefined,
      rental: rentalSource ? { monthlyNetIncome: rentalSource.monthlyNet, annualAppreciation: rentalSource.appreciation / 100 } : undefined,
    };

    const incomeProjections = projectIncome(incomePlan);

    // Build TWO expense plans: one for working years, one for retirement
    const retireSpend = plan.retireSpending || Math.round(annualSpending * 0.8);
    const inflationRate = (plan.inflationRate || 2.5) / 100;

    // Working years: use current spending
    const workingExpensePlan = createDefaultExpensePlan(currentAge, retireAge, annualSpending);
    workingExpensePlan.longevityAge = longevityAge;
    workingExpensePlan.goGoEndAge = goGoEndAge;
    workingExpensePlan.slowGoEndAge = slowGoEndAge;
    workingExpensePlan.inflationRate = inflationRate;
    workingExpensePlan.healthcareInflation = (plan.healthcareInflation || 3.5) / 100;
    // Pass debts to expense engine
    if (plan.debts && plan.debts.length > 0) {
      workingExpensePlan.debts = plan.debts.map(d => ({
        name: d.name,
        monthlyPayment: d.monthlyPayment,
        remainingBalance: d.remainingBalance,
        interestRate: d.interestRate / 100,
        payoffAge: (() => {
          const mr = (d.interestRate || 0) / 100 / 12;
          if (d.monthlyPayment <= 0 || d.remainingBalance <= 0) return currentAge;
          const months = mr > 0
            ? Math.ceil(-Math.log(1 - mr * d.remainingBalance / d.monthlyPayment) / Math.log(1 + mr))
            : Math.ceil(d.remainingBalance / d.monthlyPayment);
          return currentAge + Math.ceil((isFinite(months) && months > 0 ? months : 0) / 12);
        })(),
      }));
    }

    // Retirement years: use retirement spending as base (in today's dollars)
    const retireExpensePlan = createDefaultExpensePlan(currentAge, retireAge, retireSpend);
    retireExpensePlan.longevityAge = longevityAge;
    retireExpensePlan.goGoEndAge = goGoEndAge;
    retireExpensePlan.slowGoEndAge = slowGoEndAge;
    retireExpensePlan.inflationRate = inflationRate;
    retireExpensePlan.healthcareInflation = (plan.healthcareInflation || 3.5) / 100;

    const workingProjections = projectExpenses(workingExpensePlan);
    const retireProjections = projectExpenses(retireExpensePlan);

    // Merge: use working projections pre-retirement, retire projections post-retirement
    const expenseProjections = workingProjections.map((wp, i) => {
      const rp = retireProjections[i];
      if (wp.phase === 'working') return wp;
      // Post-retirement: use the retirement-spending-based projection
      return rp || wp;
    });

    // Compute essential vs discretionary totals for display
    const essentialTotal = workingExpensePlan.essentialExpenses.reduce((s, e) => s + e.annualAmount, 0);
    const discretionaryTotal = workingExpensePlan.discretionaryExpenses.reduce((s, e) => s + e.annualAmount, 0);
    const retireScale = annualSpending > 0 ? retireSpend / annualSpending : 1;
    const retireEssentialTotal = Math.round(essentialTotal * retireScale);
    const retireDiscretionaryTotal = Math.round(discretionaryTotal * retireScale);

    // Track account types separately for tax-aware withdrawals
    let bal401k = plan.savings401k || 0;
    let balRoth = plan.savingsRoth || 0;
    let balTaxable = plan.savingsTaxable || 0;
    let balHSA = plan.savingsHSA || 0;
    let balCash = plan.savingsCash || 0;
    let balCrypto = plan.savingsCrypto || 0;
    let balPension = plan.savingsPension || 0;
    let balAnnuity = plan.savingsAnnuity || 0;
    let balRealEstate = plan.savingsRealEstate || 0;
    let bal529 = plan.savings529 || 0;
    let portfolioBalance = bal401k + balRoth + balTaxable + balHSA + balCash + balCrypto + balPension + balAnnuity + balRealEstate + bal529;
    const startingBalance = portfolioBalance;
    const RMD_START = 73;

    // RMD divisor table (simplified — key ages)
    const rmdDivisor = (age) => {
      const table = { 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9 };
      return table[Math.min(age, 95)] || 8.9;
    };

    // Combine with taxes + portfolio tracking
    const combined = incomeProjections.map((inc, i) => {
      const exp = expenseProjections[i] || { totalExpense: 0, healthcare: 0 };
      const age = inc.age;

      // --- RMD calculation (age 73+ from 401k balance) ---
      let rmdAmount = 0;
      if (age >= RMD_START && bal401k > 0) {
        rmdAmount = Math.round(bal401k / rmdDivisor(age));
      }

      // --- Base income (before withdrawals — RMD excluded here, counted as withdrawal) ---
      const baseOrdinaryIncome = inc.salary + inc.pension + inc.rental + inc.annuity + inc.partTime + inc.otherIncome;
      const baseIncome = baseOrdinaryIncome + inc.socialSecurity;

      // --- First pass: compute taxes on known income ---
      const taxPass1 = computeTax({
        filingStatus, ordinaryIncome: baseOrdinaryIncome,
        socialSecurityBenefit: inc.socialSecurity, capitalGains: 0,
        stateCode, age,
      });

      const netAfterTax1 = baseIncome - taxPass1.totalTax;
      const shortfall = exp.totalExpense - netAfterTax1; // positive = need to withdraw

      // --- Portfolio withdrawal (if shortfall exists) ---
      let withdrawal401k = 0, withdrawalRoth = 0, withdrawalTaxable = 0;
      let withdrawalCash = 0, withdrawalCrypto = 0, withdrawalAnnuity = 0, withdrawalPension = 0;

      if (shortfall > 0 && inc.isRetired && portfolioBalance > 0) {
        // Withdrawal order: Cash → Taxable + Crypto → Annuity → 401k + Pension → Roth
        // (Real estate & 529 excluded — illiquid / education-only)
        let remaining = shortfall;

        // 1. Cash/Savings (most liquid, interest taxed as ordinary income)
        if (remaining > 0 && balCash > 0) {
          withdrawalCash = Math.min(remaining, balCash);
          remaining -= withdrawalCash;
        }

        // 2. Taxable brokerage (only gains taxed at ~15% LTCG)
        if (remaining > 0 && balTaxable > 0) {
          withdrawalTaxable = Math.min(remaining, balTaxable);
          remaining -= withdrawalTaxable;
        }

        // 3. Crypto (LTCG treatment)
        if (remaining > 0 && balCrypto > 0) {
          withdrawalCrypto = Math.min(remaining, balCrypto);
          remaining -= withdrawalCrypto;
        }

        // 4. Annuity (partially taxable — gains portion)
        if (remaining > 0 && balAnnuity > 0) {
          withdrawalAnnuity = Math.min(remaining, balAnnuity);
          remaining -= withdrawalAnnuity;
        }

        // 5. 401(k) — fully taxable as ordinary income
        if (remaining > 0 && bal401k > 0) {
          const marginalRate = taxPass1.marginalRate || 0.22;
          const grossUp = remaining / (1 - marginalRate);
          withdrawal401k = Math.min(grossUp, bal401k);
          remaining -= withdrawal401k * (1 - marginalRate);
        }

        // 6. Pension pot — taxed as ordinary income like 401k
        if (remaining > 0 && balPension > 0) {
          const marginalRate = taxPass1.marginalRate || 0.22;
          const grossUp = remaining / (1 - marginalRate);
          withdrawalPension = Math.min(grossUp, balPension);
          remaining -= withdrawalPension * (1 - marginalRate);
        }

        // 7. Roth — tax-free (last)
        if (remaining > 0 && balRoth > 0) {
          withdrawalRoth = Math.min(remaining, balRoth);
          remaining -= withdrawalRoth;
        }
      }

      // Ensure RMD is withdrawn even if no shortfall
      if (rmdAmount > 0 && withdrawal401k < rmdAmount) {
        withdrawal401k = rmdAmount;
      }

      // --- Second pass: recompute taxes with withdrawal income ---
      const totalOrdinaryIncome = baseOrdinaryIncome + withdrawal401k + withdrawalPension + withdrawalCash;
      const capitalGains = (withdrawalTaxable > 0 ? Math.round(withdrawalTaxable * 0.5) : 0)
        + (withdrawalCrypto > 0 ? Math.round(withdrawalCrypto * 0.5) : 0)
        + (withdrawalAnnuity > 0 ? Math.round(withdrawalAnnuity * 0.3) : 0); // annuity: ~30% gains portion

      const taxResult = computeTax({
        filingStatus, ordinaryIncome: totalOrdinaryIncome,
        socialSecurityBenefit: inc.socialSecurity, capitalGains,
        stateCode, age,
      });

      const totalIncome = baseIncome + withdrawal401k + withdrawalRoth + withdrawalTaxable
        + withdrawalCash + withdrawalCrypto + withdrawalAnnuity + withdrawalPension;
      const netAfterTax = totalIncome - taxResult.totalTax;
      const gap = netAfterTax - exp.totalExpense;

      // --- Update account balances ---
      const balanceStart = portfolioBalance;
      const retiredReturnPct = (plan.retiredReturnPct || 60) / 100;
      const retiredReturn = inc.isRetired ? returnRate * retiredReturnPct : returnRate;
      const cashRate = (plan.cashReturn || 3) / 100;
      const annuityRate = (plan.annuityReturn || 3.5) / 100;
      const reRate = (plan.realEstateAppreciation || 3) / 100;

      if (!inc.isRetired) {
        // Working: grow all accounts + add contributions (split: 60% 401k, 20% Roth, 20% taxable)
        bal401k = bal401k * (1 + returnRate) + monthlyContrib * 12 * 0.6;
        balRoth = balRoth * (1 + returnRate) + monthlyContrib * 12 * 0.2;
        balTaxable = balTaxable * (1 + returnRate) + monthlyContrib * 12 * 0.2;
        balHSA = balHSA * (1 + returnRate * 0.5);
        balCash = balCash * (1 + cashRate);
        balCrypto = balCrypto * (1 + returnRate);
        balPension = balPension * (1 + returnRate * 0.6);
        balAnnuity = balAnnuity * (1 + annuityRate);
        balRealEstate = balRealEstate * (1 + reRate);
        bal529 = bal529 * (1 + returnRate * 0.8);
      } else {
        // Retired: withdraw first, then grow remainder (beginning-of-year withdrawal)
        bal401k = Math.max(0, (bal401k - withdrawal401k) * (1 + retiredReturn));
        balRoth = Math.max(0, (balRoth - withdrawalRoth) * (1 + retiredReturn));
        balTaxable = Math.max(0, (balTaxable - withdrawalTaxable) * (1 + retiredReturn));
        balHSA = Math.max(0, balHSA * (1 + retiredReturn * 0.5));
        balCash = Math.max(0, (balCash - withdrawalCash) * (1 + cashRate * 0.8));
        balCrypto = Math.max(0, (balCrypto - withdrawalCrypto) * (1 + retiredReturn));
        balPension = Math.max(0, (balPension - withdrawalPension) * (1 + retiredReturn * 0.5));
        balAnnuity = Math.max(0, (balAnnuity - withdrawalAnnuity) * (1 + annuityRate));
        balRealEstate = balRealEstate * (1 + reRate);
        bal529 = bal529 * (1 + retiredReturn * 0.6);
      }
      portfolioBalance = bal401k + balRoth + balTaxable + balHSA + balCash + balCrypto + balPension + balAnnuity + balRealEstate + bal529;
      if (portfolioBalance < 0) portfolioBalance = 0;

      const totalWithdrawals = withdrawal401k + withdrawalRoth + withdrawalTaxable
        + withdrawalCash + withdrawalCrypto + withdrawalAnnuity + withdrawalPension;
      const ssAndOther = inc.socialSecurity + inc.pension + inc.rental + inc.annuity;

      return {
        age: inc.age,
        year: inc.year,
        salary: inc.salary,
        socialSecurity: inc.socialSecurity,
        pension: inc.pension,
        rental: inc.rental,
        ssAndOther,
        totalWithdrawals,
        rmd: rmdAmount,
        withdrawal401k,
        withdrawalRoth,
        withdrawalTaxable,
        totalIncome,
        totalExpense: exp.totalExpense,
        healthcare: exp.healthcare,
        federalTax: taxResult.federalTax,
        stateTax: taxResult.stateTax,
        totalTax: taxResult.totalTax,
        effectiveRate: taxResult.effectiveRate,
        irmaa: taxResult.irmaa,
        ssTaxablePercent: taxResult.ssTaxablePercent,
        netAfterTax: Math.round(netAfterTax),
        gap: Math.round(gap),
        portfolioBalance: Math.round(balanceStart),
        isRetired: inc.isRetired,
        isRetireYear: inc.age === retireAge,
      };
    });

    // Portfolio at retirement
    const retireRowData = combined.find(r => r.age === retireAge);
    const portfolioAtRetire = retireRowData ? retireRowData.portfolioBalance : 0;

    // Summary metrics
    const totalLifetimeIncome = combined.reduce((s, r) => s + r.totalIncome, 0);
    const totalLifetimeTax = combined.reduce((s, r) => s + r.totalTax, 0);
    const totalLifetimeExpense = combined.reduce((s, r) => s + r.totalExpense, 0);
    const totalSurplusOrShortfall = combined.reduce((s, r) => s + r.gap, 0);
    const avgEffectiveRate = totalLifetimeIncome > 0 ? totalLifetimeTax / totalLifetimeIncome : 0;

    // Find when you're truly broke: retired + portfolio empty + income < expenses
    // This is the definitive "money lasts to" age
    let moneyLastsAge = longevityAge;
    for (const r of combined) {
      if (r.isRetired && r.portfolioBalance <= 0 && r.gap < 0) {
        moneyLastsAge = r.age;
        break;
      }
    }

    // Count years where you're covered (income covers expenses OR portfolio can fill the gap)
    const yearsCovered = combined.filter(r => {
      if (r.gap >= 0) return true; // income covers expenses
      if (r.portfolioBalance > 0) return true; // portfolio can fill the gap
      return false;
    }).length;

    const firstGapAge = combined.find(r => r.gap < 0 && r.portfolioBalance <= 0)?.age;

    return {
      combined,
      essentialTotal,
      discretionaryTotal,
      retireEssentialTotal,
      retireDiscretionaryTotal,
      startingBalance,
      portfolioAtRetire,
      finalBalance: Math.round(portfolioBalance),
      totalLifetimeIncome,
      totalLifetimeTax,
      totalLifetimeExpense,
      totalSurplusOrShortfall,
      yearsCovered,
      avgEffectiveRate,
      moneyLastsAge,
      firstGapAge,
    };
  }, [plan]);

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
        <Collapsible title="Personal Info" defaultOpen={true} badge={`Age ${plan.currentAge}, retire ${plan.retireAge}`}>
          <div>
            <Slider label="Current Age" value={plan.currentAge} onChange={v => updatePlan('currentAge', v)} min={20} max={80} />
            <Slider label="Retirement Age" value={plan.retireAge} onChange={v => updatePlan('retireAge', v)} min={Math.max(plan.currentAge + 1, 50)} max={80} />
            <Slider label="Plan Through Age" value={plan.longevityAge} onChange={v => updatePlan('longevityAge', v)} min={Math.max(plan.retireAge + 5, 80)} max={105} />
          </div>
          <div>
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
            </div>
          </div>
        </Collapsible>

        <Collapsible title="Savings & Portfolio" defaultOpen={true} badge={fmt(results.startingBalance)}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Retirement Accounts</div>
          <Slider label="401(k) / 403(b)" value={plan.savings401k} onChange={v => updatePlan('savings401k', v)} min={0} max={3000000} step={5000} format={fmt} />
          <Slider label="Roth IRA" value={plan.savingsRoth} onChange={v => updatePlan('savingsRoth', v)} min={0} max={1000000} step={5000} format={fmt} />
          <Slider label="Pension Pot" value={plan.savingsPension || 0} onChange={v => updatePlan('savingsPension', v)} min={0} max={2000000} step={5000} format={fmt} />
          <Slider label="Annuity Value" value={plan.savingsAnnuity || 0} onChange={v => updatePlan('savingsAnnuity', v)} min={0} max={1000000} step={5000} format={fmt} />
          <Slider label="HSA" value={plan.savingsHSA} onChange={v => updatePlan('savingsHSA', v)} min={0} max={200000} step={1000} format={fmt} />

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
            <Slider label="Monthly Investment" value={plan.monthlyContribution} onChange={v => updatePlan('monthlyContribution', v)} min={0} max={10000} step={100} format={fmt} />
            <Slider label="Expected Return" value={plan.expectedReturn} onChange={v => updatePlan('expectedReturn', v)} min={3} max={12} step={0.5} suffix="%" />
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -16, marginBottom: 8 }}>
              Retirement return: {((plan.expectedReturn || 7) * 0.6).toFixed(1)}% (60% of working)
            </div>
          </div>
        </Collapsible>

        <Collapsible title="Income Sources" badge={`${plan.incomeSources.length} source${plan.incomeSources.length !== 1 ? 's' : ''}`}>
          {plan.incomeSources.map(src => (
            <IncomeSourceCard
              key={src.id}
              source={src}
              onChange={updated => updateIncome(src.id, updated)}
              onRemove={() => removeIncome(src.id)}
              retireAge={plan.retireAge}
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
                padding: 4, minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,.3)',
              }}>
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
              </div>
            )}
          </div>
        </Collapsible>

        {/* ---- Debts ---- */}
        <Collapsible title="Debts" defaultOpen={(plan.debts || []).length > 0} badge={(plan.debts || []).length > 0 ? `${fmt((plan.debts || []).reduce((s, d) => s + d.monthlyPayment, 0))}/mo` : 'None'}>
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

        <Collapsible title="Expenses" defaultOpen={true} badge={expenseMode === 'simple' ? fmt(plan.annualSpending) + '/yr' : fmt(detailedTotal) + '/yr'}>
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
          </div>
        </Collapsible>
      </div>

      {/* ============ RESULTS COLUMN ============ */}
      <div className="myplan-results">
      {/* ---- Action Items (suggestions) ---- */}
      {(() => {
        const suggestions = generateSuggestions(plan, results);
        const dismissed = (() => { try { return JSON.parse(localStorage.getItem('suggestions-dismissed') || '[]'); } catch { return []; } })();
        const active = suggestions.filter(s => !dismissed.includes(s.id));
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
                  const cur = (() => { try { return JSON.parse(localStorage.getItem('suggestions-dismissed') || '[]'); } catch { return []; } })();
                  localStorage.setItem('suggestions-dismissed', JSON.stringify([...cur, s.id]));
                  // Force re-render
                  updatePlan('_suggestionsVersion', Date.now());
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
              <span style={{ color: 'var(--text-dim)' }}>At retirement</span>
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
          <IncomeExpenseChart projections={combined} retireAge={plan.retireAge} />
        </div>
      </div>

      {/* Key Metrics — horizontal strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 20 }}>
        <MetricCard label="Portfolio at Retire" value={fmt(results.portfolioAtRetire)} color="var(--blue)" />
        <MetricCard label="Money Lasts To" value={`Age ${results.moneyLastsAge}`} color={results.moneyLastsAge >= plan.longevityAge ? '#34d399' : '#ef4444'} />
        <MetricCard label="Lifetime Income" value={fmt(results.totalLifetimeIncome)} />
        <MetricCard label="Lifetime Taxes" value={fmt(results.totalLifetimeTax)} color="#f59e0b" />
        <MetricCard label="Lifetime Expenses" value={fmt(results.totalLifetimeExpense)} />
        <MetricCard label="Avg Tax Rate" value={`${(results.avgEffectiveRate * 100).toFixed(1)}%`} color="#a78bfa" />
      </div>

      {/* Year-by-Year & Tax */}
      <Collapsible title="Year-by-Year Summary" defaultOpen={false} badge="Every 5 years">
        <SummaryTable rows={combined} />
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

        {/* IRMAA Warning */}
        {combined.some(r => r.irmaa > 0) && (
          <InfoBox icon="&#9888;&#65039;" title="IRMAA Surcharge" color="#f59e0b" bgColor="rgba(245,158,11,.08)">
            Your projected income triggers Medicare Part B IRMAA surcharges in some years.
            The highest surcharge is ${Math.max(...combined.map(r => r.irmaa)).toFixed(0)}/month.
            Consider Roth conversions or income timing strategies to reduce MAGI.
          </InfoBox>
        )}

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
