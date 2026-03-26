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
import MyPlans from '@/components/tabs/MyPlans';
import Journal from '@/components/tabs/Journal';

function AppContent() {
  const [tab, setTab] = useState('growth');
  const [loaded, setLoaded] = useState(false);
  const { user, isConfigured: configured, authLoading, signIn, signOut } = useAuth();

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'growth', label: 'Growth', icon: '📈' },
    { id: 'fees', label: 'Fees', icon: '⚠️' },
    { id: 'portfolio', label: 'Portfolio', icon: '🎯' },
    { id: 'rebalance', label: 'Rebalance', icon: '⚖️' },
    { id: 'taxloss', label: 'Tax Harvesting', icon: '🌾' },
    { id: 'withdrawal', label: 'Withdrawal', icon: '🏦' },
    { id: 'montecarlo', label: 'Monte Carlo', icon: '🎲' },
    { id: 'tax', label: 'Roth vs Trad', icon: '⚖️' },
    { id: 'scenarios', label: 'Scenarios', icon: '🔀' },
    { id: 'ssa', label: 'Social Security', icon: '🏛️' },
    { id: 'investing', label: 'Investing 101', icon: '💡' },
    { id: 'advisor', label: 'AI Advisor', icon: '🤖' },
    ...(user ? [
      { id: 'myplans', label: 'My Plans', icon: '📂' },
      { id: 'journal', label: 'Journal', icon: '📓' },
    ] : []),
    { id: 'guide', label: 'Get Started', icon: '📚' },
  ];

  return (
    <div style={{ opacity: loaded ? 1 : 0, transition: 'opacity .6s ease', position: 'relative', zIndex: 1 }}>
      <header style={{ textAlign: 'center', padding: '40px 24px 16px', background: 'linear-gradient(180deg,rgba(52,211,153,.06) 0%,transparent 100%)', position: 'relative' }}>
        {/* Auth button */}
        <div style={{ position: 'absolute', top: 16, right: 24 }}>
          {authLoading ? null : user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {user.picture && <img src={user.picture} alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--accent)' }} referrerPolicy="no-referrer" />}
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user.name?.split(' ')[0]}</span>
              <button onClick={signOut} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)', fontSize: 11, fontWeight: 600 }}>Sign Out</button>
            </div>
          ) : configured ? (
            <button onClick={signIn} style={{ padding: '8px 18px', borderRadius: 20, border: '1px solid var(--accent)', cursor: 'pointer', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>🔑 Sign in</button>
          ) : null}
        </div>

        <div className="fade-up" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 6, color: 'var(--accent)', fontWeight: 700, marginBottom: 10 }}>Free · No Advisor Needed · Open to All</div>
        <h1 className="fade-up-1 hero-title" style={{ fontFamily: 'var(--serif)', fontSize: 48, fontWeight: 400, margin: 0, lineHeight: 1.05 }}>
          Retirement<span style={{ color: 'var(--accent)' }}>.</span>Simplified
        </h1>
        <p className="fade-up-2" style={{ color: 'var(--text-muted)', fontSize: 15, maxWidth: 560, margin: '12px auto 0', lineHeight: 1.6, fontWeight: 300 }}>
          Everything a financial advisor charges 1% for — <strong style={{ color: 'var(--text)', fontWeight: 600 }}>free and transparent</strong>.
          {user && <span style={{ color: 'var(--accent)' }}> Your data is saved.</span>}
        </p>
      </header>

      <nav className="fade-up-3 tab-bar" style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '12px 16px 28px', position: 'sticky', top: 0, zIndex: 10, background: 'linear-gradient(180deg,var(--bg) 60%,transparent)', backdropFilter: 'blur(12px)', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px', border: 'none', cursor: 'pointer', borderRadius: 32,
              background: tab === t.id ? 'var(--accent)' : 'var(--card)',
              color: tab === t.id ? 'var(--bg)' : 'var(--text-muted)',
              fontWeight: tab === t.id ? 700 : 500, fontSize: 12,
              transition: 'all .25s', display: 'flex', alignItems: 'center', gap: 6,
              border: tab === t.id ? 'none' : '1px solid var(--border)',
              boxShadow: tab === t.id ? '0 4px 20px var(--accent-glow)' : 'none',
              fontFamily: 'var(--sans)',
            }}
          >
            <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      <main className="section-pad" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 40px' }} key={tab}>
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
