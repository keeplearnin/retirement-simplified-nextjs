'use client';
export default function FormSelect({ value, onChange, options, style, ...props }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none', ...style }}
      {...props}
    >
      {options.map(opt => typeof opt === 'string'
        ? <option key={opt} value={opt}>{opt}</option>
        : <option key={opt.value} value={opt.value}>{opt.label}</option>
      )}
    </select>
  );
}
