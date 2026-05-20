'use client';

import { useState, useEffect, useRef } from 'react';
import Card from '@/components/ui/Card';
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
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState({ email: '', weeklyCheckEnabled: false, loaded: false });
  const [introOpen, setIntroOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('rs:intro-seen-v1') !== '1';
  });
  const [activePanel, setActivePanel] = useState(null); // 'health' | 'insights' | 're' | 'optimize' | 'settings' | null
  const chatRef = useRef(null);

  function togglePanel(name) {
    setActivePanel((prev) => (prev === name ? null : name));
  }

  function dismissIntro() {
    setIntroOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rs:intro-seen-v1', '1');
    }
  }

  async function fetchInsights() {
    setInsightsLoading(true);
    try {
      const res = await fetch('/api/agent/portfolio-insights', {
        method: 'POST',
        headers: Auth.getAuthHeaders(),
        body: JSON.stringify({ plan }),
      });
      if (res.ok) setInsights(await res.json());
    } catch {
      // silent — insights are nice-to-have
    } finally {
      setInsightsLoading(false);
    }
  }

  useEffect(() => {
    savePlanSnapshot(plan);
    const existing = loadHealthReport();
    if (existing) setHealthReport(existing);

    // Anonymous device-ID is always available; Cognito token is optional.
    // All API calls work either way — backend resolves identity from
    // X-Device-Id header when no Bearer token is present.
    fetchInsights();
    loadHistoryFromDb().then(() => {
      if (isHealthCheckDue()) runHealthCheck();
    });
    fetch('/api/db/plan', {
      method: 'PUT',
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify({ plan }),
    }).catch(() => undefined);
    fetch('/api/db/preferences', { headers: Auth.getAuthHeaders() })
      .then((r) => r.json())
      .then(({ preferences }) => {
        if (preferences) {
          setEmailPrefs({
            email: preferences.email ?? '',
            weeklyCheckEnabled: preferences.weeklyCheckEnabled,
            loaded: true,
          });
        }
      })
      .catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runHealthCheck() {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/agent/health-check', {
        method: 'POST',
        headers: Auth.getAuthHeaders(),
        body: JSON.stringify({ plan, planHistory: loadHistory() }),
      });
      if (res.ok) {
        const { report } = await res.json();
        saveHealthReport(report);
        markHealthCheckRan();
        setHealthReport(report);
      }
    } catch {
      // silent
    } finally {
      setHealthLoading(false);
    }
  }

  async function runOptimization() {
    setActivePanel('optimize');
    setOptimizeLoading(true);
    setOptimizeError(null);
    setOptimizeReport(null);
    try {
      const res = await fetch('/api/agent/optimize', {
        method: 'POST',
        headers: Auth.getAuthHeaders(),
        body: JSON.stringify({ plan, planHistory: loadHistory() }),
      });
      if (!res.ok) {
        let serverMsg = '';
        try {
          serverMsg = (await res.json()).error || '';
        } catch {
          /* non-JSON */
        }
        const fallback = {
          401: 'Optimizer needs a valid session or device ID. Try refreshing the page.',
          429: 'Too many requests — try again in a minute.',
          503: 'Optimizer is not configured on the server (missing ANTHROPIC_API_KEY or auth env vars).',
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
      setOptimizeError({ status: 0, message: err?.message || 'Network error.' });
    } finally {
      setOptimizeLoading(false);
    }
  }

  async function saveEmailPrefs(updates) {
    const next = { ...emailPrefs, ...updates };
    setEmailPrefs(next);
    await fetch('/api/db/preferences', {
      method: 'PUT',
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify({ email: next.email, weeklyCheckEnabled: next.weeklyCheckEnabled }),
    }).catch(() => undefined);
  }

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: Auth.getAuthHeaders(),
        body: JSON.stringify({ messages: newMessages, plan, planHistory: loadHistory() }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Session issue — try refreshing the page.' }]);
        return;
      }
      if (res.status === 429) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: "You're sending messages too quickly. Please wait a moment." },
        ]);
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.text }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ---------- derived state for chips ----------
  const reBalance = plan?.savingsRealEstate ?? 0;
  const reExcluded = reBalance >= 100_000 && !plan?.useRealEstateInRetirement;
  const reLabel =
    reBalance >= 1_000_000
      ? `$${(reBalance / 1_000_000).toFixed(1)}M`
      : `$${Math.round(reBalance / 1000)}K`;
  const insightCount = insights?.recommendations?.length ?? 0;
  const healthScore = healthReport?.overallScore;
  const healthDot =
    {
      excellent: '#10b981',
      good: '#10b981',
      needs_attention: '#f59e0b',
      critical: '#ef4444',
    }[healthScore] || 'var(--text-dim, #888)';
  const healthLabel = healthLoading
    ? 'Checking…'
    : healthScore === 'excellent'
    ? 'Excellent'
    : healthScore === 'good'
    ? 'Good'
    : healthScore === 'needs_attention'
    ? 'Attention'
    : healthScore === 'critical'
    ? 'Critical'
    : 'Health';

  function chipStyle(active, primary = false) {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      borderRadius: 999,
      background: active
        ? 'var(--accent-dim, rgba(16,185,129,0.12))'
        : primary
        ? 'var(--accent)'
        : 'var(--bg2)',
      color: active ? 'var(--accent)' : primary ? 'var(--bg)' : 'var(--text)',
      border: `1px solid ${active ? 'var(--accent)' : primary ? 'var(--accent)' : 'var(--border)'}`,
      fontSize: 12,
      fontWeight: 600,
      fontFamily: 'var(--sans)',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      transition: 'all 0.15s',
    };
  }

  return (
    <div>
      {/* What's New — single-line dismissible toast */}
      {introOpen && (
        <div
          style={{
            marginBottom: 12,
            padding: '8px 12px',
            background: 'var(--accent-dim, rgba(16,185,129,0.08))',
            border: '1px solid var(--accent)',
            borderRadius: 8,
            fontFamily: 'var(--sans)',
            fontSize: 12,
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span>
            ✨ <strong>New:</strong> real plan calculations · ⚡ Optimize · weekly health report · portfolio insights · email digest.
          </span>
          <button
            onClick={dismissIntro}
            aria-label="Dismiss"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Compact header */}
      <div style={{ marginBottom: 12, fontFamily: 'var(--sans)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text)', fontFamily: 'var(--serif)' }}>
          🤖 AI Advisor
        </h2>
        <p style={{ color: 'var(--text-muted)', margin: '2px 0 0', fontSize: 13 }}>
          Ask anything about your retirement plan.
        </p>
      </div>

      {/* Status chip bar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 12,
          overflowX: 'auto',
          paddingBottom: 4,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <button onClick={() => togglePanel('health')} style={chipStyle(activePanel === 'health')}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: healthDot,
              display: 'inline-block',
            }}
          />
          <span>Plan health: {healthLabel}</span>
        </button>

        {insightCount > 0 && (
          <button onClick={() => togglePanel('insights')} style={chipStyle(activePanel === 'insights')}>
            <span>📊 {insightCount} insight{insightCount === 1 ? '' : 's'}</span>
          </button>
        )}

        {reExcluded && (
          <button onClick={() => togglePanel('re')} style={chipStyle(activePanel === 're')}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#f59e0b',
                display: 'inline-block',
              }}
            />
            <span>🏠 {reLabel} RE excluded</span>
          </button>
        )}

        <button onClick={runOptimization} style={chipStyle(false, true)} disabled={optimizeLoading}>
          {optimizeLoading ? '⏳ Optimizing…' : '⚡ Optimize'}
        </button>

        <button
          onClick={() => togglePanel('settings')}
          style={chipStyle(activePanel === 'settings')}
          aria-label="Settings"
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      {/* Active panel — single drawer below chip bar */}
      {activePanel && (
        <div
          style={{
            marginBottom: 12,
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: 'var(--bg2)',
            fontFamily: 'var(--sans)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
              {activePanel === 'health' && 'Plan Health Report'}
              {activePanel === 'insights' && 'Portfolio Insights'}
              {activePanel === 're' && 'Real Estate Treatment'}
              {activePanel === 'optimize' && 'Optimization Report'}
              {activePanel === 'settings' && 'Settings'}
            </span>
            <button
              onClick={() => setActivePanel(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <div style={{ padding: '12px 14px' }}>
            {/* Health panel */}
            {activePanel === 'health' && (
              <div>
                {healthLoading && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Running plan health check…</div>
                )}
                {!healthLoading && !healthReport && (
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px' }}>
                      No health check has been run yet.
                    </p>
                    <button
                      onClick={runHealthCheck}
                      style={{
                        background: 'var(--accent)',
                        color: 'var(--bg)',
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Run now
                    </button>
                  </div>
                )}
                {healthReport && !healthLoading && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                      {healthReport.scoreLabel}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                      {healthReport.emailSummary}
                    </div>
                    {healthReport.alerts?.length > 0 && (
                      <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12, color: 'var(--text)' }}>
                        {healthReport.alerts.slice(0, 3).map((a, i) => (
                          <li key={i} style={{ marginBottom: 2 }}>
                            {a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🟢'} {a.message}
                          </li>
                        ))}
                      </ul>
                    )}
                    {healthReport.recommendations?.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 10 }}>
                        <strong>Top actions:</strong>
                        <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                          {healthReport.recommendations.slice(0, 3).map((r, i) => (
                            <li key={i} style={{ marginBottom: 2 }}>
                              {r}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    <button
                      onClick={runHealthCheck}
                      style={{
                        background: 'transparent',
                        color: 'var(--accent)',
                        border: '1px solid var(--accent)',
                        borderRadius: 8,
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Refresh
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Insights panel */}
            {activePanel === 'insights' && (
              <div>
                {insightsLoading && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading insights…</div>
                )}
                {!insightsLoading && (!insights || insightCount === 0) && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Your portfolio looks well-balanced — no major recommendations right now.
                  </div>
                )}
                {insights?.recommendations?.map((rec, i) => {
                  const dot = rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🟢';
                  return (
                    <div
                      key={rec.id}
                      style={{
                        display: 'flex',
                        gap: 10,
                        paddingTop: i === 0 ? 0 : 10,
                        paddingBottom: 10,
                        borderBottom: i === insightCount - 1 ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{dot}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{rec.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 6px', lineHeight: 1.5 }}>
                          {rec.detail}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: 'var(--accent)',
                              background: 'var(--accent-dim, rgba(16,185,129,0.10))',
                              padding: '2px 8px',
                              borderRadius: 10,
                            }}
                          >
                            {rec.impactLabel}
                          </span>
                          <button
                            onClick={() => {
                              setActivePanel(null);
                              sendMessage(`Tell me more about: ${rec.title}`);
                            }}
                            style={{
                              background: 'transparent',
                              color: 'var(--text-muted)',
                              border: 'none',
                              padding: 0,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              textDecoration: 'underline',
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
            )}

            {/* Real estate panel */}
            {activePanel === 're' && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 10px', lineHeight: 1.5 }}>
                  {reLabel} is currently excluded from your projection. The engine treats real estate as illiquid by default. If you plan to sell, downsize, or take a reverse mortgage in late retirement, enable it below and your money-lasts-to age will extend significantly.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      updatePlan('useRealEstateInRetirement', true);
                      setActivePanel(null);
                    }}
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--bg)',
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Include in retirement
                  </button>
                  <button
                    onClick={() => {
                      setActivePanel(null);
                      sendMessage(
                        `How does enabling 'draw from real estate in retirement' change my projection? I have ${reLabel} in real estate.`,
                      );
                    }}
                    style={{
                      background: 'transparent',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Ask the advisor
                  </button>
                </div>
              </div>
            )}

            {/* Optimize panel */}
            {activePanel === 'optimize' && (
              <div>
                {optimizeLoading && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Running multi-step analysis — projection → SS timing → Roth conversions → withdrawal order…
                  </div>
                )}
                {optimizeError && !optimizeLoading && (
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>
                      <strong>⚠️ Optimization failed.</strong> {optimizeError.message}
                      {optimizeError.status > 0 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>
                          (HTTP {optimizeError.status})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={runOptimization}
                      style={{
                        background: 'var(--accent)',
                        color: 'var(--bg)',
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Try again
                    </button>
                  </div>
                )}
                {optimizeReport && !optimizeLoading && (
                  <div>
                    {optimizeReport.headline && (
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px' }}>
                        {optimizeReport.headline}
                      </p>
                    )}
                    {optimizeReport.keyMetrics && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                        {[
                          { label: 'Money lasts (now)', value: `Age ${optimizeReport.keyMetrics.currentMoneyLastsAge ?? '—'}` },
                          { label: 'Money lasts (optimized)', value: `Age ${optimizeReport.keyMetrics.optimizedMoneyLastsAge ?? '—'}` },
                          { label: 'Lifetime tax (now)', value: `$${Math.round((optimizeReport.keyMetrics.currentLifetimeTax || 0) / 1000)}K` },
                          { label: 'Lifetime tax (optimized)', value: `$${Math.round((optimizeReport.keyMetrics.optimizedLifetimeTax || 0) / 1000)}K` },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 8px' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {optimizeReport.actions?.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            marginBottom: 6,
                          }}
                        >
                          Ranked actions
                        </div>
                        {optimizeReport.actions.map((a, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              gap: 8,
                              padding: '6px 0',
                              borderBottom: i === optimizeReport.actions.length - 1 ? 'none' : '1px solid var(--border)',
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent)', minWidth: 20 }}>
                              #{a.rank}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{a.action}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 4px' }}>
                                {a.detail}
                              </div>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: 'var(--accent)',
                                  background: 'var(--accent-dim, rgba(16,185,129,0.10))',
                                  padding: '1px 6px',
                                  borderRadius: 8,
                                }}
                              >
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

            {/* Settings panel */}
            {activePanel === 'settings' && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  📬 Weekly email digest
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Get your plan health report in your inbox every Monday.
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={emailPrefs.weeklyCheckEnabled}
                    onChange={(e) => saveEmailPrefs({ weeklyCheckEnabled: e.target.checked })}
                    style={{ width: 14, height: 14, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>
                    {emailPrefs.weeklyCheckEnabled ? 'On' : 'Off'}
                  </span>
                </label>
                {emailPrefs.weeklyCheckEnabled && (
                  <input
                    type="email"
                    value={emailPrefs.email}
                    onChange={(e) => setEmailPrefs((p) => ({ ...p, email: e.target.value }))}
                    onBlur={(e) => saveEmailPrefs({ email: e.target.value })}
                    placeholder="your@email.com"
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      color: 'var(--text)',
                      fontSize: 13,
                      width: '100%',
                      maxWidth: 320,
                      outline: 'none',
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat — the hero */}
      <Card>
        <div ref={chatRef} style={{ height: 460, overflowY: 'auto', padding: 8 }}>
          {messages.length === 0 ? (
            <div style={{ padding: '60px 16px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text)', margin: '0 0 8px', fontFamily: 'var(--sans)' }}>
                What would you like to know about your retirement plan?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px', fontFamily: 'var(--sans)' }}>
                I can run real calculations on your numbers — try one of these:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {[
                  'Am I on track to retire at 65?',
                  'Should I do a Roth conversion?',
                  'When should I claim Social Security?',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    style={{
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      borderRadius: 999,
                      padding: '6px 14px',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontFamily: 'var(--sans)',
                    }}
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
                  Thinking…
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage(input)}
          placeholder="Ask about retirement, investing, taxes…"
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
          }}
        >
          Send
        </button>
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
