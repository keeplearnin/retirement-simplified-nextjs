'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import MiniChart from '@/components/ui/MiniChart';
import BracketButtons from '@/components/ui/BracketButtons';
import ValidationWarning from '@/components/ui/ValidationWarning';
import { fmt, fmtFull } from '@/lib/format';
import { RMD_TABLE, TAX_BRACKETS } from '@/lib/constants';
import { usePlan } from '@/components/PlanProvider';

export default function WithdrawalStrategy() {
  const { plan } = usePlan();
  const [age, setAge] = useState(() => plan.retireAge || 65);
  const [lifeExpectancy, setLifeExpectancy] = useState(() => plan.longevityAge || 90);
  const [annualSpend, setAnnualSpend] = useState(() => plan.retireSpending || Math.round((plan.annualSpending || 60000) * 0.8));
  const [returnRate, setReturnRate] = useState(5);
  const [inflationRate, setInflationRate] = useState(2.5);
  const [traditional, setTraditional] = useState(() => plan.savings401k || 500000);
  const [roth, setRoth] = useState(() => plan.savingsRoth || 200000);
  const [taxable, setTaxable] = useState(() => plan.savingsTaxable || 100000);
  const [socialSecurity, setSocialSecurity] = useState(() => {
    const ss = plan.incomeSources?.find(s => s.type === 'socialSecurity');
    return ss?.monthlyBenefit || 2000;
  });
  const [taxBracket, setTaxBracket] = useState(22);
  const [enableRothConversion, setEnableRothConversion] = useState(false);
  const [rothConversionAmt, setRothConversionAmt] = useState(40000);

  const results = useMemo(() => {
    function runProjection(conversionEnabled) {
      let tradBal = traditional;
      let rothBal = roth;
      let taxableBal = taxable;
      const projection = [];
      let moneyRunsOutAge = null;
      let totalRMDs = 0;
      let totalConversions = 0;

      const ssCola = Math.max(inflationRate - 0.5, 1) / 100; // SS COLA typically trails personal inflation by ~0.5%

      for (let y = 0; y <= lifeExpectancy - age; y++) {
        const currentAge = age + y;
        const spendInflation = Math.pow(1 + inflationRate / 100, y);
        const ssInflation = Math.pow(1 + ssCola, y);
        const ssIncome = socialSecurity * 12 * ssInflation;
        const spending = annualSpend * spendInflation;
        const gap = Math.max(0, spending - ssIncome);

        // Roth conversion FIRST (before RMD age, reduces future RMDs)
        let conversion = 0;
        if (conversionEnabled && currentAge < 73 && tradBal > 0) {
          conversion = Math.min(rothConversionAmt, tradBal);
          tradBal -= conversion;
          rothBal += conversion;
        }

        // RMD check (starts at 73 per SECURE Act 2.0)
        let rmd = 0;
        if (currentAge >= 73 && tradBal > 0) {
          const divisor = RMD_TABLE[currentAge];
          if (divisor && divisor > 0) {
            rmd = tradBal / divisor;
          }
        }

        // Withdrawal order: Taxable first, then Traditional (forced RMD + gap), then Roth
        let remaining = Math.max(0, gap);

        // 1. Take from taxable
        const fromTaxable = Math.min(remaining, taxableBal);
        taxableBal -= fromTaxable;
        remaining -= fromTaxable;

        // 2. Take from traditional — must take at least RMD, plus any remaining gap
        const tradNeeded = Math.max(remaining, rmd); // Must satisfy both gap AND RMD
        let fromTraditional = Math.min(tradNeeded, tradBal);
        tradBal -= fromTraditional;
        // Only reduce remaining by the gap portion (RMD excess doesn't count toward spending gap)
        remaining = Math.max(0, remaining - fromTraditional);

        // 3. Take from Roth (last resort, tax-free)
        const fromRoth = Math.min(remaining, rothBal);
        rothBal -= fromRoth;
        remaining -= fromRoth;

        // Growth
        taxableBal *= (1 + returnRate / 100);
        tradBal *= (1 + returnRate / 100);
        rothBal *= (1 + returnRate / 100);

        // Prevent negatives
        taxableBal = Math.max(0, taxableBal);
        tradBal = Math.max(0, tradBal);
        rothBal = Math.max(0, rothBal);

        const total = taxableBal + tradBal + rothBal;
        totalRMDs += rmd;
        totalConversions += conversion;

        // Tax impact — estimate effective bracket based on total taxable income this year
        const ordinaryIncome = fromTraditional + conversion;
        // SS taxation: 2-tier formula (single filer thresholds: $25K / $34K)
        const combinedIncome = ordinaryIncome + ssIncome * 0.5;
        let ssTaxable = 0;
        if (combinedIncome > 34000) {
          ssTaxable = Math.min(ssIncome * 0.85, 4500 + (combinedIncome - 34000) * 0.85);
        } else if (combinedIncome > 25000) {
          ssTaxable = Math.min(ssIncome * 0.50, (combinedIncome - 25000) * 0.50);
        }
        const totalTaxableIncome = ordinaryIncome + ssTaxable;
        // Progressive bracket estimate (2025 single filer)
        const effectiveBracket = totalTaxableIncome <= 11925 ? 10
          : totalTaxableIncome <= 48475 ? 12
          : totalTaxableIncome <= 103350 ? 22
          : totalTaxableIncome <= 197300 ? 24
          : totalTaxableIncome <= 250525 ? 32
          : totalTaxableIncome <= 626350 ? 35
          : 37;
        const ltcgRate = effectiveBracket <= 12 ? 0 : effectiveBracket >= 37 ? 0.20 : 0.15;
        // Gains ratio: early years ~70% gains, evolves as portfolio ages
        const gainsRatio = Math.min(0.8, 0.3 + y * 0.02); // Starts ~30%, grows ~2%/yr to max 80%
        const taxOnTraditional = fromTraditional * (effectiveBracket / 100);
        const taxOnTaxable = fromTaxable * ltcgRate * gainsRatio;
        const taxOnConversion = conversion * (effectiveBracket / 100);
        const taxOnSS = ssTaxable * (effectiveBracket / 100);
        const totalTax = taxOnTraditional + taxOnTaxable + taxOnConversion + taxOnSS;
        const afterTaxIncome = (fromTaxable + fromTraditional + fromRoth + ssIncome) - totalTax;

        projection.push({
          year: y,
          age: currentAge,
          taxable: taxableBal,
          traditional: tradBal,
          roth: rothBal,
          total,
          spending,
          ssIncome,
          rmd,
          fromTaxable,
          fromTraditional,
          fromRoth,
          conversion,
          totalTax,
          afterTaxIncome,
        });

        if (total <= 0 && !moneyRunsOutAge) {
          moneyRunsOutAge = currentAge;
          break;
        }
      }

      return { projection, moneyRunsOutAge, totalRMDs, totalConversions };
    }

    const withConversion = runProjection(enableRothConversion);
    const withoutConversion = runProjection(false);

    const totalNestEgg = traditional + roth + taxable;
    const withdrawalRate = totalNestEgg > 0 ? (annualSpend / totalNestEgg) * 100 : 0;
    const yearsOfRetirement = withConversion.moneyRunsOutAge
      ? withConversion.moneyRunsOutAge - age
      : lifeExpectancy - age;
    // Sum actual tax from projection rather than flat-rate estimate
    const conversionTaxCost = withConversion.projection.reduce((s, d) => s + (d.conversion || 0) * (taxBracket / 100), 0);

    const noConvYears = withoutConversion.moneyRunsOutAge
      ? withoutConversion.moneyRunsOutAge - age
      : lifeExpectancy - age;

    const lastWith = withConversion.projection[withConversion.projection.length - 1] || {};
    const lastWithout = withoutConversion.projection[withoutConversion.projection.length - 1] || {};

    return {
      projectionData: withConversion.projection,
      moneyRunsOutAge: withConversion.moneyRunsOutAge,
      totalNestEgg,
      withdrawalRate,
      yearsOfRetirement,
      totalRMDs: withConversion.totalRMDs,
      totalConversions: withConversion.totalConversions,
      conversionTaxCost,
      noConvYears,
      endingWithConversion: lastWith.total || 0,
      endingWithoutConversion: lastWithout.total || 0,
      noConvMoneyRunsOutAge: withoutConversion.moneyRunsOutAge,
    };
  }, [age, lifeExpectancy, annualSpend, returnRate, inflationRate, traditional, roth, taxable, socialSecurity, taxBracket, enableRothConversion, rothConversionAmt]);

  const withdrawalColor = results.withdrawalRate < 4 ? 'var(--accent)' : results.withdrawalRate <= 5 ? 'var(--warn)' : 'var(--danger)';
  const yearsColor = results.moneyRunsOutAge ? 'var(--danger)' : 'var(--accent)';
  const totalAccount = traditional + roth + taxable;

  const warnings = useMemo(() => {
    const w = [];
    if (totalAccount === 0) w.push('Total nest egg is $0 — enter your account balances.');
    if (results.withdrawalRate > 5) w.push(`Withdrawal rate of ${results.withdrawalRate.toFixed(1)}% exceeds safe limits — consider reducing spending or saving more.`);
    if (age < 59.5 && traditional > 0) w.push('Withdrawals from Traditional IRA/401(k) before age 59½ incur a 10% early withdrawal penalty (not shown).');
    if (results.moneyRunsOutAge) w.push(`Money runs out at age ${results.moneyRunsOutAge} — ${lifeExpectancy - results.moneyRunsOutAge} years short of your plan.`);
    if (enableRothConversion && rothConversionAmt > traditional * 0.1) w.push('Large Roth conversions may push you into a higher tax bracket or trigger Medicare IRMAA surcharges.');
    return w;
  }, [totalAccount, results, age, traditional, lifeExpectancy, enableRothConversion, rothConversionAmt]);

  // RMD rows for the table
  const rmdRows = results.projectionData.filter(d => d.age >= 73 && d.rmd > 0).slice(0, 15);
  let cumulativeRmd = 0;
  const rmdTableData = rmdRows.map(d => {
    cumulativeRmd += d.rmd;
    return { ...d, cumulativeRmd };
  });

  return (
    <div className="fade-up">
      <InfoBox icon="🏦" title="Retirement Withdrawal Strategy" color="var(--blue)" bgColor="var(--blue-dim)">
        The accumulation phase gets all the attention, but how you draw down is just as important. The right withdrawal order and Roth conversion strategy can save you tens of thousands in taxes.
      </InfoBox>

      <ValidationWarning warnings={warnings} />

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 32, marginTop: 16 }}>
        {/* Left Column */}
        <div>
          <Card>
            <SectionLabel>Your Retirement Accounts</SectionLabel>
            <Slider label="Traditional (401k/IRA)" value={traditional} onChange={setTraditional} min={0} max={3000000} step={10000} format={fmt} />
            <Slider label="Roth Balance" value={roth} onChange={setRoth} min={0} max={2000000} step={10000} format={fmt} />
            <Slider label="Taxable Balance" value={taxable} onChange={setTaxable} min={0} max={2000000} step={10000} format={fmt} />
            <Slider label="Social Security (monthly)" value={socialSecurity} onChange={setSocialSecurity} min={0} max={5000} step={100} prefix="$" suffix="/mo" />
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Total Nest Egg</span>
              <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 18 }}>{fmtFull(totalAccount)}</span>
            </div>
          </Card>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Spending &amp; Assumptions</SectionLabel>
            <Slider label="Current Age" value={age} onChange={setAge} min={55} max={80} suffix=" yrs" />
            <Slider label="Plan Until Age" value={lifeExpectancy} onChange={setLifeExpectancy} min={80} max={100} suffix=" yrs" />
            <Slider label="Annual Spending" value={annualSpend} onChange={setAnnualSpend} min={30000} max={200000} step={1000} format={fmt} />
            <Slider label="Portfolio Return" value={returnRate} onChange={setReturnRate} min={2} max={8} step={0.5} suffix="%" />
            <Slider label="Inflation Rate" value={inflationRate} onChange={setInflationRate} min={1} max={5} step={0.5} suffix="%" />

            <div style={{ marginTop: 14 }}>
              <div className="f11 dim upcase mb-8" style={{ letterSpacing: '.08em' }}>Tax Bracket</div>
              <BracketButtons brackets={TAX_BRACKETS} selected={taxBracket} onSelect={setTaxBracket} />
            </div>
          </Card>

          {/* Roth conversion modeling lives on its own dedicated tab now —
              dropping the toggle here so users see one canonical surface for
              the conversion decision (which is a substantial standalone
              question, not a sub-feature of withdrawal sequencing). */}
          <Card style={{ marginTop: 14, background: 'var(--bg2)', borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>
              Modeling Roth conversions?
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10 }}>
              The dedicated <strong>Roth Ladder</strong> tab fills a target tax bracket each gap year, runs the math against the IRS bracket schedule, and flags IRMAA cliffs. More precise than the simple "convert $X/yr" model that used to live here.
            </div>
            <a href="?tab=roth-ladder" onClick={(e) => {
              e.preventDefault();
              // Find the Optimize > Roth Ladder nav and click it
              const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Roth Ladder');
              if (btn) btn.click();
            }} style={{
              display: 'inline-block', padding: '6px 12px', borderRadius: 8,
              background: 'var(--accent-dim)', color: 'var(--accent)',
              fontSize: 12, fontWeight: 600, fontFamily: 'var(--sans)',
              textDecoration: 'none', cursor: 'pointer',
            }}>
              Open Roth Ladder →
            </a>
          </Card>
        </div>

        {/* Right Column */}
        <div>
          {/* Stats Row */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            <Stat icon="💰" label="Total Nest Egg" value={fmt(results.totalNestEgg)} sub="Starting portfolio" color="var(--accent)" />
            <Stat icon="📊" label="Withdrawal Rate" value={`${results.withdrawalRate.toFixed(1)}%`} sub={results.withdrawalRate < 4 ? 'Sustainable' : results.withdrawalRate <= 5 ? 'Caution zone' : 'High risk'} color={withdrawalColor} />
            <Stat icon="📅" label="Years Funded" value={results.yearsOfRetirement} sub={results.moneyRunsOutAge ? 'Money runs out early' : 'Fully funded'} color={yearsColor} />
            <Stat icon="🎯" label="Money Lasts Until" value={`Age ${age + results.yearsOfRetirement}`} sub={results.moneyRunsOutAge ? 'Consider reducing spend' : 'On track'} color={yearsColor} />
          </div>

          {/* Tax Impact Summary */}
          {results.projectionData.length > 1 && (() => {
            const firstYear = results.projectionData[0] || {};
            const avgTax = results.projectionData.reduce((s, d) => s + (d.totalTax || 0), 0) / results.projectionData.length;
            const totalLifetimeTax = results.projectionData.reduce((s, d) => s + (d.totalTax || 0), 0);
            return (
              <Card style={{ marginBottom: 14, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="f11 dim upcase" style={{ letterSpacing: '.08em', marginBottom: 4 }}>Estimated Tax Impact</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      Year 1 tax: <strong style={{ color: 'var(--danger)' }}>{fmtFull(Math.round(firstYear.totalTax || 0))}</strong>
                      {' · '}Avg annual: <strong style={{ color: 'var(--warn)' }}>{fmtFull(Math.round(avgTax))}</strong>
                      {' · '}Lifetime est: <strong style={{ color: 'var(--danger)' }}>{fmt(Math.round(totalLifetimeTax))}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="f11 dim upcase" style={{ letterSpacing: '.08em', marginBottom: 4 }}>Year 1 After-Tax</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--serif)' }}>
                      {fmtFull(Math.round(firstYear.afterTaxIncome || 0))}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })()}

          {/* Account Drawdown Chart */}
          <Card>
            <SectionLabel>Account Drawdown Over Time</SectionLabel>
            <MiniChart
              data={results.projectionData}
              height={280}
              lines={[
                { key: 'traditional', color: 'var(--blue)', label: 'Traditional', width: 2 },
                { key: 'roth', color: 'var(--purple)', label: 'Roth', width: 2 },
                { key: 'taxable', color: 'var(--warn)', label: 'Taxable', width: 2 },
              ]}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
              <span>Age {age}</span>
              <span>Age {age + results.projectionData.length - 1}</span>
            </div>
          </Card>

          {/* RMD Schedule */}
          {traditional > 0 && rmdTableData.length > 0 && (
            <Card style={{ marginTop: 14 }}>
              <SectionLabel>RMD Schedule</SectionLabel>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Age</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Traditional Balance</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>RMD Amount</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 500 }}>Cumulative RMDs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rmdTableData.map((row, i) => (
                      <tr key={row.age} style={{ borderBottom: i < rmdTableData.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '7px 12px', color: 'var(--text)' }}>{row.age}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--blue)', textAlign: 'right' }}>{fmtFull(row.traditional)}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--warn)', textAlign: 'right' }}>{fmtFull(row.rmd)}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--text-muted)', textAlign: 'right' }}>{fmtFull(row.cumulativeRmd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                Total lifetime RMDs: <strong style={{ color: 'var(--warn)' }}>{fmtFull(results.totalRMDs)}</strong> — all taxed as ordinary income
              </div>
            </Card>
          )}

          {/* Withdrawal Order */}
          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Optimal Withdrawal Order</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { num: 1, label: 'Taxable Accounts First', desc: 'Capital gains rates are lower than income tax rates. Assets get a step-up in cost basis, and you maintain tax-advantaged growth elsewhere.', color: 'var(--warn)' },
                { num: 2, label: 'Traditional Accounts / RMDs', desc: 'Withdrawals are taxed as ordinary income. Required Minimum Distributions start at age 73 — take these first to avoid the 25% excise penalty.', color: 'var(--blue)' },
                { num: 3, label: 'Roth Accounts Last', desc: 'Tax-free withdrawals with no RMDs. Let these grow the longest for maximum tax-free compounding. Ideal for leaving to heirs.', color: 'var(--purple)' },
              ].map(step => (
                <div key={step.num} style={{ display: 'flex', gap: 14, padding: '12px 16px', background: 'var(--bg)', borderRadius: 10, borderLeft: `3px solid ${step.color}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: step.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {step.num}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13, marginBottom: 4 }}>{step.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Roth Conversion Comparison */}
          {enableRothConversion && (
            <Card style={{ marginTop: 14 }}>
              <SectionLabel>Roth Conversion Impact</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--accent)', borderColor: 'var(--accent)' }}>
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>With Roth Conversion</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{fmtFull(results.endingWithConversion)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Ending balance at age {age + results.yearsOfRetirement}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                    Converted: <strong style={{ color: 'var(--accent)' }}>{fmtFull(results.totalConversions)}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                    Tax cost: <strong style={{ color: 'var(--warn)' }}>{fmtFull(results.conversionTaxCost)}</strong>
                  </div>
                </div>
                <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Without Conversion</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{fmtFull(results.endingWithoutConversion)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Ending balance at age {age + results.noConvYears}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                    More in Traditional → higher RMDs
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                    Lasts until: <strong>Age {results.noConvMoneyRunsOutAge || age + results.noConvYears}</strong>
                  </div>
                </div>
              </div>
              {results.endingWithConversion > results.endingWithoutConversion && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 8, fontSize: 12, color: 'var(--accent)' }}>
                  Roth conversion strategy leaves you with <strong>{fmtFull(results.endingWithConversion - results.endingWithoutConversion)}</strong> more at the end — and more of it is tax-free.
                </div>
              )}
              {results.endingWithConversion <= results.endingWithoutConversion && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 8, fontSize: 12, color: 'var(--warn)' }}>
                  In this scenario, the tax cost of conversions outweighs the benefit. Consider a smaller conversion amount or check if your tax bracket will be lower in retirement.
                </div>
              )}
            </Card>
          )}

          {/* Key Rules */}
          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Key Rules to Know</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 10 }}>
                <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 13, marginBottom: 4 }}>The 4% Rule</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  Withdraw 4% of your portfolio in year one, then adjust for inflation. Historically, this has a high probability of lasting 30 years. Your rate: <strong style={{ color: withdrawalColor }}>{results.withdrawalRate.toFixed(1)}%</strong>
                </div>
              </div>
              <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 10 }}>
                <div style={{ fontWeight: 600, color: 'var(--danger, #EF4444)', fontSize: 13, marginBottom: 4 }}>RMD Penalties</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  Missing a Required Minimum Distribution triggers a <strong style={{ color: 'var(--danger, #EF4444)' }}>25% excise tax</strong> on the amount not withdrawn (reduced from 50% by SECURE Act 2.0). RMDs start at age 73 and increase each year as the divisor shrinks.
                </div>
              </div>
              <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 10 }}>
                <div style={{ fontWeight: 600, color: 'var(--purple)', fontSize: 13, marginBottom: 4 }}>Roth 5-Year Rule</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  Roth conversions must &quot;season&quot; for 5 years before you can withdraw them penalty-free if you&apos;re under 59&frac12;. Each conversion has its own 5-year clock. Plan conversions early to give them time to qualify.
                </div>
              </div>
              <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 10 }}>
                <div style={{ fontWeight: 600, color: 'var(--blue)', fontSize: 13, marginBottom: 4 }}>Social Security &amp; Taxes</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  Up to 85% of Social Security benefits can be taxed if your combined income exceeds $34,000 (single) or $44,000 (married). Roth withdrawals don&apos;t count toward this threshold — another reason to have Roth funds in retirement.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
