'use client';

import { useState, useEffect, useRef } from 'react';
import Card from '@/components/ui/Card';
import Auth from '@/lib/auth';
import { usePlan } from '@/components/PlanProvider';
import { savePlanSnapshot, loadHistory, loadHistoryFromDb } from '@/lib/planHistory';
import Icon from '@/components/ui/Icon';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import SequencedLoader from '@/components/ui/SequencedLoader';
import {
  isHealthCheckDue,
  markHealthCheckRan,
  saveHealthReport,
  loadHealthReport,
} from '@/lib/healthCheck';
import {
  isReviewDue,
  markReviewRan,
  saveReport as saveReviewReport,
  loadReport as loadReviewReport,
} from '@/lib/quarterlyReview';

export default function AIAdvisor() {
  const { plan, updatePlan, updateIncome } = usePlan();
  const [messages, setMessages] = useState([]);
  const [toast, setToast] = useState(null); // null | { text, undo?: () => void }
  const [appliedProposalIds, setAppliedProposalIds] = useState(() => new Set());
  // Map<proposalId, { previousValue, target }>. While an entry exists, the
  // Apply button shows an inline "Undo" affordance for 30 seconds after the
  // user clicks Apply. After expiry the entry is removed and the change
  // becomes permanent (still editable via My Plan, but no one-click revert).
  const [pendingUndo, setPendingUndo] = useState(() => new Map());
  const undoTimersRef = useRef(new Map());      // proposalId → setTimeout handle
  const toastTimerRef = useRef(null);            // active toast clear timer
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [healthReport, setHealthReport] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [optimizeReport, setOptimizeReport] = useState(null);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [optimizeError, setOptimizeError] = useState(null);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [reviewReport, setReviewReport] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSeen, setReviewSeen] = useState(false);
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

    const existingReview = loadReviewReport();
    if (existingReview) {
      setReviewReport(existingReview);
      setReviewSeen(true); // existing report has been seen before
    }

    // Anonymous device-ID is always available; Cognito token is optional.
    // All API calls work either way — backend resolves identity from
    // X-Device-Id header when no Bearer token is present.
    fetchInsights();
    loadHistoryFromDb().then((history) => {
      if (isHealthCheckDue()) runHealthCheck();
      if (isReviewDue(history?.length ?? 0)) runReview();
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

  async function runReview() {
    setReviewLoading(true);
    setActivePanel('review');
    try {
      const res = await fetch('/api/agent/quarterly-review', {
        method: 'POST',
        headers: Auth.getAuthHeaders(),
        body: JSON.stringify({ plan, planHistory: loadHistory() }),
      });
      if (res.ok) {
        const { report } = await res.json();
        saveReviewReport(report);
        markReviewRan();
        setReviewReport(report);
        setReviewSeen(false); // mark as fresh — chip will get the "new" dot
      }
    } catch {
      // silent
    } finally {
      setReviewLoading(false);
    }
  }

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

  // Toast supports an optional `undo` action that renders an inline button.
  // Uses a single ref'd timer so rapid back-to-back toasts don't leak handles.
  function showToast(text, options = {}) {
    const { durationMs = 3000, undo } = options;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const payload = { text, undo };
    setToast(payload);
    toastTimerRef.current = setTimeout(() => {
      setToast((t) => (t === payload ? null : t));
      toastTimerRef.current = null;
    }, durationMs);
  }

  function undoProposal(proposal) {
    const entry = pendingUndo.get(proposal.id);
    if (!entry) return;
    try {
      // Revert the field to its pre-apply value
      if (entry.target.kind === 'planField') {
        updatePlan(entry.target.key, entry.previousValue);
      } else if (entry.target.kind === 'incomeSource') {
        const src = (plan.incomeSources || []).find((s) => s.id === entry.target.sourceId);
        if (src) {
          updateIncome(src.id, { ...src, [entry.target.subfield]: entry.previousValue });
        }
      }
      // Cancel the pending expiry timer
      const handle = undoTimersRef.current.get(proposal.id);
      if (handle) clearTimeout(handle);
      undoTimersRef.current.delete(proposal.id);
      // Remove from pendingUndo and from applied set so the button is
      // re-Apply-able if the user changes their mind again.
      setPendingUndo((prev) => {
        const next = new Map(prev);
        next.delete(proposal.id);
        return next;
      });
      setAppliedProposalIds((prev) => {
        const next = new Set(prev);
        next.delete(proposal.id);
        return next;
      });
      // Dismiss the toast immediately
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast(null);
      // Confirm with a short toast (no undo on the undo — that gets silly)
      showToast(`Undone — restored to ${String(entry.previousValue ?? '—')}.`, { durationMs: 2500 });
    } catch (err) {
      showToast(`Could not undo: ${err?.message || 'unknown error'}`, { durationMs: 3500 });
    }
  }

  // Read the LIVE current value of a proposal's target from the plan state
  // at the moment apply is clicked — not the value the LLM saw when it
  // generated the proposal. This catches the case where the user edited
  // the field in My Plan between when the AI suggested the change and when
  // they clicked Apply.
  function readLiveTargetValue(target) {
    if (!target) return undefined;
    if (target.kind === 'planField') {
      return plan?.[target.key];
    }
    if (target.kind === 'incomeSource') {
      const src = (plan?.incomeSources || []).find((s) => s.id === target.sourceId);
      return src?.[target.subfield];
    }
    return undefined;
  }

  // Loose equality: handles number-vs-string ("70" vs 70) and rounds floats
  // before comparing so we don't false-positive on float precision noise.
  function valuesDiffer(a, b) {
    if (a == null && b == null) return false;
    if (typeof a === 'number' && typeof b === 'number') {
      return Math.abs(a - b) > 0.001;
    }
    return String(a ?? '').trim() !== String(b ?? '').trim();
  }

  function applyProposal(proposal) {
    if (!proposal || !proposal.target) return;
    if (appliedProposalIds.has(proposal.id)) return;

    // Compare what the LLM saw vs. what the plan ACTUALLY contains right
    // now. If the user edited the field since the AI made the suggestion,
    // confirm before clobbering their edit.
    const liveValue = readLiveTargetValue(proposal.target);
    const llmSawValue = proposal.currentValue;
    const driftDetected =
      llmSawValue !== undefined && valuesDiffer(liveValue, llmSawValue);

    if (driftDetected) {
      const ok = window.confirm(
        `Heads up — you've changed this since the AI suggested it.\n\n` +
        `When the AI made the suggestion: ${String(llmSawValue)}\n` +
        `Your current value: ${String(liveValue)}\n` +
        `AI's proposed value: ${String(proposal.newValue)}\n\n` +
        `Apply the AI's value anyway (overwriting your edit)?`,
      );
      if (!ok) return;
    }

    // Snapshot the pre-apply value so Undo can restore it. Read from the
    // LIVE plan state, not the proposal's stale snapshot.
    const previousValue = readLiveTargetValue(proposal.target);

    try {
      if (proposal.target.kind === 'planField') {
        updatePlan(proposal.target.key, proposal.newValue);
      } else if (proposal.target.kind === 'incomeSource') {
        const src = (plan.incomeSources || []).find((s) => s.id === proposal.target.sourceId);
        if (!src) {
          showToast('Could not find the income source on your plan.');
          return;
        }
        updateIncome(src.id, { ...src, [proposal.target.subfield]: proposal.newValue });
      }
      setAppliedProposalIds((prev) => {
        const next = new Set(prev);
        next.add(proposal.id);
        return next;
      });

      // Register an undo entry. Lives for 30s, then auto-expires and the
      // change becomes permanent (button settles to "✓ Applied").
      setPendingUndo((prev) => {
        const next = new Map(prev);
        next.set(proposal.id, { previousValue, target: proposal.target });
        return next;
      });
      const existing = undoTimersRef.current.get(proposal.id);
      if (existing) clearTimeout(existing);
      undoTimersRef.current.set(
        proposal.id,
        setTimeout(() => {
          setPendingUndo((prev) => {
            const next = new Map(prev);
            next.delete(proposal.id);
            return next;
          });
          undoTimersRef.current.delete(proposal.id);
        }, 30_000),
      );

      // Toast with inline Undo. Visible 5s; undo on the button persists
      // for the full 30s window.
      showToast(`Applied — ${proposal.applyLabel}.`, {
        durationMs: 5000,
        undo: () => undoProposal(proposal),
      });
    } catch (err) {
      showToast(`Could not apply: ${err?.message || 'unknown error'}`);
    }
  }

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
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.text, proposedChanges: data.proposedChanges || [] },
      ]);
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
      {/* What's New — replaced with a single-line tour offer. The
          feature catalogue lives in the Tour drawer, reachable from
          Settings even after dismissal. */}
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
            ✨ <strong>New here?</strong>{' '}
            <button
              onClick={() => setActivePanel('tour')}
              style={{
                background: 'transparent',
                color: 'var(--accent)',
                border: 'none',
                padding: 0,
                fontFamily: 'var(--sans)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Take the 30-second tour →
            </button>
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
          <Icon name="sparkles" size={20} style={{ marginRight: 8, color: 'var(--accent)' }} />
          AI Advisor
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
          <button onClick={() => togglePanel('insights')} style={chipStyle(activePanel === 'insights')} className="chip">
            <Icon name="chart-pie" size={14} />
            <span>{insightCount} insight{insightCount === 1 ? '' : 's'}</span>
          </button>
        )}

        {(reviewReport || reviewLoading) && (
          <button
            onClick={() => {
              togglePanel('review');
              setReviewSeen(true);
            }}
            style={chipStyle(activePanel === 'review')}
            className="chip"
          >
            {!reviewSeen && reviewReport && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'inline-block',
                }}
              />
            )}
            <Icon name="calendar" size={14} />
            <span>
              {reviewLoading
                ? 'Review running…'
                : reviewReport?.framing === 'quarterly'
                ? 'Quarterly review'
                : reviewReport?.framing === 'monthly'
                ? 'Monthly review'
                : 'Progress review'}
            </span>
          </button>
        )}

        {reExcluded && (
          <button onClick={() => togglePanel('re')} style={chipStyle(activePanel === 're')} className="chip">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#f59e0b',
                display: 'inline-block',
              }}
            />
            <Icon name="home" size={14} />
            <span>{reLabel} RE excluded</span>
          </button>
        )}

        <button onClick={runOptimization} style={chipStyle(false, true)} disabled={optimizeLoading} className="chip">
          <Icon name="bolt" size={14} />
          <span>{optimizeLoading ? 'Optimizing…' : 'Optimize'}</span>
        </button>

        <button
          onClick={() => togglePanel('settings')}
          style={chipStyle(activePanel === 'settings')}
          aria-label="Settings"
          title="Settings"
          className="chip"
        >
          <Icon name="cog" size={14} />
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
              {activePanel === 'review' &&
                (reviewReport?.framing === 'quarterly'
                  ? 'Quarterly Review'
                  : reviewReport?.framing === 'monthly'
                  ? 'Monthly Progress'
                  : 'Progress Review')}
              {activePanel === 'settings' && 'Settings'}
              {activePanel === 'tour' && '✨ AI Advisor — 30-second tour'}
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
                  <SequencedLoader
                    messages={[
                      'Reading your plan…',
                      'Running the projection…',
                      'Checking the Fidelity benchmark…',
                      'Modeling SS claiming ages…',
                      'Synthesizing your health report…',
                    ]}
                  />
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

            {/* Review panel — progress / monthly / quarterly */}
            {activePanel === 'review' && (
              <div>
                {reviewLoading && (
                  <SequencedLoader
                    messages={[
                      'Loading your snapshot history…',
                      'Comparing against your last review…',
                      'Re-running the projection…',
                      'Identifying what changed…',
                      'Writing your progress summary…',
                    ]}
                  />
                )}
                {!reviewLoading && reviewReport && (() => {
                  const trendColor =
                    reviewReport.trend === 'improving' ? 'var(--accent)'
                    : reviewReport.trend === 'declining' ? '#f59e0b'
                    : 'var(--text-muted)';
                  const trendIcon =
                    reviewReport.trend === 'improving' ? '↗'
                    : reviewReport.trend === 'declining' ? '↘'
                    : '→';
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 18, color: trendColor, fontWeight: 700 }}>{trendIcon}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
                          {reviewReport.headline}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                        Looking at the last {reviewReport.periodDays} day{reviewReport.periodDays === 1 ? '' : 's'} of your plan history.
                      </div>

                      {reviewReport.metrics && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                          {[
                            {
                              label: 'Money lasts to',
                              before: reviewReport.metrics.moneyLastsAge?.before,
                              after: reviewReport.metrics.moneyLastsAge?.after,
                              fmt: (v) => v == null ? '—' : `Age ${v}`,
                            },
                            {
                              label: 'Portfolio at retire',
                              before: reviewReport.metrics.portfolioAtRetire?.before,
                              after: reviewReport.metrics.portfolioAtRetire?.after,
                              fmt: (v) => v == null ? '—' : `$${Math.round((v || 0) / 1000)}K`,
                            },
                          ].map(({ label, before, after, fmt: f }) => (
                            <div key={label} style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 8px' }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'line-through', display: 'inline-block', marginRight: 6 }}>
                                {f(before)}
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                                {f(after)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {reviewReport.changes?.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                            What changed
                          </div>
                          {reviewReport.changes.slice(0, 5).map((c, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 12 }}>
                              <span style={{ color: c.significance === 'major' ? 'var(--accent)' : 'var(--text-muted)' }}>
                                {c.significance === 'major' ? '●' : '○'}
                              </span>
                              <span style={{ flex: 1, color: 'var(--text)' }}>
                                <strong>{c.field}:</strong> {c.before} → {c.after}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {reviewReport.topRecommendation && (
                        <div style={{
                          background: 'var(--bg)',
                          borderLeft: '3px solid var(--accent)',
                          padding: '8px 10px',
                          borderRadius: 6,
                          marginBottom: 10,
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                            Next action
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text)' }}>
                            {reviewReport.topRecommendation}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Next review in {reviewReport.nextReviewInDays} days
                        </span>
                        <button
                          onClick={runReview}
                          style={{
                            background: 'transparent',
                            color: 'var(--accent)',
                            border: '1px solid var(--accent)',
                            borderRadius: 8,
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: 'var(--sans)',
                            cursor: 'pointer',
                          }}
                        >
                          Refresh now
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Optimize panel */}
            {activePanel === 'optimize' && (
              <div>
                {optimizeLoading && (
                  <SequencedLoader
                    messages={[
                      'Reading your plan…',
                      'Modeling tax impact…',
                      'Comparing Social Security claiming ages…',
                      'Testing Roth conversion ladders…',
                      'Ranking actions by dollar impact…',
                    ]}
                  />
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
                          {
                            label: 'Money lasts (now)',
                            value: optimizeReport.keyMetrics.currentMoneyLastsAge,
                            format: (v) => v == null ? '—' : `Age ${Math.round(v)}`,
                          },
                          {
                            label: 'Money lasts (optimized)',
                            value: optimizeReport.keyMetrics.optimizedMoneyLastsAge,
                            format: (v) => v == null ? '—' : `Age ${Math.round(v)}`,
                          },
                          {
                            label: 'Lifetime tax (now)',
                            value: optimizeReport.keyMetrics.currentLifetimeTax || 0,
                            format: (v) => `$${Math.round(v / 1000)}K`,
                          },
                          {
                            label: 'Lifetime tax (optimized)',
                            value: optimizeReport.keyMetrics.optimizedLifetimeTax || 0,
                            format: (v) => `$${Math.round(v / 1000)}K`,
                          },
                        ].map(({ label, value, format }) => (
                          <div key={label} style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 8px' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                              {value == null ? '—' : <AnimatedNumber value={value} format={format} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {optimizeReport.reasoningSteps?.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <button
                          onClick={() => setReasoningOpen((v) => !v)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          aria-expanded={reasoningOpen}
                        >
                          <span style={{ display: 'inline-block', transform: reasoningOpen ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}>▸</span>
                          See reasoning ({optimizeReport.reasoningSteps.length} steps)
                        </button>
                        {reasoningOpen && (
                          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {optimizeReport.reasoningSteps.map((s) => (
                              <div
                                key={s.step}
                                style={{
                                  display: 'flex',
                                  gap: 8,
                                  background: 'var(--bg)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 6,
                                  padding: '6px 8px',
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: 'var(--text-muted)',
                                    minWidth: 16,
                                    lineHeight: '16px',
                                  }}
                                >
                                  {s.step}.
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, color: 'var(--text)' }}>
                                    {s.action}
                                    {s.finding && (
                                      <>
                                        {' — '}
                                        <strong>{s.finding}</strong>
                                      </>
                                    )}
                                  </div>
                                  {s.nextAction && (
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                      → {s.nextAction}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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

            {/* Tour panel — the actual feature catalogue that used to live
                in the banner. Reachable from "New here? Take the tour" AND
                from Settings → "Show tour" so dismissal isn't permanent. */}
            {activePanel === 'tour' && (
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 12px', color: 'var(--text-muted)' }}>
                  The AI Advisor reads your live retirement plan and runs real calculations on your numbers. Five things to know:
                </p>
                <ol style={{ margin: '0 0 12px', paddingLeft: 20 }}>
                  <li><strong>Real plan calculations</strong> — Ask "am I on track" or "what if I retire at 62" and the AI runs the actual projection engine, not a generic answer.</li>
                  <li><strong>⚡ Optimize My Plan</strong> — Click the green chip above for a multi-step analysis (SS timing + Roth conversion + withdrawal order) with dollar impact per change.</li>
                  <li><strong>Plan health</strong> — Color-coded chip auto-runs every 7 days. Green = on track, yellow = needs attention.</li>
                  <li><strong>Portfolio insights</strong> — Proactive recommendations on tax diversification, concentration, cash drag, etc.</li>
                  <li><strong>Apply to My Plan</strong> — When the AI suggests a specific change ("claim SS at 70"), an inline button writes it to your plan with one click.</li>
                </ol>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  Educational tool only — not financial advice. Your data stays in your browser unless you sign in.
                </p>
              </div>
            )}

            {/* Settings panel */}
            {activePanel === 'settings' && (
              <div>
                <div style={{ marginBottom: 18 }}>
                  <button
                    onClick={() => setActivePanel('tour')}
                    style={{
                      background: 'transparent',
                      color: 'var(--accent)',
                      border: '1px solid var(--accent)',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'var(--sans)',
                      cursor: 'pointer',
                    }}
                  >
                    ✨ Show tour
                  </button>
                </div>
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

                <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                    🤖 Replay setup
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                    Re-open the onboarding chooser to walk through plan setup again. Your existing plan stays — you can update fields conversationally instead of editing the form.
                  </div>
                  <button
                    onClick={() => {
                      setActivePanel(null);
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new Event('replay-onboarding'));
                      }
                    }}
                    style={{
                      background: 'transparent',
                      color: 'var(--accent)',
                      border: '1px solid var(--accent)',
                      borderRadius: 8,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'var(--sans)',
                      cursor: 'pointer',
                    }}
                  >
                    Replay onboarding
                  </button>
                </div>
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
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    gap: 6,
                    maxWidth: '80%',
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      background:
                        msg.role === 'user'
                          ? 'linear-gradient(135deg, var(--accent), #2dd4a0)'
                          : 'var(--bg2)',
                      color: msg.role === 'user' ? 'var(--bg)' : 'var(--text)',
                      padding: '10px 14px',
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      fontSize: 14,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'var(--sans)',
                    }}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'assistant' && msg.proposedChanges?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                      {msg.proposedChanges.map((p) => {
                        const applied = appliedProposalIds.has(p.id);
                        const canUndo = applied && pendingUndo.has(p.id);
                        // Show the LIVE value (not the LLM's snapshot). If
                        // the user edited the field since the AI suggested
                        // the change, the chip below the button surfaces
                        // the drift so they're not surprised by the confirm.
                        const liveValue = readLiveTargetValue(p.target);
                        const llmSaw = p.currentValue;
                        const drift =
                          !applied && llmSaw !== undefined && valuesDiffer(liveValue, llmSaw);
                        return (
                          <div
                            key={p.id}
                            style={{
                              display: 'flex',
                              alignItems: 'stretch',
                              gap: 0,
                              borderRadius: 10,
                              border: `1px solid ${applied ? 'var(--border)' : 'var(--accent)'}`,
                              overflow: 'hidden',
                            }}
                          >
                            <button
                              onClick={() => applyProposal(p)}
                              disabled={applied}
                              style={{
                                flex: 1,
                                textAlign: 'left',
                                background: applied ? 'var(--bg2)' : 'var(--accent-dim, rgba(16,185,129,0.10))',
                                color: applied ? 'var(--text-muted)' : 'var(--accent)',
                                border: 'none',
                                padding: '8px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                fontFamily: 'var(--sans)',
                                cursor: applied ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                              }}
                              title={drift ? `You changed this to ${String(liveValue)} since the AI suggested it.` : p.rationale}
                            >
                              <span>
                                {applied ? '✓ Applied: ' : 'Apply: '}
                                {p.applyLabel}
                                {liveValue != null && !applied && (
                                  <span style={{ color: drift ? 'var(--warn, #f59e0b)' : 'var(--text-muted)', fontWeight: 500, marginLeft: 6 }}>
                                    (currently {String(liveValue)}{drift ? ' — you edited this' : ''})
                                  </span>
                                )}
                              </span>
                              {!applied && <span aria-hidden>→</span>}
                            </button>
                            {canUndo && (
                              <button
                                onClick={() => undoProposal(p)}
                                aria-label="Undo this change"
                                style={{
                                  background: 'var(--bg)',
                                  color: 'var(--accent)',
                                  border: 'none',
                                  borderLeft: '1px solid var(--border)',
                                  padding: '0 14px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  fontFamily: 'var(--sans)',
                                  cursor: 'pointer',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                }}
                                title="Undo (within 30 seconds)"
                              >
                                Undo
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
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

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--accent)',
            color: 'var(--bg)',
            padding: toast.undo ? '8px 8px 8px 18px' : '10px 18px',
            borderRadius: 999,
            fontFamily: 'var(--sans)',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            maxWidth: 'calc(100vw - 48px)',
          }}
        >
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              onClick={() => {
                const fn = toast.undo;
                if (fn) fn();
              }}
              style={{
                background: 'var(--bg)',
                color: 'var(--accent)',
                border: 'none',
                borderRadius: 999,
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'var(--sans)',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes fade {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
