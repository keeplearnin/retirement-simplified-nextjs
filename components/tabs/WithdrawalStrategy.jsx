'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import MiniChart from '@/components/ui/MiniChart';
import BracketButtons from '@/components/ui/BracketButtons';
import { fmt, fmtFull } from '@/lib/format';
import { RMD_TABLE, TAX_BRACKETS } from '@/lib/constants';

export default function WithdrawalStrategy() {
  const [age, setAge] = useState(62);
  const [lifeExpectancy, setLifeExpectancy] = useState(90);
  const [annualSpend, setAnnualSpend] = useState(60000);
  const [returnRate, setReturnRate] = useState(5);
  const [inflationRate, setInflationRate] = useState(2.5);
  const [traditional, setTraditional] = useState(500000);
  const [roth, setRoth] = useState(200000);
  const [taxable, setTaxable] = useState(100000);
  const [socialSecurity, setSocialSecurity] = useState(2000);
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

      for (let y = 0; y <= lifeExpectancy - age; y++) {
        const currentAge = age + y;
        const inflationMult = Math.pow(1 + inflationRate / 100, y);
        const ssIncome = socialSecurity * 12 * inflationMult;
        const spending = annualSpend * inflationMult;
        const gap = spending - ssIncome;

        // RMD check (starts at 73)
        let rmd = 0;
        if (currentAge >= 73 && tradBal > 0) {
          const divisor = RMD_TABLE[currentAge] || 3.5;
          rmd = tradBal / divisor;
        }

        // Roth conversion (before RMD age, if enabled)
        let conversion = 0;
        if (conversionEnabled && currentAge < 73 && tradBal > 0) {
          conversion = Math.min(rothConversionAmt, tradBal);
        }

        // Withdrawal order: Taxable first, then Traditional (or RMD), then Roth
        let remaining = Math.max(0, gap);

        // 1. Take from taxable
        const fromTaxable = Math.min(remaining, taxableBal);
        taxableBal -= fromTaxable;
        remaining -= fromTaxable;

        // 2. Take from traditional (at least RMD)
        let fromTraditional = Math.max(remaining, rmd);
        fromTraditional = Math.min(fromTraditional, tradBal);
        tradBal -= fromTraditional;
        remaining -= fromTraditional;

        // Apply Roth conversion
        tradBal -= conversion;
        rothBal += conversion;

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
    const conversionTaxCost = withConversion.totalConversions * (taxBracket / 100);

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

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 32, marginTop: 16 }}>
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

          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Roth Conversion Ladder</SectionLabel>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: enableRothConversion ? 16 : 0 }}>
              <input
                type="checkbox"
                checked={enableRothConversion}
                onChange={e => setEnableRothConversion(e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 18, height: 18 }}
              />
              <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>Enable Roth Conversion Strategy</span>
            </label>

            {enableRothConversion && (
              <>
                <Slider label="Annual Conversion Amount" value={rothConversionAmt} onChange={setRothConversionAmt} min={10000} max={200000} step={5000} format={fmt} />
                <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  Convert Traditional → Roth before age 73 to reduce future RMDs and create tax-free income. You&apos;ll pay taxes on conversions now at your {taxBracket}% rate, but withdrawals in retirement will be tax-free.
                </div>
              </>
            )}
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
