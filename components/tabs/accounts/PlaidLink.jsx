'use client';

import { INSTITUTION_LIST } from './accountsData';

export default function PlaidLink({ modalOpen, connecting, linked, onClose, onConnect }) {
  if (!modalOpen) return null;
  const alreadyLinked = new Set(linked.map(i => i.id));

  return (
    <div
      onClick={() => { if (!connecting) onClose(); }}
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
            onClick={onClose}
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
                    onClick={() => !isLinked && onConnect(inst.key)}
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
}
