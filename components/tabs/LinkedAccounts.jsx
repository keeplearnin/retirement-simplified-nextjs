'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import Donut from '@/components/ui/Donut';
import { fmt, fmtFull } from '@/lib/format';

// PLAID INTEGRATION: import { usePlaidLink } from '@plaid/plaid-link';

// ---------------------------------------------------------------------------
// Demo institution data — realistic account structures
// ---------------------------------------------------------------------------
const DEMO_INSTITUTIONS = {
  vanguard: {
    id: 'inst_vanguard',
    name: 'Vanguard',
    color: '#c41200',
    accounts: [
      { id: 'vg_roth', name: 'Roth IRA', type: 'investment', subtype: 'roth_ira', category: 'retirement', balance: 45200, allocation: { stocks: 90, bonds: 8, cash: 2 } },
      { id: 'vg_401k', name: '401(k)', type: 'investment', subtype: '401k', category: 'retirement', balance: 128500, allocation: { stocks: 70, bonds: 25, cash: 5 } },
      { id: 'vg_brok', name: 'Individual Brokerage', type: 'investment', subtype: 'brokerage', category: 'taxable', balance: 32100, allocation: { stocks: 80, bonds: 10, cash: 10 } },
    ],
  },
  fidelity: {
    id: 'inst_fidelity',
    name: 'Fidelity',
    color: '#4a8c2a',
    accounts: [
      { id: 'fid_401k', name: '401(k) Growth Fund', type: 'investment', subtype: '401k', category: 'retirement', balance: 87300, allocation: { stocks: 85, bonds: 12, cash: 3 } },
    ],
  },
  schwab: {
    id: 'inst_schwab',
    name: 'Schwab',
    color: '#00a3e0',
    accounts: [
      { id: 'sch_brok', name: 'Brokerage Account', type: 'investment', subtype: 'brokerage', category: 'taxable', balance: 18700, allocation: { stocks: 75, bonds: 15, cash: 10 } },
      { id: 'sch_ira', name: 'Traditional IRA', type: 'investment', subtype: 'ira', category: 'retirement', balance: 56400, allocation: { stocks: 65, bonds: 30, cash: 5 } },
    ],
  },
  chase: {
    id: 'inst_chase',
    name: 'Chase',
    color: '#117aca',
    accounts: [
      { id: 'ch_chk', name: 'Total Checking', type: 'depository', subtype: 'checking', category: 'cash', balance: 8450, allocation: { stocks: 0, bonds: 0, cash: 100 } },
      { id: 'ch_sav', name: 'Savings Account', type: 'depository', subtype: 'savings', category: 'cash', balance: 25000, allocation: { stocks: 0, bonds: 0, cash: 100 } },
      { id: 'ch_cc', name: 'Sapphire Preferred', type: 'credit', subtype: 'credit_card', category: 'debt', balance: -2100, allocation: { stocks: 0, bonds: 0, cash: 0 } },
    ],
  },
  bofa: {
    id: 'inst_bofa',
    name: 'Bank of America',
    color: '#e31837',
    accounts: [
      { id: 'bofa_chk', name: 'Advantage Checking', type: 'depository', subtype: 'checking', category: 'cash', balance: 4200, allocation: { stocks: 0, bonds: 0, cash: 100 } },
      { id: 'bofa_sav', name: 'Savings Account', type: 'depository', subtype: 'savings', category: 'cash', balance: 12000, allocation: { stocks: 0, bonds: 0, cash: 100 } },
    ],
  },
};

const INSTITUTION_LIST = [
  { key: 'vanguard', name: 'Vanguard', color: '#c41200' },
  { key: 'fidelity', name: 'Fidelity', color: '#4a8c2a' },
  { key: 'schwab', name: 'Schwab', color: '#00a3e0' },
  { key: 'chase', name: 'Chase', color: '#117aca' },
  { key: 'bofa', name: 'Bank of America', color: '#e31837' },
];

const TYPE_BADGE_COLORS = {
  '401k': 'var(--accent)',
  roth_ira: 'var(--purple)',
  ira: 'var(--purple)',
  brokerage: 'var(--blue)',
  checking: 'var(--text-muted)',
  savings: 'var(--text-muted)',
  credit_card: 'var(--danger)',
};

const TYPE_LABELS = {
  '401k': '401(k)',
  roth_ira: 'Roth IRA',
  ira: 'Traditional IRA',
  brokerage: 'Brokerage',
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
};

const CATEGORY_META = {
  retirement: { label: 'Retirement', color: 'var(--accent)', icon: '🏦' },
  taxable: { label: 'Taxable Investment', color: 'var(--blue)', icon: '📈' },
  cash: { label: 'Cash / Savings', color: 'var(--purple)', icon: '💵' },
  debt: { label: 'Debt', color: 'var(--danger)', icon: '💳' },
};

const LS_KEY = 'linkedAccounts';

