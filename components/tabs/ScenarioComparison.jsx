'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import MiniChart from '@/components/ui/MiniChart';
import { fmt } from '@/lib/format';

function project(s) {
  const yrsWork = s.retireAge - s.age;
  const yrsRetire = 30;
  const total = yrsWork + yrsRetire;
  const r = s.returnRate / 100;
  const pts = [];
  let bal = s.savings;
  for (let y = 0; y <= total; y++) {
    pts.push({ year: y, age: s.age + y, balance: bal, phase: y <= yrsWork ? 'accumulate' : 'spend' });
    if (y < yrsWork) bal = bal * (1 + r) + s.monthly * 12;
    else bal = bal * (1 + r) - s.annualSpend * Math.pow(1.025, y - yrsWork);
    if (bal < 0) bal = 0;
  }
  return pts;
}

function ScenPanel({ scen, onChange, color, label }) {
  const update = (key, val) => onChange({ ...scen, [key]: val });

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
        <input
          type="text"
          value={scen.name}
          onChange={e => update('name', e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: `1.5px solid ${color}`,
            color: 'var(--text)',
            fontSize: 16,
            fontFamily: 'var(--serif)',
            fontWeight: 600,
            padding: '2px 0',
            outline: 'none',
            width: '100%',
          }}
        />
      </div>
      <SectionLabel>{label}</SectionLabel>
      <Slider label="Current Age" value={scen.age} onChange={v => update('age', v)} min={18} max={60} suffix=" yrs" />
      <Slider label="Retirement Age" value={scen.retireAge} onChange={v => update('retireAge', v)} min={50} max={75} suffix=" yrs" />
      <Slider label="Current Savings" value={scen.savings} onChange={v => update('savings', v)} min={0} max={1000000} step={5000} format={fmt} />
      <Slider label="Monthly Contribution" value={scen.monthly} onChange={v => update('monthly', v)} min={0} max={5000} step={50} format={fmt} />
      <Slider label="Expected Return" value={scen.returnRate} onChange={v => update('returnRate', v)} min={4} max={12} step={0.5} suffix="%" />
      <Slider label="Annual Spending (Retirement)" value={scen.annualSpend} onChange={v => update('annualSpend', v)} min={20000} max={150000} step={5000} format={fmt} />
    </Card>
  );
}

export default function ScenarioComparison() {
  const [scenA, setScenA] = useState({
    name: 'Conservative',
    age: 35,
    retireAge: 65,
    savings: 100000,
    monthly: 500,
    returnRate: 7,
    annualSpend: 50000,
  });

  const [scenB, setScenB] = useState({
    name: 'Aggressive',
    age: 35,
    retireAge: 60,
    savings: 100000,
    monthly: 1000,
    returnRate: 9,
    annualSpend: 50000,
  });

  const ptsA = useMemo(() => project(scenA), [scenA]);
  const ptsB = useMemo(() => project(scenB), [scenB]);

  const maxLen = Math.max(ptsA.length, ptsB.length);
  const merged = useMemo(() => {
    const out = [];
    for (let i = 0; i < maxLen; i++) {
      out.push({
        year: i,
        scenA: ptsA[i]?.balance || 0,
        scenB: ptsB[i]?.balance || 0,
      });
    }
    return out;
  }, [ptsA, ptsB, maxLen]);

  const peakA = Math.max(...ptsA.map(p => p.balance));
  const peakB = Math.max(...ptsB.map(p => p.balance));
  const retireA = ptsA.find(p => p.age === scenA.retireAge)?.balance || 0;
  const retireB = ptsB.find(p => p.age === scenB.retireAge)?.balance || 0;
  const depletionA = ptsA.find(p => p.phase === 'spend' && p.balance === 0);
  const depletionB = ptsB.find(p => p.phase === 'spend' && p.balance === 0);
  const lastA = ptsA[ptsA.length - 1]?.balance || 0;
  const lastB = ptsB[ptsB.length - 1]?.balance || 0;

  return (
    <div className="fade-up">
      <InfoBox icon="🔮" title="Compare Your Futures" color="var(--purple)" bgColor="var(--purple-dim)">
        See how different savings rates, timelines, and returns change your retirement picture.
        {retireA > retireB ? (
          <> <strong style={{ color: 'var(--accent)' }}>{scenA.name}</strong> reaches retirement with <strong>{fmt(retireA)}</strong> vs <strong>{fmt(retireB)}</strong>.</>
        ) : (
          <> <strong style={{ color: 'var(--purple)' }}>{scenB.name}</strong> reaches retirement with <strong>{fmt(retireB)}</strong> vs <strong>{fmt(retireA)}</strong>.</>
        )}
      </InfoBox>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 16 }}>
        <ScenPanel scen={scenA} onChange={setScenA} color="var(--accent)" label="Scenario A" />
        <ScenPanel scen={scenB} onChange={setScenB} color="var(--purple)" label="Scenario B" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 16 }}>
        <Stat icon="🏔️" label={`${scenA.name} at Retirement`} value={fmt(retireA)} sub={`Age ${scenA.retireAge}`} color="var(--accent)" />
        <Stat icon="🏔️" label={`${scenB.name} at Retirement`} value={fmt(retireB)} sub={`Age ${scenB.retireAge}`} color="var(--purple)" />
        <Stat icon="📉" label={`${scenA.name} Runs Out`} value={depletionA ? `Age ${depletionA.age}` : 'Never'} sub={depletionA ? 'Money depleted' : `${fmt(lastA)} left at end`} color={depletionA ? 'var(--danger)' : 'var(--accent)'} />
        <Stat icon="📉" label={`${scenB.name} Runs Out`} value={depletionB ? `Age ${depletionB.age}` : 'Never'} sub={depletionB ? 'Money depleted' : `${fmt(lastB)} left at end`} color={depletionB ? 'var(--danger)' : 'var(--purple)'} />
      </div>

      <Card style={{ marginTop: 16 }}>
        <SectionLabel>Portfolio Over Time</SectionLabel>
        <MiniChart data={merged} height={340} lines={[
          { key: 'scenA', color: 'var(--accent)', label: scenA.name, width: 2.5 },
          { key: 'scenB', color: 'var(--purple)', label: scenB.name, width: 2.5 },
        ]} />
      </Card>
    </div>
  );
}
