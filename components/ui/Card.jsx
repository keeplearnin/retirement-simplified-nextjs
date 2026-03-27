'use client';

export default function Card({ children, style, glow, variant }) {
  const variantClass = variant === 'input' ? ' card-input' : variant === 'output' ? ' card-output' : '';
  return (
    <div
      className={`card${glow ? ' card-glow' : ''}${variantClass}`}
      style={{ ...(glow ? { borderColor: glow } : {}), boxShadow: glow ? `0 0 30px ${glow}22` : undefined, ...style }}
    >
      {children}
    </div>
  );
}
