'use client';

import { useState } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import { fmt } from '@/lib/format';

const STORAGE_KEY = 'verdict-input-v1';

function readSaved() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function VerdictInputForm({ onSubmit }) {
  const saved = readSaved();
  const [hasSpouse, setHasSpouse] = useState(saved?.hasSpouse ?? false);
  const [currentAge, setCurrentAge] = useState(saved?.currentAge ?? 40);
  const [retirementAge, setRetirementAge] = useState(saved?.retirementAge ?? 65);
  const [annualIncome, setAnnualIncome] = useState(saved?.annualIncome ?? 100000);
  const [currentSavings, setCurrentSavings] = useState(saved?.currentSavings ?? 150000);
  const [monthlyContribution, setMonthlyContribution] = useState(saved?.monthlyContribution ?? 1500);
  const [filingStatus, setFilingStatus] = useState(saved?.filingStatus ?? 'single');
  const [spouseCurrentAge, setSpouseCurrentAge] = useState(saved?.spouseCurrentAge ?? 40);
  const [spouseRetirementAge, setSpouseRetirementAge] = useState(saved?.spouseRetirementAge ?? 65);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function setHousehold(isCouple) {
    setHasSpouse(isCouple);
    setFilingStatus(isCouple ? 'mfj' : 'single');
  }

  function submit() {
    const input = {
      currentAge,
      retirementAge,
      annualIncome,
      currentSavings,
      monthlyContribution,
      filingStatus,
      hasSpouse,
      ...(hasSpouse && {
        spouseCurrentAge,
        spouseRetirementAge,
      }),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
    } catch {
      // ignore quota
    }
    onSubmit(input);
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--text)', marginBottom: 8 }}>
          Where do you stand?
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          Three questions, one answer. No account needed — your numbers stay in your browser.
        </p>
      </div>

      <Card>
        {/* Household toggle */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
            Are you planning…
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setHousehold(false)} style={pill(!hasSpouse)}>Just me</button>
            <button onClick={() => setHousehold(true)} style={pill(hasSpouse)}>With my partner</button>
          </div>
        </div>

        <Slider label={hasSpouse ? 'Your Current Age' : 'Current Age'} value={currentAge} onChange={setCurrentAge} min={25} max={70} />
        {hasSpouse && (
          <Slider label="Spouse Current Age" value={spouseCurrentAge} onChange={setSpouseCurrentAge} min={25} max={70} />
        )}
        <Slider
          label={hasSpouse ? 'Household Annual Income (gross)' : 'Annual Income (gross)'}
          value={annualIncome} onChange={setAnnualIncome} min={20000} max={1000000} step={5000} format={fmt}
        />
        <Slider
          label={hasSpouse ? 'Total Household Retirement Savings' : 'Current Retirement Savings'}
          value={currentSavings} onChange={setCurrentSavings} min={0} max={5000000} step={5000} format={fmt}
        />
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--sans)',
            padding: '8px 0', marginTop: 4,
          }}
        >
          {showAdvanced ? 'Hide' : 'Adjust'} assumptions {showAdvanced ? '▲' : '▼'}
        </button>
        {showAdvanced && (
          <div style={{ marginTop: 4 }}>
            <Slider label={hasSpouse ? 'Your Retirement Age' : 'Retirement Age'} value={retirementAge} onChange={setRetirementAge} min={Math.max(currentAge + 1, 50)} max={75} />
            {hasSpouse && (
              <Slider label="Spouse Retirement Age" value={spouseRetirementAge} onChange={setSpouseRetirementAge} min={Math.max(spouseCurrentAge + 1, 50)} max={75} />
            )}
            <Slider
              label={hasSpouse ? 'Combined Monthly Contribution' : 'Monthly Contribution'}
              value={monthlyContribution} onChange={setMonthlyContribution} min={0} max={10000} step={50} format={fmt}
            />
            {!hasSpouse && (
              <>
                <div style={{ marginTop: 12, marginBottom: 8, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--sans)' }}>
                  Filing Status
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setFilingStatus('single')} style={pill(filingStatus === 'single')}>Single</button>
                  <button onClick={() => setFilingStatus('mfj')} style={pill(filingStatus === 'mfj')}>Married Filing Jointly</button>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      <button
        onClick={submit}
        style={{
          width: '100%', marginTop: 20, padding: '14px 24px',
          borderRadius: 12, border: 'none', cursor: 'pointer',
          background: 'var(--accent)', color: '#fff',
          fontSize: 15, fontWeight: 600, fontFamily: 'var(--sans)',
          transition: 'all .2s',
        }}
      >
        Show me where I stand →
      </button>
    </div>
  );
}

function pill(active) {
  return {
    flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: 'var(--sans)',
    transition: 'all .15s',
  };
}
