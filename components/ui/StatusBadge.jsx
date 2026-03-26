'use client';
export function getStatusColor(value, thresholds = { good: 0.9, warn: 0.75 }) {
  if (value >= thresholds.good) return 'var(--accent)';
  if (value >= thresholds.warn) return 'var(--warn)';
  return 'var(--danger)';
}
export default function StatusBadge({ label, color, style }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)', background: color ? `${color}20` : 'var(--accent-dim)', color: color || 'var(--accent)', ...style }}>
      {label}
    </span>
  );
}
