'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import Card from '@/components/ui/Card';
import Slider from '@/components/ui/Slider';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { fmt, fmtFull } from '@/lib/format';
import { useLocalState } from '@/lib/useLocalState';
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

const INCOME_TEMPLATES = {
  salary: { type: 'salary', label: 'Salary', amount: 100000, growthRate: 3 },
  socialSecurity: { type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2500, startAge: 67 },
  pension: { type: 'pension', label: 'Pension', monthlyAmount: 1500, startAge: 65, cola: true },
  rental: { type: 'rental', label: 'Rental Income', monthlyNet: 1500, appreciation: 3 },
};

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

const DEFAULT_PLAN = {
  currentAge: 40,
  retireAge: 65,
  longevityAge: 95,
  filingStatus: 'single',
  stateCode: 'CA',
  // Savings / portfolio
  savings401k: 150000,
  savingsRoth: 50000,
  savingsTaxable: 30000,
  savingsHSA: 10000,
  monthlyContribution: 1500,
  expectedReturn: 7,
  // Expenses
  annualSpending: 80000,
  expenseMode: 'simple',
  expenseBreakdown: null,
  goGoEndAge: 75,
  slowGoEndAge: 85,
  // Income
  incomeSources: [
    { id: 1, type: 'salary', label: 'Salary', amount: 100000, growthRate: 3 },
    { id: 2, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2500, startAge: 67 },
  ],
};

// nextIncomeId moved to useRef inside component

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
// SVG Area Chart
// ---------------------------------------------------------------------------

