# Retirement.Simplified — Product & Roadmap

## What it is

A free, open-source retirement planner for people roughly 55–70 with $100K–$1M saved and no advisor. It answers the question they are actually stuck on — *how much can I spend, and will it last?* — with a tax-aware, year-by-year engine, then ranks the moves that would improve the plan by dollar value. Every number shows its math, the engine is checked against published IRS and SSA examples, and the code is MIT-licensed.

Live at **retiresimplified.com**. How it works: **/how-it-works**. Assumptions and sources: **/methodology**. Checked cases: **/accuracy**. What the AI will and won't do: **/assistant-rules**.

---

## The product today: three screens

The Nov 2026 redesign cut the app to three screens; everything else is a Tool, one click away.

### Plan — "Am I okay?"
- **One verdict.** A headline and one line. Below the 80% bar it leads with the spending that works ("A strong plan is within reach: $9.0K/mo gives you an 80% chance"), with the strict rate on the ring.
- **Plan odds.** 500 seeded markets (same plan, same answer) plus a replay of every real market sequence since 1928, judged against the household horizon (the surviving spouse's last year, not the primary's).
- **You can spend.** The everyday spending that keeps an 80% chance, beside what you plan to spend, plus *If markets move*: what to trim to after a 20% fall and what you could spend after a 20% rise.
- **Flexible spending.** What trimming in bad markets buys ("Bad market: age 82 → 97 if you trim"), from Guyton-style guardrails run on the same market paths.
- **Lighter tools' number.** When our odds differ from what most calculators would show by 10+ points, the card shows their number for the user's own plan and names the assumptions that explain the gap.
- **Wealth chart** with retirement, Social Security and required-withdrawal milestones, and four *Try a change* sliders beside it (retire age, spending, saving, return).
- **Details:** the dollar-by-dollar Ledger, the Assumptions strip, and inputs (basics plus Debts and Assumptions under More).

### Improve — "What should I change?"
- **Ranked moves** from the Decision Engine, each re-running the full plan, with *Show the math* and one-click Apply: Social Security claiming (joint sweep for couples), Roth conversions (IRMAA-aware ladder optimizer), the pre-65 healthcare bridge, Medicare surcharge (IRMAA) cliffs, Social Security tax thresholds, and plan rescue.
- **Scenarios:** snapshot, change, compare side by side.

### Ask — "Explain my plan"
- Claude chat that reaches the engine only through tools, so its numbers match the Plan screen. It explains; it does not pick investments.
- Daily caps (30 questions per device, 100 per IP), cached system prompt, daily model health probe.

### Tools
Social Security and income (claiming, withdrawal order, healthcare before 65), Roth (contributions and conversion ladder), Your accounts, Portfolio, Stock compensation, College, Inheritance, Getting started — plus Quick verdict (`/verdict`), the PDF report (`/report`), and three standalone calculators (Social Security break-even, IRMAA check, tax torpedo).

---

## What the engine models

- **Federal tax every year:** 2026 brackets and deductions grown with inflation in later years, capital gains and the 0% bracket, NIIT, Social Security taxation (statutory, unindexed thresholds), the OBBBA senior deduction and SALT cap, required withdrawals from 73 with per-spouse divisors.
- **State tax:** full bracket math for CA, NY, NJ, OR, HI, MN, MA and WI (indexed in later years where state law indexes: CA, MN, WI and the MA surtax threshold); effective rates elsewhere; Social Security exempt except in the 8 states that tax it; state retirement-income exclusions.
- **Healthcare:** ACA bridge before 65, Medicare per beneficiary from each person's own 65, IRMAA charged as spending from MAGI two years earlier, healthcare inflation above CPI.
- **Long-term care:** per person, over each spouse's own final years ($3,600/mo in today's dollars by default; editable or off).
- **Couples and survivors:** per-spouse balances, contributions and timelines; Social Security step-up, MFJ → single filing flip, spousal rollover, pension survivor benefit, rental income continuing for the survivor.
- **Cash flow that conserves money:** contributions funded only from real surplus, RMDs counted as income before the withdrawal waterfall, a damped gross-up that lands within ~$50 of spending.

---

## Trust and credibility

- **/accuracy:** 15 hand-worked IRS/SSA cases, asserted as tests and rendered live with the engine's result.
- **CI gate:** the full suite (274 tests) runs on every push and PR, and Amplify runs it before building — a red suite blocks the deploy.
- **Dated figures:** every page says which year's official figures are used and when they were last checked.
- **No accounts:** identity is a random per-browser device ID, stated plainly. The plan lives in the browser; chat history and email preferences are keyed to the device ID.

---

## Tech stack

- **Frontend**: Next.js 16 (App Router), React 19
- **Backend**: AWS Lambda (Python), DynamoDB, API Gateway (legacy; current API routes run inside Next.js on Amplify)
- **Auth**: none. Each browser has a random device ID; there are no accounts (the half-built Cognito path was removed in Nov 2026)
- **AI**: Anthropic Claude API via server-side proxy (Sonnet for chat, Haiku for the weekly check)
- **Hosting**: AWS Amplify, auto-deploy from `main`, gated on the test suite
- **Persistence**: localStorage, plus DynamoDB keyed on the device ID for chat history and email preferences

