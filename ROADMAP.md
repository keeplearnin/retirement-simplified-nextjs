# Retirement.Simplified — Executive Summary & Roadmap

## Executive Summary

### What We Are
A **free, open-source retirement planning platform** built with Next.js that gives everyday people the same tools financial advisors charge 1% annually for — growth projections, Monte Carlo simulations, portfolio recommendations, tax strategy comparisons, and AI-powered financial education.

### Current Features (v1.0)

| Module | What It Does |
|--------|-------------|
| **Growth Projector** | Projects portfolio growth with configurable age, savings, contributions, and return rate. Shows inflation-adjusted values. |
| **Fee Impact Calculator** | Visualizes the compounding cost of advisor fees (1%+) vs index funds (0.03-0.05%) over decades. Shows exact dollar loss. |
| **Portfolio Builder** | Recommends a 3-fund portfolio (US stocks, international, bonds) based on age and risk tolerance. Shows specific tickers (VTI, VXUS, BND) across Vanguard/Fidelity/Schwab. |
| **Monte Carlo Simulation** | Runs 100-5,000 randomized market simulations (Box-Muller normal distribution, 7% avg, 15% std dev). Shows success rate, percentile bands, and configurable retirement end age (75-100). |
| **Roth vs Traditional** | Compares after-tax retirement outcomes for Roth vs Traditional IRA/401k, factoring in current vs retirement tax brackets and reinvested tax savings. |
| **Scenario Comparison** | Side-by-side modeling of two retirement strategies (e.g., retire at 60 aggressive vs 65 conservative) with lifetime wealth curves. |
| **Social Security Estimator** | Estimates monthly/annual benefits using PIA formula with bend points. Shows claiming age comparison (62/64/67/70) and cumulative breakeven chart. |
| **Investing 101 Guide** | 6-section educational module: priority order, pre-invest checklist, risk tolerance quiz, fund recommendations, DCA calculator, and 8 common mistakes. |
| **AI Financial Educator** | Claude-powered chat for personalized Q&A. Server-side API proxy (no exposed keys). Educational only — explicitly not financial advice. |
| **My Plans** | Authenticated users can save/load multiple retirement plans and view Monte Carlo simulation history. |
| **Progress Journal** | Monthly balance tracking with account breakdown. Net worth chart over time. |
| **Get Started** | 5-step actionable guide: open account → pick strategy → buy funds → automate → when to get an advisor. |

### Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, SSR
- **Backend**: AWS Lambda (Python), DynamoDB (single-table design), API Gateway
- **Auth**: AWS Cognito + Google OAuth
- **AI**: Claude API via server-side proxy
- **Hosting**: AWS Amplify (auto-deploy from GitHub)
- **Cost to run**: ~$0/month on free tier for moderate usage

---

## Competitive Landscape

| Feature | Fidelity Go ($0-0.35%) | Betterment (0.25%) | Wealthfront (0.25%) | **Retirement.Simplified (Free)** |
|---------|----------------------|-------------------|--------------------|---------------------------------|
| Portfolio management | Auto-rebalanced | Auto-rebalanced | Auto-rebalanced | DIY with recommendations |
| Tax-loss harvesting | $25K+ accounts | All accounts | All accounts | Not yet |
| Human advisor access | $25K+ (30-min calls) | $100K+ (premium) | None | AI educator (free) |
| Financial planning tools | Basic | Goal-based | Robust | 8 calculator tools |
| Monte Carlo simulation | Hidden | Hidden | Yes | Yes (transparent, configurable) |
| Roth vs Traditional analysis | No | No | No | Yes |
| Social Security planning | No | No | No | Yes |
| Education/guides | Articles | Articles | Articles | Interactive tools + AI chat |
| Fee transparency | Good | Good | Good | Core mission — shows fee impact |
| Open source | No | No | No | **Yes — MIT License** |
| Minimum balance | $10 | $10 | $500 | **$0** |
| Annual cost on $100K | $350 | $250 | $250 | **$0** |

### Our Edge
1. **$0 forever** — no AUM fees, no premium tier, no hidden costs
2. **Transparent** — every calculation is visible, every assumption adjustable
3. **Educational** — we teach you to fish instead of managing your fish
4. **Open source** — community-driven, auditable, forkable

---

## Roadmap: What to Build Next

### Phase 1: Core Parity (1-2 months)
Features needed to be taken seriously as a Fidelity Go alternative.

#### 1. Automated Portfolio Rebalancing Recommendations
- Connect to brokerage via Plaid or manual input
- Show current allocation vs target allocation
- Generate specific trade recommendations ("Sell $2,400 of VTI, buy $2,400 of BND")
- Rebalancing frequency: quarterly/annually/threshold-based (5% drift)

