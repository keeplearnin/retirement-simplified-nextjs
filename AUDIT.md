# Calculation Audit Log

Track calculation bugs, fixes, and learnings across the app.

---

## Audit #1 — 2026-04-12

### CRITICAL

| # | File | Issue | Status |
|---|------|-------|--------|
| 1 | MyPlan.jsx:585-601 | **RMD double-counted in income** — RMD is included in `baseOrdinaryIncome` (line 515) AND added again via `withdrawal401k` in `totalIncome` (line 601). In no-shortfall years (age 73+), income is overstated by the full RMD amount, inflating taxes. | FIXED 2026-04-12 |

### SIGNIFICANT

| # | File | Issue | Status |
|---|------|-------|--------|
| 2 | MyPlan.jsx:624-631 | **Growth applied before withdrawal** — `bal401k * (1 + return) - withdrawal` lets the portfolio earn a full year of returns on money that was withdrawn. Should be `(bal401k - withdrawal) * (1 + return)` (beginning-of-year withdrawal convention). | FIXED 2026-04-12 |
| 3 | WithdrawalStrategy.jsx:109 | **SS taxability skips 50% tier** — Jumps straight to 85% at $34K threshold, missing the 50% tier between $25K-$34K. Also hardcodes single-filer thresholds. | FIXED 2026-04-12 (+ updated brackets to 2025) |
| 4 | GrowthProjector.jsx:79-86 | **SS early claiming reduction uses flat rate** — Uses 0.556%/month for all months early. Real formula: 5/9% for first 36 months, 5/12% for months beyond. At age 62 (60 months early), underestimates benefit by ~3.3%. | FIXED 2026-05-02 — replaced with two-tier formula matching `lib/incomeEngine.ts` and `SocialSecurity.jsx`; also capped delayed-credit accumulation at age 70. |
| 5 | MonteCarlo.jsx:48 | **Inflation off-by-one in retirement** — First retirement year spending is already inflated by 1 year because loop is 1-indexed. Should use `y - years - 1` exponent. | FIXED 2026-04-12 |
| 6 | MyPlan.jsx:608 | **Retirement return silently reduced to 60%** — User sets 7% return but gets 4.2% in retirement with no UI explanation. Should be separately configurable or clearly disclosed. | BY DESIGN (now `retiredReturnPct` default = 60%, surfaced as an editable assumption; documented in `/methodology`) |
| 7 | GrowthProjector.jsx:284 | **SWR hardcodes life to 90** — `retirementYears = 90 - retireAge` ignores user's longevity setting. Overstates sustainable withdrawal rate for users planning to 95+. | FIXED 2026-04-12 — now `(plan.longevityAge \|\| 95) - retireAge`. This row was stale; the fix already shipped the same day it was logged. |

### MINOR

