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
    { id: 'overview', label: 'Overview', icon: '📊', tabs: [
      { id: 'myplan', label: 'My Plan' },
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'growth', label: 'Growth Projector' },
      { id: 'goals', label: 'Goal Planner' },
      { id: 'scenarios', label: 'Scenarios' },
    ]},
    { id: 'invest', label: 'Invest', icon: '🎯', tabs: [
      { id: 'portfolio', label: 'Portfolio Builder' },
      { id: 'rebalance', label: 'Rebalance' },
      { id: 'fees', label: 'Fee Analyzer' },
    ]},
    { id: 'taxes', label: 'Taxes', icon: '🏦', tabs: [
      { id: 'tax', label: 'Roth vs Traditional' },
      { id: 'taxloss', label: 'Tax-Loss Harvesting' },
      { id: 'withdrawal', label: 'Withdrawal Strategy' },
    ]},
    { id: 'analyze', label: 'Analyze', icon: '🔬', tabs: [
      { id: 'montecarlo', label: 'Monte Carlo' },
      { id: 'ssa', label: 'Social Security' },
    ]},
    { id: 'learn', label: 'Learn', icon: '💡', tabs: [
      { id: 'riskquiz', label: 'Risk Profile' },
      { id: 'investing', label: 'Investing 101' },
      { id: 'guide', label: 'Getting Started' },
      { id: 'advisor', label: 'AI Advisor' },
    ]},
    { id: 'me', label: 'My Data', icon: '👤', tabs: [
      { id: 'linked', label: 'Linked Accounts' },
      { id: 'myplans', label: 'My Plans' },
      { id: 'journal', label: 'Journal' },
    ]},
  ];

  const activeCategory = categories.find(c => c.tabs.some(t => t.id === tab)) || categories[0];
  const subTabs = activeCategory.tabs;

  return (
    <div style={{ opacity: loaded ? 1 : 0, transition: 'opacity .6s ease', position: 'relative', zIndex: 1 }}>
      <header style={{ textAlign: 'center', padding: '40px 24px 16px', background: 'linear-gradient(180deg,rgba(52,211,153,.06) 0%,transparent 100%)', position: 'relative' }}>
        {/* Theme toggle + Auth */}
        <div style={{ position: 'absolute', top: 16, right: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          {authLoading ? null : user ? (
            <>
              {user.picture && <img src={user.picture} alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--accent)' }} referrerPolicy="no-referrer" />}
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user.name?.split(' ')[0]}</span>
              <button onClick={signOut} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)', fontSize: 11, fontWeight: 600 }}>Sign Out</button>
            </>
          ) : configured ? (
            <button onClick={signIn} style={{ padding: '8px 18px', borderRadius: 20, border: '1px solid var(--accent)', cursor: 'pointer', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>🔑 Sign in</button>
          ) : null}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)',
              background: 'var(--bg2)', cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .25s',
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="fade-up" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 6, color: 'var(--accent)', fontWeight: 700, marginBottom: 10 }}>Free · No Advisor Needed · Open to All</div>
        <h1 className="fade-up-1 hero-title" style={{ fontFamily: 'var(--serif)', fontSize: 48, fontWeight: 400, margin: 0, lineHeight: 1.05 }}>
          Retirement<span style={{ color: 'var(--accent)' }}>.</span>Simplified
        </h1>
        <p className="fade-up-2" style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 560, margin: '10px auto 0', lineHeight: 1.6, fontWeight: 300 }}>
          From first paycheck to last withdrawal
        </p>
        <p className="fade-up-2" style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 560, margin: '6px auto 0', lineHeight: 1.6, fontWeight: 300 }}>
          Everything a financial advisor charges 1% for — <strong style={{ color: 'var(--text)', fontWeight: 600 }}>free and transparent</strong>.
          {user && <span style={{ color: 'var(--accent)' }}> Your data is saved.</span>}
        </p>
      </header>

      <nav className="fade-up-3" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'linear-gradient(180deg,var(--bg) 80%,transparent)', backdropFilter: 'blur(12px)', padding: '12px 16px 0' }}>
        {/* Category row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {categories.map(c => {
            const isActive = c.id === activeCategory.id;
            return (
              <button
                key={c.id}
                onClick={() => setTab(c.tabs[0].id)}
                style={{
                  padding: '10px 18px', border: 'none', cursor: 'pointer', borderRadius: 32,
                  background: isActive ? 'var(--accent)' : 'var(--card)',
                  color: isActive ? 'var(--bg)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 500, fontSize: 13,
                  transition: 'all .25s', display: 'flex', alignItems: 'center', gap: 6,
                  border: isActive ? 'none' : '1px solid var(--border)',
                  boxShadow: isActive ? '0 4px 20px var(--accent-glow)' : 'none',
                  fontFamily: 'var(--sans)',
                }}
              >
                <span style={{ fontSize: 15 }}>{c.icon}</span>{c.label}
              </button>
            );
          })}
        </div>
        {/* Sub-tab row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, paddingBottom: 20, flexWrap: 'wrap' }}>
          {subTabs.map(t => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '7px 14px', border: 'none', cursor: 'pointer', borderRadius: 20,
                  background: isActive ? 'var(--accent-dim)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                  fontWeight: isActive ? 700 : 500, fontSize: 12,
                  transition: 'all .2s', fontFamily: 'var(--sans)',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

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
