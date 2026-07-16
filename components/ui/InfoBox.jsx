'use client';

/**
 * Design note: this used to be a tinted, emoji-led callout (20px glyph +
 * colored serif title on a colored wash). Repeated at the top of every tab
 * it read as template noise. Now: quiet surface, one colored rule carrying
 * the accent, title in heading color. The `icon` prop is accepted for
 * backward compatibility but intentionally not rendered.
 */
export default function InfoBox({ icon, title, children, color = 'var(--accent)', bgColor, style }) {
  return (
    <div
      className="info-box"
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${color}`,
        ...style,
      }}
    >
      <div className="mb-8">
        <span className="serif f16" style={{ color: 'var(--heading, var(--text))', fontWeight: 600 }}>{title}</span>
      </div>
      <div className="muted f13 lh-loose">{children}</div>
    </div>
  );
}
