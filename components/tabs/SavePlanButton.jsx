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

  async function handleSave() {
    if (!planName.trim()) {
      setShowInput(true);
      return;
    }

    setSaving(true);
    try {
      const settings = getCurrentSettings();
      const plan = {
        id: `plan_${Date.now()}`,
        name: planName.trim(),
        updatedAt: new Date().toISOString(),
        ...settings,
      };

      if (user && isConfigured()) {
        // Authenticated: save to backend
        await API.savePlan(plan);
      }

      // Always save to localStorage (works for all users)
      const existing = JSON.parse(localStorage.getItem('rs_plans') || '[]');
      const idx = existing.findIndex(p => p.name === plan.name && p.type === plan.type);
      if (idx >= 0) {
        existing[idx] = plan; // update existing plan with same name+type
      } else {
        existing.unshift(plan); // add new
      }
      localStorage.setItem('rs_plans', JSON.stringify(existing));

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
      {showInput && (
        <input
          type="text"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder={`Name your ${tabName || 'plan'}...`}
          style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '8px 16px', color: 'var(--text)',
            fontSize: 13, fontFamily: 'var(--sans)', outline: 'none',
            flex: 1, minWidth: 0,
          }}
          autoFocus
        />
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: saved ? 'var(--accent)' : 'linear-gradient(135deg, rgba(52,211,153,0.1) 0%, rgba(96,165,250,0.08) 100%)',
          border: saved ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
          borderRadius: 20, padding: '8px 20px',
          color: saved ? '#fff' : 'var(--text-muted)',
          fontSize: 13, fontWeight: 600, fontFamily: 'var(--sans)',
          cursor: saving ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s', opacity: saving ? 0.6 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Plan'}
      </button>
    </div>
  );
}