---

## Where it differs from the field

| | Boldin | ProjectionLab | Empower / brokerage planners | **Retire.Simplified** |
|---|---|---|---|---|
| Price (Nov 2026) | Free / $168/yr | Free / $129/yr | Free, funnels to advice | **$0** |
| Year-by-year federal + state tax, Roth, IRMAA, ACA bridge | Paid tier | Paid tier | Limited | Yes |
| Moves ranked by dollar value in one list | Separate explorers | Separate tools | No | Yes |
| Explains why its odds differ from other tools | No | No | No | Yes |
| Published, tested reference cases | No | No | No | Yes (`/accuracy`) |
| Open source | No | No | No | **MIT License** |

Competitor rows reflect the Nov 2026 product research; re-check prices before quoting them publicly. "No competitor ranks moves in one list" is an absence of evidence, not a verified fact.

---

## What's next

Ordered by user impact per week of work. Features are no longer the gap — getting found, and being trusted, are.

### Now (next 30 days)
- **2027 official figures.** Slot in IRS 2027 brackets, deductions and 401(k)/IRA limits, and CMS 2027 Part B and IRMAA tiers, as each is published; bump the "checked" stamp. Confirm Wisconsin's 2026 schedule and Massachusetts's surtax threshold against the states' own sites.
- **Quick verdict as the front door** for first-time visitors (today they land on Ask with a setup chooser).
- **Privacy-friendly analytics** — cookieless, aggregate only — so the next decisions rest on usage, not guesses.
- **Five to ten tester sessions** with people in the 55–70 target segment.
- **First community launch:** Bogleheads, the FIRE podcasts, Hacker News (ProjectionLab's path to $1M ARR without funding).

### Soon (next 1–3 months)
- **"What if I have to stop at 60?"** one-tap stress test, wired to the ACA bridge move (46% of 2026 retirees stopped earlier than planned).
- **Social Security cut scenario** (e.g. 22% from 2032), so the claiming advice is shown to hold up under a cut.
- **Advisor-meeting prep pack:** the PDF report reshaped around the questions to bring to a professional.
- **Prefill from a tax return:** upload a 1040, pre-fill tax inputs, nothing stored.
- **Roth ladder v2:** ACA subsidy clawback for pre-65 conversions.
- **Consistent ranking in Improve:** put every move's dollar value in today's dollars (the cliff moves sum nominal, hypothetical costs).
- **Era-accurate inflation in the history replay** (the CPI column is recorded but not yet used).
- **Medicare Part D IRMAA** (only Part B is charged today).

### Later
- **QCDs** for 70½+ givers; **backdoor / mega-backdoor Roth** flag above the Roth income phase-out; **tax-loss harvesting** estimate; **state move comparison** ("retire in TX or stay in CA?").
- **Read-only MCP connector** so people can bring their plan into the assistant they already use.
- **Revenue, only after an audience and a securities-lawyer review:** hosted extras (more AI, sync, advisor seats) — never the MIT-licensed math.

### Decide
- **Portfolio tool:** naming funds is the closest the product comes to investment advice. Keep it as "model a mix you choose", or remove it.
- **Account linking (Plaid):** built and env-gated, off in production. Users in this segment rarely ask for linking, and it adds cost and liability; decide whether it stays.

### Known debt
- Massachusetts and Wisconsin 2026 figures are secondary-source consensus, flagged in code and on `/methodology`.
- Oregon's brackets are held fixed in later years (law indexes all but the top bracket; per-bracket indexing not modeled). California indexes by its own CPI; we use the plan's inflation rate.
- Non-bracket states use one effective rate. State retirement exclusions are held at today's dollar amounts.
- Odds sampling moves the headline by about ±3 points at 500 runs.
- AI rate limits are per server instance, not shared across instances.
- Survivor gaps: qualifying widow(er) status, step-up in cost basis at death, the inherited-IRA 10-year rule for non-spouse heirs (listed on `/methodology`).

### Explicitly not on the roadmap
Kept out by design — they push the product into high-net-worth territory or into regulated advice:
- Estate tax planning (federal exemption $15M, made permanent by OBBBA)
- AMT, NUA on company stock, K-1 / deferred comp modeling
- Concentrated single-stock risk, private holdings
- Recommending specific securities or funds, or placing trades
- Long-term care insurance product comparisons

---

## Pitch

> Know what you can spend, not just whether it lasts. Retire Simplified gives you one clear answer in minutes — your odds, your monthly spending number, and your best moves ranked by dollars — with real year-by-year tax math and every number shown. Free, open source, nothing to sell you.

---

*Last updated: 2026-11-11 — rewritten for the three-screen product after the Nov 2–11 redesign, odds engine, inflation indexing, household and tax audits, and trust pages. Next-step priorities follow the Nov 2026 product research (kept outside the repo).*
