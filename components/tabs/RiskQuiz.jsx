'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import Donut from '@/components/ui/Donut';
import { RISK_LABELS } from '@/lib/constants';

const QUESTIONS = [
  {
    q: 'How old are you?',
    options: ['Under 30', '30\u201345', '46\u201355', 'Over 55'],
  },
  {
    q: 'When do you plan to start withdrawing from investments?',
    options: ['20+ years', '10\u201320 years', '5\u201310 years', 'Less than 5 years'],
  },
  {
    q: 'How would you describe your investment knowledge?',
    options: ['Beginner', 'Some knowledge', 'Knowledgeable', 'Expert'],
  },
  {
    q: 'If your portfolio dropped 20% in a month, what would you do?',
    options: ['Sell everything', 'Sell some', 'Hold steady', 'Buy more'],
  },
  {
    q: 'What is your primary investing goal?',
    options: ['Preserve capital', 'Steady income', 'Growth with some income', 'Maximum growth'],
  },
  {
    q: 'How much of your monthly income can you invest?',
    options: ['Less than 5%', '5\u201310%', '10\u201320%', 'More than 20%'],
  },
  {
    q: 'Do you have an emergency fund covering 3\u20136 months of expenses?',
    options: ['No', 'Building one', 'Yes, 3 months', 'Yes, 6+ months'],
  },
  {
    q: 'How would you feel if your portfolio was worth less than you invested after 2 years?',
    options: ['Very uncomfortable', 'Somewhat uncomfortable', 'Slightly concerned', 'Not worried'],
  },
  {
    q: 'Which best describes your income stability?',
    options: ['Unstable/variable', 'Somewhat stable', 'Stable with growth potential', 'Very stable, high earner'],
  },
  {
    q: 'How long could you leave your investments untouched if markets crashed?',
    options: ['Would need it immediately', 'A few months', '1\u20133 years', '5+ years'],
  },
];

const ALLOCATIONS = [
  { stocks: 25, bonds: 65, cash: 10 },
  { stocks: 40, bonds: 50, cash: 10 },
  { stocks: 60, bonds: 33, cash: 7 },
  { stocks: 80, bonds: 17, cash: 3 },
  { stocks: 95, bonds: 5, cash: 0 },
];

const RISK_COLORS = [
  'var(--blue)',
  'var(--blue)',
  'var(--accent)',
  'var(--warn)',
  'var(--danger)',
];

function scoreToLevel(total, answers) {
  // Weight time horizon (Q2) and age (Q1) — young investors with long horizons get a boost
  const ageScore = answers[0] || 0; // 1=Under 30, 2=30-45, 3=46-55, 4=Over 55
  const horizonScore = answers[1] || 0; // 1=20+yrs, 2=10-20, 3=5-10, 4=<5
  // Young + long horizon = natural fit for growth — add bonus points
  const timeBonus = (ageScore <= 2 && horizonScore <= 2) ? 4 : (ageScore <= 2 && horizonScore <= 3) ? 2 : 0;
  const adjusted = total + timeBonus;

  if (adjusted <= 16) return 0;
  if (adjusted <= 22) return 1;
  if (adjusted <= 28) return 2;
  if (adjusted <= 34) return 3;
  return 4;
}