// ---------------------------------------------------------------------------
// Helper — relative time
// ---------------------------------------------------------------------------
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LinkedAccounts() {
  const [linked, setLinked] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [connecting, setConnecting] = useState(null); // institution key being connected
  const [refreshing, setRefreshing] = useState(null); // institution id being refreshed

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

  // PLAID INTEGRATION: Replace this entire block with usePlaidLink
  // ---------------------------------------------------------------
  // const [linkToken, setLinkToken] = useState(null);
  //
  // useEffect(() => {
  //   // PLAID INTEGRATION: Call /api/plaid/create-link-token to get link_token
  //   async function createLinkToken() {
  //     const res = await fetch('/api/plaid/create-link-token', { method: 'POST' });
  //     const data = await res.json();
  //     setLinkToken(data.link_token);
  //   }
  //   createLinkToken();
  // }, []);
  //
  // const { open, ready } = usePlaidLink({
  //   token: linkToken,
  //   onSuccess: async (public_token, metadata) => {
  //     // PLAID INTEGRATION: Exchange public_token via /api/plaid/exchange-token
  //     const res = await fetch('/api/plaid/exchange-token', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ public_token }),
  //     });
  //     const data = await res.json();
  //     // Then fetch accounts using the access_token stored server-side
  //     // and add them to the linked state
  //   },
  //   onExit: (err) => {
  //     if (err) console.error('Plaid Link exit error:', err);
  //   },
  // });
  // ---------------------------------------------------------------

  const connectInstitution = useCallback((key) => {
    setConnecting(key);
    // Simulate 1.5s Plaid Link connection flow
    setTimeout(() => {
      const inst = DEMO_INSTITUTIONS[key];
      if (!inst) { setConnecting(null); return; }
      setLinked(prev => {
        if (prev.find(i => i.id === inst.id)) return prev; // already connected
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

  // Simulated month-over-month
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
  // Render — Modal overlay
  // ---------------------------------------------------------------------------
  const renderModal = () => {
    if (!modalOpen) return null;
    const alreadyLinked = new Set(linked.map(i => i.id));
    return (
      <div
        onClick={() => { if (!connecting) setModalOpen(false); }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn .2s ease',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            width: '100%', maxWidth: 420, padding: '28px 24px', position: 'relative',
            animation: 'slideUp .25s ease',
          }}
        >
          {/* Close */}
          {!connecting && (
            <button
              onClick={() => setModalOpen(false)}
              style={{
                position: 'absolute', top: 12, right: 14, background: 'none', border: 'none',
                color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18, fontFamily: 'var(--sans)',
              }}
              aria-label="Close"
            >
              x
            </button>
          )}

          {connecting ? (
            /* Loading state */
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{
                width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
                borderRadius: '50%', margin: '0 auto 20px',
                animation: 'spin 0.8s linear infinite',
              }} />
              <div className="serif f16" style={{ color: 'var(--text)' }}>
                Connecting to {INSTITUTION_LIST.find(i => i.key === connecting)?.name}...
              </div>
              <div className="f12 dim mt-8">Securely linking your accounts</div>
            </div>
          ) : (
            /* Institution picker */
            <>
              <div className="serif f18 mb-4" style={{ color: 'var(--text)' }}>Connect Account</div>
              <div className="f12 dim mb-16 lh-loose">
                Select your financial institution. Your credentials are encrypted and never stored on our servers.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {INSTITUTION_LIST.map(inst => {
                  const isLinked = alreadyLinked.has(`inst_${inst.key}`);
                  return (
                    <button
                      key={inst.key}
                      onClick={() => !isLinked && connectInstitution(inst.key)}
                      disabled={isLinked}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)', background: isLinked ? 'var(--bg2)' : 'var(--bg)',
                        cursor: isLinked ? 'default' : 'pointer', textAlign: 'left',
                        opacity: isLinked ? 0.5 : 1, transition: 'background .15s',
                        fontFamily: 'var(--sans)',
                      }}
                    >
                      {/* Logo placeholder — colored circle with initial */}
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', background: inst.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0,
                        fontFamily: 'var(--sans)',
                      }}>
                        {inst.name[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{inst.name}</div>
                        {isLinked && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Already connected</div>}
                      </div>
                      {!isLinked && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.4 }}>
                          <path d="M6 4l4 4-4 4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="f11 dim mt-16" style={{ textAlign: 'center', lineHeight: 1.5 }}>
                Demo mode - no real credentials are used.
                <br />In production, this uses Plaid Link for secure connections.
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render — Empty state
  // ---------------------------------------------------------------------------
  if (linked.length === 0) {
    return (
      <div className="fade-up">
        <InfoBox icon="🔗" title="Link Your Accounts" color="var(--accent)">
          Connect your financial institutions to automatically aggregate all your accounts. See your complete net worth, retirement progress, and asset allocation in one place.
        </InfoBox>

        <Card style={{ textAlign: 'center', padding: '60px 32px', marginTop: 16 }}>
          <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.25 }}>🏦</div>
          <div className="serif f20 mb-8" style={{ color: 'var(--text-muted)' }}>
            Connect Your First Account
          </div>
          <div className="f13 dim lh-loose" style={{ maxWidth: 460, margin: '0 auto 12px' }}>
            Link your bank, brokerage, and retirement accounts to get a unified view of your finances. We use bank-level encryption to keep your data secure.
          </div>

          <div style={{
            display: 'flex', gap: 20, justifyContent: 'center', margin: '24px auto 32px',
            maxWidth: 400, flexWrap: 'wrap',
          }}>
            {[
              { icon: '📊', text: 'Unified net worth' },
              { icon: '🔒', text: 'Bank-level security' },
              { icon: '📈', text: 'Auto-sync balances' },
              { icon: '🎯', text: 'Track retirement goals' },
            ].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>{item.icon}</span> {item.text}
              </div>
            ))}
          </div>

          <button onClick={() => setModalOpen(true)} style={{ ...btnPrimary, padding: '12px 28px', fontSize: 14 }}>
            Connect Account
          </button>
        </Card>

        {renderModal()}

        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
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

      {/* Aggregated stats */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <Stat icon="💰" label="Total Net Worth" value={fmt(totalNetWorth)} color="var(--accent)"
          sub={<span style={{ color: monthChange.amount >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
            {monthChange.amount >= 0 ? '+' : ''}{fmtFull(monthChange.amount)} ({monthChange.pct}%) this month
          </span>}
        />
        <Stat icon="🏦" label="Retirement" value={fmt(retirementTotal)} color="var(--accent)"
          sub={`${linked.length} institution${linked.length !== 1 ? 's' : ''} linked`}
        />
        <Stat icon="📈" label="Taxable Investments" value={fmt(taxableTotal)} color="var(--blue)" />
        <Stat icon="💵" label="Cash & Savings" value={fmt(cashTotal)} color="var(--purple)" />
        {debtTotal > 0 && <Stat icon="💳" label="Debt" value={`-${fmt(debtTotal)}`} color="var(--danger)" />}
      </div>

      {/* Charts row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* Category breakdown donut */}
        {categorySegs.length > 0 && (
          <Card style={{ flex: '1 1 240px', padding: 20 }}>
            <SectionLabel>Account Type Breakdown</SectionLabel>
            <Donut segs={categorySegs} label={fmt(totalNetWorth)} size={150} />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {categorySegs.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--text-muted)' }}>{s.label}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{s.pct.toFixed(1)}%</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11, minWidth: 60, textAlign: 'right' }}>{fmtFull(s.value)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Asset allocation donut */}
        {allocationSegs.length > 0 && (
          <Card style={{ flex: '1 1 240px', padding: 20 }}>
            <SectionLabel>Asset Allocation (Investments)</SectionLabel>
            <Donut segs={allocationSegs} label="Allocation" size={150} />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {allocationSegs.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--text-muted)' }}>{s.label}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{s.pct}%</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Connected institutions list */}
      <SectionLabel>Connected Institutions</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {linked.map(inst => (
          <Card key={inst.id} style={{ padding: 0, overflow: 'hidden' }}>
            {/* Institution header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
            }}>
              {/* Logo circle */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: inst.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0,
                fontFamily: 'var(--sans)',
              }}>
                {inst.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{inst.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  Synced {timeAgo(inst.lastSynced)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => refreshInstitution(inst.id)}
                  disabled={refreshing === inst.id}
                  style={{ ...btnSecondary, opacity: refreshing === inst.id ? 0.5 : 1 }}
                >
                  {refreshing === inst.id ? 'Syncing...' : 'Refresh'}
                </button>
                <button onClick={() => disconnectInstitution(inst.id)} style={btnDanger}>
                  Disconnect
                </button>
              </div>
            </div>

            {/* Accounts under this institution */}
            <div style={{ padding: '8px 16px 12px' }}>
              {inst.accounts.map(acct => (
                <div key={acct.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{acct.name}</span>
                    <span style={{
                      display: 'inline-block', marginLeft: 8, fontSize: 10, fontWeight: 700,
                      padding: '2px 7px', borderRadius: 4,
                      background: (TYPE_BADGE_COLORS[acct.subtype] || 'var(--text-dim)') + '18',
                      color: TYPE_BADGE_COLORS[acct.subtype] || 'var(--text-dim)',
                      textTransform: 'uppercase', letterSpacing: 0.3,
                    }}>
                      {TYPE_LABELS[acct.subtype] || acct.subtype}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 700, fontFamily: 'var(--serif)',
                    color: acct.balance < 0 ? 'var(--danger)' : 'var(--text)',
                  }}>
                    {fmtFull(acct.balance)}
                  </div>
                </div>
              ))}
              {/* Institution total */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 0 2px',
                fontSize: 12, color: 'var(--text-muted)',
              }}>
                <span>{inst.accounts.length} account{inst.accounts.length !== 1 ? 's' : ''}</span>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                  {fmtFull(inst.accounts.reduce((s, a) => s + a.balance, 0))}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Connect another */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <button onClick={() => setModalOpen(true)} style={btnPrimary}>
          + Connect Another Account
        </button>
      </div>

      {renderModal()}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
