'use client';

import { useState, useEffect, useRef } from 'react';
import Card from '@/components/ui/Card';
import { AI_SUGGESTED_QUESTIONS } from '@/lib/constants';
import Auth from '@/lib/auth';
import { usePlan } from '@/components/PlanProvider';
import { savePlanSnapshot, loadHistory, loadHistoryFromDb } from '@/lib/planHistory';
import {
  isHealthCheckDue,
  markHealthCheckRan,
  saveHealthReport,
  loadHealthReport,
} from '@/lib/healthCheck';

export default function AIAdvisor() {
  const { plan } = usePlan();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [healthReport, setHealthReport] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [optimizeReport, setOptimizeReport] = useState(null);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [showOptimize, setShowOptimize] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState({ email: '', weeklyCheckEnabled: false, loaded: false });
  const chatRef = useRef(null);

  useEffect(() => {
    savePlanSnapshot(plan);
    // Load any existing health report immediately
    const existing = loadHealthReport();
    if (existing) setHealthReport(existing);
    // Load DB history and auto-run health check if overdue
    const token = Auth.getIdToken?.();
    if (token) {
      loadHistoryFromDb(token).then(() => {
        if (isHealthCheckDue()) runHealthCheck();
      });
      // Sync current plan to DB for cross-device access
      fetch('/api/db/plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      }).catch(() => undefined);
      // Load email preferences
      fetch('/api/db/preferences', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then(({ preferences }) => {
          if (preferences) {
            setEmailPrefs({ email: preferences.email ?? '', weeklyCheckEnabled: preferences.weeklyCheckEnabled, loaded: true });
          }
        })
        .catch(() => undefined);
    } else {
      if (isHealthCheckDue()) runHealthCheck();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runHealthCheck() {
    setHealthLoading(true);
    try {
      const token = Auth.getIdToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/agent/health-check', {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan, planHistory: loadHistory() }),
      });
      if (res.ok) {
        const { report } = await res.json();
        saveHealthReport(report);
        markHealthCheckRan();
        setHealthReport(report);
      }
    } catch {
      // silent — health check is best-effort
    } finally {
      setHealthLoading(false);
    }
  }

  async function runOptimization() {
    setOptimizeLoading(true);
    setShowOptimize(true);
    try {
      const token = Auth.getIdToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/agent/optimize', {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan, planHistory: loadHistory() }),
      });
      if (res.ok) {
        const { report } = await res.json();
        setOptimizeReport(report);
      }
    } catch {
      // silent
    } finally {
      setOptimizeLoading(false);
    }
  }

  async function saveEmailPrefs(updates) {
    const token = Auth.getIdToken?.();
    if (!token) return;
    const next = { ...emailPrefs, ...updates };
    setEmailPrefs(next);
    await fetch('/api/db/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: next.email, weeklyCheckEnabled: next.weeklyCheckEnabled }),
    }).catch(() => undefined);
  }

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function sendMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    const userMsg = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const token = Auth.getIdToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: newMessages, plan, planHistory: loadHistory() }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Please sign in to use the AI advisor.' }]);
        return;
      }
      if (res.status === 429) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'You\'re sending messages too quickly. Please wait a moment.' }]);
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.text }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const quickTopics = [
    'How do I start?',
    'Roth vs Traditional',
    'Am I saving enough?',
    'What about inflation?',
    'Tax-loss harvesting',
  ];

  const scoreColors = {
    excellent: { bg: 'var(--success-dim, #d1fae5)', text: 'var(--success, #059669)', border: 'var(--success, #059669)' },
    good: { bg: 'var(--info-dim, #dbeafe)', text: 'var(--info, #2563eb)', border: 'var(--info, #2563eb)' },
    needs_attention: { bg: 'var(--warn-dim)', text: 'var(--warn)', border: 'var(--warn)' },
    critical: { bg: 'var(--danger-dim, #fee2e2)', text: 'var(--danger, #dc2626)', border: 'var(--danger, #dc2626)' },
  };

  return (
    <div>
      {/* Weekly Health Report Banner */}
      {healthLoading && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ animation: 'fade 1.2s ease-in-out infinite', display: 'inline-block' }}>⏳</span>
          Running weekly plan health check...
        </div>
      )}
      {healthReport && !healthLoading && (() => {
        const colors = scoreColors[healthReport.overallScore] || scoreColors.needs_attention;
        return (
          <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16, background: colors.bg, fontFamily: 'var(--sans)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>
                📋 Weekly Plan Health — {healthReport.scoreLabel}
              </span>
              <button
                onClick={runHealthCheck}
                style={{ fontSize: 11, color: colors.text, background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '2px 8px', cursor: 'pointer', fontFamily: 'var(--sans)' }}
              >
                Refresh
              </button>
            </div>
            {healthReport.alerts.length > 0 && (
              <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 13, color: 'var(--text)' }}>
                {healthReport.alerts.slice(0, 3).map((a, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>
                    {a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🟢'} {a.message}
                  </li>
                ))}
              </ul>
            )}
            {healthReport.recommendations.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', borderTop: `1px solid ${colors.border}`, paddingTop: 8, marginTop: 4 }}>
                <strong>Top action:</strong> {healthReport.recommendations[0]}
              </div>
            )}
          </div>
        );
      })()}

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text)', fontFamily: 'var(--serif)' }}>
          🤖 AI Financial Advisor
        </h2>
        <p style={{ color: 'var(--text-muted)', margin: '4px 0 8px', fontSize: 14, fontFamily: 'var(--sans)' }}>
          Ask questions about your retirement plan — I can run real calculations on your numbers.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-block',
              background: 'var(--warn-dim)',
              color: 'var(--warn)',
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 20,
              fontFamily: 'var(--sans)',
            }}
          >
            Educational tool only — not financial advice
          </span>
          <button
            onClick={runOptimization}
            disabled={optimizeLoading}
            style={{
              background: optimizeLoading ? 'var(--border)' : 'var(--accent)',
              color: optimizeLoading ? 'var(--text-muted)' : 'var(--bg)',
              border: 'none',
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--sans)',
              cursor: optimizeLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {optimizeLoading ? '⏳ Optimizing...' : '⚡ Optimize My Plan'}
          </button>
        </div>
      </div>

      {/* Optimization Report */}
      {showOptimize && (
        <div style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', fontFamily: 'var(--sans)' }}>
          <div style={{ background: 'var(--bg2)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>⚡ Optimization Report</span>
            <button onClick={() => setShowOptimize(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          {optimizeLoading && (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 13 }}>
              Running full analysis: projection → SS timing → Roth conversions → withdrawal order...
            </div>
          )}
          {optimizeReport && !optimizeLoading && (
            <div style={{ padding: '12px 16px' }}>
              {optimizeReport.headline && (
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>
                  {optimizeReport.headline}
                </p>
              )}
              {optimizeReport.keyMetrics && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'Money lasts (now)', value: `Age ${optimizeReport.keyMetrics.currentMoneyLastsAge}` },
                    { label: 'Money lasts (optimized)', value: `Age ${optimizeReport.keyMetrics.optimizedMoneyLastsAge}` },
                    { label: 'Lifetime tax (now)', value: `$${Math.round(optimizeReport.keyMetrics.currentLifetimeTax / 1000)}K` },
                    { label: 'Lifetime tax (optimized)', value: `$${Math.round(optimizeReport.keyMetrics.optimizedLifetimeTax / 1000)}K` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}
              {optimizeReport.actions?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Ranked Actions</div>
                  {optimizeReport.actions.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 8 }}>
                      <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--accent)', minWidth: 24, lineHeight: 1.2 }}>#{a.rank}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{a.action}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{a.detail}</div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim, rgba(0,200,150,0.1))', padding: '2px 8px', borderRadius: 10 }}>
                          {a.estimatedImpact}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Weekly Email Settings */}
      {emailPrefs.loaded && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, fontFamily: 'var(--sans)', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>📬 Weekly Email Check</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>Get your plan health report every Monday</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={emailPrefs.weeklyCheckEnabled}
                onChange={(e) => saveEmailPrefs({ weeklyCheckEnabled: e.target.checked })}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{emailPrefs.weeklyCheckEnabled ? 'On' : 'Off'}</span>
            </label>
          </div>
          {emailPrefs.weeklyCheckEnabled && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="email"
                value={emailPrefs.email}
                onChange={(e) => setEmailPrefs((p) => ({ ...p, email: e.target.value }))}
                onBlur={(e) => saveEmailPrefs({ email: e.target.value })}
                placeholder="your@email.com"
                style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Chat area */}
      <Card>
        <div ref={chatRef} style={{ height: 440, overflowY: 'auto', padding: 8 }}>
          {messages.length === 0 ? (
            <div>
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16, fontSize: 14, fontFamily: 'var(--sans)' }}>
                Choose a question to get started, or type your own below.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {AI_SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    style={{
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 13,
                      fontFamily: 'var(--sans)',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--card-hover)'; e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    background:
                      msg.role === 'user'
                        ? 'linear-gradient(135deg, var(--accent), #2dd4a0)'
                        : 'var(--bg2)',
                    color: msg.role === 'user' ? 'var(--bg)' : 'var(--text)',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    maxWidth: '80%',
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'var(--sans)',
                  }}
                >
                  {msg.content}
                </div>
              ))}
              {loading && (
                <div
                  style={{
                    alignSelf: 'flex-start',
                    background: 'var(--bg2)',
                    color: 'var(--text-muted)',
                    padding: '10px 14px',
                    borderRadius: '16px 16px 16px 4px',
                    fontSize: 14,
                    fontFamily: 'var(--sans)',
                    animation: 'fade 1.2s ease-in-out infinite',
                  }}
                >
                  Thinking...
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage(input)}
          placeholder="Ask about retirement, investing, taxes..."
          style={{
            flex: 1,
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 14px',
            color: 'var(--text)',
            fontSize: 14,
            fontFamily: 'var(--sans)',
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
            fontFamily: 'var(--sans)',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Send
        </button>
      </div>

      {/* Quick topic buttons */}
      {messages.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {quickTopics.map((topic) => (
            <button
              key={topic}
              onClick={() => sendMessage(topic)}
              disabled={loading}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 20,
                padding: '6px 14px',
                color: 'var(--text-muted)',
                fontSize: 12,
                fontFamily: 'var(--sans)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--card-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {topic}
            </button>
          ))}
        </div>
      )}

      {/* Fade animation for loading */}
      <style>{`
        @keyframes fade {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
