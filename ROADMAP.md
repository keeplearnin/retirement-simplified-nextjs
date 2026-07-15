# Retirement.Simplified — Product & Roadmap

## What it is

A free, open-source retirement planning tool for the mass-affluent ($100K–$1M households). Three questions on `/verdict` produce a specific dollar gap vs. the Fidelity benchmark in 90 seconds, no account required. From there, a full plan editor exposes the math the paid tools hide: RMD avalanche, IRMAA cliffs, the Social Security tax torpedo, Roth conversion ladders, the pre-Medicare healthcare bridge.

Live at **retiresimplified.com**. Methodology and assumptions documented at **/methodology**. Source on GitHub.

---

## What's shipped

### Top-of-funnel
- **Verdict screen** (`/verdict`) — three inputs, ninety seconds, one specific dollar gap vs. the Fidelity age-based benchmark. Gap status is calibrated to the user's time horizon (a 40-year-old at 50% of benchmark sees "behind" with a 25-year catch-up message, not "significantly behind"). Result includes the household-aware healthcare bridge cost and three quantified actions ranked by 10-year dollar impact.
- **3 SEO calculators** (`/calculators/irmaa-cliff-checker`, `/calculators/social-security-break-even`, `/calculators/tax-torpedo`) — standalone, no-signup single-purpose tools built on the same engines as the full app, for organic entry points beyond `/verdict`.

### Plan editor (full app)
- **Plan tab** — inputs for ages, income, savings (10 account types), debts, expenses, assumptions. Year-by-year projection with retirement-detail and RMD-avalanche tables.
- **Smart Action Items card** — the plan's "what should I do next" surface, adapting to the user's specific gaps (e.g. "Build an emergency fund," "Savings run out at age X," "Personalize your plan for accurate tax projections"). Supersedes the old "smart next-step card" idea — this and the Decision Engine (below) both cover that ground now.
- **Stress Test tab** (formerly "Dashboard new") — return-shock sensitivity. "Money lasts to age X" with a sensitivity slider that finds the smallest return shock that breaks the plan.
- **Liquid vs. total net worth** — both shown on the projection chart so users with real estate / 529 holdings can see when their *spendable* portfolio is exhausted, even while total net worth keeps appreciating.
- **Plan import/export** — download the current plan as a versioned JSON file (backup, device moves, sharing with a spouse/advisor) and re-import it elsewhere (Scenarios tab).
- **PDF / share export** (`/report`) — single-page printable retirement summary for sharing with a spouse, advisor, or parent.

### Decision Engine, Scenarios, and simulation
- **Decision Engine** — one screen that re-runs the full plan across the decision space (SS claiming ages 62–70, Roth conversions, IRMAA proximity) and returns ranked, dollar-quantified recommendations with an auditable "show the math" trail and one-click Apply to My Plan.
- **Scenario comparison** — snapshot the plan, change anything, compare futures side-by-side; each column runs the full tax-aware projection.
- **Monte Carlo** — Box-Muller normal-distribution simulation with P10/P25/P50/P75/P90 bands and plain-language interpretation.
- **Historical backtesting** — replays the user's exact plan through every real market sequence since 1928 (Damodaran/NYU data), with era-accurate CPI (a 1966 start suffers both the sideways market and the 1970s price spiral, not the user's flat inflation assumption). This is the "historical sequence-of-returns stress test" that captures fat-tail risk the normal-distribution Monte Carlo misses.

### Phased retirement
Salary income carries an editable "stops at age" field; pair with a Part-time / consulting income source covering the gap until full retirement. Common pattern: full-time → 60, part-time $40K/yr 60–65, full retirement 65+. Per-spouse for couples mode. Income flows into ordinary tax (correctly affects SS taxability tier and IRMAA timing in those bridge years).

