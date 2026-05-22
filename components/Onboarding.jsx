'use client';

import { useState } from 'react';
import Slider from '@/components/ui/Slider';
import { usePlan } from '@/components/PlanProvider';
import { fmt } from '@/lib/format';
import OnboardingChat from '@/components/OnboardingChat';

const STEPS = ['Welcome', 'Age & Timeline', 'Income', 'Savings'];

export default function Onboarding({ onComplete }) {
  const { plan, updatePlan, bulkUpdate } = usePlan();
  const [mode, setMode] = useState('chooser'); // 'chooser' | 'chat' | 'form'
  const [step, setStep] = useState(0);

  // Household type — Phase B: gates the spouse inputs on subsequent steps.
  const [hasSpouse, setHasSpouse] = useState(false);

  // Local state — primary
  const [age, setAge] = useState(35);
  const [retireAge, setRetireAge] = useState(65);
  const [salary, setSalary] = useState(85000);
  const [retireReplacementPct, setRetireReplacementPct] = useState(80);
  const [s401k, setS401k] = useState(50000);
  const [sRoth, setSRoth] = useState(10000);
  const [sTaxable, setSTaxable] = useState(5000);
  const [sHSA, setSHSA] = useState(2000);

  // Local state — spouse (only used when hasSpouse=true)
  const [spouseAge, setSpouseAge] = useState(35);
  const [spouseRetireAge, setSpouseRetireAge] = useState(65);
  const [spouseSalary, setSpouseSalary] = useState(75000);
  const [spouseS401k, setSpouseS401k] = useState(30000);
  const [spouseSRoth, setSpouseSRoth] = useState(5000);

  // Pension — optional, off by default. Tester feedback flagged that
  // teachers / govt / military / union-pension users had no clear way to
  // add a pension; the income-source dropdown on My Plan was discoverable
  // only to users who scrolled and clicked. Surfacing it here keeps the
  // 80% who don't have one on a fast path, and the 20% who do never have
  // to wonder if it's supported.
  const [hasPension, setHasPension] = useState(false);
  const [pensionMonthly, setPensionMonthly] = useState(2000);
  const [pensionStartAge, setPensionStartAge] = useState(65);
  const [hasSpousePension, setHasSpousePension] = useState(false);
  const [spousePensionMonthly, setSpousePensionMonthly] = useState(2000);
  const [spousePensionStartAge, setSpousePensionStartAge] = useState(65);

  function finish() {
    const householdSalary = salary + (hasSpouse ? spouseSalary : 0);
    // Spending is anchored to household salary; 75% as default working-years
    // spend (consistent with previous behavior for single users).
    const spending = Math.round(householdSalary * 0.75 / 1000) * 1000;
    const retireSpending = Math.round(spending * (retireReplacementPct / 100) / 1000) * 1000;

    const incomeSources = [
      { id: 1, type: 'salary', label: 'Salary', amount: salary, growthRate: 3, owner: 'primary' },
      { id: 2, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2500, startAge: 67, owner: 'primary' },
    ];
    if (hasSpouse) {
      incomeSources.push(
        { id: 3, type: 'salary', label: 'Spouse Salary', amount: spouseSalary, growthRate: 3, owner: 'spouse' },
        { id: 4, type: 'socialSecurity', label: 'Spouse Social Security', monthlyBenefit: 2200, startAge: 67, owner: 'spouse' },
      );
    }
    let nextId = incomeSources.length + 1;
    if (hasPension) {
      incomeSources.push({
        id: nextId++, type: 'pension', label: 'Pension',
        monthlyAmount: pensionMonthly, startAge: pensionStartAge, cola: true, owner: 'primary',
      });
    }
    if (hasSpouse && hasSpousePension) {
      incomeSources.push({
        id: nextId++, type: 'pension', label: 'Spouse Pension',
        monthlyAmount: spousePensionMonthly, startAge: spousePensionStartAge, cola: true, owner: 'spouse',
      });
    }

    bulkUpdate({
      currentAge: age,
      retireAge,
      hasSpouse,
      // Filing status — couples default to MFJ; user can override later in My Plan.
      filingStatus: hasSpouse ? 'mfj' : 'single',
      // Spouse fields are written regardless so the data shape stays consistent;
      // consumers gate their use on hasSpouse anyway.
      spouseCurrentAge: hasSpouse ? spouseAge : undefined,
      spouseRetireAge: hasSpouse ? spouseRetireAge : undefined,
      savings401k: s401k,
      savingsRoth: sRoth,
      savingsTaxable: sTaxable,
      savingsHSA: sHSA,
      spouseSavings401k: hasSpouse ? spouseS401k : 0,
      spouseSavingsRoth: hasSpouse ? spouseSRoth : 0,
      annualSpending: spending,
      retireSpending,
      incomeSources,
    });
    onComplete();
  }

  function skip() {
    // Leave a flag so My Plan can show a "Finish setup" banner. Cleared
    // when the user either replays onboarding or explicitly dismisses
    // the banner.
    if (typeof window !== 'undefined') {
      localStorage.setItem('retirement-onboarding-skipped', '1');
    }
    onComplete();
  }

  const total = s401k + sRoth + sTaxable + sHSA + (hasSpouse ? spouseS401k + spouseSRoth : 0);

  // Reusable pill style for the household-type toggle.
  const pillStyle = (active) => ({
    flex: 1, padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    fontSize: 13, fontWeight: active ? 600 : 500, fontFamily: 'var(--sans)',
    transition: 'all .15s',
  });

  // Section divider for grouping spouse inputs visually.
  const SpouseSectionLabel = ({ children }) => (
    <div style={{
      marginTop: 18, marginBottom: 10, fontSize: 10, color: 'var(--text-dim)',
      textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700,
      borderTop: '1px solid var(--border)', paddingTop: 14,
    }}>
      {children}
    </div>
  );

  // ---- Mode router ----
  if (mode === 'chat') {
    return (
      <div className="onboarding-overlay">
        <div className="onboarding-card" style={{ padding: '32px 24px' }}>
          <button onClick={skip} style={{
            position: 'absolute', top: 16, right: 20,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--sans)',
          }}>
            Skip
          </button>
          <OnboardingChat
            onComplete={onComplete}
            onSwitchToForm={() => setMode('form')}
          />
        </div>
      </div>
    );
  }

  if (mode === 'chooser') {
    return (
      <div className="onboarding-overlay">
        <div className="onboarding-card">
          <button onClick={skip} style={{
            position: 'absolute', top: 16, right: 20,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--sans)',
          }}>
            Skip
          </button>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--serif)', marginBottom: 8 }}>
              Welcome to Retire<span style={{ color: 'var(--accent)' }}>.</span>Simplified
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 28, maxWidth: 380, margin: '0 auto 28px' }}>
              How would you like to set up your retirement plan?
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420, margin: '0 auto' }}>
              <button
                onClick={() => setMode('chat')}
                style={{
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  border: 'none',
                  borderRadius: 12,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--sans)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  transition: 'transform 0.1s',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span style={{ fontSize: 28 }}>🤖</span>
                <span style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Chat with the AI</div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>5 questions, about 3 minutes</div>
                </span>
                <span style={{ fontSize: 18, opacity: 0.7 }}>→</span>
              </button>

              <button
                onClick={() => setMode('form')}
                style={{
                  background: 'var(--bg2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--sans)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <span style={{ fontSize: 28 }}>📝</span>
                <span style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Fill in the form myself</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>4 steps, about 5 minutes</div>
                </span>
                <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>→</span>
              </button>
            </div>

            <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Either way, you can edit everything later in My Plan.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // mode === 'form' — original step-based flow
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
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
              Answer a few quick questions and we'll build a personalized retirement projection for you.
            </div>
            <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600 }}>
              Are you planning…
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={() => setHasSpouse(false)} style={pillStyle(!hasSpouse)}>
                Just me
              </button>
              <button onClick={() => setHasSpouse(true)} style={pillStyle(hasSpouse)}>
                With my partner
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              {hasSpouse
                ? 'We\'ll capture each spouse\'s ages, savings, and Social Security separately — couples retirement math benefits from it.'
                : 'You can add a spouse later from My Plan if your situation changes.'}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--serif)', marginBottom: 4 }}>
              Age & Timeline
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 24 }}>
              {hasSpouse ? "How old is each of you, and when does each want to retire?" : "How old are you, and when do you want to retire?"}
            </div>
            <Slider label="Current Age" value={age} onChange={setAge} min={18} max={70} />
            <Slider label="Retirement Age" value={retireAge} onChange={setRetireAge} min={Math.max(age + 1, 40)} max={80} />
            {hasSpouse && (
              <>
                <SpouseSectionLabel>Your spouse</SpouseSectionLabel>
                <Slider label="Spouse Current Age" value={spouseAge} onChange={setSpouseAge} min={18} max={70} />
                <Slider label="Spouse Retirement Age" value={spouseRetireAge} onChange={setSpouseRetireAge} min={Math.max(spouseAge + 1, 40)} max={80} />
              </>
            )}
            <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--bg2)', fontSize: 13, color: 'var(--text-muted)' }}>
              {hasSpouse
                ? `${retireAge - age} yrs until you retire · ${spouseRetireAge - spouseAge} yrs until your spouse retires`
                : `${retireAge - age} years until retirement`}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--serif)', marginBottom: 4 }}>
              Income & Spending
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 24 }}>
              {hasSpouse ? "Each salary today, plus how much you expect to spend in retirement." : "Your salary today, and how much you expect to spend once retired."}
            </div>
            <Slider label="Annual Salary" value={salary} onChange={setSalary} min={20000} max={500000} step={5000} format={fmt} />
            {hasSpouse && (
              <Slider label="Spouse Annual Salary" value={spouseSalary} onChange={setSpouseSalary} min={0} max={500000} step={5000} format={fmt} />
            )}
            <Slider label="Retirement Spending (% of today's spending)" value={retireReplacementPct} onChange={setRetireReplacementPct} min={50} max={120} step={5} suffix="%" />

            {/* Pension toggle — surfaced for teacher / govt / military / union users.
                Off by default because most private-sector folks no longer have one;
                we don't want to clutter the path for the 80% case. */}
            <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  checked={hasPension}
                  onChange={e => setHasPension(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 600 }}>{hasSpouse ? 'I will receive a pension' : 'I will receive a pension'}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>(teacher, govt, military, union)</span>
              </label>
              {hasPension && (
                <div style={{ marginTop: 10 }}>
                  <Slider label="Monthly Pension Amount" value={pensionMonthly} onChange={setPensionMonthly} min={0} max={15000} step={100} format={fmt} />
                  <Slider label="Start Age" value={pensionStartAge} onChange={setPensionStartAge} min={50} max={75} suffix=" yrs" />
                </div>
              )}
              {hasSpouse && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text)', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <input
                    type="checkbox"
                    checked={hasSpousePension}
                    onChange={e => setHasSpousePension(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 600 }}>My spouse will receive a pension</span>
                </label>
              )}
              {hasSpouse && hasSpousePension && (
                <div style={{ marginTop: 10 }}>
                  <Slider label="Spouse Monthly Pension" value={spousePensionMonthly} onChange={setSpousePensionMonthly} min={0} max={15000} step={100} format={fmt} />
                  <Slider label="Spouse Start Age" value={spousePensionStartAge} onChange={setSpousePensionStartAge} min={50} max={75} suffix=" yrs" />
                </div>
              )}
            </div>

            {(() => {
              const householdSalary = salary + (hasSpouse ? spouseSalary : 0);
              return (
                <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--bg2)', fontSize: 13, color: 'var(--text-muted)' }}>
                  Household income {fmt(householdSalary)}/yr ({fmt(Math.round(householdSalary / 12))}/mo). Retirement spending estimate: {fmt(Math.round(householdSalary * 0.75 * (retireReplacementPct / 100) / 12))}/mo (most planners use 70–85%).
                </div>
              );
            })()}
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--serif)', marginBottom: 4 }}>
              Current Savings
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 24 }}>
              {hasSpouse ? "Each retirement account is per-person; taxable and HSA can be joint." : "How much do you have saved? Estimates are fine."}
            </div>
            <Slider label="401(k) / 403(b)" value={s401k} onChange={setS401k} min={0} max={2000000} step={5000} format={fmt} />
            <Slider label="Roth IRA" value={sRoth} onChange={setSRoth} min={0} max={500000} step={5000} format={fmt} />
            {hasSpouse && (
              <>
                <SpouseSectionLabel>Your spouse</SpouseSectionLabel>
                <Slider label="Spouse 401(k) / 403(b)" value={spouseS401k} onChange={setSpouseS401k} min={0} max={2000000} step={5000} format={fmt} />
                <Slider label="Spouse Roth IRA" value={spouseSRoth} onChange={setSpouseSRoth} min={0} max={500000} step={5000} format={fmt} />
              </>
            )}
            {hasSpouse && <SpouseSectionLabel>Joint accounts</SpouseSectionLabel>}
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
