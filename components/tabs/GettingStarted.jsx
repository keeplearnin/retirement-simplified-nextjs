'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';

const steps = [
  {
    icon: '',
    title: 'Open a Brokerage Account',
    content: (
      <div>
        <p style={{ marginBottom: 12 }}>Choose one of the big three low-cost brokerages — you can&apos;t go wrong with any of them:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { name: 'Vanguard', desc: 'Pioneer of index investing. Best for buy-and-hold investors.' },
            { name: 'Fidelity', desc: 'Zero-fee index funds. Great research tools and customer service.' },
            { name: 'Schwab', desc: 'Excellent all-around platform. Strong banking integration.' },
          ].map(b => (
            <div key={b.name} style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 15, fontFamily: 'var(--serif)', color: 'var(--accent)', marginBottom: 4 }}>{b.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{b.desc}</div>
            </div>
          ))}
        </div>
        <SectionLabel>Account Types</SectionLabel>
        <ul style={{ paddingLeft: 18, margin: 0, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.8 }}>
          <li><strong style={{ color: 'var(--text)' }}>401(k)</strong> — Employer-sponsored. Always contribute enough to get the full match (it&apos;s free money).</li>
          <li><strong style={{ color: 'var(--text)' }}>Roth IRA</strong> — After-tax contributions, tax-free growth. Best if you expect higher taxes in retirement.</li>
          <li><strong style={{ color: 'var(--text)' }}>Traditional IRA</strong> — Pre-tax contributions, taxed on withdrawal. Best if you expect lower taxes in retirement.</li>
          <li><strong style={{ color: 'var(--text)' }}>Taxable Brokerage</strong> — No tax advantages, but no contribution limits or withdrawal restrictions.</li>
        </ul>
      </div>
    ),
  },
  {
    icon: '',
    title: 'Pick Your Strategy',
    content: (
      <div>
        <p style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: 13 }}>There are only two strategies most people need. Both are simple, diversified, and low-cost.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--accent)33' }}>
            <div style={{ fontSize: 15, fontFamily: 'var(--serif)', color: 'var(--accent)', marginBottom: 8 }}>Target Date Fund</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              Pick the fund closest to your retirement year. It automatically adjusts from aggressive to conservative as you age. One fund, completely hands-off.
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim)', padding: '6px 10px', background: 'var(--accent-dim)', borderRadius: 4 }}>
              Best for: People who want zero maintenance
            </div>
          </div>
          <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--warn)33' }}>
            <div style={{ fontSize: 15, fontFamily: 'var(--serif)', color: 'var(--warn)', marginBottom: 8 }}>Three-Fund Portfolio</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              US stocks + international stocks + bonds. You choose the percentages and rebalance once a year. Slightly lower fees than target date funds.
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim)', padding: '6px 10px', background: 'var(--warn-dim)', borderRadius: 4 }}>
              Best for: People who want slight control and lower fees
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: '',
    title: 'Buy Your Funds',
    content: (
      <div>
        <p style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 13 }}>Here are the specific fund tickers for each provider. All have expense ratios under 0.10%.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>Fund Type</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>Vanguard</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>Fidelity</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>Schwab</th>
              </tr>
            </thead>
            <tbody>
              {[
                { type: 'US Total Market', vg: 'VTI / VTSAX', fi: 'FSKAX / FZROX', sc: 'SWTSX' },
                { type: 'International', vg: 'VXUS / VTIAX', fi: 'FTIHX / FZILX', sc: 'SWISX' },
                { type: 'US Bonds', vg: 'BND / VBTLX', fi: 'FXNAX', sc: 'SCHZ' },
                { type: 'Target Date 2055', vg: 'VFFVX', fi: 'FDEWX', sc: 'SWYJX' },
              ].map(row => (
                <tr key={row.type} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 600 }}>{row.type}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--accent)', fontFamily: 'monospace', fontSize: 12 }}>{row.vg}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--accent)', fontFamily: 'monospace', fontSize: 12 }}>{row.fi}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--accent)', fontFamily: 'monospace', fontSize: 12 }}>{row.sc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    icon: '',
    title: 'Automate & Forget',
    content: (
      <div>
        <p style={{ marginBottom: 14, color: 'var(--text-muted)', fontSize: 13 }}>The best investment strategy is one you don&apos;t have to think about. Set these up once and let compounding do the work.</p>
        <ol style={{ paddingLeft: 20, margin: 0, color: 'var(--text-muted)', fontSize: 13, lineHeight: 2 }}>
          <li><strong style={{ color: 'var(--text)' }}>Max your 401(k) match</strong> — Increase contributions to at least the employer match percentage.</li>
          <li><strong style={{ color: 'var(--text)' }}>Set up automatic IRA contributions</strong> — Schedule monthly transfers from your bank to your IRA.</li>
          <li><strong style={{ color: 'var(--text)' }}>Enable automatic investing</strong> — Set purchases to happen the same day contributions arrive.</li>
          <li><strong style={{ color: 'var(--text)' }}>Turn on dividend reinvestment (DRIP)</strong> — All dividends automatically buy more shares.</li>
          <li><strong style={{ color: 'var(--text)' }}>Increase contributions annually</strong> — Bump contributions by 1% each year or with each raise.</li>
          <li><strong style={{ color: 'var(--text)' }}>Rebalance once a year</strong> — Check your allocation annually and rebalance if it drifts more than 5%.</li>
        </ol>
      </div>
    ),
  },
  {
    icon: '',
    title: 'When You DO Need an Advisor',
    content: (
      <div>
        <p style={{ marginBottom: 14, color: 'var(--text-muted)', fontSize: 13 }}>Most people don&apos;t need a financial advisor. But there are situations where professional guidance is worth it:</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { title: 'Complex Tax Situations', desc: 'Stock options, RSUs, multiple income sources, or business ownership.' },
            { title: 'Major Life Changes', desc: 'Inheritance, divorce, retirement transition, or caring for aging parents.' },
            { title: 'Estate Planning', desc: 'Trusts, wills, and tax-efficient wealth transfer strategies.' },
            { title: 'High Net Worth', desc: 'Asset protection, charitable giving strategies, and tax optimization.' },
          ].map(s => (
            <div key={s.title} style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 16px', background: 'var(--accent-dim)', borderRadius: 8, border: '1px solid var(--accent)22' }}>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>Find a Fee-Only Advisor</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Look for fee-only fiduciary advisors through <strong style={{ color: 'var(--text)' }}>NAPFA.org</strong>. Fee-only means they don&apos;t earn commissions — they work only for you, not for a product company.
          </div>
        </div>
      </div>
    ),
  },
];

