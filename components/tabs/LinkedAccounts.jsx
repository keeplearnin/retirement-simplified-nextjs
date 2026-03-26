'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import InfoBox from '@/components/ui/InfoBox';
import { fmt } from '@/lib/format';
import { DEMO_INSTITUTIONS, CATEGORY_META, LS_KEY } from './accounts/accountsData';
import PlaidLink from './accounts/PlaidLink';
import AccountList from './accounts/AccountList';
import ManualAccountForm from './accounts/ManualAccountForm';
import NetWorthSummary from './accounts/NetWorthSummary';

export default function LinkedAccounts() {
  const [linked, setLinked] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [connecting, setConnecting] = useState(null);
  const [refreshing, setRefreshing] = useState(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setLinked(JSON.parse(stored));
    } catch {}
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (linked.length > 0) {
      localStorage.setItem(LS_KEY, JSON.stringify(linked));
    } else {
      localStorage.removeItem(LS_KEY);
    }
  }, [linked]);

  const connectInstitution = useCallback((key) => {
    setConnecting(key);
    setTimeout(() => {
      const inst = DEMO_INSTITUTIONS[key];
      if (!inst) { setConnecting(null); return; }
      setLinked(prev => {
        if (prev.find(i => i.id === inst.id)) return prev;
        return [...prev, { ...inst, linkedAt: Date.now(), lastSynced: Date.now() }];
      });
      setConnecting(null);
      setModalOpen(false);
    }, 1500);
  }, []);

  const disconnectInstitution = useCallback((instId) => {
    setLinked(prev => prev.filter(i => i.id !== instId));
  }, []);

  const refreshInstitution = useCallback((instId) => {
    setRefreshing(instId);
    setTimeout(() => {
      setLinked(prev => prev.map(i => i.id === instId ? { ...i, lastSynced: Date.now() } : i));
      setRefreshing(null);
    }, 1200);
  }, []);

  // ---------------------------------------------------------------------------
  // Aggregated metrics
  // ---------------------------------------------------------------------------
  const allAccounts = useMemo(() => linked.flatMap(i => i.accounts.map(a => ({ ...a, institution: i.name, instColor: i.color }))), [linked]);
  const totalNetWorth = useMemo(() => allAccounts.reduce((s, a) => s + a.balance, 0), [allAccounts]);

  const categoryBreakdown = useMemo(() => {
    const result = {};
    Object.keys(CATEGORY_META).forEach(k => { result[k] = 0; });
    allAccounts.forEach(a => { result[a.category] = (result[a.category] || 0) + a.balance; });
    return result;
  }, [allAccounts]);

  const categorySegs = useMemo(() => {
    if (totalNetWorth <= 0) return [];
    let cum = 0;
    return Object.entries(categoryBreakdown)
      .filter(([, val]) => val > 0)
      .map(([cat, val]) => {
        const pct = (val / totalNetWorth) * 100;
        const start = cum;
        cum += pct;
        return { id: cat, label: CATEGORY_META[cat]?.label || cat, color: CATEGORY_META[cat]?.color || 'var(--text-dim)', pct, start, end: cum, value: val };
      });
  }, [categoryBreakdown, totalNetWorth]);

  const aggregatedAllocation = useMemo(() => {
    let totalInvested = 0;
    let wStocks = 0, wBonds = 0, wCash = 0;
    allAccounts.forEach(a => {
      if (a.type !== 'investment') return;
      totalInvested += a.balance;
      wStocks += a.allocation.stocks * a.balance;
      wBonds += a.allocation.bonds * a.balance;
      wCash += a.allocation.cash * a.balance;
    });
    if (totalInvested === 0) return { stocks: 0, bonds: 0, cash: 0 };
    return {
      stocks: Math.round(wStocks / totalInvested),
      bonds: Math.round(wBonds / totalInvested),
      cash: Math.round(wCash / totalInvested),
    };
  }, [allAccounts]);

  const allocationSegs = useMemo(() => {
    const { stocks, bonds, cash } = aggregatedAllocation;
    const total = stocks + bonds + cash;
    if (total === 0) return [];
    let cum = 0;
    const entries = [
      { id: 'stocks', label: 'Stocks', color: 'var(--accent)', pct: stocks },
      { id: 'bonds', label: 'Bonds', color: 'var(--blue)', pct: bonds },
      { id: 'cash', label: 'Cash', color: 'var(--purple)', pct: cash },
    ].filter(e => e.pct > 0);
    return entries.map(e => {
      const start = cum;
      cum += e.pct;
      return { ...e, start, end: cum };
    });
  }, [aggregatedAllocation]);

  const monthChange = useMemo(() => {
    if (totalNetWorth === 0) return { amount: 0, pct: 0 };
    const amount = Math.round(totalNetWorth * 0.023);
    return { amount, pct: 2.3 };
  }, [totalNetWorth]);

  const retirementTotal = categoryBreakdown.retirement || 0;
  const taxableTotal = categoryBreakdown.taxable || 0;
  const cashTotal = categoryBreakdown.cash || 0;
  const debtTotal = Math.abs(categoryBreakdown.debt || 0);

  // ---------------------------------------------------------------------------
  // Shared inline styles
  // ---------------------------------------------------------------------------
  const btnPrimary = {
    padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
    background: 'var(--accent)', color: 'var(--bg)', fontWeight: 700, fontSize: 13,
    fontFamily: 'var(--sans)', transition: 'opacity .15s',
  };
  const btnSecondary = {
    padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer',
    background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11,
    fontFamily: 'var(--sans)', transition: 'all .15s',
  };
  const btnDanger = {
    ...btnSecondary, color: 'var(--danger)', borderColor: 'var(--danger-dim)',
  };

  // ---------------------------------------------------------------------------
  // Render — Empty state
  // ---------------------------------------------------------------------------
  if (linked.length === 0) {
    return (
      <>
        <ManualAccountForm onOpenModal={() => setModalOpen(true)} btnPrimary={btnPrimary} />
        <PlaidLink
          modalOpen={modalOpen}
          connecting={connecting}
          linked={linked}
          onClose={() => setModalOpen(false)}
          onConnect={connectInstitution}
        />
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — Dashboard + connected accounts
  // ---------------------------------------------------------------------------
  return (
    <div className="fade-up">
      <InfoBox icon="🔗" title="Linked Accounts" color="var(--accent)">
        Your connected financial institutions are synced automatically. View your aggregated net worth and asset allocation across all accounts.
      </InfoBox>

      <NetWorthSummary
        totalNetWorth={totalNetWorth}
        monthChange={monthChange}
        retirementTotal={retirementTotal}
        taxableTotal={taxableTotal}
        cashTotal={cashTotal}
        debtTotal={debtTotal}
        linked={linked}
        categorySegs={categorySegs}
        allocationSegs={allocationSegs}
      />

      <AccountList
        linked={linked}
        refreshing={refreshing}
        onRefresh={refreshInstitution}
        onDisconnect={disconnectInstitution}
        btnSecondary={btnSecondary}
        btnDanger={btnDanger}
      />

      {/* Connect another */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <button onClick={() => setModalOpen(true)} style={btnPrimary}>
          + Connect Another Account
        </button>
      </div>

      <PlaidLink
        modalOpen={modalOpen}
        connecting={connecting}
        linked={linked}
        onClose={() => setModalOpen(false)}
        onConnect={connectInstitution}
      />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
