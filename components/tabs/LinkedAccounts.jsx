'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import InfoBox from '@/components/ui/InfoBox';
import { fmt } from '@/lib/format';
import { DEMO_INSTITUTIONS, CATEGORY_META, LS_KEY } from './accounts/accountsData';
import PlaidLink from './accounts/PlaidLink';
import AccountList from './accounts/AccountList';
import ManualAccountForm from './accounts/ManualAccountForm';
import NetWorthSummary from './accounts/NetWorthSummary';
import { usePlan } from '@/components/PlanProvider';
import { startLink, fetchLinkedAccounts, unlinkInstitution } from '@/lib/plaidClient';
import { classifyAccount, aggregateAccounts, mergeIntoPlan } from '@/lib/plaidMapping';

// Bucket → display category for real (Plaid) accounts.
const BUCKET_CATEGORY = {
  savings401k: 'retirement', savingsRoth: 'retirement', savingsHSA: 'retirement', savings529: 'retirement',
  savingsTaxable: 'taxable', savingsCrypto: 'taxable', savingsCash: 'cash',
};
const INST_COLORS = ['#2F7D57', '#3D6B99', '#A8741A', '#6D5DA8', '#BD4A36'];

// Group normalized Plaid accounts into the display shape LinkedAccounts renders.
function toDisplayInstitutions(accounts, institutions) {
  const byInst = new Map();
  accounts.forEach((a, i) => {
    const instName = a.institution || 'Linked';
    if (!byInst.has(instName)) {
      byInst.set(instName, {
        id: `plaid_${instName.replace(/\s+/g, '_').toLowerCase()}`,
        name: instName, color: INST_COLORS[byInst.size % INST_COLORS.length],
        real: true, accounts: [], linkedAt: Date.now(), lastSynced: Date.now(),
      });
    }
    const c = classifyAccount(a);
    const category = c.kind === 'debt' ? 'debt' : (BUCKET_CATEGORY[c.bucket] || 'taxable');
    byInst.get(instName).accounts.push({
      id: a.id || `acct_${i}`, name: a.name, type: a.type, subtype: a.subtype,
      category, balance: c.kind === 'debt' ? -c.balance : (a.balance || 0),
      allocation: { stocks: 0, bonds: 0, cash: category === 'cash' ? 100 : 0 },
    });
  });
  // Carry item ids for unlink.
  for (const inst of institutions || []) {
    const match = [...byInst.values()].find(v => v.name === inst.name);
    if (match) match.itemId = inst.itemId;
  }
  return [...byInst.values()];
}

