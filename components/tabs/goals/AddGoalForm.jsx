'use client';

import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import { GOAL_TYPES } from './goalHelpers';

export default function AddGoalForm({ onSelect, onCancel }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Choose a Goal Type</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        {Object.entries(GOAL_TYPES).map(([key, def]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
              borderRadius: 'var(--radius)', border: `1px solid ${def.color}33`,
              background: def.dimColor, cursor: 'pointer', color: def.color,
              fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)', transition: 'border-color .2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = def.color}
            onMouseLeave={e => e.currentTarget.style.borderColor = `${def.color}33`}
          >
            <span style={{ fontSize: 22 }}>{def.icon}</span>
            {def.label}
          </button>
        ))}
      </div>
      <button onClick={onCancel} style={{
        marginTop: 10, width: '100%', padding: '8px 0', background: 'none',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--sans)',
      }}>Cancel</button>
    </Card>
  );
}
