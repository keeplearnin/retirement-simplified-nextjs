'use client';

// A labeled figure. Pass `total` for a bottom-line number: it gets the
// accounting double underline. Use it only for true totals, so the mark
// keeps its meaning.
export default function Stat({ icon, label, value, sub, color = 'var(--heading)', total = false }) {
  return (
    <div className="stat-card">
      <div className="f12 muted fw6 mb-6">
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}{label}
      </div>
      <div className="serif lh-tight" style={{ fontSize: 28, fontWeight: 750, color }}>
        {total ? <span className="total">{value}</span> : value}
      </div>
      {sub && <div className="f12 dim mt-8 lh-base">{sub}</div>}
    </div>
  );
}
