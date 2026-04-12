'use client';

import { useState } from 'react';
import Slider from '@/components/ui/Slider';
import { usePlan } from '@/components/PlanProvider';
import { fmt } from '@/lib/format';

const STEPS = ['Welcome', 'Age & Timeline', 'Income', 'Savings'];

export default function Onboarding({ onComplete }) {
  const { plan, updatePlan, bulkUpdate } = usePlan();
  const [step, setStep] = useState(0);

  // Local state for onboarding values (write to plan on finish)
  const [age, setAge] = useState(35);
  const [retireAge, setRetireAge] = useState(65);
  const [salary, setSalary] = useState(85000);
  const [s401k, setS401k] = useState(50000);
  const [sRoth, setSRoth] = useState(10000);
  const [sTaxable, setSTaxable] = useState(5000);
  const [sHSA, setSHSA] = useState(2000);

  function finish() {
    const spending = Math.round(salary * 0.75 / 1000) * 1000;
    bulkUpdate({
      currentAge: age,
      retireAge: retireAge,
      savings401k: s401k,
      savingsRoth: sRoth,
      savingsTaxable: sTaxable,
      savingsHSA: sHSA,
      annualSpending: spending,
      retireSpending: Math.round(spending * 0.8 / 1000) * 1000,
      incomeSources: [
        { id: 1, type: 'salary', label: 'Salary', amount: salary, growthRate: 3 },
        { id: 2, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2500, startAge: 67 },
      ],
    });
    onComplete();
  }

  function skip() {
    onComplete();
  }

  const total = s401k + sRoth + sTaxable + sHSA;

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {/* Skip */}
        <button onClick={skip} style={{
          position: 'absolute', top: 16, right: 20,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--sans)',
        }}>
          Skip
        </button>

        {/* Step dots */}
        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <div key={i} className={`onboarding-dot${i === step ? ' active' : i < step ? ' done' : ''}`} />
          ))}
        </div>

        {/* Step content */}
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--serif)', marginBottom: 8 }}>
              Plan Your Retirement
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 32, maxWidth: 360, margin: '0 auto 32px' }}>
              Answer a few quick questions and we'll build a personalized retirement projection for you.
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--serif)', marginBottom: 4 }}>
              Age & Timeline
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 24 }}>
              How old are you, and when do you want to retire?
            </div>
            <Slider label="Current Age" value={age} onChange={setAge} min={18} max={70} />
            <Slider label="Retirement Age" value={retireAge} onChange={setRetireAge} min={Math.max(age + 1, 40)} max={80} />
            <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--bg2)', fontSize: 13, color: 'var(--text-muted)' }}>
              {retireAge - age} years until retirement
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--serif)', marginBottom: 4 }}>
              Income
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 24 }}>
              What's your annual salary before taxes?
            </div>
            <Slider label="Annual Salary" value={salary} onChange={setSalary} min={20000} max={500000} step={5000} format={fmt} />
            <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--bg2)', fontSize: 13, color: 'var(--text-muted)' }}>
              ~{fmt(Math.round(salary / 12))}/month gross
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--serif)', marginBottom: 4 }}>
              Current Savings
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 24 }}>
              How much do you have saved? Estimates are fine.
            </div>
            <Slider label="401(k) / 403(b)" value={s401k} onChange={setS401k} min={0} max={2000000} step={5000} format={fmt} />
            <Slider label="Roth IRA" value={sRoth} onChange={setSRoth} min={0} max={500000} step={5000} format={fmt} />
            <Slider label="Taxable Brokerage" value={sTaxable} onChange={setSTaxable} min={0} max={1000000} step={5000} format={fmt} />
            <Slider label="HSA" value={sHSA} onChange={setSHSA} min={0} max={100000} step={1000} format={fmt} />
            <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--accent-dim)', fontSize: 14, fontWeight: 600, color: 'var(--accent)', textAlign: 'center' }}>
              Total: {fmt(total)}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: step === 0 ? 'center' : 'space-between', marginTop: 32, gap: 12 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={{
              padding: '10px 24px', borderRadius: 10, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, fontFamily: 'var(--sans)',
            }}>
              Back
            </button>
          )}
          <button onClick={() => step < STEPS.length - 1 ? setStep(step + 1) : finish()} style={{
            padding: '10px 32px', borderRadius: 10, cursor: 'pointer',
            border: 'none', background: 'var(--accent)',
            color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'var(--sans)',
            transition: 'all .2s',
          }}>
            {step === 0 ? 'Get Started' : step === STEPS.length - 1 ? 'See My Plan' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
