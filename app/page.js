'use client';

import { useState, useEffect } from 'react';
import AuthProvider, { useAuth } from '@/components/AuthProvider';
import Auth, { isConfigured } from '@/lib/auth';

import AccountDashboard from '@/components/tabs/AccountDashboard';
import GrowthProjector from '@/components/tabs/GrowthProjector';
import FeeImpact from '@/components/tabs/FeeImpact';
import PortfolioBuilder from '@/components/tabs/PortfolioBuilder';
import Rebalance from '@/components/tabs/Rebalance';
import TaxLossHarvesting from '@/components/tabs/TaxLossHarvesting';
import WithdrawalStrategy from '@/components/tabs/WithdrawalStrategy';
import MonteCarlo from '@/components/tabs/MonteCarlo';
import TaxAware from '@/components/tabs/TaxAware';
import ScenarioComparison from '@/components/tabs/ScenarioComparison';
import SocialSecurity from '@/components/tabs/SocialSecurity';
import GettingStarted from '@/components/tabs/GettingStarted';
import InvestingGuide from '@/components/tabs/InvestingGuide';
import AIAdvisor from '@/components/tabs/AIAdvisor';
import MyPlan from '@/components/tabs/MyPlan';
import MyPlans from '@/components/tabs/MyPlans';
import Journal from '@/components/tabs/Journal';
import RiskQuiz from '@/components/tabs/RiskQuiz';
import GoalPlanner from '@/components/tabs/GoalPlanner';
import LinkedAccounts from '@/components/tabs/LinkedAccounts';

function AppContent() {
  const [tab, setTab] = useState('myplan');
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState('dark');
  const { user, isConfigured: configured, authLoading, signIn, signOut } = useAuth();

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);
    const handler = (e) => setTab(e.detail);
    window.addEventListener('navigate-tab', handler);
    // Restore saved theme
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
    return () => window.removeEventListener('navigate-tab', handler);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  const categories = [
    { id: 'plan', label: 'My Plan', icon: '📊', tabs: [
      { id: 'myplan', label: 'My Plan' },
    ]},
    { id: 'build', label: 'Build', icon: '🎯', tabs: [
      { id: 'portfolio', label: 'Portfolio Builder' },
      { id: 'growth', label: 'Growth Projector' },
      { id: 'goals', label: 'Goal Planner' },
    ]},
    { id: 'optimize', label: 'Optimize', icon: '⚡', tabs: [
      { id: 'tax', label: 'Tax Strategy' },
      { id: 'withdrawal', label: 'Withdrawal' },
      { id: 'montecarlo', label: 'Monte Carlo' },
    ]},
    { id: 'learn', label: 'Learn', icon: '💡', tabs: [
      { id: 'guide', label: 'Getting Started' },
      { id: 'advisor', label: 'AI Advisor' },
    ]},
  ];

  const activeCategory = categories.find(c => c.tabs.some(t => t.id === tab)) || categories[0];
  const subTabs = activeCategory.tabs;

  return (
    <div style={{ opacity: loaded ? 1 : 0, transition: 'opacity .5s ease', position: 'relative', zIndex: 1 }}>
      {/* Compact header — logo + nav + actions in one row */}
      <header className="app-header">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }} onClick={() => setTab('myplan')}>
          <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--sans)', color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Retire<span style={{ color: 'var(--accent)' }}>.</span>Simplified
          </span>
          <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, opacity: 0.7 }}>Free</span>
        </div>

        {/* Nav pills */}
        <nav style={{ display: 'flex', gap: 2, background: 'var(--bg2)', borderRadius: 28, padding: 3 }}>
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

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
        {tab === 'myplan' && <MyPlan />}
        {tab === 'dashboard' && <AccountDashboard />}
        {tab === 'growth' && <GrowthProjector />}
        {tab === 'fees' && <FeeImpact />}
        {tab === 'portfolio' && <PortfolioBuilder />}
        {tab === 'rebalance' && <Rebalance />}
        {tab === 'taxloss' && <TaxLossHarvesting />}
        {tab === 'withdrawal' && <WithdrawalStrategy />}
        {tab === 'montecarlo' && <MonteCarlo />}
        {tab === 'tax' && <TaxAware />}
        {tab === 'scenarios' && <ScenarioComparison />}
        {tab === 'ssa' && <SocialSecurity />}
        {tab === 'investing' && <InvestingGuide />}
        {tab === 'advisor' && <AIAdvisor />}
        {tab === 'myplans' && <MyPlans />}
        {tab === 'journal' && <Journal />}
        {tab === 'guide' && <GettingStarted />}
        {tab === 'riskquiz' && <RiskQuiz />}
        {tab === 'goals' && <GoalPlanner />}
        {tab === 'linked' && <LinkedAccounts />}
      </main>

      <footer style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', padding: '28px 24px 40px', borderTop: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.8, maxWidth: 580, margin: '0 auto' }}>
          ⚖️ <strong>Disclaimer:</strong> This tool is for educational purposes only and does not constitute financial advice. Past performance does not guarantee future results. All projections are hypothetical. Consult a qualified financial professional for advice specific to your situation.
        </p>
        <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 12, opacity: 0.5 }}>Built with care. Share freely. MIT License.</p>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
