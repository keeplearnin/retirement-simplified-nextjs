'use client';

export default function Stat({ icon, label, value, sub, color = 'var(--accent)' }) {
  return (
    <div className="stat-card">
      <div className="f11 dim upcase mb-4">
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}{label}
      </div>
      <div className="serif lh-tight" style={{ fontSize: 28, color }}>{value}</div>
      {sub && <div className="f12 dim mt-4 lh-base">{sub}</div>}
    </div>
  );
}
