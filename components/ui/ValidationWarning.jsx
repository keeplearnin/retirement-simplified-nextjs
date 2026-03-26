'use client';

export default function ValidationWarning({ warnings }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div style={{
      background: 'var(--warn-dim)', border: '1px solid var(--warn)',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 14,
    }}>
      {warnings.map((w, i) => (
        <div key={i} style={{ fontSize: 12, color: 'var(--warn)', fontFamily: 'var(--sans)', display: 'flex', gap: 6, alignItems: 'center', marginBottom: i < warnings.length - 1 ? 4 : 0 }}>
          <span>⚠️</span> {w}
        </div>
      ))}
    </div>
  );
}
