'use client';

import { useState, useRef, useEffect } from 'react';
import { usePlan } from '@/components/PlanProvider';
import Auth from '@/lib/auth';

/**
 * OnboardingChat — conversational plan builder. The agent at
 * /api/agent/onboard asks 5-7 questions in a brief chat. Each round-trip
 * returns a delta (fieldUpdates + incomeUpdates) that we apply via the
 * PlanProvider context.
 *
 * The user can bail out at any time with "Switch to form" or "Done — skip"
 * — both call onComplete which closes the onboarding modal and reveals
 * the main app.
 */
export default function OnboardingChat({ onComplete, onSwitchToForm }) {
  const { plan, bulkUpdate, updatePlan } = usePlan();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hi! Let's build your retirement plan in about 3 minutes. I'll ask 5 questions — feel free to say \"use a default\" for anything you're unsure about.\n\nFirst: how old are you, and what age would you like to retire?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  function applyDelta(fieldUpdates, incomeUpdates) {
    // Apply scalar fields via bulkUpdate so we get one re-render.
    if (fieldUpdates && Object.keys(fieldUpdates).length > 0) {
      bulkUpdate(fieldUpdates);
    }
    // Append income sources individually (preserves existing ones).
    if (incomeUpdates && incomeUpdates.length > 0) {
      const existing = Array.isArray(plan?.incomeSources) ? plan.incomeSources : [];
      const maxId = existing.reduce((m, s) => Math.max(m, Number(s.id) || 0), 0);
      const newSources = incomeUpdates.map((s, i) => ({ id: maxId + i + 1, ...s }));
      updatePlan('incomeSources', [...existing, ...newSources]);
    }
  }

  async function sendMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed || loading || isDone) return;

    const userMsg = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/agent/onboard', {
        method: 'POST',
        headers: Auth.getAuthHeaders(),
        body: JSON.stringify({ messages: newMessages, plan }),
      });

      if (!res.ok) {
        const fallback = res.status === 503
          ? "The setup assistant isn't configured on the server. You can still fill in the form yourself."
          : `Setup hit an error (status ${res.status}). Try again, or switch to the form.`;
        setMessages((prev) => [...prev, { role: 'assistant', content: fallback }]);
        return;
      }

      const data = await res.json();

      // Apply the structured updates BEFORE rendering the next message so
      // the user sees both arrive together.
      applyDelta(data.fieldUpdates, data.incomeUpdates);

      if (data.text) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.text }]);
      }

      if (data.isComplete) {
        setIsDone(true);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Network error — try again, or switch to the form.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: 0,
        fontFamily: 'var(--sans)',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>
            Setup with AI
            {!isDone && (() => {
              // Count user replies as completed questions. Clamp display
              // to 5 so a follow-up doesn't read "Question 7 of 5" — the
              // ~5 framing is intentional since the agent can ask
              // clarifications.
              const answered = messages.filter((m) => m.role === 'user').length;
              const step = Math.min(answered + 1, 5);
              return (
                <>
                  {' · '}Question {step} of ~5
                </>
              );
            })()}
            {isDone && ' · Done'}
          </span>
          <button
            onClick={onSwitchToForm}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Switch to form →
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          height: 380,
          overflowY: 'auto',
          padding: 12,
          marginBottom: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? 'linear-gradient(135deg, var(--accent), #2dd4a0)' : 'var(--bg)',
              color: m.role === 'user' ? 'var(--bg)' : 'var(--text)',
              padding: '10px 14px',
              borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              maxWidth: '85%',
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)',
            }}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div
            style={{
              alignSelf: 'flex-start',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              padding: '10px 14px',
              borderRadius: '14px 14px 14px 4px',
              fontSize: 13,
              animation: 'fade 1.2s ease-in-out infinite',
            }}
          >
            Thinking…
          </div>
        )}
      </div>

      {isDone ? (
        <button
          onClick={onComplete}
          style={{
            width: '100%',
            background: 'var(--accent)',
            color: 'var(--bg)',
            border: 'none',
            borderRadius: 10,
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          See my plan →
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder="Your answer..."
            disabled={loading}
            style={{
              flex: 1,
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '10px 14px',
              color: 'var(--text)',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? 'var(--border)' : 'var(--accent)',
              color: loading || !input.trim() ? 'var(--text-dim)' : 'var(--bg)',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 600,
              fontSize: 14,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            Send
          </button>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        Educational tool only — not financial advice. You can edit anything later in My Plan.
      </div>

      <style>{`
        @keyframes fade {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
