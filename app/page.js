'use client';

import { useState, useEffect } from 'react';
import AuthProvider, { useAuth } from '@/components/AuthProvider';
import { PlanProvider } from '@/components/PlanProvider';
import Onboarding from '@/components/Onboarding';
import Auth, { isConfigured } from '@/lib/auth';

// Screens: Plan (MyPlan), Improve (Optimize + Scenarios), Ask (AIAdvisor).
// Everything else is reached from the Tools page. Earlier orphans still on
// the bench (not imported): GrowthProjector, GoalPlanner, MyPlanV2,
// AccountDashboard, FeeImpact, Rebalance, TaxLossHarvesting, InvestingGuide,
// MyPlans, Journal, RiskQuiz.
import MyPlan from '@/components/tabs/MyPlan';
import Improve from '@/components/tabs/Improve';
import AIAdvisor from '@/components/tabs/AIAdvisor';
import Tools, { TOOLS } from '@/components/tabs/Tools';
// Tools. RothStrategy and RetirementIncome each group several calculators
// and accept a sub-view (e.g. 'income:bridge').
import RothStrategy from '@/components/tabs/RothStrategy';
import RetirementIncome from '@/components/tabs/RetirementIncome';
import Inheritance from '@/components/tabs/Inheritance';
import LinkedAccounts from '@/components/tabs/LinkedAccounts';
import EquityComp from '@/components/tabs/EquityComp';
import CollegePlanner from '@/components/tabs/CollegePlanner';
import PortfolioBuilder from '@/components/tabs/PortfolioBuilder';
import GettingStarted from '@/components/tabs/GettingStarted';
import Icon from '@/components/ui/Icon';
import { FIGURES } from '@/lib/constants';

function AppContent() {
  const [tab, setTab] = useState('myplan');
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState('light');
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

    // Default landing tab: Ask for net-new users (no plan yet), My Plan
    // for returning users. Ask is also where the welcome chooser sends the
    // user after onboarding.
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

  // Three screens answer what most people come for: am I okay (Plan), what
  // should I change (Improve), and questions about my situation (Ask).
  // Everything else is a Tool — one click away, never in the main nav.
  // Tab IDs stay stable so saved state and links keep resolving; 'optimize'
  // is the Improve screen and 'scenarios' / 'montecarlo' open inside
  // Improve / My Plan. A tool tab may carry a sub-view: 'income:bridge'.
  const categories = [
    { id: 'plan', label: 'Plan', icon: 'chart', tabs: ['myplan', 'montecarlo'] },
    { id: 'improve', label: 'Improve', icon: 'lightbulb', tabs: ['optimize', 'scenarios'] },
    { id: 'ask', label: 'Ask', icon: 'sparkles', tabs: ['advisor'] },
  ];
  const [tabId, tabView] = tab.split(':');
  const activeCategory = categories.find(c => c.tabs.includes(tabId));
  const activeTool = TOOLS.find(t => t.id === tabId);

  return (
    <div style={{ opacity: loaded ? 1 : 0, transition: 'opacity .5s ease', position: 'relative', zIndex: 1 }}>
      {!onboarded && (
        <Onboarding onComplete={(result) => {
          localStorage.setItem('retirement-onboarded', 'true');
          setOnboarded(true);
          // Users who finished onboarding (entered real data) land on the
          // Decision Engine — the "here's what your numbers say to do"
          // moment. Skippers keep the Ask default. Anything without
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
                onClick={() => setTab(c.tabs[0])}
                className="top-nav-link"
                aria-current={c.id === activeCategory?.id ? 'page' : undefined}
              >
                {c.label}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <button
              type="button"
              onClick={() => setTab('tools')}
              className="header-pill header-pill-quiet"
              aria-current={tab === 'tools' || activeTool ? 'page' : undefined}
            >
              Tools
            </button>
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

      <main className="app-main">
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
        {activeTool && (
          <button type="button" className="tools-back" onClick={() => setTab('tools')}>
            ← All tools
          </button>
        )}
        {(tabId === 'myplan' || tabId === 'montecarlo') && <MyPlan openRange={tabId === 'montecarlo'} />}
        {(tabId === 'optimize' || tabId === 'scenarios') && <Improve />}
        {tabId === 'advisor' && <AIAdvisor />}
        {tabId === 'tools' && <Tools onOpen={setTab} />}
        {tabId === 'accounts' && <LinkedAccounts />}
        {tabId === 'equity' && <EquityComp />}
        {tabId === 'college' && <CollegePlanner />}
        {tabId === 'portfolio' && <PortfolioBuilder />}
        {tabId === 'roth-strategy' && <RothStrategy key={tab} initialView={tabView} />}
        {tabId === 'income' && <RetirementIncome key={tab} initialView={tabView} />}
        {tabId === 'inheritance' && <Inheritance />}
        {tabId === 'guide' && <GettingStarted />}
      </main>

      {/* Phone-only bottom tab bar — replaces the header tabs under 720px. */}
      <nav className="bottom-nav" aria-label="Main">
        {categories.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setTab(c.tabs[0])}
            className="bottom-nav-link"
            aria-current={c.id === activeCategory?.id ? 'page' : undefined}
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
          <a href="/accuracy" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>How we check it</a>
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
          Built independently. Not a financial advisor. Free, open source, MIT licensed. Tax and benefit figures: {FIGURES.year} from the IRS, SSA and CMS, grown with inflation for later years · checked {FIGURES.checked}.
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
