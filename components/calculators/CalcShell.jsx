'use client';

/**
 * CalcShell — shared chrome for the standalone SEO calculator pages.
 *
 * These pages are entry points from search: no plan, no auth, no app state.
 * Consistent header (brand → home), a footer CTA into the full planner,
 * and cross-links between calculators.
 */

const CALCULATORS = [
  { slug: 'irmaa-cliff-checker', label: 'IRMAA Cliff Checker' },
  { slug: 'tax-torpedo', label: 'Social Security Tax Torpedo' },
  { slug: 'social-security-break-even', label: 'SS Break-Even Calculator' },
];

export default function CalcShell({ slug, title, intro, children }) {
  const others = CALCULATORS.filter((c) => c.slug !== slug);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 48px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 14px', flexWrap: 'wrap', gap: 12, borderBottom: '4px double var(--rule)' }}>
        <a href="/" style={{ textDecoration: 'none', color: 'var(--heading)' }}>
          <span className="brand-name" style={{ fontSize: 17 }}>Retire<span className="dot">.</span>Simplified</span>
        </a>
        <a href="/" className="mast-btn">Open the free planner</a>
      </header>

      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 750, color: 'var(--heading)', lineHeight: 1.2, marginTop: 28, textWrap: 'balance' }}>{title}</h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65, marginTop: 10, maxWidth: 640 }}>{intro}</p>

      <div style={{ marginTop: 24 }}>{children}</div>

      {/* CTA into the app */}
      <div style={{
        marginTop: 32, padding: '20px 24px', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', borderTop: '3px solid var(--accent)', background: 'var(--card)',
      }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--text)', fontWeight: 700 }}>
          This is one number. Your retirement is a system.
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 6 }}>
          The free planner runs this calculation inside your full picture — taxes, Social Security,
          RMDs, and withdrawals together — and returns a ranked list of moves worth real dollars,
          each with the math shown.
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block', marginTop: 12, padding: '10px 20px', borderRadius: 'var(--radius-sm)',
            background: 'var(--accent)', color: 'var(--card)', textDecoration: 'none',
            fontSize: 13, fontWeight: 700, fontFamily: 'var(--sans)',
          }}
        >
          Build my free plan →
        </a>
      </div>

      <footer style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>More free calculators</div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12 }}>
          {others.map((c) => (
            <a key={c.slug} href={`/calculators/${c.slug}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
              {c.label}
            </a>
          ))}
          <a href="/verdict" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>Quick Verdict</a>
          <a href="/methodology" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>How the math works</a>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 16, lineHeight: 1.7, opacity: 0.7 }}>
          Educational tool, not financial advice. Figures use 2026 IRS/SSA/CMS data. Free and open source (MIT).
        </p>
      </footer>
    </div>
  );
}
