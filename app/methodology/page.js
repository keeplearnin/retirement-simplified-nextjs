'use client';

// Methodology page — documents the assumptions, data sources, and known
// simplifications so users (and their advisors) can verify the math.

const LAST_REVIEWED = 'May 2026';

const sections = [
  {
    title: 'Tax brackets, deductions, and capital gains',
    body: [
      "Federal income tax brackets, standard deduction, additional standard deduction for age 65+, and long-term capital-gains brackets all use 2026 figures from IRS Rev. Proc. 2025-32.",
      "Marginal rates and bracket thresholds update each January when the IRS publishes new inflation adjustments.",
    ],
    sources: [
      { label: 'IRS Rev. Proc. 2025-32 (2026 inflation adjustments)', url: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill' },
      { label: 'Tax Foundation: 2026 federal brackets', url: 'https://taxfoundation.org/data/all/federal/2026-tax-brackets/' },
    ],
  },
  {
    title: 'Retirement contribution limits',
    body: [
      "401(k) elective deferral: $24,500 (2026); age-50+ catch-up: $8,000; SECURE 2.0 super catch-up for ages 60–63: $11,250.",
      "IRA contribution: $7,500; age-50+ catch-up: $1,100. HSA: $4,400 individual / $8,750 family; age-55+ catch-up: $1,000.",
    ],
    sources: [
      { label: 'IRS Notice 2025-67 (2026 retirement plan limits)', url: 'https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500' },
    ],
  },
  {
    title: 'Social Security',
    body: [
      "Benefit calculations use the 2026 PIA bend points ($1,286 / $7,749) and the 2026 SS wage base of $184,500.",
      "Early-claiming reduction follows the IRS two-tier formula: 5/9 of 1% per month for the first 36 months before FRA, then 5/12 of 1% per month thereafter. Delayed-retirement credits accrue at 8% per year past FRA, capped at age 70.",
      "Cost-of-living adjustment (COLA) projected at 2.5%/yr.",
    ],
    sources: [
      { label: 'SSA: 2026 COLA fact sheet', url: 'https://www.ssa.gov/news/en/cola/factsheets/2026.html' },
      { label: 'SSA: PIA formula bend points', url: 'https://www.ssa.gov/oact/cola/bendpoints.html' },
    ],
  },
  {
    title: 'Medicare and IRMAA',
    body: [
      "2026 Medicare Part B base premium: $202.90/month. Average Medigap Plan G: $165/month. Average Part D premium: $45/month.",
      "IRMAA (income-related Part B surcharge) thresholds and surcharges use 2026 SSA POMS HI 01101.020 figures. Tier 1 single starts at MAGI > $109,000; tier 1 MFJ starts at > $218,000.",
    ],
    sources: [
      { label: 'SSA POMS HI 01101.020 — IRMAA Sliding Scale Tables', url: 'https://secure.ssa.gov/poms.nsf/lnx/0601101020' },
      { label: 'CMS: 2026 Medicare Parts A & B Premiums', url: 'https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles' },
    ],
  },
  {
    title: 'Required Minimum Distributions',
    body: [
      "RMDs begin at age 73 per the SECURE Act 2.0. Divisors come from the IRS Uniform Lifetime Table (2022 revision).",
      "Known limitation: when both members of a household have separate 401(k) balances, the projection uses primary's age for the divisor on the combined household pool. This may over-state RMDs when the spouse is younger and not yet 73. Per-spouse divisor handling is on the roadmap.",
    ],
    sources: [
      { label: 'IRS Pub 590-B — Uniform Lifetime Table', url: 'https://www.irs.gov/publications/p590b' },
    ],
  },
  {
    title: 'State income tax',
    body: [
      "State tax uses one effective rate per state — a flat rate for flat-tax states, a representative effective rate for graduated states (CA, NY, OR, etc.). For households earning under $300K this approximation is within a few hundred dollars of the true bill.",
      "Known limitation: high earners in graduated-tax states will owe meaningfully more than this estimator shows. CA at 9.3% understates the 13.3% top bracket; NY at 6.85% ignores NYC's additional 3.876% city tax.",
    ],
  },
  {
    title: 'Portfolio assumptions and inflation',
    body: [
      "Default expected return: 7%/yr (a 60/40 stock/bond portfolio assumption).",
      "Default retirement allocation shift: 60% of working-years return — i.e., a 7% expected return drops to 4.2% in retirement, modeling a more conservative bond-heavier allocation. This is editable on the Plan tab; users with longer time horizons or higher risk tolerance should bump this up.",
      "Default inflation: 2.5%/yr. Healthcare inflation: 3.5%/yr.",
      "The retirement allocation shift activates only when both household members are retired — gap years where one spouse is still working keep the higher pre-retirement return rate.",
    ],
  },
  {
    title: 'Healthcare bridge (pre-Medicare)',
    body: [
      "ACA marketplace premium estimates use national-average benchmark second-lowest-cost silver plan premiums by age (KFF marketplace data, scaled to household size).",
      "Subsidy calculations follow the post-ARPA (now permanent under IRA extension through 2025; reverification needed for 2026+) premium-tax-credit formula. The 400% FPL cliff is currently uncapped per the IRA extension; verify status each year.",
      "2026 Federal Poverty Level guidelines (HHS): $15,650 for a household of 1; $21,150 for 2.",
    ],
  },
  {
    title: 'Capital-gains assumption',
    body: [
      "When the projection draws from a taxable brokerage, it estimates the embedded gains ratio using a simple curve: 30% gains in the first year of retirement, growing 2 points/yr, capped at 80%. This avoids hard-coding either an unrealistically optimistic (low gains) or pessimistic (all gains) assumption.",
      "Annuity withdrawals use a flat 30% gains ratio (exclusion-ratio approximation).",
    ],
  },
  {
    title: 'Monte Carlo',
    body: [
      "Box-Muller normal distribution. Default 1,000 runs (configurable). Reports P10 / P25 / P50 / P75 / P90 percentiles plus success rate.",
      "Known limitation: normal-distribution returns underestimate left-tail risk vs. fat-tailed empirical distributions. Real markets have crashes that the Monte Carlo doesn't fully capture.",
    ],
  },
  {
    title: 'What this tool intentionally does NOT model',
    body: [
      "Estate tax (federal exemption is $13.99M+ in 2025, sunsetting in 2026 to ~$15M post-OBBBA — relevant only to households well above mass-affluent).",
      "Alternative Minimum Tax (AMT) — relevant to ISO exercises and high-SALT states.",
      "Net Unrealized Appreciation (NUA) on company stock in employer 401(k)s.",
      "K-1 income, deferred compensation, RSU vesting schedules — relevant to executives and business owners.",
      "Concentrated single-stock risk.",
      "Long-term care insurance specifics (the projection does increase healthcare costs in slow-go / no-go phases generically).",
    ],
  },
];

export default function MethodologyPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 24, paddingBottom: 60 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        maxWidth: 800, margin: '0 auto', padding: '0 16px 16px',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'var(--text)', fontFamily: 'var(--sans)' }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Retire<span style={{ color: 'var(--accent)' }}>.</span>Simplified
          </span>
        </a>
        <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2 }}>
          Methodology
        </span>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--text)', marginBottom: 8 }}>
          How the math works
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 4 }}>
          What goes into the projection, where the data comes from, and the things this tool intentionally doesn't try to model. If you're working with an advisor or just like reading the fine print, start here.
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 32, fontStyle: 'italic' }}>
          Last reviewed: {LAST_REVIEWED}. We re-check assumptions each January when the IRS, SSA, and CMS publish next year's figures.
        </p>

        {sections.map((section, i) => (
          <div key={i} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--accent)', marginBottom: 10 }}>
              {section.title}
            </h2>
            {section.body.map((p, j) => (
              <p key={j} style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 10 }}>
                {p}
              </p>
            ))}
            {section.sources && section.sources.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim)' }}>
                Sources:{' '}
                {section.sources.map((s, k) => (
                  <span key={k}>
                    {k > 0 ? ' · ' : ''}
                    <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>
                      {s.label}
                    </a>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        <div style={{
          marginTop: 48, padding: '20px 24px', borderRadius: 12,
          background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 13,
          color: 'var(--text-muted)', lineHeight: 1.7,
        }}>
          <strong style={{ color: 'var(--text)' }}>Reminder.</strong> This tool is an educational planning estimator, not financial advice. The math is honest about its assumptions and citations, but every household has nuances (deferred comp, K-1 income, large taxable concentrations, divorce, kids, business interests, etc.) that a competent fee-only advisor or CPA will handle better than any free calculator. If you're managing $1M+, talk to one.
        </div>
      </div>
    </main>
  );
}
