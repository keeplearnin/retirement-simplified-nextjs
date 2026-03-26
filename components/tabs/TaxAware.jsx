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

export default function TaxAware() {
  const [age, setAge] = useState(35);
  const [retireAge, setRetireAge] = useState(65);
  const [annualContrib, setAnnualContrib] = useState(7000);
  const [returnRate, setReturnRate] = useState(7);
  const [currentBracket, setCurrentBracket] = useState(24);
  const [retireBracket, setRetireBracket] = useState(22);

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
      pts.push({ year: y, age: age + y, roth, trad, rothNet: rothAfterTax, tradNet: tradAfterTax + taxSavingsAfterTax, taxSavings: taxSavingsInvested });
      roth = roth * (1 + r) + rothContrib;
      trad = trad * (1 + r) + tradContrib;
      taxSavingsInvested = taxSavingsInvested * (1 + r) + tradTaxSaved;
    }
    return pts;
  }, [age, retireAge, annualContrib, returnRate, currentBracket, retireBracket]);

  const final = data[data.length - 1] || {};
  const rothWins = final.rothNet > final.tradNet;
  const diff = Math.abs(final.rothNet - final.tradNet);

  return (
    <div className="fade-up">
      <InfoBox icon="⚖️" title="Roth vs Traditional: Which Wins?" color="var(--info)" bgColor="var(--info-dim)">
        {rothWins ? (
          <>The <strong style={{ color: 'var(--accent)' }}>Roth IRA</strong> comes out ahead by <strong style={{ color: 'var(--accent)' }}>{fmt(diff)}</strong> after taxes. With a lower tax bracket in retirement, the gap narrows — but tax-free withdrawals still win here.</>
        ) : (
          <>The <strong style={{ color: 'var(--info)' }}>Traditional IRA</strong> comes out ahead by <strong style={{ color: 'var(--info)' }}>{fmt(diff)}</strong> after taxes. Your higher current bracket means the upfront deduction and reinvested tax savings give Traditional the edge.</>
        )}
      </InfoBox>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 32, marginTop: 16 }}>
        <div>
          <Card>
            <SectionLabel>Your Scenario</SectionLabel>
            <Slider label="Current Age" value={age} onChange={setAge} min={18} max={60} suffix=" yrs" />
            <Slider label="Retirement Age" value={retireAge} onChange={setRetireAge} min={50} max={75} suffix=" yrs" />
            <Slider label="Annual Contribution" value={annualContrib} onChange={setAnnualContrib} min={500} max={7000} step={500} format={fmt} />
            <Slider label="Expected Return" value={returnRate} onChange={setReturnRate} min={4} max={12} step={0.5} suffix="%" />
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
          </Card>
        </div>

        <div>
          <Card>
            <SectionLabel>After-Tax Comparison at Retirement</SectionLabel>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <Stat icon="🟢" label="Roth (after-tax)" value={fmt(final.rothNet || 0)} sub="Tax-free withdrawals" color="var(--accent)" />
              <Stat icon="🔵" label="Traditional (after-tax)" value={fmt(final.tradNet || 0)} sub={`Includes reinvested tax savings`} color="var(--info)" />
              <Stat icon="💰" label="Tax Savings Invested" value={fmt(final.taxSavings || 0)} sub={`${fmt(annualContrib * currentBracket / 100)}/yr reinvested`} color="var(--text-muted)" />
            </div>

            <MiniChart data={data} height={280} lines={[
              { key: 'rothNet', color: 'var(--accent)', label: 'Roth (after-tax)', width: 2.5 },
              { key: 'tradNet', color: 'var(--info)', label: 'Traditional (after-tax)', width: 2.5 },
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
