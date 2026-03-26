'use client';
export default function BracketButtons({ brackets, selected, onSelect, variant = 'filled', style }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...style }}>
      {brackets.map(b => {
        const isSelected = selected === b.rate;
        const btnStyle = variant === 'filled'
          ? {
              padding: '6px 12px',
              border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8,
              background: isSelected ? 'var(--accent)' : 'transparent',
              color: isSelected ? 'var(--bg)' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all .15s',
            }
          : {
              padding: '6px 12px',
              border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8,
              background: isSelected ? 'var(--accent-dim)' : 'transparent',
              color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all .15s',
            };
        return (
          <button key={b.rate} onClick={() => onSelect(b.rate)} style={btnStyle}>
            {b.label}
          </button>
        );
      })}
    </div>
  );
}
