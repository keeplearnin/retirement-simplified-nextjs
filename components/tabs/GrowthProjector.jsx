'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import MiniChart from '@/components/ui/MiniChart';
import { fmt } from '@/lib/format';

export default function GrowthProjector() {
  const [age, setAge] = useState(35);
  const [retireAge, setRetireAge] = useState(65);
  const [savings, setSavings] = useState(50000);
  const [monthly, setMonthly] = useState(500);
  const [returnRate, setReturnRate] = useState(7);
  const [showInflation, setShowInflation] = useState(false);
  const inflation = 2.5;

  const data = useMemo(() => {
    const years = retireAge - age;
    const r = returnRate / 100;
    const ri = (returnRate - inflation) / 100;
    const pts = [];
    let bal = savings, balR = savings;
    for (let y = 0; y <= years; y++) {
      const c = savings + monthly * 12 * y;
      pts.push({ year: y, age: age + y, balance: bal, real: balR, contributed: c });
      bal = bal * (1 + r) + monthly * 12;
      balR = balR * (1 + ri) + monthly * 12;
    }
    return pts;
  }, [age, retireAge, savings, monthly, returnRate, inflation]);

  const final = data[data.length - 1] || {};
  const totalC = savings + monthly * 12 * (retireAge - age);
  const growth = final.balance - totalC;
  const monthlyIncome = (final.balance * 0.04) / 12;
  const maxBal = Math.max(...data.map(d => d.balance));

  return (
    <div className="fade-up">
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 32 }}>
        <div>
          <Card>
            <SectionLabel>Your Details</SectionLabel>
            <Slider label="Current Age" value={age} onChange={v => { setAge(v); if (retireAge <= v + 5) setRetireAge(v + 5); }} min={18} max={60} suffix=" yrs" />
            <Slider label="Retirement Age" value={retireAge} onChange={setRetireAge} min={Math.max(age + 5, 50)} max={80} suffix=" yrs" />
            <Slider label="Current Savings" value={savings} onChange={setSavings} min={0} max={1000000} step={1000} format={fmt} />
            <Slider label="Monthly Contribution" value={monthly} onChange={setMonthly} min={0} max={10000} step={50} format={fmt} tooltip="Include employer match" />
            <Slider label="Expected Annual Return" value={returnRate} onChange={setReturnRate} min={3} max={12} step={0.5} suffix="%" tooltip="S&P 500 avg ~10%, after inflation ~7%" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={showInflation} onChange={e => setShowInflation(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
              Show inflation-adjusted ({inflation}%)
            </label>
          </Card>
        </div>
        <div>
          <div className="stats-row" style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <Stat icon="🎯" label="At Retirement" value={fmt(final.balance)} sub={showInflation ? `${fmt(final.real)} in today's $` : `in ${retireAge - age} years`} />
            <Stat icon="💰" label="You Contribute" value={fmt(totalC)} color="var(--warn)" />
            <Stat icon="🏖️" label="Monthly Income (4%)" value={fmt(monthlyIncome)} color="var(--blue)" />
          </div>
          <Stat icon="📈" label="Market Growth" value={fmt(growth)} sub={`${((growth / totalC) * 100).toFixed(0)}% return on contributions`} color="var(--blue)" />
          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Portfolio Growth Over Time</SectionLabel>
            <MiniChart data={data} height={220} lines={[
              { key: 'balance', color: 'var(--accent)', label: 'Total balance', width: 2.5 },
              ...(showInflation ? [{ key: 'real', color: 'var(--blue)', label: 'Inflation-adjusted', dash: '6 4' }] : []),
              { key: 'contributed', color: 'var(--warn)', label: 'Contributions', dash: '5 4', width: 1.5 },
            ]} yMax={maxBal} />
          </Card>
        </div>
      </div>
    </div>
  );
}