function IncomeExpenseChart({ projections, retireAge }) {
  const W = 700, H = 320, PAD = { top: 20, right: 20, bottom: 40, left: 70 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  if (!projections || projections.length === 0) return null;

  const maxVal = Math.max(
    ...projections.map(p => Math.max(p.totalIncome, p.totalExpense))
  ) * 1.1;
  const ages = projections.map(p => p.age);
  const minAge = ages[0];
  const maxAge = ages[ages.length - 1];

  const x = (age) => PAD.left + ((age - minAge) / (maxAge - minAge)) * plotW;
  const y = (val) => PAD.top + plotH - (val / maxVal) * plotH;

  // Income area path
  const incomePoints = projections.map(p => `${x(p.age)},${y(p.totalIncome)}`).join(' ');
  const incomeArea = `M ${x(minAge)},${y(0)} L ${incomePoints} L ${x(maxAge)},${y(0)} Z`;

  // Expense line
  const expenseLine = projections.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.age)},${y(p.totalExpense)}`).join(' ');

  // Income breakdown stacks
  const incomeKeys = ['salary', 'socialSecurity', 'pension', 'rental'];
  const incomeColors = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa'];

  // Build stacked areas
  const stackedAreas = [];
  for (let k = 0; k < incomeKeys.length; k++) {
    const key = incomeKeys[k];
    const topPoints = [];
    const bottomPoints = [];
    for (const p of projections) {
      let stackBottom = 0;
      for (let j = 0; j < k; j++) {
        stackBottom += p[incomeKeys[j]] || 0;
      }
      const stackTop = stackBottom + (p[key] || 0);
      topPoints.push(`${x(p.age)},${y(stackTop)}`);
      bottomPoints.push(`${x(p.age)},${y(stackBottom)}`);
    }
    bottomPoints.reverse();
    const areaPath = `M ${topPoints.join(' L ')} L ${bottomPoints.join(' L ')} Z`;
    stackedAreas.push({ key, color: incomeColors[k], path: areaPath });
  }

  // Y-axis ticks
  const yTicks = [];
  const tickStep = maxVal > 500000 ? 100000 : maxVal > 200000 ? 50000 : 25000;
  for (let v = 0; v <= maxVal; v += tickStep) {
    yTicks.push(v);
  }

  // X-axis ticks every 5 years
  const xTicks = [];
  for (let a = Math.ceil(minAge / 5) * 5; a <= maxAge; a += 5) {
    xTicks.push(a);
  }

  const retireX = x(retireAge);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
        {/* Grid */}
        {yTicks.map(v => (
          <line key={v} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={0.5} />
        ))}

        {/* Stacked income areas */}
        {stackedAreas.map(sa => (
          <path key={sa.key} d={sa.path} fill={sa.color} opacity={0.35} />
        ))}

        {/* Expense line */}
        <path d={expenseLine} fill="none" stroke="#ef4444" strokeWidth={2.5} strokeDasharray="6,3" />

        {/* Retirement marker */}
        <line x1={retireX} x2={retireX} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4,4" />
        <text x={retireX} y={PAD.top - 4} textAnchor="middle" fill="var(--accent)" fontSize={10} fontFamily="var(--sans)">Retire {retireAge}</text>

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
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, justifyContent: 'center' }}>
        {incomeKeys.map((key, i) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: incomeColors[i], opacity: 0.7 }} />
            {key === 'socialSecurity' ? 'Social Security' : key.charAt(0).toUpperCase() + key.slice(1)}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ width: 12, height: 3, background: '#ef4444', borderRadius: 2 }} />
          Expenses
        </div>
      </div>
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
            {['Age', 'Income', 'Expenses', 'Fed Tax', 'State Tax', 'Net After Tax', 'Surplus / Gap'].map(h => (
              <th key={h} style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map(r => {
            const gapColor = r.gap >= 0 ? '#34d399' : '#ef4444';
            return (
              <tr key={r.age} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: r.isRetireYear ? 700 : 400, color: r.isRetireYear ? 'var(--accent)' : 'var(--text)' }}>{r.age}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text)' }}>{fmt(r.totalIncome)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text)' }}>{fmt(r.totalExpense)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(r.federalTax)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(r.stateTax)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text)' }}>{fmt(r.netAfterTax)}</td>
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
  const incomeIdRef = useRef(100);
  const [plan, setPlan] = useLocalState('myplan-v1', DEFAULT_PLAN);

  const updatePlan = useCallback((key, val) => {
    setPlan(prev => ({ ...prev, [key]: val }));
  }, [setPlan]);

  const updateIncome = useCallback((id, updated) => {
    setPlan(prev => ({
      ...prev,
      incomeSources: prev.incomeSources.map(s => s.id === id ? updated : s),
    }));
  }, [setPlan]);

  const removeIncome = useCallback((id) => {
    setPlan(prev => ({
      ...prev,
      incomeSources: prev.incomeSources.filter(s => s.id !== id),
    }));
  }, [setPlan]);

  const addIncome = useCallback((type) => {
    const template = INCOME_TEMPLATES[type];
    if (!template) return;
    incomeIdRef.current += 1;
    setPlan(prev => ({
      ...prev,
      incomeSources: [...prev.incomeSources, { ...template, id: incomeIdRef.current }],
    }));
  }, [setPlan]);

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

    // Build expense plan
    const expensePlan = createDefaultExpensePlan(currentAge, retireAge, annualSpending);
    expensePlan.longevityAge = longevityAge;
    expensePlan.goGoEndAge = goGoEndAge;
    expensePlan.slowGoEndAge = slowGoEndAge;

    const expenseProjections = projectExpenses(expensePlan);

    // Compute essential vs discretionary totals for display
    const essentialTotal = expensePlan.essentialExpenses.reduce((s, e) => s + e.annualAmount, 0);
    const discretionaryTotal = expensePlan.discretionaryExpenses.reduce((s, e) => s + e.annualAmount, 0);

    // Portfolio balance tracking — grows with returns + contributions, draws down in retirement
    let portfolioBalance = (plan.savings401k || 0) + (plan.savingsRoth || 0) + (plan.savingsTaxable || 0) + (plan.savingsHSA || 0);
    const startingBalance = portfolioBalance;

    // Combine with taxes + portfolio tracking
    const combined = incomeProjections.map((inc, i) => {
      const exp = expenseProjections[i] || { totalExpense: 0, healthcare: 0 };

      // Compute ordinary income for tax
      const ordinaryIncome = inc.salary + inc.pension + inc.rental + inc.annuity + inc.rmd + inc.partTime + inc.otherIncome;

      const taxResult = computeTax({
        filingStatus,
        ordinaryIncome,
        socialSecurityBenefit: inc.socialSecurity,
        capitalGains: 0,
        stateCode,
        age: inc.age,
      });

      const netAfterTax = inc.totalIncome - taxResult.totalTax;
      const gap = netAfterTax - exp.totalExpense;

      // Portfolio: grow by return, add contributions pre-retirement, withdraw gap post-retirement
      const balanceStart = portfolioBalance;
      portfolioBalance = portfolioBalance * (1 + returnRate);
      if (!inc.isRetired) {
        portfolioBalance += monthlyContrib * 12; // saving
      }
      if (gap < 0) {
        portfolioBalance += gap; // withdraw from savings (gap is negative)
      }
      if (portfolioBalance < 0) portfolioBalance = 0;

      return {
        age: inc.age,
        year: inc.year,
        salary: inc.salary,
        socialSecurity: inc.socialSecurity,
        pension: inc.pension,
        rental: inc.rental,
        totalIncome: inc.totalIncome,
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
    const retireRow = combined.find(r => r.age === retireAge);
    const portfolioAtRetire = retireRow ? retireRow.portfolioBalance : 0;

    // Summary metrics
    const totalLifetimeIncome = combined.reduce((s, r) => s + r.totalIncome, 0);
    const totalLifetimeTax = combined.reduce((s, r) => s + r.totalTax, 0);
    const totalLifetimeExpense = combined.reduce((s, r) => s + r.totalExpense, 0);
    const totalSurplusOrShortfall = combined.reduce((s, r) => s + r.gap, 0);
    const yearsWithPositiveGap = combined.filter(r => r.gap >= 0 || r.portfolioBalance > 0).length;
    const avgEffectiveRate = totalLifetimeIncome > 0 ? totalLifetimeTax / totalLifetimeIncome : 0;

    // Find when portfolio runs out
    let moneyLastsAge = longevityAge;
    for (const r of combined) {
      if (r.isRetired && r.portfolioBalance <= 0 && r.gap < 0) {
        moneyLastsAge = r.age;
        break;
      }
    }

    // Find when money runs out (cumulative gap)
    let cumulativeGap = 0;
    // moneyLastsAge already calculated above
    for (const r of combined) {
      cumulativeGap += r.gap;
      // This is simplified - just tracks first gap year
    }

    const firstGapAge = combined.find(r => r.gap < 0)?.age;

    return {
      combined,
      essentialTotal,
      discretionaryTotal,
      startingBalance,
      portfolioAtRetire,
      finalBalance: Math.round(portfolioBalance),
      totalLifetimeIncome,
      totalLifetimeTax,
      totalLifetimeExpense,
      totalSurplusOrShortfall,
      yearsWithPositiveGap,
      avgEffectiveRate,
      moneyLastsAge,
      firstGapAge,
    };
  }, [plan]);

  const { combined, essentialTotal, discretionaryTotal } = results;

  // Monthly snapshot for "now" and "at retirement"
  const nowRow = combined.find(r => r.age === plan.currentAge) || combined[0] || {};
  const retireRow = combined.find(r => r.age === plan.retireAge) || {};
  const nowMonthlyIncome = Math.round((nowRow.totalIncome || 0) / 12);
  const nowMonthlyExpense = Math.round((nowRow.totalExpense || 0) / 12);
  const nowMonthlyNet = nowMonthlyIncome - nowMonthlyExpense;
  const retireMonthlyIncome = Math.round((retireRow.totalIncome || 0) / 12);
  const retireMonthlyExpense = Math.round((retireRow.totalExpense || 0) / 12);
  const retireMonthlyNet = retireMonthlyIncome - retireMonthlyExpense;

  // Add income dropdown
  const [showAddMenu, setShowAddMenu] = useState(false);
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
    <div className="slide-in">
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
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Gap</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: retireMonthlyNet >= 0 ? 'var(--accent)' : 'var(--warn)' }}>
              {retireMonthlyNet >= 0 ? '+' : '-'}{fmtFull(Math.abs(retireMonthlyNet))}/mo
            </span>
          </div>
          {retireMonthlyNet < 0 && results.portfolioAtRetire > 0 && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'right', marginTop: 2 }}>
              {fmt(results.portfolioAtRetire)} covers ~{Math.round(results.portfolioAtRetire / (Math.abs(retireMonthlyNet) * 12))} years of gap
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

      {/* ============ INPUTS (collapsible, below results) ============ */}

      {/* Personal Info — compact inline */}
      <Collapsible title="Savings & Portfolio" defaultOpen={false} badge={fmt(results.startingBalance)}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div>
            <Slider label="401(k) / 403(b)" value={plan.savings401k} onChange={v => updatePlan('savings401k', v)} min={0} max={3000000} step={5000} format={fmt} />
            <Slider label="Roth IRA" value={plan.savingsRoth} onChange={v => updatePlan('savingsRoth', v)} min={0} max={1000000} step={5000} format={fmt} />
          </div>
          <div>
            <Slider label="Taxable Brokerage" value={plan.savingsTaxable} onChange={v => updatePlan('savingsTaxable', v)} min={0} max={2000000} step={5000} format={fmt} />
            <Slider label="HSA" value={plan.savingsHSA} onChange={v => updatePlan('savingsHSA', v)} min={0} max={200000} step={1000} format={fmt} />
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
          <Slider label="Monthly Investment" value={plan.monthlyContribution} onChange={v => updatePlan('monthlyContribution', v)} min={0} max={10000} step={100} format={fmt} />
          <Slider label="Expected Return" value={plan.expectedReturn} onChange={v => updatePlan('expectedReturn', v)} min={3} max={12} step={0.5} suffix="%" />
        </div>
      </Collapsible>

      <Collapsible title="Personal Info" defaultOpen={false} badge={`Age ${plan.currentAge}, retire ${plan.retireAge}`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
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
        </div>
      </Collapsible>

      {/* ---- Section 2: Income Sources ---- */}
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

      {/* ---- Expenses with Simple/Detailed Toggle ---- */}
      <Collapsible title="Expenses" defaultOpen={false} badge={expenseMode === 'simple' ? fmt(plan.annualSpending) + '/yr' : fmt(detailedTotal) + '/yr'}>
        {/* Mode toggle */}
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
            <Slider label="Total Annual Spending" value={plan.annualSpending} onChange={v => updatePlan('annualSpending', v)} min={30000} max={300000} step={5000} format={fmt} />
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>Essential (~60%)</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>{fmt(essentialTotal)}/yr</div>
              </div>
              <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>Discretionary (~40%)</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--blue)', marginTop: 2 }}>{fmt(discretionaryTotal)}/yr</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
              Customize each category. Total: <strong style={{ color: 'var(--text)' }}>{fmtFull(detailedTotal)}/yr</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} className="grid-2">
              {EXPENSE_CATEGORIES.map(cat => {
                const val = expenseBreakdown[cat.key] || 0;
                const isEssential = cat.type === 'essential';
                return (
                  <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: isEssential ? 'var(--accent)' : 'var(--blue)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{cat.label}</span>
                    <input
                      type="number"
                      value={val}
                      onChange={e => {
                        const newBreakdown = { ...expenseBreakdown, [cat.key]: Math.max(0, parseInt(e.target.value) || 0) };
                        updatePlan('expenseBreakdown', newBreakdown);
                        updatePlan('annualSpending', Object.values(newBreakdown).reduce((s, v) => s + v, 0));
                      }}
                      style={{
                        width: 80, padding: '4px 8px', borderRadius: 6, textAlign: 'right',
                        border: '1px solid var(--border)', background: 'var(--bg)',
                        color: 'var(--text)', fontSize: 12, fontFamily: 'var(--sans)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
            {/* Visual bar showing essential vs discretionary */}
            <div style={{ marginTop: 12, height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', background: 'var(--bg)' }}>
              {(() => {
                const essTotal = EXPENSE_CATEGORIES.filter(c => c.type === 'essential').reduce((s, c) => s + (expenseBreakdown[c.key] || 0), 0);
                const discTotal = detailedTotal - essTotal;
                const essPct = detailedTotal > 0 ? (essTotal / detailedTotal) * 100 : 60;
                return (
                  <>
                    <div style={{ width: `${essPct}%`, background: 'var(--accent)', transition: 'width .3s' }} />
                    <div style={{ width: `${100 - essPct}%`, background: 'var(--blue)', transition: 'width .3s' }} />
                  </>
                );
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-dim)' }}>
              <span style={{ color: 'var(--accent)' }}>Essential</span>
              <span style={{ color: 'var(--blue)' }}>Discretionary</span>
            </div>
          </>
        )}

        {/* Spending phases */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Retirement Spending Phases</div>
          <Slider label="Go-Go Ends" value={plan.goGoEndAge} onChange={v => updatePlan('goGoEndAge', v)} min={plan.retireAge} max={plan.slowGoEndAge - 1} />
          <Slider label="Slow-Go Ends" value={plan.slowGoEndAge} onChange={v => updatePlan('slowGoEndAge', v)} min={plan.goGoEndAge + 1} max={plan.longevityAge - 1} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Go-Go: 100% spending · Slow-Go: 85% · No-Go ({plan.slowGoEndAge}+): 70%
          </div>
        </div>
      </Collapsible>

      {/* Year-by-Year & Tax (below inputs) */}
      <Collapsible title="Year-by-Year Summary" defaultOpen={false} badge="Every 5 years">
        <SummaryTable rows={combined} />
      </Collapsible>

      {/* ---- Tax Summary ---- */}
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
    </div>
  );
}
