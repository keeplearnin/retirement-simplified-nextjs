'use client';

import { useState, useMemo } from 'react';
import InfoBox from '@/components/ui/InfoBox';
import { sectionNav } from './learn/learnData';
import WhereToStart from './learn/WhereToStart';
import PreInvestChecklist from './learn/PreInvestChecklist';
import RiskQuizSection from './learn/RiskQuizSection';
import WhatToBuy from './learn/WhatToBuy';
import DCACalculator from './learn/DCACalculator';
import CommonMistakes from './learn/CommonMistakes';

export default function InvestingGuide() {
  const [section, setSection] = useState('start');
  const [investAmt, setInvestAmt] = useState(500);
  const [investFreq, setInvestFreq] = useState('monthly');
  const [hasDebt, setHasDebt] = useState(false);
  const [has401k, setHas401k] = useState(false);
  const [hasEmergency, setHasEmergency] = useState(false);
  const [riskQuiz, setRiskQuiz] = useState([0, 0, 0, 0, 0]);

  const dcaData = useMemo(() => {
    const monthly = investFreq === 'monthly' ? investAmt : investFreq === 'biweekly' ? investAmt * 26 / 12 : investAmt * 52 / 12;
    const pts = []; let bal = 0; const r = 0.07 / 12;
    for (let m = 0; m <= 360; m++) { bal = bal * (1 + r) + monthly; if (m % 12 === 0) pts.push({ year: m / 12, balance: bal, contributed: monthly * m }); }
    return pts;
  }, [investAmt, investFreq]);

  const riskScore = useMemo(() => {
    const s = riskQuiz.reduce((a, b) => a + b, 0);
    if (s <= 4) return { level: 'Conservative', stock: 30, bond: 60, cash: 10, color: 'var(--blue)' };
    if (s <= 7) return { level: 'Moderate', stock: 60, bond: 35, cash: 5, color: 'var(--accent)' };
    if (s <= 10) return { level: 'Growth', stock: 80, bond: 18, cash: 2, color: 'var(--warn)' };
    return { level: 'Aggressive', stock: 90, bond: 9, cash: 1, color: 'var(--danger)' };
  }, [riskQuiz]);

  return (
    <div>
      <InfoBox icon="📈" title="Index Fund Investing — The Proven Path to Wealth">
        Most millionaires don&apos;t pick stocks or time the market. They consistently invest in low-cost index funds over decades. This guide covers everything you need to start and stay the course.
      </InfoBox>

      {/* Section Navigation */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {sectionNav.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              border: section === s.id ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: section === s.id ? 'var(--accent-dim)' : 'var(--card)',
              color: section === s.id ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all .2s',
            }}
          >
            <span>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {section === 'start' && <WhereToStart />}
      {section === 'checklist' && (
        <PreInvestChecklist
          hasEmergency={hasEmergency}
          setHasEmergency={setHasEmergency}
          hasDebt={hasDebt}
          setHasDebt={setHasDebt}
          has401k={has401k}
          setHas401k={setHas401k}
        />
      )}
      {section === 'risk' && (
        <RiskQuizSection riskQuiz={riskQuiz} setRiskQuiz={setRiskQuiz} riskScore={riskScore} />
      )}
      {section === 'what' && <WhatToBuy />}
      {section === 'dca' && (
        <DCACalculator
          investAmt={investAmt}
          setInvestAmt={setInvestAmt}
          investFreq={investFreq}
          setInvestFreq={setInvestFreq}
          dcaData={dcaData}
        />
      )}
      {section === 'mistakes' && <CommonMistakes />}
    </div>
  );
}