export default function LinkedAccounts() {
  const { plan, bulkUpdate } = usePlan();
  const [linked, setLinked] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [connecting, setConnecting] = useState(null);
  const [refreshing, setRefreshing] = useState(null);
  const [plaidBusy, setPlaidBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setLinked(JSON.parse(stored));
    } catch {}
  }, []);

  // Persist demo/manual institutions only. Live (Plaid) accounts are fetched
  // fresh each mount from the server — never cached in the browser.
  useEffect(() => {
    const persistable = linked.filter(i => !i.real);
    if (persistable.length > 0) {
      localStorage.setItem(LS_KEY, JSON.stringify(persistable));
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
    setLinked(prev => {
      const target = prev.find(i => i.id === instId);
      // Real (Plaid) institutions also get revoked server-side.
      if (target?.real && target.itemId) { unlinkInstitution(target.itemId).catch(() => {}); }
      return prev.filter(i => i.id !== instId);
    });
  }, []);

  const refreshInstitution = useCallback((instId) => {
    setRefreshing(instId);
    setTimeout(() => {
      setLinked(prev => prev.map(i => i.id === instId ? { ...i, lastSynced: Date.now() } : i));
      setRefreshing(null);
    }, 1200);
  }, []);

  // ── Real Plaid path ──────────────────────────────────────────────────
  // On mount, pull any already-linked live accounts. If Plaid isn't
  // configured server-side this returns demo:true and we do nothing (the
  // demo picker remains the connect path).
  const loadRealAccounts = useCallback(async () => {
    try {
      const { demo, accounts, institutions } = await fetchLinkedAccounts();
      if (demo || !accounts?.length) return;
      const real = toDisplayInstitutions(accounts, institutions);
      // Merge live institutions in, replacing any prior live set; keep demo ones.
      setLinked(prev => [...prev.filter(i => !i.real), ...real]);
    } catch { /* offline / not signed in — silent */ }
  }, []);

  useEffect(() => { loadRealAccounts(); }, [loadRealAccounts]);

  // "Connect" entry point: try the real Link flow; fall back to the demo
  // institution picker when Plaid isn't configured.
  const handleConnect = useCallback(async () => {
    setPlaidBusy(true);
    setSyncMsg(null);
    try {
      const result = await startLink();
      // Not configured server-side → demo picker.
      if (result.demo) { setModalOpen(true); return; }
      if (result.linked) {
        await loadRealAccounts();
        setSyncMsg(`Connected ${result.institutionName}. Click "Sync to My Plan" to pull balances in.`);
      }
      // result.cancelled → user closed Link; do nothing.
    } catch {
      // Any failure to start the real flow (Plaid unconfigured, auth/network
      // error) falls back to the demo picker so the tab is always usable.
      setModalOpen(true);
    } finally {
      setPlaidBusy(false);
    }
  }, [loadRealAccounts]);

  // Map the currently-shown balances into the plan's savings buckets so they
  // drive the projection. Works uniformly for demo, manual, and live (Plaid)
  // institutions — it aggregates the accounts already on screen by tax
  // treatment. Replaces the matching manual bucket values (aggregation is the
  // source of truth once connected).
  const syncToPlan = useCallback(() => {
    setPlaidBusy(true);
    try {
      const accounts = linked.flatMap(i => i.accounts.map(a => ({
        name: a.name, type: a.type, subtype: a.subtype, balance: a.balance,
      })));
      if (!accounts.length) { setSyncMsg('No accounts to sync yet.'); return; }
      const aggregated = aggregateAccounts(accounts);
      const patch = mergeIntoPlan(plan, aggregated, 'replace');
      bulkUpdate(patch);
      const total = Object.values(aggregated.buckets).reduce((s, v) => s + v, 0);
      setSyncMsg(`Synced ${fmt(total)} across ${accounts.length} accounts into My Plan.`);
    } catch (e) {
      setSyncMsg(e?.message || 'Sync failed. Please try again.');
    } finally {
      setPlaidBusy(false);
    }
  }, [linked, plan, bulkUpdate]);

  const disconnectReal = useCallback(async (inst) => {
    if (inst.itemId) { try { await unlinkInstitution(inst.itemId); } catch {} }
    setLinked(prev => prev.filter(i => i.id !== inst.id));
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
        <ManualAccountForm onOpenModal={handleConnect} btnPrimary={btnPrimary} />
        {syncMsg && (
          <div style={{ textAlign: 'center', margin: '12px 0', fontSize: 12, color: 'var(--text-muted)' }}>{syncMsg}</div>
        )}
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

      {/* Sync + connect actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <button onClick={syncToPlan} disabled={plaidBusy} style={{ ...btnPrimary, opacity: plaidBusy ? 0.6 : 1 }}>
          {plaidBusy ? 'Working…' : 'Sync to My Plan →'}
        </button>
        <button onClick={handleConnect} disabled={plaidBusy} style={{ ...btnSecondary, padding: '10px 18px', fontSize: 13 }}>
          + Connect Another Account
        </button>
      </div>
      {syncMsg && (
        <div style={{ textAlign: 'center', marginBottom: 20, fontSize: 12, color: 'var(--accent)' }}>{syncMsg}</div>
      )}
      <div style={{ textAlign: 'center', marginBottom: 20, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Linked balances map into your plan by tax treatment (401k/IRA → tax-deferred, Roth → tax-free,
        brokerage → taxable, checking/savings → cash). Sync replaces the matching manual entries in My Plan.
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
