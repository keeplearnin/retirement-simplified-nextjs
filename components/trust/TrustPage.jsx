// Shared shell for the trust pages (/accuracy's look): wordmark, serif title,
// muted lead, and the small-print footer. Keeps the three pages consistent
// without touching /accuracy, which has its own data-driven body.

export const REPO = 'https://github.com/keeplearnin/retirement-simplified-nextjs';

export const h2 = { fontSize: 22, fontWeight: 400, fontFamily: 'var(--serif)', color: 'var(--heading)', margin: '40px 0 12px' };
export const muted = { fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 };
export const body = { fontSize: 15, color: 'var(--text)', lineHeight: 1.65, margin: '0 0 12px' };
export const link = { color: 'var(--accent)' };

export function Rule({ n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--accent)', lineHeight: 1, minWidth: 24 }}>{n}</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--heading)', marginBottom: 4 }}>{title}</div>
        <p style={{ ...muted, margin: 0 }}>{children}</p>
      </div>
    </div>
  );
}

export function Item({ title, children }) {
  return (
    <li style={{ ...muted, marginBottom: 8 }}>
      <strong style={{ color: 'var(--heading)', fontWeight: 600 }}>{title}</strong> {children}
    </li>
  );
}

export default function TrustPage({ title, lead, children }) {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 24, paddingBottom: 60 }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 16px' }}>
        <a href="/" style={{ textDecoration: 'none', color: 'var(--heading)', fontFamily: 'var(--serif)', fontSize: 20 }}>
          Retire<span style={{ color: 'var(--accent)' }}>.</span>Simplified
        </a>
        <h1 style={{ fontSize: 34, fontWeight: 400, fontFamily: 'var(--serif)', color: 'var(--heading)', margin: '32px 0 10px' }}>
          {title}
        </h1>
        <p style={muted}>{lead}</p>
        {children}
        <p style={{ ...muted, marginTop: 40 }}>
          See also <a href="/methodology" style={link}>How the math works</a>, <a href="/accuracy" style={link}>How we check it</a>,{' '}
          <a href="/how-it-works" style={link}>How it works</a> and <a href="/assistant-rules" style={link}>What the assistant will and won’t do</a>.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 24, lineHeight: 1.6 }}>
          Educational planning estimates, not financial advice.
        </p>
      </div>
    </main>
  );
}
