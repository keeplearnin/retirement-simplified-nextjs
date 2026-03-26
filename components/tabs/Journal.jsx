'use client';

import { useState, useEffect } from 'react';
import Slider from '@/components/ui/Slider';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import InfoBox from '@/components/ui/InfoBox';
import MiniChart from '@/components/ui/MiniChart';
import { useAuth } from '@/components/AuthProvider';
import API from '@/lib/api';
import { isConfigured } from '@/lib/auth';
import { fmt } from '@/lib/format';

const today = () => new Date().toISOString().split('T')[0];

const emptyForm = () => ({
  date: today(),
  totalSavings: 0,
  totalInvested: 0,
  netWorth: 0,
  monthlyContributions: 0,
  notes: '',
  accounts: [],
});

export default function Journal() {
  const { user, signIn } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [newAcct, setNewAcct] = useState({ name: '', balance: 0, type: 'retirement' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      try {
        const data = await API.listJournal();
        setEntries(data || []);
      } catch (e) {
        console.error('Failed to load journal:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.saveJournal(form);
      const data = await API.listJournal();
      setEntries(data || []);
      setForm(emptyForm());
      setShowForm(false);
    } catch (e) {
      console.error('Failed to save entry:', e);
    } finally {
      setSaving(false);
    }
  };

  const addAccount = () => {
    if (!newAcct.name.trim()) return;
    setForm(prev => ({ ...prev, accounts: [...prev.accounts, { ...newAcct }] }));
    setNewAcct({ name: '', balance: 0, type: 'retirement' });
  };

  const removeAccount = (idx) => {
    setForm(prev => ({ ...prev, accounts: prev.accounts.filter((_, i) => i !== idx) }));
  };

  if (!user) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📓</div>
          <div style={{ fontSize: 20, fontFamily: 'var(--serif)', color: 'var(--text)', marginBottom: 8 }}>
            Sign In to Track Your Progress
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Keep a journal of your financial progress. Track net worth, savings, and investments over time.
          </p>
          {isConfigured() && (
            <button
              onClick={() => signIn()}
              style={{
                padding: '10px 28px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'var(--serif)',
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading your data...
        </div>
      </Card>
    );
  }

  return (
    <div>
      <InfoBox icon="📈" title="Progress Journal" color="var(--info, #3b82f6)" bgColor="var(--info-dim, #3b82f611)">
        Track your financial journey over time. Record your savings, investments, and net worth to see how you&apos;re progressing toward your retirement goals.
      </InfoBox>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '8px 20px',
            background: showForm ? 'var(--border)' : 'var(--accent)',
            color: showForm ? 'var(--text)' : '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'var(--serif)',
          }}
        >
          {showForm ? 'Cancel' : '+ New Entry'}
        </button>
      </div>

      {showForm && (
        <Card style={{ marginBottom: 24 }}>
          <SectionLabel>New Journal Entry</SectionLabel>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
              style={{
                padding: '8px 12px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text)',
                fontSize: 13,
                width: '100%',
                maxWidth: 200,
              }}
            />
          </div>

          <Slider
            label="Total Savings"
            value={form.totalSavings}
            onChange={v => setForm(prev => ({ ...prev, totalSavings: v }))}
            min={0} max={2000000} step={1000}
            prefix="$" format={v => fmt(v).replace('$', '')}
          />
          <Slider
            label="Total Invested"
            value={form.totalInvested}
            onChange={v => setForm(prev => ({ ...prev, totalInvested: v }))}
            min={0} max={5000000} step={1000}
            prefix="$" format={v => fmt(v).replace('$', '')}
          />
          <Slider
            label="Net Worth"
            value={form.netWorth}
            onChange={v => setForm(prev => ({ ...prev, netWorth: v }))}
            min={0} max={10000000} step={5000}
            prefix="$" format={v => fmt(v).replace('$', '')}
          />
          <Slider
            label="Monthly Contributions"
            value={form.monthlyContributions}
            onChange={v => setForm(prev => ({ ...prev, monthlyContributions: v }))}
            min={0} max={20000} step={100}
            prefix="$" format={v => fmt(v).replace('$', '')}
          />

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any notes about this month&apos;s progress..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text)',
                fontSize: 13,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <SectionLabel>Account Breakdown</SectionLabel>
          {form.accounts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {form.accounts.map((acct, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--bg)',
                  borderRadius: 6,
                  marginBottom: 6,
                  border: '1px solid var(--border)',
                }}>
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>{acct.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>({acct.type})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--accent)' }}>{fmt(acct.balance)}</span>
                    <button
                      onClick={() => removeAccount(i)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14 }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 24 }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Account Name</label>
              <input
                type="text"
                value={newAcct.name}
                onChange={e => setNewAcct(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Vanguard 401(k)"
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  fontSize: 12,
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Balance</label>
              <input
                type="number"
                value={newAcct.balance}
                onChange={e => setNewAcct(prev => ({ ...prev, balance: Number(e.target.value) }))}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  fontSize: 12,
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Type</label>
              <select
                value={newAcct.type}
                onChange={e => setNewAcct(prev => ({ ...prev, type: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  fontSize: 12,
                }}
              >
                <option value="retirement">Retirement</option>
                <option value="brokerage">Brokerage</option>
                <option value="savings">Savings</option>
                <option value="crypto">Crypto</option>
                <option value="real-estate">Real Estate</option>
                <option value="other">Other</option>
              </select>
            </div>
            <button
              onClick={addAccount}
              style={{
                padding: '7px 14px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Add
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 28px',
              background: saving ? 'var(--border)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              cursor: saving ? 'default' : 'pointer',
              fontFamily: 'var(--serif)',
              width: '100%',
            }}
          >
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </Card>
      )}

      {entries.length >= 2 && (
        <>
          <SectionLabel>Net Worth Over Time</SectionLabel>
          <Card style={{ marginBottom: 24 }}>
            <MiniChart
              data={entries.slice().sort((a, b) => a.date.localeCompare(b.date))}
              lines={[
                { key: 'netWorth', label: 'Net Worth', color: 'var(--accent)' },
                { key: 'totalInvested', label: 'Invested', color: 'var(--warn, #f59e0b)', dash: '4 2' },
                { key: 'totalSavings', label: 'Savings', color: 'var(--good, #22c55e)', dash: '2 2' },
              ]}
            />
          </Card>
        </>
      )}

      <SectionLabel>Entries</SectionLabel>
      {entries.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
            No journal entries yet. Click &quot;+ New Entry&quot; to start tracking your progress.
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Date', 'Net Worth', 'Invested', 'Savings', 'Monthly', 'Notes'].map(h => (
                    <th key={h} style={{
                      textAlign: h === 'Date' || h === 'Notes' ? 'left' : 'right',
                      padding: '10px 12px',
                      color: 'var(--text-muted)',
                      fontWeight: 500,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.slice().sort((a, b) => b.date.localeCompare(a.date)).map((entry, i) => (
                  <tr key={entry.date || i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>
                      {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>
                      {fmt(entry.netWorth || 0)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text)' }}>
                      {fmt(entry.totalInvested || 0)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text)' }}>
                      {fmt(entry.totalSavings || 0)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                      {fmt(entry.monthlyContributions || 0)}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
