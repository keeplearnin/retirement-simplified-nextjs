'use client';

export default function Card({ children, style, glow }) {
  return (
    <div
      className={`card${glow ? ' card-glow' : ''}`}
      style={{ ...(glow ? { borderColor: glow } : {}), boxShadow: glow ? `0 0 30px ${glow}22` : 'none', ...style }}
    >
      {children}
    </div>
  );
}
