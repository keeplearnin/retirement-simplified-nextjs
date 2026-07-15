# Retire.Simplified

**Free, open-source retirement planning — from first paycheck to last withdrawal.**

Live at **[retiresimplified.com](https://retiresimplified.com)** · [How the math works](https://retiresimplified.com/methodology) · MIT licensed

> Boldin gives you a dashboard. ProjectionLab gives you a sandbox.
> **We give you the answer — and show our math.**

## What it does

**🎯 Decision Engine** — one screen that runs your full plan across the decision space and returns ranked, dollar-quantified recommendations: when to claim Social Security (every age 62–70, actuarially adjusted, swept through the *complete* projection), whether and how to do Roth conversions, and how close you are to an IRMAA cliff. Every card has a **"Show the math"** audit trail and a one-click **Apply to My Plan**.

**🧾 A tax engine that takes retirement seriously** — 2026 federal brackets, Social Security taxability, state-by-state retirement income exemptions (PA, IL, GA, NY, MI, and more), graduated brackets for CA/NY/NJ/OR, per-spouse RMDs with survivor rollover, NIIT, the OBBBA senior deduction, and IRMAA tier detection.

**💰 IRMAA-aware Roth conversion optimizer** — sweeps the 12/22/24% brackets across your pre-RMD window and ranks by **net** savings: tax saved *minus* the Medicare surcharges the conversions trigger. A conversion that saves $30K of tax but trips eight years of IRMAA tiers is a net loser — we catch that.

**🔀 Scenario comparison** — snapshot your plan, change anything (retire earlier, move states, sell the rental), and compare futures side-by-side. Every column runs the full tax-aware projection, not a compound-interest toy.

**🎲 Monte Carlo + 📜 historical backtesting** — random-draw simulation *and* your exact plan replayed through every real market sequence since 1928 (Damodaran/NYU data): the Great Depression, the stagflation 70s, the dot-com bust, 2008. When the two methods disagree, we tell you why and which to weight.

**🤖 An AI advisor that acts, not just chats** — grounded in your actual plan via a tool-calling agent (Claude), it can run projections, compare claiming ages, and *propose validated plan changes* you can apply with undo. Plus a weekly autonomous health-check agent (opt-in email).

## Why trust it

- **Open source.** Every formula in this repo — audit the [tax engine](lib/taxEngine.ts), the [projection](lib/computeProjection.js), the [backtester](lib/backtestEngine.js). Competitors' math is a black box; ours is the pitch.
- **Tested.** Pure-function engines with a vitest suite: IRS golden cases, Social Security taxability boundaries, RMD forcing, regression tests for every bug we've fixed. `npm test`.
- **Private by default.** Plans live in your browser's localStorage. Sign-in (Google via Cognito) and cross-device sync are optional. We never sell or share data.
- **Free.** No paywall in front of Monte Carlo, scenarios, or the Decision Engine.

## Stack

Next.js 16 · React 19 · zero UI/chart dependencies (hand-rolled SVG) · DynamoDB (optional sync) · Cognito (optional auth) · Claude (AI advisor) · AWS Amplify hosting

All financial math lives in **pure, framework-free modules** under [`lib/`](lib/) — one source of truth shared by the UI, the AI agent tools, and the test suite.

## Run it locally

```bash
git clone https://github.com/keeplearnin/retirement-simplified-nextjs.git
cd retirement-simplified-nextjs
npm install
npm run dev        # http://localhost:3000 — works with zero config
npm test           # vitest suite for the financial engines
```

The core planner needs **no environment variables**. Optional integrations (AI advisor, auth, sync, email) are configured via `.env.local` — see [.env.local.example](.env.local.example).

## Data sources

Tax and benefit figures refreshed each January: IRS Rev. Proc. (federal brackets, deductions), SSA (claiming factors, IRMAA tiers), CMS (Medicare premiums), state revenue departments (state brackets and retirement exemptions), and Damodaran/NYU Stern (historical market returns, 1928–present).

## Disclaimer

Educational tool, not financial advice. Projections are hypothetical; past performance does not guarantee future results. Consult a qualified professional for advice specific to your situation.