| # | File | Issue | Status |
|---|------|-------|--------|
| 8 | MyPlan.jsx:616 | **Cash account growth 4.5% is high** — HY savings rates are cyclical; long-term average is 2.5-3%. Currently inflates cash balances. | FIXED 2026-04-12 (changed to 3% working, 2.5% retired) |
| 9 | MyPlan.jsx:660 | **Portfolio balance shown is start-of-year** — "Portfolio at retirement" is the balance entering the year, before growth/withdrawals. Not wrong, but could confuse users. | FIXED 2026-07-15 — number is correct as-is (it's the balance the moment retirement begins; switching to end-of-year would wrongly include a full year of retirement drawdown). Relabeled "Entering Retirement" with a tooltip/sub-label explaining what the figure represents. |
| 10 | MyPlan.jsx:563-567 | **401k gross-up doesn't account for bracket stacking** — Uses marginal rate from pre-withdrawal income. Large withdrawals push into higher brackets. Self-correcting since Pension/Roth fill the gap. | FIXED `ebf9c74` (2026-05-02) — "Fix gross-up bracket crossing" refactored the waterfall into a closure re-run at the post-withdrawal marginal rate when a bracket is crossed. Same fix applied to `lib/computeProjection.js`. This row was stale. |
| 11 | WithdrawalStrategy.jsx:44 | **SS COLA formula confusing** — `Math.max(inflationRate - 0.5, 1) / 100` works by accident for typical inputs but mixes percentage points with decimals. | FIXED 2026-05-02 — replaced with `Math.max(0, inflationRate - 0.5) / 100` (consistent percentage-point units, floored at 0 since SS COLA can never be negative). |
| 12 | WithdrawalStrategy.jsx:112-118 | **Uses 2024 tax brackets, not 2025** — Inconsistent with taxEngine.ts which has 2025 values. | FIXED 2026-07-15 — replaced the hand-rolled, single-filer-only bracket ladder and SS-taxability formula with a direct call to `computeTax()` from `lib/taxEngine.ts` (the same engine used by MyPlan/computeProjection). Picks up current-year brackets automatically, plus MFJ and state tax which the old approximation never had. Also removed the dead "Tax Bracket" selector, which never fed into the calculation. |
| 13 | TaxAware.jsx | **No inflation adjustment** — Nominal returns only, no real-dollar toggle. Both sides treated same way so relative comparison is valid. | FIXED 2026-07-15 — added a "Show inflation-adjusted" toggle that deflates Roth/Traditional/tax-savings balances to today's dollars using `plan.inflationRate`. |
| 14 | expenseEngine.ts:142 | **LTC cost capped at 3x base** — Unrealistically low for young users projecting 55+ years. | FIXED 2026-07-15 — raised the probability-weighted base monthly cost ($2,500 → $3,600, reflecting current Genworth-style cost-of-care data and a higher conditional incidence once a user reaches the LTC window) and switched from a flat 3% rate to `min(healthcareInflation, 4.5%)`, so long-horizon (young) users see LTC costs that track their own inflation assumption instead of an under-stated flat rate, while still capped to avoid runaway compounding over 55+ year horizons. |
| 15 | WithdrawalStrategy.jsx:92-94 | **Growth after withdrawal, opposite of MyPlan** — Inconsistent convention across tabs. | RESOLVED 2026-05-02 — stale note. After #2 fixed `MyPlan` to withdraw-then-grow, `WithdrawalStrategy` (which already withdraws lines 67-81 then grows lines 84-86) is now aligned with the canonical `(bal - withdrawal) * (1 + return)` convention used in `lib/computeProjection.js`. Verified: no code change needed. |

---

## Audit #2 — 2026-05-02 (launch-prep wave)

Re-audit during the couples-mode build and the launch-readiness review. Most issues here were the same bug class as Audit #1 — duplicate math drifting between two implementations, or balance fields silently mixing liquid + illiquid assets.

### CRITICAL

| # | File | Issue | Status |
|---|------|-------|--------|
| 16 | MyPlan.jsx (SuccessScore + 3 sibling sites) | **Success Score showed "100% Fully Funded" while user ran out of money.** User-reported: $5.58M plan at age 60 with $271K spend hit shortfall at 79 in the year-by-year, but headline score was 100%. Root cause: the `brokeAge` check used `portfolioBalance <= 0`, which includes real estate that appreciates forever. Same illiquid-balance bug pattern as #17 below. | FIXED `904db98` — switched 4 sites to `liquidBalance <= 0` (excludes RE + 529). |
| 17 | lib/computeProjection.js | **`firstGapAge` used `portfolioBalance` instead of `liquidBalance`** — a user with any RE on the balance sheet would never trigger the gap-age annotation, even after spendable assets were exhausted. | FIXED `bc924e6` |
| 18 | lib/computeProjection.js | **HSA balance never withdrawn** — projection accumulated HSA contributions but never drew them down in retirement, overstating end-of-life portfolio for HSA-heavy plans by 5–10 years of expenses. | FIXED `bc924e6` (added `withdrawalHSA` step in the drawdown waterfall) |
| 19 | lib/healthcare.ts | **Healthcare bridge cost doubled for subsidy-eligible couples.** `estimateAcaPremium` computed net subsidy on a single-person gross premium, then `computeHealthcare` multiplied that net by `householdSize` — overstating the bridge by ~2x for couples. A $50K-income couple retiring at 55 saw $40K instead of the correct $20K. | FIXED `35d2b87` — scale gross by household size *inside* the subsidy calc, drop the duplicate outer multiplier. |
| 20 | lib/verdict.ts | **Fidelity savings benchmark misapplied to couples with age gaps.** Anchoring the multiple on the older spouse's age and applying it to household income overstated the benchmark by 5–15% for typical age-gap couples. Ages 50/60 at $200K household showed $1.6M instead of the correct $1.40M. | FIXED `35d2b87` — split household income evenly between spouses, apply each spouse's age multiple, sum. Singles unchanged. |

### SIGNIFICANT

| # | File | Issue | Status |
|---|------|-------|--------|
| 21 | components/tabs/SocialSecurity.jsx | **Same flat-rate SS reduction bug as Audit #1 #4** — duplicate of the canonical formula in `lib/incomeEngine.ts`, drifted out of sync. Overstated reduction by ~3.4 pp at age 62 with FRA 67 (showed 33.3% cut instead of the correct 30%). Also uncapped the delayed-credit accumulation past age 70. | FIXED `73f3518` — replaced with two-tier formula, capped delayed credit at age 70. |
| 22 | components/PlanProvider.jsx, AuthProvider.jsx | **Context value rebuilt on every render** — `<Provider value={{ ... }}>` constructed a fresh object every render, forcing every `useAuth()` / `usePlan()` consumer to re-render even on unrelated state changes. Visible jank during slider drags. | FIXED `70330db` (Plan), `73f3518` (Auth) — `useMemo` the value, `useCallback` the action functions. |
| 23 | lib/incomeEngine.ts | **Couples projection loop ended at primary's `longevityAge`** — if the spouse outlives primary, the spouse's salary/SS/pension was truncated. | FIXED `35d2b87` — extend loop bound to `max(primary, spouse)` longevity in primary's frame. (Survivor logic — zero out deceased spouse, MFJ→single, SS step-up — is Phase F.) |
| 24 | components/tabs/MyPlan.jsx | **Status column branch order** in year-by-year table showed wrong category in some edge years (e.g., labeled a year "RMD" when the dominant flow was actually the healthcare bridge). | FIXED in early launch-prep batch — re-ordered branches by precedence. |
| 25 | components/tabs/WithdrawalStrategy.jsx | **Dead Roth-conversion state + 50-line dual-projection loop** kept after the toggle was replaced with a "go to Roth Ladder" promo card. Risk: the dead path could re-surface with a stale formula if anyone wired the toggle back. | FIXED `73f3518` — ~80 lines removed. |

### MINOR

| # | File | Issue | Status |
|---|------|-------|--------|
| 26 | components/tabs/MyPlan.jsx | **Inline `RMD_START = 73` magic constant** instead of importing from `lib/constants.js`. | FIXED `73f3518` — uses `RMD_START_AGE` import. |
| 27 | lib/constants.js, lib/taxEngine.ts | **2026 IRS / SSA / IRMAA constants update** — federal brackets, std deduction, 401(k) limit ($24,500), SS wage base ($184,500), bend points ($1,286/$7,749), HSA limits, IRMAA tiers, FPL all moved from 2025 to 2026 figures, sourced to IRS Rev. Proc. 2025-32, IRS Notice 2025-67, SSA POMS HI 01101.020. | DONE (multiple commits during launch prep) |

### Known limitations carried into launch

These are documented in code and on `/methodology` rather than fixed:

- ~~**Per-spouse RMD divisor**~~ **CLOSED 2026-05-03** by Phase F (commit pending). `lib/computeProjection.js` and the `MyPlan.jsx` inline mirror now track per-spouse 401(k)/Roth/HSA/Pension balances, compute RMDs from each spouse's own balance using their own age, and roll deceased spouse's balances into the survivor's bucket on first death.
- **MyPlan.jsx inline projection mirrors `lib/computeProjection.js`** — kept mathematically identical via the audit but is duplicate work for every future change. Consolidating is a multi-hour touch-everything refactor; deferred until post-launch.
- **State tax** — CA/NY/NJ/OR now use full graduated brackets (closed 2026-05-02). HI, MN, MA, WI still on flat rates with in-planner warning for high earners; on roadmap.

---

## Learnings & Notes

_Add observations here as you use the app and spot issues._

- Working years "gap" in year-by-year table: the "gap" column shows net-after-tax minus expenses. During working years, monthly investment contributions are counted as part of expenses in the gap calc but are actually savings — investigate if this is intentional.
- Expenses at age 90-95 show spikes — possibly healthcare LTC costs kicking in without proper cap scaling.
- **Pattern across both audits: duplicate math drifts.** Items #4/#21 (SS reduction in two places), #16-#17 (`portfolioBalance` vs `liquidBalance` in four sites), #15/#19 (growth-vs-withdrawal ordering different across tabs), and the still-open MyPlan inline projection mirror all have the same shape — the same calculation gets copied into a UI tab, then the canonical version in `lib/` gets fixed and the copy doesn't. Rule of thumb going forward: any tab that does more than render numbers should call into `lib/computeProjection.js` or `lib/incomeEngine.ts`, not roll its own.
- **Pattern: "balance" is ambiguous.** `portfolioBalance` (everything, including illiquid RE/529) vs `liquidBalance` (spendable). Whenever a UI question is "did the user run out of money?", the answer is `liquidBalance`; whenever it's "what is the user worth?", it's `portfolioBalance`. The dual-line chart (`3776696`) makes this visible to users; code should pick the right field deliberately.

---

## Phase F — survivor analysis (2026-05-03)

Closed three open items in one pass:

1. **Per-spouse RMD divisor** (Audit #2 known limitation). Each spouse's 401(k) now lives in its own bucket; RMD = `bal_x / divisor(spouse_x.age)`. Withdrawals draw forced RMDs from each bucket, then any remaining shortfall comes primary-first. End-of-year balances grow per-bucket with each spouse's contribution gated by their own working+alive status.

2. **SS step-up on first death.** When one spouse dies (modeled at their `longevityAge`), the survivor's SS jumps to `max(theirOwn, deceased's would-have-been amount)`. Implemented in `lib/incomeEngine.ts` by computing each spouse's SS as-if-alive, then applying death zeroing + step-up logic. The deceased's line goes to zero; the survivor's line absorbs the higher of the two.

3. **MFJ → single filing flip.** `incomeEngine` now emits `filingStatusHint` per row. Year of first death stays `mfj` per IRS rule (a survivor may file MFJ in the calendar year of death). Year after flips to `single`. `computeProjection.js` and the `MyPlan.jsx` inline mirror both consume `filingStatusHint` instead of the static plan-level `filingStatus` for tax math.

Bonus: pension survivor benefit was already in the data model (`PensionIncome.survivorBenefitPct`) and now actually affects the projection — when one spouse dies, the surviving spouse's pension gets `deceased.pension * survivorBenefitPct` added. Default is 0 (single-life payout, no benefit).

### Phase F open items
- **Inherited IRA 10-year rule (SECURE Act).** When spouse rolls deceased spouse's IRA into their own, no 10-year rule applies. We model this case correctly. Non-spouse heirs get the 10-year rule, which we don't model (out of scope — survivor planning is the spouse case).
- **Qualifying widow(er) status.** Surviving spouse with dependent children may file QW(er) for 2 years after death (effectively MFJ brackets). We assume no dependents and flip straight to single. Caveat noted on `/methodology`.
- **Step-up in cost basis at death.** Taxable brokerage assets get a basis step-up at the deceased's death — the survivor's embedded gains effectively reset. Our `gainsRatio` curve doesn't account for this, so survivor years slightly overstate capital-gains tax on taxable withdrawals. Listed in methodology limitations.
- **Pension survivor benefit defaults to 0.** Most users won't realize the field exists; we don't yet expose a UI input. Power users can edit `incomeSources[].survivorBenefitPct` via localStorage. UI input is on the roadmap.

---

## Audit #3 — 2026-07-15 (status-report follow-up)

A status report flagged six items from this log as still-`todo`/`PARTIAL`. Re-checked each against the current code before touching anything — three (#7, #10, and the Phase F RMD divisor referenced from `ROADMAP.md`) turned out to already be fixed, just never marked here. Updated their rows above instead of re-fixing working code. The remaining three got real fixes:

| # | File | Fix |
|---|------|-----|
| 9 | MyPlan.jsx | Confirmed the displayed number (start-of-year balance) is the correct one for "portfolio at retirement" — relabeled + tooltipped instead of swapping in the end-of-year figure, which would have been a regression (it'd include a full year of retirement drawdown). |
| 12 | WithdrawalStrategy.jsx | Replaced the hand-rolled, single-filer-only, stale-bracket tax estimate with a direct `computeTax()` call from `lib/taxEngine.ts` — closes the "duplicate math drifts" pattern (see Learnings above) for this tab. Also deleted the dead "Tax Bracket" selector that never fed into the calc. |
| 13 | TaxAware.jsx | Added a "Show inflation-adjusted" toggle, deflating both sides to today's dollars using `plan.inflationRate`. |
| 14 | expenseEngine.ts | Raised the LTC probability-weighted base cost and switched the flat 3% rate to `min(healthcareInflation, 4.5%)` so young users' LTC provisioning scales with their own assumptions instead of a fixed low rate, while still capped against 55+-year blow-up. |

Also corrected `ROADMAP.md`'s "Known debt" section, which still listed the per-spouse RMD divisor as an open bug — Phase F (2026-05-03) closed it, and `AUDIT.md` already said so; the roadmap doc just hadn't been updated to match.

**Lesson reinforced:** the same drift pattern noted in Audit #2's Learnings — a fix lands in code but the audit/roadmap doc doesn't get updated — cost real time here re-verifying "known" bugs that were already closed. When closing an item, grep for every doc that mentions it (`AUDIT.md`, `ROADMAP.md`, inline comments) in the same commit.
