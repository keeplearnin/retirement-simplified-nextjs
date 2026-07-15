'use client';

import { useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import Button from '@/components/ui/Button';
import MiniChart from '@/components/ui/MiniChart';
import { fmt } from '@/lib/format';
import { usePlan } from '@/components/PlanProvider';
import { useLocalState } from '@/lib/useLocalState';
import { computeProjection } from '@/lib/computeProjection';

const SCENARIO_COLORS = ['var(--accent)', 'var(--blue)', 'var(--purple, #8b5cf6)'];
const MAX_COMPARE = 3;

function metricRows(results) {
  const covered = (r) => r.proj.moneyLastsAge >= (r.plan.longevityAge || 95);
  return [
    { label: 'Retire at', value: (r) => `Age ${r.plan.retireAge}` },
    { label: 'Money lasts to', value: (r) => `Age ${r.proj.moneyLastsAge}`, highlight: (r) => (covered(r) ? 'var(--accent)' : 'var(--danger)') },
    { label: 'Portfolio at retirement', value: (r) => fmt(r.proj.portfolioAtRetire) },
    { label: 'Lifetime tax', value: (r) => fmt(r.proj.totalLifetimeTax) },
    { label: 'Net lifetime resources', value: (r) => fmt(r.proj.totalLifetimeIncome - r.proj.totalLifetimeTax) },
    { label: 'Left at end of plan', value: (r) => fmt(r.proj.finalBalance) },
  ].map((row) => ({ ...row, cells: results.map((r) => ({ text: row.value(r), color: row.highlight ? row.highlight(r) : undefined })) }));
}

export default function Scenarios() {
  const { plan, bulkUpdate } = usePlan();
  const [saved, setSaved] = useLocalState('rs-scenarios-v1', []);
  const [name, setName] = useState('');
  // Persisted so the comparison survives tab switches and reloads.
  const [selectedIds, setSelectedIds] = useLocalState('rs-scenarios-selected-v1', []);

  function saveCurrent() {
    const label = name.trim() || `Scenario ${saved.length + 1}`;
    const scenario = { id: Date.now(), name: label, savedAt: new Date().toISOString().slice(0, 10), plan: { ...plan } };
    setSaved((prev) => [...prev, scenario]);
    setName('');
    setSelectedIds((ids) => (ids.length < MAX_COMPARE - 1 ? [...ids, scenario.id] : ids));
  }

  function removeScenario(id) {
    setSaved((prev) => prev.filter((s) => s.id !== id));
    setSelectedIds((ids) => ids.filter((x) => x !== id));
  }

  function toggleSelect(id) {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < MAX_COMPARE - 1 ? [...ids, id] : ids
    );
  }

  // "Current plan" is always the first column; up to two saved scenarios join it.
  const compared = useMemo(() => {
    const entries = [
      { id: 'current', name: 'Current plan', plan },
      ...saved.filter((s) => selectedIds.includes(s.id)),
    ];
    return entries.map((e, i) => {
      try {
        return { ...e, color: SCENARIO_COLORS[i], proj: computeProjection(e.plan) };
      } catch {
        return null;
      }
    }).filter(Boolean);
  }, [plan, saved, selectedIds]);

  const chartData = useMemo(() => {
    const maxLen = Math.max(...compared.map((c) => c.proj.combined.length));
    const out = [];
    for (let i = 0; i < maxLen; i++) {
      const point = { i };
      compared.forEach((c, idx) => {
        point[`s${idx}`] = c.proj.combined[i]?.portfolioEndBalance ?? 0;
      });
      out.push(point);
    }
    return out;
  }, [compared]);

  const rows = useMemo(() => metricRows(compared), [compared]);

  return (
    <div className="fade-up">
      <InfoBox icon="🔀" title="Scenario Comparison" color="var(--blue)" bgColor="rgba(96,165,250,0.08)">
        Snapshot your plan, change anything (retire earlier, sell the rental, move states), snapshot again,
        and compare futures side-by-side. Every column runs your full tax-aware projection — not a simplified curve.
      </InfoBox>

      {/* Save + manage */}
      <Card style={{ marginTop: 16 }}>
        <SectionLabel icon="📸">Snapshot Current Plan</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveCurrent()}
            placeholder={`e.g. "Retire at ${plan.retireAge - 3}" or "Move to Texas"`}
            style={{
              flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg2)',
              color: 'var(--text)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none',
            }}
          />
          <Button variant="primary" size="sm" onClick={saveCurrent}>Save scenario</Button>
        </div>

        {saved.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
            {saved.map((s) => {
              const isSelected = selectedIds.includes(s.id);
              const atCapacity = !isSelected && selectedIds.length >= MAX_COMPARE - 1;
              return (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  borderRadius: 8, border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  background: isSelected ? 'var(--accent-dim, rgba(16,185,129,0.06))' : 'var(--bg2)',
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: atCapacity ? 'not-allowed' : 'pointer', opacity: atCapacity ? 0.5 : 1 }}>
                    <input type="checkbox" checked={isSelected} disabled={atCapacity} onChange={() => toggleSelect(s.id)} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--sans)' }}>{s.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      saved {s.savedAt} · retire at {s.plan.retireAge} · {s.plan.stateCode}
                    </span>
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => { bulkUpdate(s.plan); }}>Load into plan</Button>
                  <Button variant="ghost" size="sm" onClick={() => removeScenario(s.id)} aria-label={`Delete ${s.name}`}>✕</Button>
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              Check up to {MAX_COMPARE - 1} scenarios to compare against your current plan.
            </div>
          </div>
        )}
      </Card>

      {/* Comparison table */}
      {compared.length > 1 && (
        <>
          <Card style={{ marginTop: 16 }}>
            <SectionLabel icon="⚖️">Side by Side</SectionLabel>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480, fontFamily: 'var(--sans)' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px 8px 0', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Metric</th>
                    {compared.map((c) => (
                      <th key={c.id} style={{ textAlign: 'right', padding: '8px 12px', fontSize: 13, fontWeight: 700, color: c.color }}>
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 12px 9px 0', fontSize: 12.5, color: 'var(--text-muted)' }}>{row.label}</td>
                      {row.cells.map((cell, i) => (
                        <td key={i} style={{ textAlign: 'right', padding: '9px 12px', fontSize: 13.5, fontWeight: 600, color: cell.color || 'var(--text)' }}>
                          {cell.text}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card style={{ marginTop: 16 }}>
            <SectionLabel>Portfolio Over Time</SectionLabel>
            <MiniChart
              data={chartData}
              height={320}
              lines={compared.map((c, i) => ({ key: `s${i}`, color: c.color, label: c.name, width: 2.5 }))}
            />
          </Card>
        </>
      )}

      {saved.length === 0 && (
        <Card style={{ marginTop: 16, textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔀</div>
          <div style={{ fontSize: 16, fontFamily: 'var(--serif)', color: 'var(--text-muted)' }}>
            No saved scenarios yet
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.6, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
            Save your plan as it is now, then tweak it in My Plan (retirement age, state, spending)
            and save again — come back here to compare the two futures.
          </div>
        </Card>
      )}
    </div>
  );
}
