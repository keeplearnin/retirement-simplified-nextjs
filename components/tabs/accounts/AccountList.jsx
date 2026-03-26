'use client';

import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import { fmtFull } from '@/lib/format';
import { TYPE_BADGE_COLORS, TYPE_LABELS, timeAgo } from './accountsData';

export default function AccountList({ linked, refreshing, onRefresh, onDisconnect, btnSecondary, btnDanger }) {
  return (
    <>
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
                  onClick={() => onRefresh(inst.id)}
                  disabled={refreshing === inst.id}
                  style={{ ...btnSecondary, opacity: refreshing === inst.id ? 0.5 : 1 }}
                >
                  {refreshing === inst.id ? 'Syncing...' : 'Refresh'}
                </button>
                <button onClick={() => onDisconnect(inst.id)} style={btnDanger}>
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
    </>
  );
}
