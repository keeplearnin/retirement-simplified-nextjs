'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import MiniChart from '@/components/ui/MiniChart';
import BracketButtons from '@/components/ui/BracketButtons';
import { fmt } from '@/lib/format';
import { TAX_BRACKETS } from '@/lib/constants';
import { usePlan } from '@/components/PlanProvider';

// SECURE 2.0 mandatory Roth catch-up: starting 2026, employees age 50+ whose
// prior-year FICA wages exceed the indexed threshold ($150,000 for 2026 plan
// year, indexed annually from a $145,000 statutory base) must make age-50+
// catch-up contributions to a Roth account, not pre-tax. Applies to 401(k),
// 403(b), and governmental 457(b) plans. Source: IRS final regulations on
// SECURE 2.0 Act, Treas. Reg. § 1.414(v)-2.
const SECURE_2_ROTH_CATCHUP_THRESHOLD_2026 = 150_000;

export default function TaxAware() {
  const { plan } = usePlan();
  const age = plan.currentAge;
  const retireAge = plan.retireAge;
  const returnRate = plan.expectedReturn;
  const [annualContrib, setAnnualContrib] = useState(7000);
  const [currentBracket, setCurrentBracket] = useState(24);
  const [retireBracket, setRetireBracket] = useState(22);
  const [showReal, setShowReal] = useState(false);
  const inflationRate = plan.inflationRate || 2.5;

  // Detect SECURE 2.0 mandatory-Roth-catch-up applicability for this household.
  // Trigger: age 50+ AND salary > $150K (2026 threshold). Couples-aware: any
  // spouse 50+ earning over the threshold flips the banner on, with copy
  // adjusted to identify which earner.
  const salarySource = plan.incomeSources?.find(s => s.type === 'salary' && (s.owner || 'primary') === 'primary');
  const spouseSalarySource = plan.hasSpouse
    ? plan.incomeSources?.find(s => s.type === 'salary' && s.owner === 'spouse')
    : null;
  const primaryHighEarner50 = age >= 50 && (salarySource?.amount || 0) > SECURE_2_ROTH_CATCHUP_THRESHOLD_2026;
  const spouseAge = plan.spouseCurrentAge || 0;
  const spouseHighEarner50 = plan.hasSpouse && spouseAge >= 50 && (spouseSalarySource?.amount || 0) > SECURE_2_ROTH_CATCHUP_THRESHOLD_2026;
  const showSecure2Banner = primaryHighEarner50 || spouseHighEarner50;

  const data = useMemo(() => {
    const years = retireAge - age;
    const r = returnRate / 100;
    const rothContrib = annualContrib;
    const tradContrib = annualContrib;
    const tradTaxSaved = annualContrib * (currentBracket / 100);
    // Tax savings are invested in a taxable account — gains taxed at LTCG rate (~15%)
    const ltcgRate = retireBracket <= 12 ? 0 : retireBracket >= 37 ? 0.20 : 0.15;
    const pts = [];
    let roth = 0, trad = 0, taxSavingsInvested = 0;
    for (let y = 0; y <= years; y++) {
      const rothAfterTax = roth; // Roth: already taxed, withdrawals are tax-free
      const tradAfterTax = trad * (1 - retireBracket / 100); // Traditional: taxed at retirement bracket
      // Tax savings account: only the GAINS are taxed at LTCG rate, not the principal
      const taxSavingsBasis = tradTaxSaved * y; // total contributions (cost basis)
      const taxSavingsGain = Math.max(0, taxSavingsInvested - taxSavingsBasis);
      const taxSavingsAfterTax = taxSavingsInvested - (taxSavingsGain * ltcgRate);
      const tradNet = tradAfterTax + taxSavingsAfterTax;
      // Deflate to today's purchasing power — same convention as the other
      // tabs (divide the nominal balance by cumulative inflation to date).
      const deflator = Math.pow(1 + inflationRate / 100, y);
      pts.push({
        year: y, age: age + y, roth, trad,
        rothNet: rothAfterTax, tradNet, taxSavings: taxSavingsInvested,
        rothNetReal: rothAfterTax / deflator, tradNetReal: tradNet / deflator,
        taxSavingsReal: taxSavingsInvested / deflator,
      });
      roth = roth * (1 + r) + rothContrib;
      trad = trad * (1 + r) + tradContrib;
      taxSavingsInvested = taxSavingsInvested * (1 + r) + tradTaxSaved;
    }
    return pts;
  }, [age, retireAge, annualContrib, returnRate, currentBracket, retireBracket, inflationRate]);

  const final = data[data.length - 1] || {};
  const finalRothNet = showReal ? final.rothNetReal : final.rothNet;
  const finalTradNet = showReal ? final.tradNetReal : final.tradNet;
  const finalTaxSavings = showReal ? final.taxSavingsReal : final.taxSavings;
  const rothWins = finalRothNet > finalTradNet;
  const diff = Math.abs((finalRothNet || 0) - (finalTradNet || 0));

  return (
    <div className="fade-up">
      {showSecure2Banner && (
        <InfoBox icon="📌" title="SECURE 2.0: your catch-up contribution must be Roth" color="var(--warn)" bgColor="rgba(251,191,36,.08)">
          {primaryHighEarner50 && spouseHighEarner50
            ? "Both of you are over 50 with FICA wages above $150K, so under SECURE 2.0 (effective 2026) every age-50+ catch-up dollar you contribute to a 401(k) / 403(b) / 457(b) must go to the Roth side, not pre-tax. The Traditional side of this comparison is for the regular contribution; the catch-up portion ($8,000/yr at 50+, or $11,250/yr at 60–63) is Roth-only by law."
            : (primaryHighEarner50
                ? "You're over 50 with FICA wages above $150K, so under SECURE 2.0 (effective 2026) every age-50+ catch-up dollar you contribute to a 401(k) / 403(b) / 457(b) must go to the Roth side, not pre-tax. The Traditional side of this comparison is for the regular contribution; the catch-up portion ($8,000/yr at 50+, or $11,250/yr at 60–63) is Roth-only by law."
                : "Your spouse is over 50 with FICA wages above $150K, so under SECURE 2.0 (effective 2026) their age-50+ catch-up contributions must go to the Roth side. Your own contributions are still your choice if you're under the threshold or under age 50.")}
        </InfoBox>
      )}

      <InfoBox icon="⚖️" title="Roth vs Traditional: Which Wins?" color="var(--info)" bgColor="var(--info-dim)">
        {rothWins ? (
          <>The <strong style={{ color: 'var(--accent)' }}>Roth IRA</strong> comes out ahead by <strong style={{ color: 'var(--accent)' }}>{fmt(diff)}</strong> after taxes{showReal ? ' (today\'s dollars)' : ''}. With a lower tax bracket in retirement, the gap narrows — but tax-free withdrawals still win here.</>
        ) : (
          <>The <strong style={{ color: 'var(--info)' }}>Traditional IRA</strong> comes out ahead by <strong style={{ color: 'var(--info)' }}>{fmt(diff)}</strong> after taxes{showReal ? ' (today\'s dollars)' : ''}. Your higher current bracket means the upfront deduction and reinvested tax savings give Traditional the edge.</>
        )}
      </InfoBox>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 32, marginTop: 16 }}>
        <div>
          <Card>
            <SectionLabel>Your Scenario</SectionLabel>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--bg2)' }}>
              Age {age} · Retire at {retireAge} · {returnRate}% return
              <span style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginTop: 2 }}>Edit in My Plan</span>
            </div>
            <Slider label="Annual Contribution" value={annualContrib} onChange={setAnnualContrib} min={500} max={7000} step={500} format={fmt} />
          </Card>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Tax Brackets</SectionLabel>

            <div style={{ marginBottom: 18 }}>
              <div className="f11 dim upcase mb-8" style={{ letterSpacing: '.08em' }}>Current Bracket (working years)</div>
              <BracketButtons brackets={TAX_BRACKETS} selected={currentBracket} onSelect={setCurrentBracket} />
            </div>

            <div>
              <div className="f11 dim upcase mb-8" style={{ letterSpacing: '.08em' }}>Retirement Bracket (withdrawals)</div>
              <BracketButtons brackets={TAX_BRACKETS} selected={retireBracket} onSelect={setRetireBracket} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={showReal} onChange={e => setShowReal(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
              Show inflation-adjusted ({inflationRate}%)
            </label>
          </Card>
        </div>

        <div>
          <Card>
            <SectionLabel>After-Tax Comparison at Retirement{showReal ? " (today's $)" : ''}</SectionLabel>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <Stat icon="🟢" label="Roth (after-tax)" value={fmt(finalRothNet || 0)} sub="Tax-free withdrawals" color="var(--accent)" />
              <Stat icon="🔵" label="Traditional (after-tax)" value={fmt(finalTradNet || 0)} sub={`Includes reinvested tax savings`} color="var(--info)" />
              <Stat icon="💰" label="Tax Savings Invested" value={fmt(finalTaxSavings || 0)} sub={`${fmt(annualContrib * currentBracket / 100)}/yr reinvested`} color="var(--text-muted)" />
            </div>

            <MiniChart data={data} height={280} lines={[
              { key: showReal ? 'rothNetReal' : 'rothNet', color: 'var(--accent)', label: 'Roth (after-tax)', width: 2.5 },
              { key: showReal ? 'tradNetReal' : 'tradNet', color: 'var(--info)', label: 'Traditional (after-tax)', width: 2.5 },
            ]} />
          </Card>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Rules of Thumb</SectionLabel>
            <div className="f13 lh-loose" style={{ color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: 10 }}>
                <strong style={{ color: 'var(--accent)' }}>Choose Roth</strong> if you expect to be in a <em>higher</em> tax bracket in retirement, are early in your career, or value tax-free flexibility.
              </div>
              <div style={{ marginBottom: 10 }}>
                <strong style={{ color: 'var(--info)' }}>Choose Traditional</strong> if you&apos;re in a <em>high</em> bracket now and expect a lower one in retirement, or want the upfront deduction.
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>Consider both</strong> — many people split contributions for tax diversification. Having both gives you flexibility in retirement.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
