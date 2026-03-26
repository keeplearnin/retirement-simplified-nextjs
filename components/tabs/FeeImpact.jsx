'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import MiniChart from '@/components/ui/MiniChart';
import { fmt, fmtFull } from '@/lib/format';

export default function FeeImpact() {
  const [portfolio, setPortfolio] = useState(100000);
  const [years, setYears] = useState(30);
  const [returnRate, setReturnRate] = useState(7);
  const [advisorFee, setAdvisorFee] = useState(1.0);
  const [monthlyAdd, setMonthlyAdd] = useState(500);
  const indexFee = 0.05;

  const data = useMemo(() => {
    const pts = [];
    let bA = portfolio, bI = portfolio;
    for (let y = 0; y <= years; y++) {
      pts.push({ year: y, advisor: bA, index: bI });
      bA = (bA + monthlyAdd * 12) * (1 + (returnRate - advisorFee) / 100);
      bI = (bI + monthlyAdd * 12) * (1 + (returnRate - indexFee) / 100);
    }
    return pts;
  }, [portfolio, years, returnRate, advisorFee, monthlyAdd, indexFee]);

  const finalA = data[data.length - 1]?.advisor || 0;
  const finalI = data[data.length - 1]?.index || 0;
  const feeCost = finalI - finalA;
  const feePct = ((feeCost / finalI) * 100).toFixed(1);

  return (
    <div className="fade-up">
      <InfoBox icon="⚠️" title="The Hidden Tax on Your Future" color="var(--danger)" bgColor="var(--danger-dim)">
        A {advisorFee}% annual fee compounds against you. Over {years} years, you&apos;d lose <strong style={{ color: 'var(--danger)', fontSize: 16 }}>{fmt(feeCost)}</strong> — that&apos;s <strong style={{ color: 'var(--danger)' }}>{feePct}%</strong> of what you could have had.
      </InfoBox>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 32, marginTop: 16 }}>
        <div>
          <Card>
            <SectionLabel>Scenario Settings</SectionLabel>
            <Slider label="Starting Portfolio" value={portfolio} onChange={setPortfolio} min={5000} max={1000000} step={5000} format={fmt} />
            <Slider label="Monthly Addition" value={monthlyAdd} onChange={setMonthlyAdd} min={0} max={5000} step={50} format={fmt} />
            <Slider label="Time Horizon" value={years} onChange={setYears} min={5} max={40} suffix=" years" />
            <Slider label="Market Return" value={returnRate} onChange={setReturnRate} min={4} max={12} step={0.5} suffix="%" />
            <Slider label="Advisor Fee" value={advisorFee} onChange={setAdvisorFee} min={0.25} max={2} step={0.05} suffix="%" />
          </Card>
          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Side-by-Side</SectionLabel>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>Index Fund (0.05%)</div>
                <div style={{ fontSize: 28, color: 'var(--accent)', fontFamily: 'var(--serif)' }}>{fmt(finalI)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{fmtFull(finalI)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>Advisor ({advisorFee}%)</div>
                <div style={{ fontSize: 28, color: 'var(--danger)', fontFamily: 'var(--serif)' }}>{fmt(finalA)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{fmtFull(finalA)}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '14px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Lost to Fees</div>
              <div style={{ fontSize: 32, color: 'var(--danger)', fontFamily: 'var(--serif)' }}>{fmt(feeCost)}</div>
            </div>
          </Card>
        </div>
        <div>
          <Card style={{ height: '100%' }}>
            <SectionLabel>Fee Impact Over Time</SectionLabel>
            <MiniChart data={data} height={340} lines={[
              { key: 'index', color: 'var(--accent)', label: 'Index fund (0.05%)', width: 2.5 },
              { key: 'advisor', color: 'var(--danger)', label: `Advisor (${advisorFee}%)`, width: 2.5 },
            ]} />
          </Card>
        </div>
      </div>
    </div>
  );
}
