'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import { useAuth } from '@/components/AuthProvider';
import API from '@/lib/api';
import Auth from '@/lib/auth';
import { isConfigured } from '@/lib/auth';
import { fmt } from '@/lib/format';

function parseTimestamp(ts) {
  if (!ts || ts.length < 14) return null;
  const y = ts.slice(0, 4);
  const mo = ts.slice(4, 6);
  const d = ts.slice(6, 8);
  const h = ts.slice(8, 10);
  const mi = ts.slice(10, 12);
  const s = ts.slice(12, 14);
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
}

function formatDate(d) {
  if (!d || isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MyPlans() {
  const { user, signIn } = useAuth();
  const [plans, setPlans] = useState([]);
  const [mcHistory, setMcHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (user) {
          const [p, mc] = await Promise.all([API.listPlans(), API.listMonteCarlo()]);
          setPlans(p || []);
          setMcHistory(mc || []);
        } else {
          const savedPlans = localStorage.getItem('rs_plans');
          const savedMC = localStorage.getItem('rs_montecarlo');
          setPlans(savedPlans ? JSON.parse(savedPlans) : []);
          setMcHistory(savedMC ? JSON.parse(savedMC) : []);
        }
      } catch (e) {
        console.error('Failed to load data:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleDelete = async (plan) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;
    const pid = plan.planId || plan.id;
    if (user && plan.planId) {
      await API.deletePlan(plan.planId);
    }
    const updated = plans.filter(p => (p.planId || p.id) !== pid);
    localStorage.setItem('rs_plans', JSON.stringify(updated));
    setPlans(updated);
  };

  const handleLoad = (plan) => {
    const tabMap = {
      growth_projector: { tab: 'growth', storageKey: 'growth_projector' },
      portfolio_builder: { tab: 'portfolio', storageKey: 'portfolio_builder' },
    };
    const mapping = tabMap[plan.type];
    if (!mapping) return;

    // Extract the input fields (remove computed/meta fields)
    const { id, name, updatedAt, type, currentSavings, monthlyContribution, projectedTotal,
            allocation, totalStock, totalBond, totalGold, blendedExpense, ...inputFields } = plan;

    // Write to localStorage for the tab to pick up
    localStorage.setItem(mapping.storageKey, JSON.stringify(inputFields));

    // Navigate to the tab
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: mapping.tab }));
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading your data...
        </div>
      </Card>
    );
  }

  const firstName = user?.given_name || user?.name?.split(' ')[0] || 'there';

  return (
    <div>
      <InfoBox icon="📋" title="Your Dashboard">
        Welcome back, {firstName}! You have {plans.length} saved plan{plans.length !== 1 ? 's' : ''} and {mcHistory.length} Monte Carlo simulation{mcHistory.length !== 1 ? 's' : ''}.
      </InfoBox>

      <SectionLabel>Saved Plans</SectionLabel>
      {plans.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
            No saved plans yet. Use the Save Plan button in Growth Projector or Portfolio Builder to save your configuration here.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
          {plans.map(plan => {
            const pid = plan.planId || plan.id;
            const typeLabel = plan.type === 'growth_projector' ? 'Growth' : plan.type === 'portfolio_builder' ? 'Portfolio' : '';
            return (
            <Card key={pid}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 16, fontFamily: 'var(--serif)', color: 'var(--text)' }}>
                      {plan.name || 'Untitled Plan'}
                    </div>
                    {typeLabel && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: plan.type === 'growth_projector' ? 'rgba(52,211,153,0.1)' : 'rgba(96,165,250,0.1)', color: plan.type === 'growth_projector' ? 'var(--accent)' : 'var(--blue)' }}>
                        {typeLabel}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, marginBottom: 12 }}>
                    Updated {formatDate(plan.updatedAt ? new Date(plan.updatedAt) : null)}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(plan)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, padding: '2px 6px', borderRadius: 4 }}
                  title="Delete plan"
                >
                  ✕
                </button>
              </div>
              {plan.currentSavings != null && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Savings: {fmt(plan.currentSavings)}
                  {plan.projectedTotal ? ` → ${fmt(plan.projectedTotal)} projected` : ''}
                </div>
              )}
              {plan.monthlyContribution != null && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Monthly contribution: {fmt(plan.monthlyContribution)}
                </div>
              )}
              {plan.type && (
                <button
                  onClick={() => handleLoad(plan)}
                  style={{
                    marginTop: 10, width: '100%', padding: '8px 0', borderRadius: 8,
                    background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
                    color: 'var(--accent)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--sans)',
                    cursor: 'pointer', transition: 'all .2s',
                  }}
                >
                  Load Plan
                </button>
              )}
            </Card>
            );
          })}
        </div>
      )}

      <SectionLabel>Monte Carlo History</SectionLabel>
      {mcHistory.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
            No simulations yet. Run a Monte Carlo simulation to see your results here.
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Plan</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Success Rate</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Runs</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Median at Retirement</th>
                </tr>
              </thead>
              <tbody>
                {mcHistory.map((mc, i) => {
                  const date = parseTimestamp(mc.timestamp);
                  const rate = mc.successRate != null ? mc.successRate : 0;
                  const rateColor = rate >= 80 ? 'var(--good, #22c55e)' : rate >= 50 ? 'var(--warn, #f59e0b)' : 'var(--bad, #ef4444)';
                  return (
                    <tr key={mc.timestamp || i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{formatDate(date)}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{mc.planName || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: rateColor }}>{rate}%</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{mc.runs?.toLocaleString() || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text)' }}>{mc.medianAtRetirement != null ? fmt(mc.medianAtRetirement) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
