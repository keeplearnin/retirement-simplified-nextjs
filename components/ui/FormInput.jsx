'use client';
export default function FormInput({ value, onChange, placeholder, type = 'text', style, ...props }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none', width: '100%', ...style }}
      {...props}
    />
  );
}
