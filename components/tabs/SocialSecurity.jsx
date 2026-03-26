'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import MiniChart from '@/components/ui/MiniChart';
import { fmt } from '@/lib/format';

function estimateBenefit(currentIncome, startAge, workYears) {
  const aime = Math.min(currentIncome, 168600) / 12;

  let pia;
  if (aime <= 1174) {
    pia = aime * 0.9;
  } else if (aime <= 7078) {
    pia = 1174 * 0.9 + (aime - 1174) * 0.32;
  } else {
    pia = 1174 * 0.9 + (7078 - 1174) * 0.32 + (aime - 7078) * 0.15;
  }

  const fra = 67;
  let ageAdj;
  if (startAge < fra) {
    ageAdj = 1 - ((fra - startAge) * 12 * 0.00556);
  } else {
    ageAdj = 1 + ((startAge - fra) * 12 * 0.00667);
  }

  const workFactor = Math.min(workYears / 35, 1);

  return pia * ageAdj * workFactor;
}

export default function SocialSecurity() {
  const [currentIncome, setCurrentIncome] = useState(85000);
  const [startAge, setStartAge] = useState(67);
  const [workYears, setWorkYears] = useState(35);

  const keyAges = useMemo(() => {
    return [62, 64, 67, 70].map(age => {
      const monthly = estimateBenefit(currentIncome, age, workYears);
      return { age, monthly: Math.round(monthly), annual: Math.round(monthly * 12) };
    });
  }, [currentIncome, workYears]);

  const currentEstimate = useMemo(() => {
    const monthly = estimateBenefit(currentIncome, startAge, workYears);
    return { monthly: Math.round(monthly), annual: Math.round(monthly * 12) };
  }, [currentIncome, startAge, workYears]);

  const cumulativeData = useMemo(() => {
    const claim62 = estimateBenefit(currentIncome, 62, workYears) * 12;
    const claim67 = estimateBenefit(currentIncome, 67, workYears) * 12;
    const claim70 = estimateBenefit(currentIncome, 70, workYears) * 12;

    const pts = [];
    for (let age = 62; age <= 90; age++) {
      pts.push({
        year: age,
        claim62: age >= 62 ? (age - 62) * claim62 : 0,
        claim67: age >= 67 ? (age - 67) * claim67 : 0,
        claim70: age >= 70 ? (age - 70) * claim70 : 0,
      });
    }
    return pts;
  }, [currentIncome, workYears]);

  return (
    <div className="fade-up">
      <InfoBox icon="⚠️" title="Social Security Is a Starting Point, Not a Plan" color="var(--warn)" bgColor="var(--warn-dim)">
        Social Security replaces roughly 40% of pre-retirement income for average earners. When you claim matters — waiting until 70 can increase your benefit by over 75% compared to claiming at 62. This estimator uses the actual PIA formula with 2024 bend points.
      </InfoBox>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 32, marginTop: 16 }}>
        <div>
          <Card>
            <SectionLabel>Your Information</SectionLabel>
            <Slider label="Current Annual Income" value={currentIncome} onChange={setCurrentIncome} min={20000} max={250000} step={5000} format={fmt} />
            <Slider label="Claiming Age" value={startAge} onChange={setStartAge} min={62} max={70} suffix=" years" />
            <Slider label="Years Worked" value={workYears} onChange={setWorkYears} min={10} max={45} suffix=" years" />
          </Card>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Key Claiming Ages</SectionLabel>
            {keyAges.map(({ age, monthly, annual }) => (
              <div key={age} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontSize: 13, color: age === 62 ? 'var(--danger)' : age === 67 ? 'var(--warn)' : age === 70 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600 }}>
                    Age {age}
                    {age === 62 && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 6 }}>Earliest</span>}
                    {age === 67 && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 6 }}>FRA</span>}
                    {age === 70 && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 6 }}>Max</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontFamily: 'var(--serif)', color: age === startAge ? 'var(--accent)' : 'var(--text)' }}>${monthly.toLocaleString()}/mo</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>${annual.toLocaleString()}/yr</div>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <Stat icon="📅" label="Monthly Benefit" value={`$${currentEstimate.monthly.toLocaleString()}`} sub={`Claiming at age ${startAge}`} color="var(--accent)" />
            <Stat icon="📊" label="Annual Benefit" value={`$${currentEstimate.annual.toLocaleString()}`} sub={`${fmt(currentEstimate.annual)} per year`} color="var(--accent)" />
          </div>

          <Card>
            <SectionLabel>Benefit by Claiming Age</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              {keyAges.map(({ age, monthly }) => (
                <div key={age} style={{
                  textAlign: 'center',
                  padding: '14px 8px',
                  borderRadius: 8,
                  background: age === startAge ? 'var(--accent-dim)' : 'var(--card-bg)',
                  border: `1px solid ${age === startAge ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Age {age}</div>
                  <div style={{ fontSize: 20, fontFamily: 'var(--serif)', color: age === 62 ? 'var(--danger)' : age === 67 ? 'var(--warn)' : age === 70 ? 'var(--accent)' : 'var(--text)' }}>
                    ${monthly.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>/month</div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel>Cumulative Benefits by Claiming Age</SectionLabel>
            <MiniChart data={cumulativeData} height={280} lines={[
              { key: 'claim62', color: 'var(--danger)', label: 'Claim at 62', width: 2 },
              { key: 'claim67', color: 'var(--warn)', label: 'Claim at 67', width: 2 },
              { key: 'claim70', color: 'var(--accent)', label: 'Claim at 70', width: 2 },
            ]} />
          </Card>
        </div>
      </div>
    </div>
  );
}
