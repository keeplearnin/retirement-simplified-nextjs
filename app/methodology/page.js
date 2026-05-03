'use client';

// Methodology page — documents the assumptions, data sources, and known
// simplifications so users (and their advisors) can verify the math.

const LAST_REVIEWED = 'May 2026';

const sections = [
  {
    title: 'Tax brackets, deductions, and capital gains',
    body: [
      "Federal income tax brackets, standard deduction, additional standard deduction for age 65+, and long-term capital-gains brackets all use 2026 figures from IRS Rev. Proc. 2025-32.",
      "OBBBA senior bonus deduction: $6,000 per qualifying individual age 65+, on top of the existing additional standard deduction. Effective tax years 2025–2028 only (expires after 2028 absent congressional extension). Phases out 6¢ per dollar of MAGI over $75K single / $150K MFJ; reaches zero at $175K / $250K. The projection engine applies this deduction year-by-year and stops applying it after 2028.",
      "Marginal rates and bracket thresholds update each January when the IRS publishes new inflation adjustments.",
    ],
    sources: [
      { label: 'IRS Rev. Proc. 2025-32 (2026 inflation adjustments)', url: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill' },
      { label: 'IRS — One Big Beautiful Bill Act senior deduction', url: 'https://www.irs.gov/newsroom/one-big-beautiful-bill-act-tax-deductions-for-working-americans-and-seniors' },
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
    title: 'Net Investment Income Tax (NIIT)',
    body: [
      "The 3.8% NIIT applies to the lesser of (a) net investment income, or (b) MAGI over $200,000 (single) / $250,000 (MFJ). The projection engine applies this on top of regular capital-gains tax in years where MAGI crosses the threshold.",
      "These thresholds are statutory (Affordable Care Act, 2013) and have never been indexed for inflation, so more taxpayers cross into NIIT territory each year via wage growth and cumulative inflation.",
    ],
    sources: [
      { label: 'IRS Topic No. 559 — Net Investment Income Tax', url: 'https://www.irs.gov/taxtopics/tc559' },
    ],
  },
  {
    title: 'State income tax',
    body: [
      "California, New York, New Jersey, and Oregon use full graduated bracket math (per their state revenue department's published 2025 brackets, used for tax year 2026 with minor inflation indexing). High earners in these states see liability matching their actual top-bracket exposure rather than a flat effective rate.",
      "All other states use a single effective rate — accurate within a few hundred dollars for flat-tax states (PA, IL, IN, etc.) and for typical retiree income levels. Hawaii, Minnesota, Massachusetts, and Wisconsin are still on flat rates and will be migrated to graduated brackets in a future update; high earners in those states see an in-planner warning when affected.",
      "What this tool does not yet model: NYC's additional 3.876% city tax; California's 1% Mental Health Services tax surcharge on income above $1M; Massachusetts's 4% surtax on income above $1M (the 'Millionaires Tax'); local income taxes in PA, OH, MI cities.",
    ],
    sources: [
      { label: 'CA FTB — 2025 California Tax Rates', url: 'https://www.ftb.ca.gov/file/personal/tax-calculator-tables-rates.html' },
      { label: 'NY DTF — 2025 NY State Tax Rates', url: 'https://www.tax.ny.gov/forms/income_tax/2024_inflation_adjusted_rates.htm' },
      { label: 'NJ DOT — 2024 NJ Tax Rate Schedules', url: 'https://www.nj.gov/treasury/taxation/taxtables.shtml' },
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
    title: 'Survivor analysis (couples mode)',
    body: [
      "When one spouse dies (modeled at their longevity age), the projection applies three IRS rules going forward: (1) Social Security step-up — the survivor automatically claims the higher of their own benefit or the deceased's; the deceased's line drops to zero. (2) Filing status flip: the year of death itself stays MFJ per IRS rule; the year after flips to single. Single brackets compress at the top, so the survivor's effective tax rate often rises even on the same income. (3) Spousal rollover: the deceased's tax-deferred and Roth balances roll into the survivor's name (no immediate distribution required, preserves tax-deferred status).",
      "RMDs are computed per-spouse, using each spouse's own age and own 401(k) balance — the previous combined-pool approach over-RMD'd younger spouses with separate accounts.",
      "Pension survivor benefit: if a joint-and-survivor option was elected at retirement (50% / 75% / 100%), the surviving spouse continues receiving that fraction of the deceased's pension. Default is 0% (single-life payout) since most users don't elect survivor benefits.",
      "What survivor analysis does not yet model: qualifying widow(er) tax filing for 2 years post-death (assumes no dependent children — survivor flips straight to single); cost-basis step-up on inherited taxable brokerage assets (we use the same gains-ratio curve, which slightly overstates capital-gains tax in survivor years); inherited IRAs for non-spouse heirs (the 10-year rule applies to children but not surviving spouses, who roll over).",
    ],
    sources: [
      { label: 'IRS Pub 559 — Survivors, Executors, and Administrators', url: 'https://www.irs.gov/pub/irs-pdf/p559.pdf' },
      { label: 'SSA — Survivors Benefits', url: 'https://www.ssa.gov/benefits/survivors/' },
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
      "Estate tax (federal exemption is $15,000,000 in 2026 — made permanent by the One Big Beautiful Bill Act, which removed the 2026 TCJA sunset. Relevant only to households well above mass-affluent).",
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