#### 2. Tax-Loss Harvesting Calculator
- Input: current holdings with cost basis
- Identify positions with unrealized losses
- Calculate tax savings from harvesting
- Warn about wash sale rules (30-day window)
- Suggest replacement funds (e.g., swap VTI → ITOT during harvest)

#### 3. Retirement Income / Withdrawal Strategy
- Model the decumulation phase (currently only accumulation)
- Bucket strategy visualization (cash / bonds / stocks)
- Required Minimum Distribution (RMD) calculator
- Roth conversion ladder planner
- Social Security optimization integrated with withdrawal order

#### 4. Account Aggregation Dashboard
- Manual entry of all accounts (401k, IRA, Roth, taxable, HSA, 529)
- Net worth tracker with historical chart
- Asset allocation across ALL accounts (not just one)
- Identify overlap and gaps

### Phase 2: Differentiation (2-4 months)
Features the paid robo-advisors don't offer well.

#### 5. Tax-Aware Asset Location Optimizer
- Which funds belong in which account type?
- Put bonds in Traditional (tax-deferred), growth stocks in Roth (tax-free)
- Calculate the tax drag savings of proper location
- This is a $10K+ value that most advisors don't do well

#### 6. FIRE (Financial Independence) Calculator
- "Coast FIRE" — when can you stop saving and coast to retirement?
- "Lean FIRE" vs "Fat FIRE" scenarios
- Required savings rate calculator
- Geographic arbitrage modeling (retire somewhere cheaper)
- This captures the massive FIRE community (r/financialindependence: 2.3M members)

#### 7. Employer Benefits Optimizer
- 401k match calculator (show true return of match)
- HSA triple tax advantage explainer + calculator
- ESPP discount analysis (is the 15% discount worth the concentration risk?)
- Mega backdoor Roth eligibility checker
- Compare job offers by total comp including benefits

#### 8. Couple / Family Planning Mode
- Joint retirement planning for couples
- Spousal Social Security benefits
- Survivor benefit analysis
- Combined tax bracket optimization (file jointly vs separately impact)

### Phase 3: Moat (4-6 months)
Features that create long-term competitive advantage.

#### 9. AI-Powered Plan Review
- Upload current 401k fund lineup → AI identifies high-fee funds and suggests alternatives
- Analyze IPS (Investment Policy Statement) compliance
- Annual financial checkup: "Here's what changed, here's what to do"
- Personalized action items based on journal history

#### 10. Community & Social Features
- Anonymous plan sharing ("Rate my portfolio")
- Community benchmarks ("How does my savings rate compare to my age group?")
- Success stories / case studies
- Accountability partners

#### 11. Brokerage Integration (Plaid)
- Read-only connection to Fidelity, Vanguard, Schwab accounts
- Auto-populate portfolio data
- Real-time net worth tracking
- Automatic rebalance alerts

#### 12. Mobile App (React Native)
- Push notifications for rebalancing alerts
- Monthly journal reminders
- Quick net worth check
- Widget for home screen

### Phase 4: Revenue Without Fees (6+ months)
Sustainable business model that keeps the core tool free.

#### 13. Affiliate Revenue (Ethical)
- "Open an account" links to Vanguard/Fidelity/Schwab (referral programs)
- High-yield savings account comparisons
- Only recommend products we'd use ourselves
- Full disclosure of any affiliate relationships

#### 14. Premium AI Features
- Unlimited AI conversations (free tier: 10/day)
- Document analysis (upload 401k statements, tax returns)
- Personalized annual review report (PDF)
- Price: $5-10/month — still 50x cheaper than 0.25% AUM on $100K

#### 15. White-Label / API
- License the calculators to financial blogs, credit unions, HR platforms
- Embeddable widgets ("Add our Monte Carlo simulator to your site")
- API access for fintech developers

---

## Key Technical Priorities

1. **Plaid Integration** — biggest unlock for user experience
2. **PWA / Mobile** — most users check finances on their phone
3. **Data Export** — CSV/PDF export of all plans and journal data
4. **Accessibility** — WCAG 2.1 AA compliance (currently no ARIA labels)
5. **Testing** — unit tests for financial calculations (these MUST be correct)
6. **Performance** — move Monte Carlo to Web Worker (blocks main thread at 5000 runs)
7. **SEO** — individual pages for each tool (not tab-based SPA) for organic search traffic

---

## The Pitch

> **"Fidelity Go charges 0.35% to put your money in index funds. Betterment charges 0.25%. We show you exactly which funds to buy, run the same simulations, and teach you why — for free.**
>
> **On $500K, that saves you $1,250-$1,750 every year. Over 30 years, that's $100K+ back in your pocket."**

The robo-advisor market is $2.5T+ in AUM. We don't need to capture AUM — we need to capture attention. Every person who learns they can do this themselves is a person who stops paying advisory fees.

---

*Last updated: March 2026*
