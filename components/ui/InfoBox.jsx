'use client';

export default function InfoBox({ icon, title, children, color = 'var(--accent)', bgColor = 'var(--accent-dim)', style }) {
  return (
    <div
      className="info-box"
      style={{ background: bgColor, border: `1px solid ${color}22`, ...style }}
    >
      <div className="flex items-center gap-10 mb-8">
        <span className="f20">{icon}</span>
        <span className="serif f18" style={{ color }}>{title}</span>
      </div>
      <div className="muted f13 lh-loose">{children}</div>
    </div>
  );
}
