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
  const { plan, updatePlan } = usePlan();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [healthReport, setHealthReport] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [optimizeReport, setOptimizeReport] = useState(null);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [optimizeError, setOptimizeError] = useState(null);
  const [showOptimize, setShowOptimize] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState({ email: '', weeklyCheckEnabled: false, loaded: false });
  const [introOpen, setIntroOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('rs:intro-seen-v1') !== '1';
  });
  const [howToOpen, setHowToOpen] = useState(false);
  const chatRef = useRef(null);

  function dismissIntro() {
    setIntroOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rs:intro-seen-v1', '1');
    }
  }

  async function fetchInsights() {
    setInsightsLoading(true);
    try {
      const token = Auth.getIdToken?.();
      if (!token) return;
      const res = await fetch('/api/agent/portfolio-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });
      if (res.ok) {
        setInsights(await res.json());
      }
    } catch {
      // silent — insights are nice-to-have
    } finally {
      setInsightsLoading(false);
    }
  }

  useEffect(() => {
    savePlanSnapshot(plan);
    // Load any existing health report immediately
    const existing = loadHealthReport();
    if (existing) setHealthReport(existing);
    // Load DB history and auto-run health check if overdue
    const token = Auth.getIdToken?.();
    if (token) {
      // Portfolio insights are cheap (no LLM) — auto-fetch on mount
      fetchInsights();
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
    setOptimizeError(null);
    setOptimizeReport(null);
    try {
      const token = Auth.getIdToken?.();
      if (!token) {
        setOptimizeError({ status: 401, message: 'Please sign in to use the optimizer.' });
        return;
      }
      const res = await fetch('/api/agent/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, planHistory: loadHistory() }),
      });

      if (!res.ok) {
        let serverMsg = '';
        try {
          const body = await res.json();
          serverMsg = body.error || body.message || '';
        } catch { /* non-JSON response */ }

        const fallback = {
          401: 'Session expired. Sign in again to optimize.',
          429: 'Too many requests — try again in a minute.',
          503: 'Optimizer is not configured on the server (likely a missing ANTHROPIC_API_KEY env var). Contact support.',
          502: 'AI service temporarily unavailable. Try again in a moment.',
          500: 'Server error while running the optimization.',
        }[res.status] || `Optimization failed (status ${res.status}).`;

        setOptimizeError({ status: res.status, message: serverMsg || fallback });
        return;
      }

      const { report } = await res.json();
      if (!report) {
        setOptimizeError({ status: 200, message: 'Optimizer returned no report. Try again.' });
        return;
      }
      setOptimizeReport(report);
    } catch (err) {
      setOptimizeError({ status: 0, message: err?.message || 'Network error — check your connection.' });
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
          {!introOpen && (
            <button
              onClick={() => setIntroOpen(true)}
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'var(--sans)',
                cursor: 'pointer',
              }}
            >
              ✨ What's new
            </button>
          )}
        </div>
      </div>

      {/* What's New + How to Navigate (dismissible) */}
      {introOpen && (
        <div
          style={{
            marginBottom: 16,
            border: '1px solid var(--accent)',
            borderRadius: 12,
            padding: '14px 16px',
            background: 'var(--accent-dim, rgba(16,185,129,0.08))',
            fontFamily: 'var(--sans)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>✨ What's new</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>The AI Advisor just got a major upgrade.</div>
            </div>
            <button
              onClick={dismissIntro}
              aria-label="Dismiss"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>

          <ul style={{ margin: '8px 0 12px', paddingLeft: 20, fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>
            <li><strong>Real plan calculations.</strong> Ask "am I on track" or "what if I retire at 62" — I now run the actual projection engine on your numbers.</li>
            <li><strong>⚡ Optimize My Plan.</strong> One click runs SS timing + Roth conversion + withdrawal analysis, returns a ranked action list with dollar impact.</li>
            <li><strong>📋 Weekly plan health check.</strong> A short report shows here every Monday — alerts, recommendations, and trend over time.</li>
            <li><strong>📬 Email digest (optional).</strong> Toggle on below the chat to get the weekly summary in your inbox.</li>
          </ul>

          <button
            onClick={() => setHowToOpen(o => !o)}
            style={{
              background: 'transparent',
              color: 'var(--accent)',
              border: 'none',
              padding: 0,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--sans)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {howToOpen ? '▾ Hide' : '▸ How to navigate this tab'}
          </button>

          {howToOpen && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                <li><strong>Start with the green optimize card below</strong> if you want a complete plan review with ranked actions. Takes ~20 seconds.</li>
                <li><strong>Use chat for specific questions</strong> — "should I do a Roth conversion?", "when should I claim Social Security?", "what's my biggest risk?". Suggested questions are just starters; type anything.</li>
                <li><strong>Check the weekly report banner at the top</strong> for proactive alerts about your plan. It re-runs every 7 days automatically.</li>
                <li><strong>Edit your plan in the My Plan tab</strong> — the advisor reads from the same data source, so changes there reflect here immediately.</li>
              </ol>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                All calculations are deterministic and use the same engine as the rest of the app. Educational tool — not financial advice.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Real-estate callout — fires when user has significant RE but the
          "draw from RE in retirement" toggle is off. Surfaces the most
          impactful single setting the engine has, which is otherwise buried
          in My Plan → Assumptions. */}
      {(() => {
        const reBalance = plan?.savingsRealEstate ?? 0;
        const reIncluded = !!plan?.useRealEstateInRetirement;
        if (reBalance < 100_000 || reIncluded) return null;
        const reInK = reBalance >= 1_000_000
          ? `$${(reBalance / 1_000_000).toFixed(1)}M`
          : `$${Math.round(reBalance / 1000)}K`;
        return (
          <div
            style={{
              marginBottom: 16,
              border: '1px solid var(--warn, #f59e0b)',
              borderRadius: 12,
              padding: '14px 16px',
              background: 'var(--warn-dim, rgba(245,158,11,0.10))',
              fontFamily: 'var(--sans)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 22, lineHeight: 1 }}>🏠</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>
                {reInK} in real estate is not counted in your projection
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginBottom: 10 }}>
                By default the projection treats real estate as illiquid — it's tracked and grows, but doesn't cover retirement spending. If you plan to sell, downsize, or take a reverse mortgage, enable the toggle and your "money lasts to" age will extend significantly.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => updatePlan('useRealEstateInRetirement', true)}
                  style={{
                    background: 'var(--accent)', color: 'var(--bg)', border: 'none',
                    borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700,
                    fontFamily: 'var(--sans)', cursor: 'pointer',
                  }}
                >
                  Include real estate in retirement
                </button>
                <button
                  onClick={() => sendMessage(`I have ${reInK} in real estate that isn't counted in my plan. How does enabling "draw from real estate in retirement" change my projection?`)}
                  style={{
                    background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                    fontFamily: 'var(--sans)', cursor: 'pointer',
                  }}
                >
                  Ask the advisor
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Portfolio Insights — auto-fetched proactive recommendations */}
      {insights && insights.recommendations?.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
            fontFamily: 'var(--sans)',
          }}
        >
          <div
            style={{
              background: 'var(--bg2)',
              padding: '10px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>📊 Portfolio Insights</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{insights.summary}</span>
            </div>
            <button
              onClick={fetchInsights}
              disabled={insightsLoading}
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'var(--sans)',
                cursor: insightsLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {insightsLoading ? '...' : 'Refresh'}
            </button>
          </div>
          <div>
            {insights.recommendations.slice(0, 3).map((rec, i) => {
              const sev = rec.severity;
              const dot = sev === 'high' ? '🔴' : sev === 'medium' ? '🟡' : '🟢';
              const isLast = i === Math.min(2, insights.recommendations.length - 1);
              return (
                <div
                  key={rec.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: '20px', flexShrink: 0 }}>{dot}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{rec.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>{rec.detail}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                        background: 'var(--accent-dim, rgba(16,185,129,0.10))',
                        padding: '2px 8px', borderRadius: 10,
                      }}>{rec.impactLabel}</span>
                      <button
                        onClick={() => sendMessage(`Tell me more about this recommendation: ${rec.title}`)}
                        style={{
                          background: 'transparent', color: 'var(--text-muted)', border: 'none',
                          padding: 0, fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)',
                          cursor: 'pointer', textDecoration: 'underline',
                        }}
                      >
                        {rec.action.label} →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hero CTA — Optimize My Plan */}
      {!showOptimize && (
        <div
          style={{
            marginBottom: 16,
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '16px 18px',
            background: 'linear-gradient(135deg, var(--accent-dim, rgba(16,185,129,0.10)), transparent 80%)',
            fontFamily: 'var(--sans)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>⚡ Optimize My Plan</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Run a full multi-step analysis — SS timing, Roth conversions, withdrawal strategy, and retirement age scenarios. Returns a ranked action list with estimated dollar impact for each change.
            </div>
          </div>
          <button
            onClick={runOptimization}
            disabled={optimizeLoading}
            style={{
              background: optimizeLoading ? 'var(--border)' : 'var(--accent)',
              color: optimizeLoading ? 'var(--text-muted)' : 'var(--bg)',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'var(--sans)',
              cursor: optimizeLoading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {optimizeLoading ? '⏳ Analyzing...' : 'Run optimization →'}
          </button>
        </div>
      )}

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
          {optimizeError && !optimizeLoading && (
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>Optimization failed</div>
                  <div style={{ color: 'var(--text-muted)' }}>{optimizeError.message}</div>
                  {optimizeError.status > 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>HTTP {optimizeError.status}</div>
                  )}
                </div>
              </div>
              <button
                onClick={runOptimization}
                style={{
                  background: 'var(--accent)', color: 'var(--bg)', border: 'none',
                  borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600,
                  fontFamily: 'var(--sans)', cursor: 'pointer',
                }}
              >
                Try again
              </button>
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
