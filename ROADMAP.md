# Retirement.Simplified — Product & Roadmap

## What it is

A free, open-source retirement planning tool for the mass-affluent ($100K–$1M households). Three questions on `/verdict` produce a specific dollar gap vs. the Fidelity benchmark in 90 seconds, no account required. From there, a full plan editor exposes the math the paid tools hide: RMD avalanche, IRMAA cliffs, the Social Security tax torpedo, Roth conversion ladders, the pre-Medicare healthcare bridge.

Live at **retiresimplified.com**. Methodology and assumptions documented at **/methodology**. Source on GitHub.

---

## What's shipped

### Top-of-funnel
- **Verdict screen** (`/verdict`) — three inputs, ninety seconds, one specific dollar gap vs. the Fidelity age-based benchmark. Gap status is calibrated to the user's time horizon (a 40-year-old at 50% of benchmark sees "behind" with a 25-year catch-up message, not "significantly behind"). Result includes the household-aware healthcare bridge cost and three quantified actions ranked by 10-year dollar impact.

### Plan editor (full app)
- **Plan tab** — inputs for ages, income, savings (10 account types), debts, expenses, assumptions. Year-by-year projection with retirement-detail and RMD-avalanche tables.
- **Stress Test tab** (formerly "Dashboard new") — return-shock sensitivity. "Money lasts to age X" with a sensitivity slider that finds the smallest return shock that breaks the plan.
- **Liquid vs. total net worth** — both shown on the projection chart so users with real estate / 529 holdings can see when their *spendable* portfolio is exhausted, even while total net worth keeps appreciating.

### Optimize tabs (six tools, ordered by user journey)
- **Roth vs Trad** — accumulation-phase comparison; inputs both bracket-now and bracket-in-retirement.
- **Social Security** — PIA estimator with the IRS two-tier early-claiming formula; capped delayed-credit at age 70.
- **Roth Ladder** — fills a target tax bracket each gap year between retirement and age 73. Reports lifetime tax saved, total converted, RMD reduction at 73, and flags every year the ladder pushes MAGI over an IRMAA threshold. **Optimizer** runs every target bracket and recommends the winner (or recommends skipping conversions if your future bracket is already lower).
- **Withdrawal** — drawdown sequence (Cash → Taxable → 401k → Roth) with proper tax gross-up that iterates when withdrawals cross brackets.
- **Tax Torpedo** — interactive slider showing the marginal-rate spike when each $1 of IRA withdrawal drags $0.85 of SS into the taxable base.
- **Monte Carlo** — Box-Muller normal-distribution simulation with P10/P25/P50/P75/P90 bands and plain-language interpretation ("Your plan has a 73% probability of lasting through age 90; in the weakest 10% of scenarios, money runs short around age 82").

### Couples mode
End-to-end household modeling: per-spouse ages, retirement ages, longevity, 401(k)/Roth/HSA/pension balances, monthly contributions. Income engine projects each spouse's salary, SS, and pension on independent timelines. Per-spouse contribution gating handles "primary retires at 60, spouse keeps earning to 65" correctly. Auto-MFJ filing status with override.

### IRMAA / RMD / Healthcare features
- **IRMAA cliff detector** flags any year where projected MAGI lands within $5K of a Medicare surcharge tier; quantifies the annual cost of crossing.
- **RMD projection table** shows year-by-year forced 401(k) withdrawals from age 73 with bracket bumps and SS-taxability flags.
- **Healthcare bridge** estimates ACA marketplace premiums + subsidy for retire-before-65 users; Medicare Part B + Medigap + Part D baseline for 65+. Compared against Fidelity's lifetime healthcare benchmark ($172.5K individual / $345K couple).
- **Healthcare cost multiplier** (0.5×–3.0×) lets users with chronic conditions or unusually healthy histories scale the auto-estimate to their actual situation.

### State and federal tax
- **Graduated state-tax brackets** for CA, NY, NJ, OR — full multi-tier math matching the state revenue department's 2025 published brackets. Closes the $5K–$15K/yr undershoot the flat-rate model produced for high earners. HI, MN, MA, WI still flat-rate (warning surfaced in the planner) and on the roadmap.
- **OBBBA senior bonus deduction** ($6K/person 65+, 2025–2028) modeled with full phase-out math. Year-gated so projections beyond 2028 correctly drop the bonus.
- **NIIT** (3.8% on investment income above $200K single / $250K MFJ) modeled in the projection engine.
- **SECURE 2.0 mandatory Roth catch-up** flagged on Roth vs Traditional for users 50+ earning over the $150K FICA-wages threshold.

