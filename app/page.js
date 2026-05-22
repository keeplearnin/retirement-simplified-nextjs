'use client';

import { useState, useEffect } from 'react';
import AuthProvider, { useAuth } from '@/components/AuthProvider';
import { PlanProvider } from '@/components/PlanProvider';
import Onboarding from '@/components/Onboarding';
import Auth, { isConfigured } from '@/lib/auth';

// Tab imports — only those wired into the nav categories below.
//
// Removed from the bundle for the 3-category Plan/Coach/Learn launch
// (originally a 5-category structure). Files retained for future revival:
//   - GrowthProjector  (duplicated My Plan's results chart)
//   - GoalPlanner      (folded into the retirement-age slider)
//   - MyPlanV2         (alternate "Stress Test" view — same data twice)
//
// Earlier orphans still on the bench: AccountDashboard, FeeImpact, Rebalance,
// TaxLossHarvesting, ScenarioComparison, InvestingGuide, MyPlans, Journal,
// RiskQuiz, LinkedAccounts.
import PortfolioBuilder from '@/components/tabs/PortfolioBuilder';
import WithdrawalStrategy from '@/components/tabs/WithdrawalStrategy';
import MonteCarlo from '@/components/tabs/MonteCarlo';
import TaxAware from '@/components/tabs/TaxAware';
import SocialSecurity from '@/components/tabs/SocialSecurity';
import TaxTorpedo from '@/components/tabs/TaxTorpedo';
import RothLadder from '@/components/tabs/RothLadder';
import GettingStarted from '@/components/tabs/GettingStarted';
import AIAdvisor from '@/components/tabs/AIAdvisor';
import MyPlan from '@/components/tabs/MyPlan';