### Optimize tabs (six tools, ordered by user journey)
- **Roth vs Trad** — accumulation-phase comparison; inputs both bracket-now and bracket-in-retirement, with a real-dollar/inflation toggle.
- **Social Security** — PIA estimator with the IRS two-tier early-claiming formula; capped delayed-credit at age 70.
- **Roth Ladder** — fills a target tax bracket each gap year between retirement and age 73. Reports lifetime tax saved, total converted, RMD reduction at 73, and flags every year the ladder pushes MAGI over an IRMAA threshold. **Optimizer** runs every target bracket and recommends the winner (or recommends skipping conversions if your future bracket is already lower).
- **Withdrawal** — drawdown sequence (Cash → Taxable → 401k → Roth) taxed through the same canonical `computeTax()` engine as the rest of the app (filing status, state, current-year brackets — not a hand-rolled approximation), with proper tax gross-up that iterates when withdrawals cross brackets.
- **Tax Torpedo** — interactive slider showing the marginal-rate spike when each $1 of IRA withdrawal drags $0.85 of SS into the taxable base.
- **Monte Carlo** — see above.

### Couples mode (Phases A–F)
End-to-end household modeling: per-spouse ages, retirement ages, longevity, 401(k)/Roth/HSA/pension balances, monthly contributions. Income engine projects each spouse's salary, SS, and pension on independent timelines. Per-spouse contribution gating handles "primary retires at 60, spouse keeps earning to 65" correctly. Auto-MFJ filing status with override.

