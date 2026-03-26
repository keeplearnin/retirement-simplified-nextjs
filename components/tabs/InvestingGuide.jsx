'use client';

import { useState, useMemo } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import MiniChart from '@/components/ui/MiniChart';
import { fmt } from '@/lib/format';

const quizQuestions = [
  { q: 'How would you react if your portfolio dropped 30% in a month?', opts: ['Sell everything immediately', 'Sell some to reduce risk', 'Do nothing, wait it out', 'Buy more at the discount'] },
  { q: 'When do you need this money?', opts: ['Within 5 years', '5-10 years', '10-20 years', '20+ years'] },
  { q: 'What is your current income stability?', opts: ['Unstable / irregular', 'Somewhat stable', 'Very stable with growth', 'Multiple income streams'] },
  { q: 'How much investing experience do you have?', opts: ['Complete beginner', 'I know the basics', 'Intermediate — a few years', 'Advanced — very comfortable'] },
  { q: 'What matters more to you?', opts: ['Protecting what I have', 'Steady, predictable growth', 'Strong growth with some risk', 'Maximum growth, I can handle drops'] },
];

const sectionNav = [
  { id: 'start', label: 'Where to Start', icon: '🧭' },
  { id: 'checklist', label: 'Pre-Invest Checklist', icon: '✅' },
  { id: 'risk', label: 'Risk Quiz', icon: '🎯' },
  { id: 'what', label: 'What to Buy', icon: '🛒' },
  { id: 'dca', label: 'DCA Calculator', icon: '💰' },
  { id: 'mistakes', label: 'Mistakes to Avoid', icon: '🚫' },
];

const investSteps = [
  { num: 1, title: 'Build an Emergency Fund', desc: 'Save 3-6 months of expenses in a high-yield savings account before investing. This protects you from selling investments at a loss when life happens.', priority: 'Essential', color: 'var(--danger)' },
  { num: 2, title: 'Pay Off High-Interest Debt', desc: 'Any debt above 6-7% interest should be paid off first. Guaranteed return that beats the stock market average.', priority: 'Essential', color: 'var(--danger)' },
  { num: 3, title: 'Get Your 401(k) Match', desc: 'Contribute enough to your employer&apos;s 401(k) to get the full match. It&apos;s an instant 50-100% return on your money.', priority: 'High', color: 'var(--warn)' },
  { num: 4, title: 'Max Out Roth IRA', desc: 'Contribute up to $7,000/year ($8,000 if 50+). Tax-free growth and withdrawals in retirement make this incredibly powerful.', priority: 'High', color: 'var(--warn)' },
  { num: 5, title: 'Max Out 401(k)', desc: 'After Roth IRA, increase 401(k) contributions toward the $23,500 annual limit. Pre-tax contributions reduce your tax bill today.', priority: 'Medium', color: 'var(--accent)' },
  { num: 6, title: 'Taxable Brokerage Account', desc: 'Once tax-advantaged accounts are maxed, invest in a regular brokerage account. No tax benefits but no restrictions either.', priority: 'Optional', color: 'var(--text-dim)' },
];

const fundCards = [
  {
    title: 'US Total Stock Market',
    desc: 'Covers the entire US stock market — large, mid, and small cap companies. The core of most portfolios.',
    allocation: '50-70%',
    color: 'var(--accent)',
    tickers: { Vanguard: 'VTI / VTSAX', Fidelity: 'FSKAX / FZROX', Schwab: 'SWTSX' },
  },
  {
    title: 'International Stocks',
    desc: 'Developed and emerging markets outside the US. Provides geographic diversification.',
    allocation: '15-30%',
    color: 'var(--warn)',
    tickers: { Vanguard: 'VXUS / VTIAX', Fidelity: 'FTIHX / FZILX', Schwab: 'SWISX' },
  },
  {
    title: 'US Bond Market',
    desc: 'Government and corporate bonds. Reduces volatility and provides stability during stock downturns.',
    allocation: '10-30%',
    color: 'var(--blue)',
    tickers: { Vanguard: 'BND / VBTLX', Fidelity: 'FXNAX', Schwab: 'SCHZ' },
  },
  {
    title: 'Target Date Fund',
    desc: 'All-in-one fund that automatically adjusts allocation as you approach retirement. Choose the year closest to when you&apos;ll retire.',
    allocation: '100% (standalone)',
    color: 'var(--success)',
    tickers: { Vanguard: 'VLXVX (2065)', Fidelity: 'FFIJX (2065)', Schwab: 'SWYNX (2065)' },
  },
];

