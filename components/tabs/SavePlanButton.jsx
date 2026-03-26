'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import API from '@/lib/api';
import { isConfigured } from '@/lib/auth';

export default function SavePlanButton({ getCurrentSettings, tabName }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [planName, setPlanName] = useState('');
  const [showInput, setShowInput] = useState(false);

  if (!user || !isConfigured()) return null;

  async function handleSave() {
    if (!planName.trim()) {
      setShowInput(true);
      return;
    }

    setSaving(true);
    try {
      await API.savePlan({ name: planName.trim(), ...getCurrentSettings() });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setShowInput(false);
        setPlanName('');
      }, 2000);
    } catch (err) {
      console.error('Failed to save plan:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {showInput && (
        <input
          type="text"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder={`Name your ${tabName || 'plan'}...`}
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '6px 14px',
            color: 'var(--text)',
            fontSize: 13,
            fontFamily: 'var(--sans)',
            outline: 'none',
            width: 180,
          }}
          autoFocus
        />
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: saved ? 'var(--accent)' : 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '6px 16px',
          color: saved ? 'var(--bg)' : 'var(--text-muted)',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--sans)',
          cursor: saving ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Plan'}
      </button>
    </div>
  );
}