**Phase F — survivor analysis:**
- **Per-spouse RMD divisor.** Each spouse's 401(k) tracked separately so RMD math uses each person's own age and balance — closes a known over-RMD bug for younger spouses with separate 401(k)s.
- **SS step-up on first death.** Survivor automatically claims the higher of (their own benefit) or (the deceased's), often a meaningful jump for non-working / lower-earning spouses.
- **MFJ → single filing flip.** Year of death stays MFJ per IRS rule; year after flips to single (the brackets compress at the top, so the survivor's effective rate often rises even on the same income).
- **Spousal rollover.** Tax-deferred and Roth balances roll into the survivor's bucket on first death — no immediate distribution.
- **Pension survivor benefit.** When elected at retirement (e.g., 50% / 75% / 100% joint-and-survivor), surviving spouse continues to receive that fraction of the deceased's pension.

### IRMAA / RMD / Healthcare features
- **IRMAA cliff detector** flags any year where projected MAGI lands within $5K of a Medicare surcharge tier; quantifies the annual cost of crossing.
- **RMD projection table** shows year-by-year forced 401(k) withdrawals from age 73 with bracket bumps and SS-taxability flags.
- **Healthcare bridge** estimates ACA marketplace premiums + subsidy for retire-before-65 users; Medicare Part B + Medigap + Part D baseline for 65+. Compared against Fidelity's lifetime healthcare benchmark ($172.5K individual / $345K couple).
- **Healthcare bridge breakdown** — explicit pre-Medicare (retirement age–65) vs. Medicare (65+) cost split with per-year line items, not just the rolled-up lifetime number.
- **Healthcare cost multiplier** (0.5×–3.0×) lets users with chronic conditions or unusually healthy histories scale the auto-estimate to their actual situation.
- **Long-term care modeling** — probability-weighted cost ramp in the final years before longevity age, inflated at a capped LTC-specific rate so long-horizon (young) users get a realistic real-dollar estimate instead of an understated flat rate.

### State and federal tax
- **Graduated state-tax brackets** for CA, NY, NJ, OR — full multi-tier math matching the state revenue department's published brackets. Closes the $5K–$15K/yr undershoot the flat-rate model produced for high earners. HI, MN, MA, WI still flat-rate (warning surfaced in the planner) and are next up — see Now/Soon below.
- **OBBBA senior bonus deduction** ($6K/person 65+, 2025–2028) modeled with full phase-out math. Year-gated so projections beyond 2028 correctly drop the bonus.
- **NIIT** (3.8% on investment income above $200K single / $250K MFJ) modeled in the projection engine.
- **SECURE 2.0 mandatory Roth catch-up** flagged on Roth vs Traditional for users 50+ earning over the $150K FICA-wages threshold.

### Notifications
- **Weekly email digest (opt-in)** — a autonomous AI health-check agent reviews the user's plan and emails a summary if they've opted in via the AI Advisor settings panel. Broader in scope than the originally-envisioned "notify me when brackets ship," but the mechanism (opt-in, stored preference, scheduled send) is built and live.

### Trust signals
- **`/methodology` page** documents every assumption with citations to IRS Rev. Proc. 2025-32, IRS Notice 2025-67, SSA POMS HI 01101.020, CMS Medicare premium fact sheets, and HHS poverty guidelines. Includes an explicit "what this tool intentionally does not model" section (estate tax, AMT, NUA, K-1 income).
- **Constants are 2026** throughout: federal brackets, std deduction, 401(k) limit ($24,500), SS wage base ($184,500), SS bend points ($1,286 / $7,749), HSA limits, IRMAA tiers, FPL.

### Recent correctness hardening (2026-07-15)
A status-report pass through `AUDIT.md` surfaced several items still marked `todo` — three turned out to already be fixed in code (the audit doc had drifted, not the app), and three got real fixes:
- **WithdrawalStrategy tax estimate** now runs through the canonical `computeTax()` engine instead of a hand-rolled, single-filer-only, stale-bracket approximation — picks up MFJ and state tax for free.
- **TaxAware inflation toggle** — Roth vs. Traditional comparison can now show today's-dollars alongside nominal.
- **Long-term care realism** — base cost and inflation-rate assumptions updated (see above).
- **MyPlan "Entering Retirement" label** clarified (the underlying number was already correct; only the label was ambiguous).
- `AUDIT.md` and this roadmap were reconciled against the actual code so both stop drifting from reality.

---

## Tech stack

- **Frontend**: Next.js 16 (App Router), React 19
- **Backend**: AWS Lambda (Python), DynamoDB, API Gateway (used only for the AI Advisor proxy and authenticated plan saving)
- **Auth**: AWS Cognito + Google OAuth (optional — the app fully works without an account)
- **AI**: Anthropic Claude API via server-side proxy
- **Hosting**: AWS Amplify, auto-deploy from `main`
- **Persistence**: localStorage by default; Cognito-backed plan saving when signed in

---

## Where it differs from the field

| | Boldin | Empower | Fidelity Go | **Retire.Simplified** |
|---|---|---|---|---|
| Price | $120/yr | Free, AUM | 0.35% AUM ($350/yr on $100K) | **$0** |
| No-signup entry point | No | No | No | **`/verdict` — 90 seconds, no email** |
| RMD avalanche year-by-year | Hidden | No | No | Yes |
| IRMAA cliff detector | No | No | No | Yes |
| Tax torpedo visualizer | No | No | No | Yes |
| Roth conversion ladder | Paid tier | No | No | Yes |
| Healthcare bridge math | Light | No | No | Yes |
| Couples gap-year retirement | Paid tier | No | No | Yes |
| Historical sequence backtesting | No | No | No | Yes |
| Methodology fully documented | No | No | No | Yes (`/methodology`) |
| Open source | No | No | No | **MIT License** |

The thesis: Boldin/Empower/Fidelity Go all hide the educational layer behind a paywall or behind UX that smooths over the hard parts. We surface the hard parts up front and give them away.

---

## What's next

Ordered by user-impact-per-week-of-work, not by ambition.

### Now (next two weeks)
- **Tester feedback loop** — five-to-ten qualitative sessions before broader launch.
- **Tab hover tooltips** for nav orientation — not yet built; no `title`/tooltip affordance on the nav pills today.
- **State-tax brackets for HI, MN, MA, WI** — extend the graduated-bracket model (CA/NY/NJ/OR) to the remaining graduated states the in-planner warning currently flags.
- **Consolidate `MyPlan.jsx`'s inline projection with `lib/computeProjection.js`** — see Known debt. Promoted to Now: it's the single most-cited recurring bug source across both audits (duplicate math drifting between the tab and the canonical engine), and the surface area only grows as more features are built on top of `computeProjection.js`.

### Soon (next 1–2 months)
- **Provisional-income (SS-taxability) cliff detector** — same UX pattern as the IRMAA cliff detector, but for the SS taxability tiers ($25K/$34K single, $32K/$44K MFJ, statutory and never indexed). `computeTax()` already returns `ssTaxablePercent`; this is mostly reusing existing UI, not new modeling.
- **Roth conversion ladder v2** — model ACA subsidy clawback for pre-65 conversions (explicitly flagged as not-yet-modeled in the Roth Ladder tab today).
- **Numeric input fields alongside sliders** — for users dialing in precise values when the slider step is too coarse. Still slider-only throughout.
- **State comparison tool** — side-by-side projection: "what if you retire in TX vs. stay in CA?" Surfaces multi-decade tax-savings of state moves. Not started.
- **Global real-dollar/inflation toggle** — GrowthProjector and Roth vs Trad (TaxAware) both have a nominal/real toggle now; My Plan's main year-by-year table, Decision Engine, and Scenarios still show nominal only. Worth promoting to a shared plan-level setting rather than repeating the per-tab toggle a third and fourth time.

### Later (next quarter+)
- **Plaid aggregation (read-only)** — the API route exists only as a commented-out placeholder today (no live Plaid integration). Auto-populate balances from Schwab/Fidelity/Vanguard would reduce activation cost to seconds.
- **Plus tier ($8/mo)** — saved scenarios, scenario comparison, advanced Monte Carlo (regime-aware, bootstrap), email support. Core tool stays free.
- **RIA partnership tier ($199/firm/mo)** — co-branded methodology page, lead-share, white-labeled PDF reports.
- **QCDs (Qualified Charitable Distributions)** — for 70½+ retirees with charitable intent: $108K/yr (2026 indexed) of RMDs sent direct to charity, satisfies RMD without raising AGI. Powerful IRMAA / SS-taxability avoidance; the RMD engine is precise enough that this is mostly a UI + waterfall-order extension.
- **Tax-loss harvesting estimator** — annualized tax savings estimate based on taxable account size + portfolio volatility.
- **Backdoor Roth / Mega Backdoor Roth flag** — when user is above the Roth IRA income phase-out ($168K single / $252K MFJ in 2026), surface the strategy with mechanics. High-value for this app's actual mass-affluent user base, who hit this phase-out routinely.

### Known debt
- **State tax uses a single effective rate for non-graduated states** (all except CA/NY/NJ/OR, and — once shipped — HI/MN/MA/WI). This is fine for genuinely flat-rate/no-income-tax states, but any other high-progressivity state we haven't graduated yet would still undershoot for high earners. Caveat surfaced in the State picker tooltip.
- **Qualifying widow(er) status, step-up in cost basis at death, inherited-IRA 10-year rule for non-spouse heirs** — documented gaps from the Phase F survivor-analysis work, listed on `/methodology`.

### Explicitly not on the roadmap

These are **out of scope** by design — surfacing them would push the tool out of mass-affluent into HNW territory and dilute the focus.

- Estate tax planning (federal exemption is $15M, made permanent by OBBBA; relevant only above mass-affluent)
- AMT, NUA on company stock, K-1 / RSU / deferred comp modeling
- Concentrated single-stock risk, private-equity holdings
- Long-term care insurance product comparisons
- Active brokerage management or rebalancing trades

---

## Pitch

> Free retirement calculators tell you what you want to hear ("you have a 96% chance of success!"). Paid ones charge $120/yr to surface what should be the educational baseline. We built the third option: free, honest about its assumptions, with the math that paid tools hide. Three questions, no signup, your numbers stay in your browser. Source on GitHub.

The retirement-planning software market is roughly $20B/yr in retail TAM. There's no clear free leader. Boldin is the closest comp and charges where the educational layer should be free.

---

*Last updated: 2026-07-15 — reconciled against actual shipped code (several "Now"/"Soon" items from the prior update had already shipped without the roadmap being updated); incorporates feedback from two tester rounds (consumer + Fisherman Investments tax consulting team).*