const mistakes = [
  { title: 'Timing the Market', cost: 'Avg 1.5% annual return loss', fix: 'Set up automatic investments on a schedule and don&apos;t look at your portfolio daily.' },
  { title: 'Not Starting Early Enough', cost: '$500K+ in lost growth over 30 years', fix: 'Start with whatever you can, even $50/month. Time in the market beats timing the market.' },
  { title: 'Picking Individual Stocks', cost: '80% of stock pickers underperform index funds', fix: 'Buy broad index funds instead. You&apos;ll beat most professional fund managers.' },
  { title: 'Paying High Fees', cost: '1% fees can cost $590K over 40 years', fix: 'Only buy funds with expense ratios under 0.20%. Ideally under 0.05%.' },
  { title: 'Panic Selling During Crashes', cost: 'Missing the 10 best days cuts returns by 50%', fix: 'Zoom out. Every crash in history has been followed by recovery and new highs.' },
  { title: 'Not Diversifying', cost: 'Single stock can drop 90%+ permanently', fix: 'Index funds give you instant diversification across hundreds of companies.' },
  { title: 'Checking Portfolio Too Often', cost: 'Leads to emotional decisions and trading', fix: 'Check quarterly at most. Set it and forget it — rebalance once a year.' },
  { title: 'Waiting for the "Perfect" Time', cost: 'Every year delayed costs ~7% compounding', fix: 'The best time to invest was yesterday. The second best time is today.' },
];

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

  const checklistReady = hasEmergency && !hasDebt && has401k;

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

      {/* Where to Start */}
      {section === 'start' && (
        <Card>
          <SectionLabel>Priority Order for Your Money</SectionLabel>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Follow this order to maximize every dollar. Each step builds on the previous one.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {investSteps.map(step => (
              <div key={step.num} style={{
                padding: '16px 20px',
                background: 'var(--bg)',
                borderRadius: 8,
                borderLeft: `4px solid ${step.color}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
              }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: `${step.color}22`,
                  color: step.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                }}>
                  {step.num}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{step.title}</span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: `${step.color}22`,
                      color: step.color,
                      textTransform: 'uppercase',
                      letterSpacing: '.04em',
                    }}>
                      {step.priority}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }} dangerouslySetInnerHTML={{ __html: step.desc }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pre-Invest Checklist */}
      {section === 'checklist' && (
        <Card>
          <SectionLabel>Before You Invest</SectionLabel>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Make sure you&apos;ve checked these boxes before putting money in the market.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {/* Emergency Fund */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              padding: '16px 20px',
              background: hasEmergency ? 'var(--accent-dim)' : 'var(--bg)',
              borderRadius: 8,
              border: hasEmergency ? '1px solid var(--accent)44' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all .2s',
            }}>
              <input
                type="checkbox"
                checked={hasEmergency}
                onChange={e => setHasEmergency(e.target.checked)}
                style={{ marginTop: 2, accentColor: 'var(--accent)', width: 18, height: 18, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Emergency Fund (3-6 months)</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  Keep this in a high-yield savings account (currently ~4-5% APY). This isn&apos;t an investment — it&apos;s insurance against unexpected expenses.
                </div>
              </div>
            </label>

            {/* High-Interest Debt */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              padding: '16px 20px',
              background: !hasDebt ? 'var(--accent-dim)' : 'var(--bg)',
              borderRadius: 8,
              border: !hasDebt ? '1px solid var(--accent)44' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all .2s',
            }}>
              <input
                type="checkbox"
                checked={!hasDebt}
                onChange={e => setHasDebt(!e.target.checked)}
                style={{ marginTop: 2, accentColor: 'var(--accent)', width: 18, height: 18, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No High-Interest Debt (&gt;6-7%)</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  Credit cards, personal loans, and other high-rate debt should be paid off first. The stock market averages ~7-10% — you can&apos;t reliably out-earn 20%+ credit card interest.
                </div>
              </div>
            </label>

            {/* 401k Match */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              padding: '16px 20px',
              background: has401k ? 'var(--accent-dim)' : 'var(--bg)',
              borderRadius: 8,
              border: has401k ? '1px solid var(--accent)44' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all .2s',
            }}>
              <input
                type="checkbox"
                checked={has401k}
                onChange={e => setHas401k(e.target.checked)}
                style={{ marginTop: 2, accentColor: 'var(--accent)', width: 18, height: 18, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Getting Full 401(k) Match</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  If your employer offers a 401(k) match, contribute at least enough to get the full match. A typical 50% match on 6% of salary is an instant 50% return.
                </div>
              </div>
            </label>
          </div>

          {/* Status */}
          <div style={{
            padding: '16px 20px',
            borderRadius: 8,
            background: checklistReady ? 'var(--success)15' : 'var(--warn)15',
            border: checklistReady ? '1px solid var(--success)33' : '1px solid var(--warn)33',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 24 }}>{checklistReady ? '🟢' : '🟡'}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: checklistReady ? 'var(--success)' : 'var(--warn)' }}>
                {checklistReady ? 'You&apos;re Ready to Invest!' : 'Almost There'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 2 }}>
                {checklistReady
                  ? 'Your financial foundation is solid. You can confidently start investing in index funds.'
                  : 'Complete the items above before investing. Building a strong foundation prevents you from having to sell investments early.'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Risk Quiz */}
      {section === 'risk' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card>
            <SectionLabel>Risk Tolerance Quiz</SectionLabel>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Answer these 5 questions to find your ideal investment mix.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {quizQuestions.map((q, qi) => (
                <div key={qi}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                    {qi + 1}. {q.q}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {q.opts.map((opt, oi) => (
                      <button
                        key={oi}
                        onClick={() => {
                          const next = [...riskQuiz];
                          next[qi] = oi;
                          setRiskQuiz(next);
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: riskQuiz[qi] === oi ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: riskQuiz[qi] === oi ? 'var(--accent-dim)' : 'var(--bg)',
                          color: riskQuiz[qi] === oi ? 'var(--accent)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: 12,
                          textAlign: 'left',
                          lineHeight: 1.4,
                          transition: 'all .15s',
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionLabel>Your Risk Profile</SectionLabel>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: riskScore.color, fontFamily: 'var(--serif)' }}>
                {riskScore.level}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                Score: {riskQuiz.reduce((a, b) => a + b, 0)} / 15
              </div>
            </div>

            {/* Allocation Bar Chart */}
            <div style={{ marginBottom: 24 }}>
              {[
                { label: 'Stocks', value: riskScore.stock, color: 'var(--accent)' },
                { label: 'Bonds', value: riskScore.bond, color: 'var(--blue)' },
                { label: 'Cash', value: riskScore.cash, color: 'var(--text-dim)' },
              ].map(a => (
                <div key={a.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{a.label}</span>
                    <span style={{ color: a.color, fontWeight: 600 }}>{a.value}%</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${a.value}%`, height: '100%', background: a.color, borderRadius: 4, transition: 'width .4s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Description */}
            <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 8, marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                {riskScore.level === 'Conservative' && 'You prioritize capital preservation over growth. Your portfolio emphasizes bonds and stable income with minimal stock exposure. Best for those near retirement or with low risk tolerance.'}
                {riskScore.level === 'Moderate' && 'You want a balance of growth and stability. A 60/40 stock-bond split has historically provided solid returns with manageable volatility. Good for mid-career investors.'}
                {riskScore.level === 'Growth' && 'You&apos;re comfortable with volatility in exchange for higher long-term returns. Heavy stock allocation with some bonds for stability. Best for those with 15+ years to retirement.'}
                {riskScore.level === 'Aggressive' && 'You want maximum growth and can stomach large short-term drops. Nearly all stocks with minimal bonds. Best for young investors with 20+ year time horizons.'}
              </div>
            </div>

            {/* Recommended Funds */}
            <SectionLabel>Recommended Funds</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {riskScore.stock > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 6, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>US Stocks ({riskScore.stock}%)</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600, fontFamily: 'monospace' }}>VTI / VTSAX</span>
                </div>
              )}
              {riskScore.bond > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 6, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Bonds ({riskScore.bond}%)</span>
                  <span style={{ color: 'var(--blue)', fontWeight: 600, fontFamily: 'monospace' }}>BND / VBTLX</span>
                </div>
              )}
              {riskScore.cash > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 6, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cash ({riskScore.cash}%)</span>
                  <span style={{ color: 'var(--text-dim)', fontWeight: 600, fontFamily: 'monospace' }}>HYSA / VMFXX</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* What to Buy */}
      {section === 'what' && (
        <Card>
          <SectionLabel>Core Index Funds</SectionLabel>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            These are the only funds most people need. All have expense ratios under 0.10%.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {fundCards.map(fund => (
              <div key={fund.title} style={{
                padding: 20,
                background: 'var(--bg)',
                borderRadius: 10,
                border: `1px solid ${fund.color}33`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: fund.color, fontFamily: 'var(--serif)' }}>{fund.title}</div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 10,
                    background: `${fund.color}18`,
                    color: fund.color,
                  }}>
                    {fund.allocation}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 14 }} dangerouslySetInnerHTML={{ __html: fund.desc }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(fund.tickers).map(([provider, ticker]) => (
                    <div key={provider} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-dim)' }}>{provider}</span>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 500 }}>{ticker}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* DCA Calculator */}
      {section === 'dca' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card>
            <SectionLabel>Dollar-Cost Averaging Calculator</SectionLabel>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              See how consistent investing grows over 30 years at an average 7% annual return.
            </p>
            <Slider
              label="Investment Amount"
              value={investAmt}
              onChange={setInvestAmt}
              min={50}
              max={5000}
              step={50}
              prefix="$"
            />
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Frequency</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'biweekly', label: 'Bi-weekly' },
                  { id: 'monthly', label: 'Monthly' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setInvestFreq(f.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: investFreq === f.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: investFreq === f.id ? 'var(--accent-dim)' : 'var(--bg)',
                      color: investFreq === f.id ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      transition: 'all .15s',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Total Contributed</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--serif)' }}>
                  {fmt(dcaData[dcaData.length - 1]?.contributed || 0)}
                </div>
              </div>
              <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Portfolio Value</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--serif)' }}>
                  {fmt(dcaData[dcaData.length - 1]?.balance || 0)}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Growth from compounding: <strong style={{ color: 'var(--success)' }}>{fmt((dcaData[dcaData.length - 1]?.balance || 0) - (dcaData[dcaData.length - 1]?.contributed || 0))}</strong>
              </span>
            </div>
          </Card>

          <Card>
            <SectionLabel>Growth Over 30 Years</SectionLabel>
            <MiniChart
              data={dcaData}
              height={260}
              lines={[
                { key: 'balance', label: 'Portfolio Value', color: 'var(--accent)', width: 2 },
                { key: 'contributed', label: 'Total Contributed', color: 'var(--text-dim)', width: 1.5, dash: '4 2' },
              ]}
            />
            <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 8, marginTop: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                The gap between the lines is <strong style={{ color: 'var(--accent)' }}>compound growth</strong> — money your money earned. The longer you invest, the more compounding dominates. After 30 years, investment gains typically exceed your total contributions.
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Mistakes to Avoid */}
      {section === 'mistakes' && (
        <Card>
          <SectionLabel>Common Investing Mistakes</SectionLabel>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Avoiding these mistakes is just as important as picking the right investments.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {mistakes.map((m, i) => (
              <div key={i} style={{
                padding: 18,
                background: 'var(--bg)',
                borderRadius: 10,
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  {m.title}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--danger)',
                  fontWeight: 600,
                  marginBottom: 10,
                  padding: '4px 10px',
                  background: 'var(--danger)12',
                  borderRadius: 4,
                  display: 'inline-block',
                }}>
                  Cost: {m.cost}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: m.fix }} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
