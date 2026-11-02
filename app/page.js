'use client';

import { useState, useEffect, useRef } from 'react';
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
import MonteCarlo from '@/components/tabs/MonteCarlo';
import GettingStarted from '@/components/tabs/GettingStarted';
import AIAdvisor from '@/components/tabs/AIAdvisor';
import MyPlan from '@/components/tabs/MyPlan';
// Merged tabs — combine multiple decision surfaces under one nav entry.
// The underlying tabs (TaxAware, RothLadder, SocialSecurity, WithdrawalStrategy,
// TaxTorpedo) still exist as components and are rendered via these wrappers.
import RothStrategy from '@/components/tabs/RothStrategy';
import RetirementIncome from '@/components/tabs/RetirementIncome';
import Inheritance from '@/components/tabs/Inheritance';
// Flagship additions: Optimize (Decision Engine — ranked, dollar-quantified
// recommendations with auditable math) and Scenarios (side-by-side plan
// comparison on the full projection engine).
import Optimize from '@/components/tabs/Optimize';
import Scenarios from '@/components/tabs/Scenarios';
import LinkedAccounts from '@/components/tabs/LinkedAccounts';
import EquityComp from '@/components/tabs/EquityComp';
import CollegePlanner from '@/components/tabs/CollegePlanner';
import Icon from '@/components/ui/Icon';

