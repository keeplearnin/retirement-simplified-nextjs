'use client';

import { useEffect, useState } from 'react';

/**
 * SequencedLoader — cycles through a list of loading messages while a
 * parent is in a loading state. Each message has a small pulsing dot
 * that cycles in turn, signaling "the agent is doing this right now."
 *
 * The cycle is intentionally NOT tied to the real agent loop (the agent
 * can complete in 8 seconds or 30 — we can't know which step it's on).
 * The illusion is the point: the user gets the sense of the chain of
 * math happening without waiting in static silence.
 *
 * Usage:
 *   <SequencedLoader
 *     messages={[
 *       'Reading your plan…',
 *       'Modeling tax impact…',
 *       'Comparing scenarios…',
 *       'Ranking actions…',
 *     ]}
 *   />
 */
export default function SequencedLoader({ messages, intervalMs = 1500 }) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!messages || messages.length <= 1) return;
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [messages, intervalMs]);

  if (!messages || messages.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontFamily: 'var(--sans)',
        fontSize: 13,
      }}
      role="status"
      aria-live="polite"
    >
      {messages.map((msg, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div
            key={msg}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: active ? 'var(--text)' : done ? 'var(--text-muted)' : 'var(--text-dim)',
              opacity: active ? 1 : done ? 0.65 : 0.4,
              transition: 'opacity 0.3s ease, color 0.3s ease',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: done
                  ? 'var(--accent)'
                  : active
                  ? 'var(--accent)'
                  : 'var(--border)',
                animation: active ? 'agent-pulse 1.2s ease-in-out infinite' : 'none',
                flexShrink: 0,
              }}
            />
            <span>{msg}</span>
          </div>
        );
      })}
      <style>{`
        @keyframes agent-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50%      { opacity: 1;   transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
