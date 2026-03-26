'use client';
export default function DonutLegend({ items, style }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', ...style }}>
      {items.map(item => (
        <div key={item.id || item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
          {item.label}{item.pct != null ? ` (${typeof item.pct === 'number' ? item.pct.toFixed(0) : item.pct}%)` : ''}
        </div>
      ))}
    </div>
  );
}