export default function RiskQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(Array(10).fill(null));
  const [done, setDone] = useState(false);
  const [fade, setFade] = useState(true);

  const animateStep = useCallback((nextStep) => {
    setFade(false);
    setTimeout(() => {
      setStep(nextStep);
      setFade(true);
    }, 200);
  }, []);

  const handleSelect = useCallback((optIdx) => {
    setAnswers(prev => {
      const next = [...prev];
      next[step] = optIdx + 1;
      return next;
    });
  }, [step]);

  const handleNext = useCallback(() => {
    if (step < 9) {
      animateStep(step + 1);
    } else {
      setFade(false);
      setTimeout(() => {
        setDone(true);
        setFade(true);
      }, 200);
    }
  }, [step, animateStep]);

  const handleBack = useCallback(() => {
    if (step > 0) animateStep(step - 1);
  }, [step, animateStep]);

  const handleRetake = useCallback(() => {
    setFade(false);
    setTimeout(() => {
      setAnswers(Array(10).fill(null));
      setStep(0);
      setDone(false);
      setFade(true);
    }, 200);
  }, []);

  const total = useMemo(() => answers.reduce((s, v) => s + (v || 0), 0), [answers]);
  const level = useMemo(() => scoreToLevel(total, answers), [total, answers]);
  const alloc = ALLOCATIONS[level];
  const label = RISK_LABELS[level];
  const color = RISK_COLORS[level];

  // Persist result to localStorage when quiz completes
  useEffect(() => {
    if (done) {
      const profile = { level: level + 1, label, total, alloc, timestamp: Date.now() };
      try { localStorage.setItem('riskProfile', JSON.stringify(profile)); } catch {}
    }
  }, [done, level, label, total, alloc]);

  const donutSegs = useMemo(() => {
    const parts = [];
    let cum = 0;
    if (alloc.stocks > 0) { parts.push({ start: cum, end: cum + alloc.stocks, color: 'var(--accent)' }); cum += alloc.stocks; }
    if (alloc.bonds > 0) { parts.push({ start: cum, end: cum + alloc.bonds, color: 'var(--warn)' }); cum += alloc.bonds; }
    if (alloc.cash > 0) { parts.push({ start: cum, end: cum + alloc.cash, color: 'var(--text-dim)' }); cum += alloc.cash; }
    return parts;
  }, [alloc]);

  const optionLetters = ['A', 'B', 'C', 'D'];

  // --- Results screen ---
  if (done) {
    return (
      <div className="fade-up" style={{ opacity: fade ? 1 : 0, transition: 'opacity 0.2s ease' }}>
        <SectionLabel>Your Risk Profile</SectionLabel>

        <Card style={{
          marginBottom: 20,
          background: `linear-gradient(135deg, var(--card) 0%, ${color}11 100%)`,
          textAlign: 'center',
          padding: '40px 24px',
        }}>
          <div style={{
            fontSize: 14,
            color: 'var(--text-muted)',
            fontFamily: 'var(--sans)',
            marginBottom: 8,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}>
            Risk Score: {level + 1} / 5
          </div>
          <div style={{
            fontSize: 36,
            fontWeight: 700,
            fontFamily: 'var(--serif)',
            color,
            marginBottom: 6,
          }}>
            {label}
          </div>
          <div style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            background: `${color}18`,
            color,
            marginBottom: 28,
          }}>
            Total: {total} / 40 points
          </div>

          <div style={{ maxWidth: 200, margin: '0 auto 20px' }}>
            <Donut segs={donutSegs} label={`${alloc.stocks}% Stocks`} size={160} strokeWidth={26} radius={60} />
          </div>

          <div style={{
            fontSize: 24,
            fontWeight: 700,
            fontFamily: 'var(--serif)',
            color: 'var(--text)',
            marginBottom: 4,
          }}>
            {alloc.stocks} / {alloc.bonds} / {alloc.cash}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Stocks / Bonds / Cash
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {[
              { label: 'Stocks', pct: alloc.stocks, clr: 'var(--accent)', bg: 'var(--accent-dim)' },
              { label: 'Bonds', pct: alloc.bonds, clr: 'var(--warn)', bg: 'var(--warn-dim)' },
              { label: 'Cash', pct: alloc.cash, clr: 'var(--text-dim)', bg: 'var(--bg2)' },
            ].map(a => (
              <span key={a.label} style={{
                padding: '4px 12px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 600,
                background: a.bg,
                color: a.clr,
              }}>
                {a.label}: {a.pct}%
              </span>
            ))}
          </div>
        </Card>

        <InfoBox icon="🎯" title="What this means" color={color} bgColor={`${color}11`}>
          {level === 0 && (answers[0] <= 2
            ? 'Your answers suggest a very conservative approach despite your young age. While capital preservation is safe, consider that with 20+ years to retirement, you have time to ride out market dips. Even a small increase in stock allocation could significantly boost long-term growth.'
            : 'Your profile suggests a very conservative approach. Focus on capital preservation with mostly bonds and a small stock allocation. Ideal if you are near or in retirement.'
          )}
          {level === 1 && (answers[0] <= 2
            ? 'You lean conservative, which is understandable as a newer investor. With decades ahead, you have the most powerful advantage: time. A slightly higher stock allocation (50-60%) could add significant wealth over your career.'
            : 'You lean conservative. A balanced portfolio weighted toward bonds provides steady income with moderate growth. Good for those within 10 years of retirement.'
          )}
          {level === 2 && 'A moderate risk tolerance balances growth and stability. A classic 60/40 split gives you market participation with downside cushioning. A solid choice for most investors.'}
          {level === 3 && (answers[0] <= 2
            ? 'Great fit for your age. An 80/20 stock-to-bond ratio is aggressive but historically rewarding — and with 20+ years of compounding, you can weather short-term volatility for higher long-term returns.'
            : 'You are comfortable with volatility for higher long-term returns. An 80/20 stock-to-bond ratio is aggressive but historically rewarding over 10+ year horizons.'
          )}
          {level === 4 && (answers[0] <= 2
            ? 'Maximum growth — and with your long time horizon, this makes sense. A nearly all-stock portfolio targets the highest long-term returns. Start here and gradually shift toward bonds as you approach retirement.'
            : 'Maximum growth tolerance. A nearly all-stock portfolio targets the highest long-term returns, but expect significant short-term swings.'
          )}
        </InfoBox>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button
            onClick={handleRetake}
            style={{
              padding: '12px 32px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--sans)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Retake Quiz
          </button>
        </div>
      </div>
    );
  }

  // --- Quiz screen ---
  const current = QUESTIONS[step];
  const selected = answers[step];

  return (
    <div className="fade-up">
      <SectionLabel>Risk Assessment</SectionLabel>

      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--sans)' }}>
            Question {step + 1} of 10
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--sans)' }}>
            {Math.round(((step + 1) / 10) * 100)}%
          </span>
        </div>
        <div style={{
          height: 6,
          borderRadius: 3,
          background: 'var(--bg2)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${((step + 1) / 10) * 100}%`,
            borderRadius: 3,
            background: 'var(--accent)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Question */}
      <div style={{
        opacity: fade ? 1 : 0,
        transform: fade ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      }}>
        <Card style={{ marginBottom: 20, padding: '28px 24px' }}>
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            fontFamily: 'var(--serif)',
            color: 'var(--text)',
            marginBottom: 24,
            lineHeight: 1.4,
          }}>
            {current.q}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {current.options.map((opt, i) => {
              const isSelected = selected === i + 1;
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '16px 18px',
                    borderRadius: 'var(--radius)',
                    border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--accent-dim)' : 'var(--bg2)',
                    color: isSelected ? 'var(--accent)' : 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    fontFamily: 'var(--sans)',
                    fontSize: 14,
                    fontWeight: isSelected ? 600 : 400,
                    width: '100%',
                  }}
                >
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                    background: isSelected ? 'var(--accent)' : 'var(--card)',
                    color: isSelected ? 'var(--bg)' : 'var(--text-muted)',
                    border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    transition: 'all 0.15s ease',
                  }}>
                    {optionLetters[i]}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button
          onClick={handleBack}
          disabled={step === 0}
          style={{
            padding: '12px 24px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg2)',
            color: step === 0 ? 'var(--text-dim)' : 'var(--text)',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'var(--sans)',
            cursor: step === 0 ? 'not-allowed' : 'pointer',
            opacity: step === 0 ? 0.4 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={selected === null}
          style={{
            padding: '12px 32px',
            borderRadius: 'var(--radius)',
            border: 'none',
            background: selected !== null ? 'var(--accent)' : 'var(--bg2)',
            color: selected !== null ? 'var(--bg)' : 'var(--text-dim)',
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'var(--sans)',
            cursor: selected !== null ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
          }}
        >
          {step === 9 ? 'See Results' : 'Next'}
        </button>
      </div>
    </div>
  );
}