function AppContent() {
  const [tab, setTab] = useState('myplan');
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState('dark');
  const { user, isConfigured: configured, authLoading, signIn, signOut } = useAuth();

  const [onboarded, setOnboarded] = useState(true); // true initially to avoid flash
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);
    const handler = (e) => setTab(e.detail);
    const replayHandler = () => {
      localStorage.removeItem('retirement-onboarded');
      setOnboarded(false);
    };
    window.addEventListener('navigate-tab', handler);
    window.addEventListener('replay-onboarding', replayHandler);
    // Restore saved theme
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
    // Check onboarding
    const hasOnboarded = localStorage.getItem('retirement-onboarded') === 'true';
    const hasPlan = localStorage.getItem('myplan-v1') !== null;
    setOnboarded(hasOnboarded || hasPlan);

    // Default landing tab: AI Advisor for net-new users (no plan yet),
    // My Plan for returning users. The AI Advisor is the flagship and
    // also where the welcome chooser kicks the user after onboarding.
    if (!hasPlan) {
      setTab('advisor');
    }

    // Sticky "Finish setup" banner — set by Onboarding.jsx skip() when
    // the user bails without completing. Surfaces on My Plan until the
    // user either finishes setup or has meaningful plan data.
    const skipped = localStorage.getItem('retirement-onboarding-skipped') === '1';
    setOnboardingSkipped(skipped && !hasPlan);
    return () => {
      window.removeEventListener('navigate-tab', handler);
      window.removeEventListener('replay-onboarding', replayHandler);
    };
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  // Three top-level categories — Plan, Coach, Learn. Earlier structure was
  // five (My Plan / Build / Optimize / AI Advisor / Learn); compressed per
  // design review. PortfolioBuilder moved into Plan; the six optimize
  // workbench tabs moved under Coach alongside AI Advisor. Tab IDs are
  // kept stable (myplan, portfolio, advisor, tax, ssa, ...) so any saved
  // localStorage state and external links continue to resolve.
  const categories = [
    { id: 'plan', label: 'Plan', icon: '📊', tabs: [
      { id: 'myplan', label: 'My Plan' },
      { id: 'portfolio', label: 'Portfolio' },
    ]},
    // Ordered as: chat first (the primary surface), then workbench tabs
    // in the retirement-planning journey order:
    //   accumulation (Roth vs Trad) → income (SS) → conversion (Roth Ladder)
    //   → drawdown (Withdrawal) → educational (Torpedo) → sensitivity (MC)
    { id: 'coach', label: 'Coach', icon: '🤖', tabs: [
      { id: 'advisor', label: 'AI Advisor' },
      { id: 'tax', label: 'Roth vs Trad' },
      { id: 'ssa', label: 'Social Security' },
      { id: 'roth-ladder', label: 'Roth Ladder' },
      { id: 'withdrawal', label: 'Withdrawal' },
      { id: 'torpedo', label: 'Tax Torpedo' },
      { id: 'montecarlo', label: 'Monte Carlo' },
    ]},
    { id: 'learn', label: 'Learn', icon: '💡', tabs: [
      { id: 'guide', label: 'Getting Started' },
    ]},
  ];

  const activeCategory = categories.find(c => c.tabs.some(t => t.id === tab)) || categories[0];
  const subTabs = activeCategory.tabs;

  return (
    <div style={{ opacity: loaded ? 1 : 0, transition: 'opacity .5s ease', position: 'relative', zIndex: 1 }}>
      {!onboarded && (
        <Onboarding onComplete={() => {
          localStorage.setItem('retirement-onboarded', 'true');
          setOnboarded(true);
        }} />
      )}
      {/* Compact header — logo + nav + actions in one row */}
      <header className="app-header">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }} onClick={() => setTab('myplan')}>
          <span className="brand-name" style={{ fontWeight: 700, fontFamily: 'var(--sans)', color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Retire<span style={{ color: 'var(--accent)' }}>.</span>Simplified
          </span>
          <span className="brand-free" style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, opacity: 0.7 }}>Free</span>
        </div>

        {/* Nav pills — wrapper provides the fade-gradient scroll affordance on mobile */}
        <div className="nav-scroll-wrapper">
          <nav className="nav-scroll" style={{ display: 'flex', gap: 2, background: 'var(--bg2)', borderRadius: 28, padding: 3, minWidth: 0 }}>
            {categories.map(c => {
              const isActive = c.id === activeCategory.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setTab(c.tabs[0].id)}
                  style={{
                    padding: '8px 16px', border: 'none', cursor: 'pointer', borderRadius: 24,
                    background: isActive ? 'var(--accent)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    fontWeight: isActive ? 600 : 400, fontSize: 13,
                    transition: 'all .2s', fontFamily: 'var(--sans)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <a
            href="/verdict"
            title="Quick Verdict — see where you stand in 90 seconds"
            style={{
              padding: '6px 12px', borderRadius: 16, textDecoration: 'none',
              border: '1px solid var(--accent)', background: 'var(--accent-dim)',
              color: 'var(--accent)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="quick-verdict-text">⚡ Quick Verdict</span>
            <span className="quick-verdict-icon-only" aria-label="Quick Verdict">⚡</span>
          </a>
          {authLoading ? null : user ? (
            <>
              {user.picture && <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--accent)' }} referrerPolicy="no-referrer" />}
              <button onClick={signOut} style={{ padding: '6px 12px', borderRadius: 16, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)', fontSize: 11, fontWeight: 500, fontFamily: 'var(--sans)' }}>Sign Out</button>
            </>
          ) : configured ? (
            <button onClick={signIn} style={{ padding: '6px 14px', borderRadius: 16, border: '1px solid var(--accent)', cursor: 'pointer', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)' }}>Sign in</button>
          ) : null}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)',
              background: 'transparent', cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .25s',
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Sub-tab row (hidden for single-tab categories) */}
      {subTabs.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '12px 16px 8px', borderBottom: '1px solid var(--border)' }}>
          {subTabs.map(t => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '6px 16px', border: 'none', cursor: 'pointer', borderRadius: 20,
                  background: isActive ? 'var(--accent-dim)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                  fontWeight: isActive ? 600 : 400, fontSize: 12,
                  transition: 'all .2s', fontFamily: 'var(--sans)',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <main className="section-pad" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 40px' }}>
        {/* "Finish setup" banner — shown when the user skipped onboarding
            without entering plan data. Persists across reloads (via the
            'retirement-onboarding-skipped' localStorage flag) until they
            either complete onboarding (replay) or enter plan data. */}
        {onboardingSkipped && tab === 'myplan' && (
          <div
            style={{
              margin: '16px 0',
              padding: '12px 16px',
              background: 'var(--accent-dim, rgba(16,185,129,0.10))',
              border: '1px solid var(--accent)',
              borderRadius: 10,
              fontFamily: 'var(--sans)',
              fontSize: 13,
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span>
              👋 <strong>Finish setting up your plan</strong> — you skipped onboarding earlier. Takes ~3 minutes.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  localStorage.removeItem('retirement-onboarding-skipped');
                  window.dispatchEvent(new Event('replay-onboarding'));
                }}
                style={{
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'var(--sans)',
                  cursor: 'pointer',
                }}
              >
                Finish setup →
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('retirement-onboarding-skipped', '0');
                  setOnboardingSkipped(false);
                }}
                style={{
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'var(--sans)',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {tab === 'myplan' && <MyPlan />}
        {tab === 'portfolio' && <PortfolioBuilder />}
        {tab === 'advisor' && <AIAdvisor />}
        {tab === 'tax' && <TaxAware />}
        {tab === 'ssa' && <SocialSecurity />}
        {tab === 'roth-ladder' && <RothLadder />}
        {tab === 'withdrawal' && <WithdrawalStrategy />}
        {tab === 'torpedo' && <TaxTorpedo />}
        {tab === 'montecarlo' && <MonteCarlo />}
        {tab === 'guide' && <GettingStarted />}
      </main>

      <footer style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', padding: '28px 24px 40px', borderTop: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.8, maxWidth: 580, margin: '0 auto' }}>
          ⚖️ <strong>Disclaimer:</strong> This tool is for educational purposes only and does not constitute financial advice. Past performance does not guarantee future results. All projections are hypothetical. Consult a qualified financial professional for advice specific to your situation.
        </p>
        {/* Trust links — methodology, source, license — kept low-key but discoverable */}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', fontSize: 11 }}>
          <a href="/methodology" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>How the math works</a>
          <a href="https://github.com/keeplearnin/retirement-simplified-nextjs" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>Source on GitHub</a>
          <a href="/verdict" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>Quick Verdict</a>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 16, lineHeight: 1.7, opacity: 0.6 }}>
          Built independently. Not a financial advisor. Free, open source, MIT licensed. Tax + benefits data refreshed annually from the IRS, SSA, and CMS.
        </p>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <PlanProvider>
        <AppContent />
      </PlanProvider>
    </AuthProvider>
  );
}
