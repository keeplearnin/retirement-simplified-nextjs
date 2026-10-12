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
    // The root layout applies the saved theme before paint; mirror it here.
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
    const next = theme === 'light' ? 'dark' : 'light';
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
      { id: 'myplan', label: 'My plan' },
      { id: 'optimize', label: 'Optimize' },
      { id: 'scenarios', label: 'Scenarios' },
      { id: 'accounts', label: 'Accounts' },
      { id: 'equity', label: 'Equity comp' },
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
      { id: 'advisor', label: 'AI advisor' },
      { id: 'roth-strategy', label: 'Roth strategy' },
      { id: 'income', label: 'Retirement income' },
      { id: 'inheritance', label: 'Inheritance' },
      { id: 'montecarlo', label: 'Monte Carlo' },
    ]},
    { id: 'learn', label: 'Learn', icon: 'book', tabs: [
      { id: 'guide', label: 'Getting started' },
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
      {/* Masthead — brand, three sections, actions, then the double rule */}
      <header className="app-header">
        <div className="masthead">
          <button type="button" className="brand" onClick={() => setTab('myplan')} aria-label="Retirement.Simplified — go to My plan">
            <span className="brand-name">Retire<span className="dot">.</span>Simplified</span>
          </button>

          <div className="nav-scroll-wrapper">
            <nav className="nav-scroll" aria-label="Sections">
              {categories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTab(c.tabs[0].id)}
                  className="nav-tab"
                  aria-current={c.id === activeCategory.id ? 'page' : undefined}
                >
                  <span className="nav-icon"><Icon name={c.icon} size={15} /></span>
                  {c.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="masthead-actions">
            <a href="/verdict" className="mast-btn" title="See where you stand in 90 seconds">
              <span className="quick-verdict-text"><Icon name="bolt" size={13} />Quick verdict</span>
              <span className="quick-verdict-icon-only" aria-label="Quick verdict"><Icon name="bolt" size={14} /></span>
            </a>
            {authLoading ? null : user ? (
              <>
                {user.picture && <img src={user.picture} alt="" className="mast-avatar" referrerPolicy="no-referrer" />}
                <button type="button" onClick={signOut} className="mast-btn">Sign out</button>
              </>
            ) : configured ? (
              <button type="button" onClick={signIn} className="mast-btn solid">Sign in</button>
            ) : null}
            <button
              type="button"
              onClick={toggleTheme}
              className="mast-btn icon"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Section tabs (hidden for single-tab categories) */}
      {subTabs.length > 1 && (
        <nav className="subnav" aria-label={`${activeCategory.label} pages`}>
          <div className="subnav-inner">
            {subTabs.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="subnav-tab"
                aria-current={tab === t.id ? 'page' : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="section-pad" style={{ maxWidth: 1148, margin: '0 auto', padding: '20px 24px 48px' }}>
        {/* "Finish setup" banner — shown when the user skipped onboarding
            without entering plan data. Persists across reloads (via the
            'retirement-onboarding-skipped' localStorage flag) until they
            either complete onboarding (replay) or enter plan data. */}
        {onboardingSkipped && tab === 'myplan' && (
          <div className="setup-banner" role="status">
            <span>
              <strong>Your plan is missing your numbers.</strong> Setup takes about 3 minutes.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  localStorage.removeItem('retirement-onboarding-skipped');
                  window.dispatchEvent(new Event('replay-onboarding'));
                }}
              >
                Finish setup
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  localStorage.setItem('retirement-onboarding-skipped', '0');
                  setOnboardingSkipped(false);
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

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div>
            <div className="brand-name" style={{ color: 'var(--heading)', fontSize: 15 }}>Retire<span className="dot">.</span>Simplified</div>
            <p className="footer-note">
              Free and open source (MIT). Built independently — not a financial advisor. Tax and benefits figures are refreshed each year from the IRS, SSA and CMS.
            </p>
          </div>
          <nav aria-label="About the numbers" className="footer-col">
            <a href="/methodology">How the math works</a>
            <a href="/report">Download a PDF report</a>
            <a href="https://github.com/keeplearnin/retirement-simplified-nextjs" target="_blank" rel="noopener noreferrer">Source on GitHub</a>
          </nav>
          <nav aria-label="Free calculators" className="footer-col">
            <a href="/verdict">Quick verdict</a>
            <a href="/calculators/irmaa-cliff-checker">IRMAA cliff checker</a>
            <a href="/calculators/tax-torpedo">Tax torpedo</a>
            <a href="/calculators/social-security-break-even">Social Security break-even</a>
          </nav>
        </div>
        <p className="footer-disclaimer">
          <strong>For education only.</strong> This tool does not give financial advice. Projections are hypothetical and past performance does not guarantee future results. For advice on your situation, talk to a qualified financial professional.
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