### Trust signals
- **`/methodology` page** documents every assumption with citations to IRS Rev. Proc. 2025-32, IRS Notice 2025-67, SSA POMS HI 01101.020, CMS Medicare premium fact sheets, and HHS poverty guidelines. Includes an explicit "what this tool intentionally does not model" section (estate tax, AMT, NUA, K-1 income).
- **Constants are 2026** throughout: federal brackets, std deduction, 401(k) limit ($24,500), SS wage base ($184,500), SS bend points ($1,286 / $7,749), HSA limits, IRMAA tiers, FPL.

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
| Methodology fully documented | No | No | No | Yes (`/methodology`) |
| Open source | No | No | No | **MIT License** |

The thesis: Boldin/Empower/Fidelity Go all hide the educational layer behind a paywall or behind UX that smooths over the hard parts. We surface the hard parts up front and give them away.

---

## What's next

Ordered by user-impact-per-week-of-work, not by ambition.

### Now (next two weeks)
- **Tester feedback loop** — five-to-ten qualitative sessions before broader launch
- **Smart "next step" card on My Plan** — adapts to user's situation (high 401k → suggest Roth Ladder; retire age < 65 → suggest healthcare bridge; etc.)
- **Tab hover tooltips** for nav orientation

### Soon (next 1–2 months)
- **Roth conversion ladder v2** — model ACA subsidy clawback for pre-65 conversions
- **Healthcare bridge breakdown** — explicit pre-Medicare (60–65) vs. Medicare (65+) cost split on My Plan, with per-year line items. Currently rolled up into one "Lifetime Healthcare" number on the verdict.
- **PDF / share export** — single-page retirement summary for sharing with spouse, advisor, parent
- **Email opt-in for the annual update** — "Notify me when 2027 brackets ship"
- **Couples mode Phase F (survivor analysis)** — SS step-up to higher of two benefits; MFJ→single tax flip year of death + 1; per-spouse RMD divisor; spousal claiming strategies
- **Numeric input fields alongside sliders** — for users dialing in precise values when the slider step is too coarse
- **Phased retirement** — model part-time work in transition years (income from a part-time gig at age 60, full retirement at 65). Affects taxes, SS taxability, IRMAA timing.
- **State-tax brackets for HI, MN, MA, WI** — extend the graduated-bracket model to the remaining graduated states the in-planner warning currently flags.
- **State comparison tool** — side-by-side projection: "what if you retire in TX vs. stay in CA?" Surfaces multi-decade tax-savings of state moves.

### Later (next quarter+)
- **Plaid aggregation (read-only)** — auto-populate balances from Schwab/Fidelity/Vanguard. Reduces the activation cost to seconds.
- **Plus tier ($8/mo)** — saved scenarios, scenario comparison, advanced Monte Carlo (regime-aware, bootstrap), email support. Core tool stays free.
- **RIA partnership tier ($199/firm/mo)** — co-branded methodology page, lead-share, white-labeled PDF reports
- **Inflation-adjusted dollar toggle** — switch chart and table values between nominal and real dollars. Helps users grok purchasing power on long projections (a "$2.4M at retirement" 25 years out is ~$1.3M in today's dollars at 2.5% inflation).
- **Historical sequence-of-returns stress test** — replay actual 1929/1966/1973/2000/2008 sequences against the user's plan. Captures fat-tail risk that the normal-distribution Monte Carlo misses.
- **QCDs (Qualified Charitable Distributions)** — for 70½+ retirees with charitable intent: $108K/yr (2026 indexed) of RMDs sent direct to charity, satisfies RMD without raising AGI. Powerful IRMAA / SS-taxability avoidance.
- **Tax-loss harvesting estimator** — annualized tax savings estimate based on taxable account size + portfolio volatility.
- **Backdoor Roth / Mega Backdoor Roth flag** — when user is above the Roth IRA income phase-out ($168K single / $252K MFJ in 2026), surface the strategy with mechanics.
- **Provisional-income threshold detector on main planner** — same UX as the IRMAA cliff detector but for the SS taxability tiers ($25K/$34K single, $32K/$44K MFJ, statutory and never indexed).

### Known debt
- The inline projection in `components/tabs/MyPlan.jsx` mirrors `lib/computeProjection.js`. Both are kept mathematically identical but consolidating is a multi-hour refactor; deferred until post-launch.
- For couples with separate 401(k)s and an age gap, the RMD divisor uses primary's age on the combined household pool. Over-RMDs when spouse is younger and not yet 73. Per-spouse balance tracking is on the survivor-analysis (Phase F) work.
- State tax uses a single effective rate per state; high earners in graduated states owe more than the estimator shows. Caveat surfaced in the State picker tooltip.

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

*Last updated: May 2026 — incorporates feedback from two tester rounds (consumer + Fisherman Investments tax consulting team).*
