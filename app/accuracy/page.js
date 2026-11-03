import { REFERENCE_CASES, caseResult } from '@/lib/referenceCases';

export const metadata = {
  title: 'How we check the math — Retire Simplified',
  description:
    'The retirement engine checked against hand-worked IRS and SSA examples, plus why our answer can differ from other retirement calculators.',
  alternates: { canonical: 'https://retiresimplified.com/accuracy' },
};

const REPO = 'https://github.com/keeplearnin/retirement-simplified-nextjs';

const fmtValue = (v, unit) => (unit === '%' ? `${v}%` : `$${v.toLocaleString('en-US')}`);

// Why two honest calculators can disagree about the same household. Each
// item names the choice we make, so a reader can line it up against
// whatever other tool they used.
const DIFFERENCES = [
  ['Taxes, every year', 'We work out each year’s federal and state tax, how much Social Security is taxed and required withdrawals, and flag the years Medicare surcharges apply (they are shown, not yet deducted from savings). Many calculators use one flat tax rate, or none, which usually makes plans look better than they are.'],
  ['What your return means', 'We treat your expected return as a long-run growth rate, so a steady 7% line is the middle outcome. Tools that treat 7% as the average of yearly returns show lower odds for the same number, because ups and downs drag compound growth below the yearly average.'],
  ['How much markets swing', 'Your plan stores only an expected return, so we read the size of yearly swings off typical stock/bond mixes: 7% is treated like a roughly 50/50 mix swinging about 9% a year. A tool that assumes an all-stock portfolio shows a much wider range.'],
  ['Healthcare and long-term care', 'Healthcare is included and inflates faster than other prices, and long-term care is added in the last years of the plan ($3,600/month in today’s dollars by default — you can change or remove it under Expenses). Many tools leave long-term care out.'],
  ['Spending over time', 'Retirement spending follows go-go, slow-go and no-go phases (100%, 85%, 70% of discretionary spending). Tools with flat inflation-adjusted spending show more spending late in life.'],
  ['What counts as failing', 'A market counts as failing if any year runs short of money — not only if the balance ends at $0.'],
  ['Real history', 'Our history check replays every real run of years since 1928 in its true order, but centered on your expected return. Tools such as FIRECalc and cFIREsim use the actual returns, which averaged more than 7% for most periods, so they often look kinder.'],
  ['Same answer every time', '500 markets with a fixed random seed: the same plan always gets the same percentage. Sampling alone moves the result by about ±3 points; your return, spending and retirement-age assumptions move it far more.'],
];

const h2 = { fontSize: 22, fontWeight: 400, fontFamily: 'var(--serif)', color: 'var(--heading)', margin: '40px 0 12px' };
const muted = { fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 };

export default function AccuracyPage() {
  const rows = REFERENCE_CASES.map(c => ({ ...c, actual: caseResult(c) }));
  const passing = rows.filter(r => r.actual === r.expected).length;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 24, paddingBottom: 60 }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 16px' }}>
        <a href="/" style={{ textDecoration: 'none', color: 'var(--heading)', fontFamily: 'var(--serif)', fontSize: 20 }}>
          Retire<span style={{ color: 'var(--accent)' }}>.</span>Simplified
        </a>

        <h1 style={{ fontSize: 34, fontWeight: 400, fontFamily: 'var(--serif)', color: 'var(--heading)', margin: '32px 0 10px' }}>
          How we check the math
        </h1>
        <p style={muted}>
          Retirement calculators often disagree, and you can’t trust a number you can’t check. Below are worked examples from
          IRS and SSA rules that you can verify by hand, with what our engine gets for each. They run as automated tests on every
          change to the code, and the code itself is <a href={REPO} style={{ color: 'var(--accent)' }}>open source</a>.
        </p>

        <h2 style={h2}>Checked against IRS and SSA rules</h2>
        <p style={{ ...muted, marginBottom: 16 }}>
          {passing} of {rows.length} match exactly.{' '}
          <a href={`${REPO}/blob/main/tests/referenceCases.test.js`} style={{ color: 'var(--accent)' }}>See the test</a>
          {' · '}
          <a href={`${REPO}/blob/main/lib/referenceCases.js`} style={{ color: 'var(--accent)' }}>See every case and its working</a>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map(r => (
            <section key={r.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{r.area}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'baseline', marginTop: 4 }}>
                <div style={{ fontSize: 16, color: 'var(--heading)', flex: '1 1 320px' }}>{r.question}</div>
                <div style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
                  Rule says <strong>{fmtValue(r.expected, r.unit)}</strong> · Engine{' '}
                  <strong style={{ color: r.actual === r.expected ? 'var(--accent)' : 'var(--danger)' }}>
                    {fmtValue(r.actual, r.unit)} {r.actual === r.expected ? '✓' : '✗'}
                  </strong>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, margin: '8px 0 6px' }}>{r.worked}</p>
              <a href={r.source.url} style={{ fontSize: 12, color: 'var(--accent)' }}>{r.source.label}</a>
            </section>
          ))}
        </div>

        <h2 style={h2}>Why our answer may differ from another tool</h2>
        <p style={{ ...muted, marginBottom: 16 }}>
          If another calculator gives you a different answer, it’s usually one of these choices. Neither has to be wrong — knowing
          which assumption differs tells you what to look at.
        </p>
        <dl style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: 0 }}>
          {DIFFERENCES.map(([term, desc]) => (
            <div key={term} style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <dt style={{ fontSize: 15, fontWeight: 600, color: 'var(--heading)', marginBottom: 4 }}>{term}</dt>
              <dd style={{ ...muted, margin: 0 }}>{desc}</dd>
            </div>
          ))}
        </dl>

        <p style={{ ...muted, marginTop: 40 }}>
          Every assumption and data source is listed on <a href="/methodology" style={{ color: 'var(--accent)' }}>How the math works</a>.
          Found a case where the engine is wrong? <a href={`${REPO}/issues`} style={{ color: 'var(--accent)' }}>Open an issue</a> with the inputs and the
          answer you expected.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 24, lineHeight: 1.6 }}>
          Educational planning estimates, not financial advice.
        </p>
      </div>
    </main>
  );
}