export default function GettingStarted() {
  const [openStep, setOpenStep] = useState(1);

  return (
    <div className="fade-up">
      <InfoBox title="Your 5-Step Investing Starter Kit" color="var(--accent)" bgColor="var(--accent-dim)">
        Everything you need to start investing for retirement in under an hour. Follow these five steps in order and you&apos;ll be ahead of 90% of people.
      </InfoBox>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((step, i) => {
          const stepNum = i + 1;
          const isOpen = openStep === stepNum;
          return (
            <Card key={stepNum} style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenStep(isOpen ? null : stepNum)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '16px 20px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{
                  fontSize: 24,
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  background: isOpen ? 'var(--accent-dim)' : 'var(--bg)',
                  border: `1px solid ${isOpen ? 'var(--accent)' : 'var(--border)'}`,
                  flexShrink: 0,
                }}>
                  {step.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Step {stepNum}</div>
                  <div style={{ fontSize: 16, fontFamily: 'var(--serif)', color: isOpen ? 'var(--accent)' : 'var(--text)' }}>{step.title}</div>
                </div>
                <span style={{
                  fontSize: 18,
                  color: 'var(--text-dim)',
                  transition: 'transform 0.2s',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>
                  ▾
                </span>
              </button>
              {isOpen && (
                <div style={{
                  padding: '0 20px 20px 20px',
                  borderTop: '1px solid var(--border)',
                  paddingTop: 16,
                }}>
                  {step.content}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
