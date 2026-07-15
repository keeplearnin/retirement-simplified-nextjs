'use client';

/**
 * /report — printable retirement plan report.
 *
 * Renders the user's plan (from localStorage via PlanProvider) as a clean
 * paper-styled document and offers the browser's native print dialog —
 * "Save as PDF" gives a polished, shareable report with zero PDF-library
 * dependencies. Deliberately styled with fixed light colors (not theme
 * vars) so it prints correctly from either app theme.
 */

import { useEffect, useMemo, useState } from 'react';
import { PlanProvider, usePlan, getTotalSavings } from '@/components/PlanProvider';
import { computeProjection } from '@/lib/computeProjection';
import { runDecisionEngine } from '@/lib/decisionEngine';
import { fmt } from '@/lib/format';

const ink = '#1a2333';
const dim = '#5b6779';
const line = '#d9dee7';
const accent = '#0e9f6e';

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${line}`, fontSize: 13 }}>
      <span style={{ color: dim }}>{label}</span>
      <span style={{ color: ink, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ReportBody() {
  const { plan } = usePlan();

  const { proj, decisions } = useMemo(() => {
    try {
      return { proj: computeProjection(plan), decisions: runDecisionEngine(plan) };
    } catch {
      return { proj: null, decisions: null };
    }
  }, [plan]);

  if (!proj) {
    return <p style={{ color: dim, fontSize: 14 }}>No plan data found. Set up your plan at retiresimplified.com first, then return here.</p>;
  }

  const covered = proj.moneyLastsAge >= plan.longevityAge;
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  // Every 5th projection year keeps the table to one page.
  const tableRows = proj.combined.filter((r, i) => i % 5 === 0 || r.isRetireYear);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 28px 60px', background: '#fff', minHeight: '100vh', fontFamily: 'Georgia, serif' }}>
      {/* Print button — hidden on paper */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <a href="/" style={{ color: accent, fontSize: 13, textDecoration: 'none', fontFamily: 'system-ui, sans-serif' }}>← Back to planner</a>
        <button
          onClick={() => window.print()}
          style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'system-ui, sans-serif' }}
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Header */}
      <div style={{ borderBottom: `3px solid ${ink}`, paddingBottom: 14 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: dim, fontFamily: 'system-ui, sans-serif' }}>Retire.Simplified — Plan Report</div>
        <h1 style={{ fontSize: 26, color: ink, marginTop: 6 }}>Retirement Plan Summary</h1>
        <div style={{ fontSize: 12, color: dim, marginTop: 4, fontFamily: 'system-ui, sans-serif' }}>Prepared {today} · retiresimplified.com</div>
      </div>

      {/* Verdict strip */}
      <div style={{ display: 'flex', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
        {[
          ['Money lasts to', `Age ${proj.moneyLastsAge}`, covered ? accent : '#c81e1e'],
          ['Plan horizon', `Age ${plan.longevityAge}`, ink],
          ['Portfolio at retirement', fmt(proj.portfolioAtRetire), ink],
          ['Lifetime tax', fmt(Math.round(proj.totalLifetimeTax)), ink],
        ].map(([label, value, color]) => (
          <div key={label} style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: dim, fontFamily: 'system-ui, sans-serif' }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Profile */}
      <h2 style={{ fontSize: 16, color: ink, marginTop: 28, borderBottom: `1px solid ${ink}`, paddingBottom: 6 }}>Household & Assumptions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 36 }}>
        <div>
          <Row label="Current age" value={plan.currentAge} />
          <Row label="Retirement age" value={plan.retireAge} />
          <Row label="Filing status / state" value={`${(plan.hasSpouse ? 'MFJ' : plan.filingStatus || 'single').toUpperCase()} / ${plan.stateCode}`} />
          <Row label="Total savings today" value={fmt(getTotalSavings(plan))} />
        </div>
        <div>
          <Row label="Monthly contribution" value={fmt(plan.monthlyContribution || 0)} />
          <Row label="Spending (working / retired)" value={`${fmt(plan.annualSpending)} / ${fmt(plan.retireSpending)}`} />
          <Row label="Expected return" value={`${plan.expectedReturn}%`} />
          <Row label="Inflation assumption" value={`${plan.inflationRate}%`} />
        </div>
      </div>

      {/* Recommendations */}
      {decisions && decisions.actions.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, color: ink, marginTop: 28, borderBottom: `1px solid ${ink}`, paddingBottom: 6 }}>
            Ranked Recommendations ({fmt(decisions.totalOpportunity)} total opportunity)
          </h2>
          {decisions.actions.map((a, i) => (
            <div key={a.id} style={{ marginTop: 14, breakInside: 'avoid' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: ink }}>#{i + 1} — {a.title}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>+{fmt(a.dollarValue)}</div>
              </div>
              <p style={{ fontSize: 12.5, color: dim, lineHeight: 1.55, marginTop: 4 }}>{a.detail}</p>
            </div>
          ))}
        </>
      )}

      {/* Projection table */}
      <h2 style={{ fontSize: 16, color: ink, marginTop: 28, borderBottom: `1px solid ${ink}`, paddingBottom: 6 }}>Projection (5-Year Intervals)</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10, fontSize: 11.5, fontFamily: 'system-ui, sans-serif' }}>
        <thead>
          <tr>
            {['Age', 'Income', 'Expenses', 'Taxes', 'Withdrawals', 'Portfolio (end)'].map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '6px 4px', borderBottom: `2px solid ${ink}`, color: ink, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableRows.map((r) => (
            <tr key={r.age} style={{ borderBottom: `1px solid ${line}`, background: r.isRetireYear ? '#f0faf5' : 'transparent' }}>
              <td style={{ padding: '5px 4px', fontWeight: r.isRetireYear ? 700 : 400, color: ink }}>{r.age}{r.isRetireYear ? ' ★' : ''}</td>
              <td style={{ textAlign: 'right', padding: '5px 4px', color: ink }}>{fmt(Math.round(r.totalIncome))}</td>
              <td style={{ textAlign: 'right', padding: '5px 4px', color: ink }}>{fmt(Math.round(r.totalExpense))}</td>
              <td style={{ textAlign: 'right', padding: '5px 4px', color: ink }}>{fmt(Math.round(r.totalTax))}</td>
              <td style={{ textAlign: 'right', padding: '5px 4px', color: ink }}>{fmt(Math.round(r.totalWithdrawals))}</td>
              <td style={{ textAlign: 'right', padding: '5px 4px', fontWeight: 600, color: r.portfolioEndBalance > 0 ? ink : '#c81e1e' }}>{fmt(r.portfolioEndBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 10.5, color: dim, marginTop: 6, fontFamily: 'system-ui, sans-serif' }}>★ retirement year</div>

      {/* Disclaimer */}
      <p style={{ fontSize: 10.5, color: dim, lineHeight: 1.6, marginTop: 28, borderTop: `1px solid ${line}`, paddingTop: 12, fontFamily: 'system-ui, sans-serif' }}>
        Generated by Retire.Simplified (retiresimplified.com) — free, open-source retirement planning. Educational
        projection based on your inputs and 2026 IRS/SSA/CMS figures; hypothetical, not financial advice. Past
        performance does not guarantee future results. Consult a qualified professional before acting.
      </p>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          @page { margin: 14mm; }
        }
      `}</style>
    </div>
  );
}

export default function ReportPage() {
  // The report depends on localStorage (the plan) and today's date — both
  // differ between server prerender and client, so render client-side only
  // to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ background: '#e8ebf0', minHeight: '100vh' }} />;

  return (
    <PlanProvider>
      <div style={{ background: '#e8ebf0', minHeight: '100vh' }}>
        <ReportBody />
      </div>
    </PlanProvider>
  );
}