function AppContent() {
  const [tab, setTab] = useState('myplan');
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState('light');
  const { user, isConfigured: configured, authLoading, signIn, signOut } = useAuth();

  const [onboarded, setOnboarded] = useState(true); // true initially to avoid flash
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  // Close the "More planners" menu on outside click, Escape, or tab change.
  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

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
  // `icon` values are Icon component names (see components/ui/Icon.jsx),
  // not emoji — gives us consistent monoline glyphs that take currentColor
  // and sit on the typography baseline. (Design-pass feedback: "looks like
  // a basic calculator.")
  const categories = [
    { id: 'plan', label: 'Plan', icon: 'chart', tabs: [
      { id: 'myplan', label: 'My Plan' },
      { id: 'optimize', label: 'Optimize' },
      { id: 'scenarios', label: 'Scenarios' },
      { id: 'accounts', label: 'Accounts' },
      { id: 'equity', label: 'Equity Comp' },
      { id: 'college', label: 'College' },
      { id: 'portfolio', label: 'Portfolio' },
    ]},
    // Coach groups the AI Advisor (chat) with the workbench drill-downs,
    // ordered by the retirement-planning journey:
    //   chat (start here) → Roth decisions (accumulation + conversion)
    //   → retirement income (claim + withdrawal + tax-torpedo explainer)
    //   → Monte Carlo (downside sensitivity)
    //
    // Three workbench tabs in step-1 were merged in step-2 of the
    // restructure:
    //   • RothStrategy      = Roth vs Trad + Roth Ladder
    //   • RetirementIncome  = Social Security + Withdrawal + Tax Torpedo
    { id: 'coach', label: 'Coach', icon: 'sparkles', tabs: [
      { id: 'advisor', label: 'AI Advisor' },
      { id: 'roth-strategy', label: 'Roth Strategy' },
      { id: 'income', label: 'Retirement Income' },
      { id: 'inheritance', label: 'Inheritance' },
      { id: 'montecarlo', label: 'Monte Carlo' },
    ]},
    { id: 'learn', label: 'Learn', icon: 'book', tabs: [
      { id: 'guide', label: 'Getting Started' },
    ]},
  ];

  const activeCategory = categories.find(c => c.tabs.some(t => t.id === tab)) || categories[0];
  const subTabs = activeCategory.tabs;

  return (
    <div style={{ opacity: loaded ? 1 : 0, transition: 'opacity .5s ease', position: 'relative', zIndex: 1 }}>
      {!onboarded && (
        <Onboarding onComplete={(result) => {
          localStorage.setItem('retirement-onboarded', 'true');
          setOnboarded(true);
          // Users who finished onboarding (entered real data) land on the
          // Decision Engine — the "here's what your numbers say to do"
          // moment. Skippers keep the AI Advisor default. Anything without
          // an explicit skipped flag (e.g. OnboardingChat's done button
          // passing a click event) counts as completed.
          if (!(result && result.skipped === true)) setTab('optimize');
        }} />
      )}
      {/* Header — logo, three top-level sections (underline tabs), actions.
          On phones the section tabs move to the bottom bar below. */}
      <header className="app-header">
        <div className="app-header-inner">
          <button type="button" className="brand" onClick={() => setTab('myplan')} aria-label="Retire.Simplified — go to My Plan">
            Retire<span style={{ color: 'var(--accent)' }}>.</span>Simplified
          </button>

          <nav className="top-nav" aria-label="Main">
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setTab(c.tabs[0].id)}
                className="top-nav-link"
                aria-current={c.id === activeCategory.id ? 'page' : undefined}
              >
                {c.label}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <a href="/verdict" className="header-pill" title="Quick Verdict — see where you stand in 90 seconds">
              <span className="quick-verdict-text">Quick verdict</span>
              <span className="quick-verdict-icon-only" aria-label="Quick verdict"><Icon name="bolt" size={15} /></span>
            </a>
            {authLoading ? null : user ? (
              <>
                {user.picture && <img src={user.picture} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} referrerPolicy="no-referrer" />}
                <button type="button" onClick={signOut} className="header-pill header-pill-quiet">Sign out</button>
              </>
            ) : configured ? (
              <button type="button" onClick={signIn} className="header-pill">Sign in</button>
            ) : null}
            <button
              type="button"
              onClick={toggleTheme}
              className="header-icon-btn"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
            </button>
          </div>
        </div>
      </header>

      {/* Section pills — the first few sub-tabs inline, the rest under "More"
          so a category never shows a wall of seven tabs. */}
      {subTabs.length > 1 && (() => {
        const inline = subTabs.length > 5 ? subTabs.slice(0, 4) : subTabs;
        const overflow = subTabs.length > 5 ? subTabs.slice(4) : [];
        const activeOverflow = overflow.find(t => t.id === tab);
        return (
          <div className="sub-nav-wrap">
            <nav className="sub-nav" aria-label={`${activeCategory.label} sections`}>
              {inline.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="sub-nav-pill"
                  aria-current={tab === t.id ? 'page' : undefined}
                >
                  {t.label}
                </button>
              ))}
              {overflow.length > 0 && (
                <div className="sub-nav-more" ref={moreRef}>
                  <button
                    type="button"
                    className="sub-nav-pill"
                    aria-current={activeOverflow ? 'page' : undefined}
                    aria-expanded={moreOpen}
                    aria-haspopup="true"
                    onClick={() => setMoreOpen(o => !o)}
                  >
                    {activeOverflow ? activeOverflow.label : 'More planners'}
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                  {moreOpen && (
                    <div className="sub-nav-menu">
                      {overflow.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          className="sub-nav-menu-item"
                          aria-current={tab === t.id ? 'page' : undefined}
                          onClick={() => { setTab(t.id); setMoreOpen(false); }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </nav>
          </div>
        );
      })()}

      <main className="section-pad app-main">
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
              <strong>Finish setting up your plan</strong> — you skipped onboarding earlier. Takes ~3 minutes.
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
        {tab === 'optimize' && <Optimize />}
        {tab === 'scenarios' && <Scenarios />}
        {tab === 'accounts' && <LinkedAccounts />}
        {tab === 'equity' && <EquityComp />}
        {tab === 'college' && <CollegePlanner />}
        {tab === 'portfolio' && <PortfolioBuilder />}
        {tab === 'advisor' && <AIAdvisor />}
        {tab === 'roth-strategy' && <RothStrategy />}
        {tab === 'income' && <RetirementIncome />}
        {tab === 'inheritance' && <Inheritance />}
        {tab === 'montecarlo' && <MonteCarlo />}
        {tab === 'guide' && <GettingStarted />}
      </main>

      {/* Phone-only bottom tab bar — replaces the header tabs under 720px. */}
      <nav className="bottom-nav" aria-label="Main">
        {categories.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setTab(c.tabs[0].id)}
            className="bottom-nav-link"
            aria-current={c.id === activeCategory.id ? 'page' : undefined}
          >
            <Icon name={c.icon} size={22} />
            {c.label}
          </button>
        ))}
      </nav>

      <footer style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', padding: '28px 24px 40px', borderTop: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.8, maxWidth: 580, margin: '0 auto' }}>
          <strong>Disclaimer:</strong> This tool is for educational purposes only and does not constitute financial advice. Past performance does not guarantee future results. All projections are hypothetical. Consult a qualified financial professional for advice specific to your situation.
        </p>
        {/* Trust links — methodology, source, license — kept low-key but discoverable */}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', fontSize: 11 }}>
          <a href="/methodology" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>How the math works</a>
          <a href="https://github.com/keeplearnin/retirement-simplified-nextjs" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>Source on GitHub</a>
          <a href="/verdict" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>Quick Verdict</a>
          <a href="/report" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>PDF Report</a>
        </div>
        {/* Standalone calculators — SEO entry points that funnel into the app */}
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', fontSize: 11 }}>
          <a href="/calculators/irmaa-cliff-checker" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>IRMAA Cliff Checker</a>
          <a href="/calculators/tax-torpedo" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>Tax Torpedo</a>
          <a href="/calculators/social-security-break-even" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>SS Break-Even</a>
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
