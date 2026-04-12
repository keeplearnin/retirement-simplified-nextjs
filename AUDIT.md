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
| 4 | GrowthProjector.jsx:79-86 | **SS early claiming reduction uses flat rate** — Uses 0.556%/month for all months early. Real formula: 5/9% for first 36 months, 5/12% for months beyond. At age 62 (60 months early), underestimates benefit by ~3.3%. | todo |
| 5 | MonteCarlo.jsx:48 | **Inflation off-by-one in retirement** — First retirement year spending is already inflated by 1 year because loop is 1-indexed. Should use `y - years - 1` exponent. | FIXED 2026-04-12 |
| 6 | MyPlan.jsx:608 | **Retirement return silently reduced to 60%** — User sets 7% return but gets 4.2% in retirement with no UI explanation. Should be separately configurable or clearly disclosed. | todo |
| 7 | GrowthProjector.jsx:284 | **SWR hardcodes life to 90** — `retirementYears = 90 - retireAge` ignores user's longevity setting. Overstates sustainable withdrawal rate for users planning to 95+. | todo |

### MINOR

| # | File | Issue | Status |
|---|------|-------|--------|
| 8 | MyPlan.jsx:616 | **Cash account growth 4.5% is high** — HY savings rates are cyclical; long-term average is 2.5-3%. Currently inflates cash balances. | FIXED 2026-04-12 (changed to 3% working, 2.5% retired) |
| 9 | MyPlan.jsx:660 | **Portfolio balance shown is start-of-year** — "Portfolio at retirement" is the balance entering the year, before growth/withdrawals. Not wrong, but could confuse users. | todo |
| 10 | MyPlan.jsx:563-567 | **401k gross-up doesn't account for bracket stacking** — Uses marginal rate from pre-withdrawal income. Large withdrawals push into higher brackets. Self-correcting since Pension/Roth fill the gap. | todo |
| 11 | WithdrawalStrategy.jsx:44 | **SS COLA formula confusing** — `Math.max(inflationRate - 0.5, 1) / 100` works by accident for typical inputs but mixes percentage points with decimals. | todo |
| 12 | WithdrawalStrategy.jsx:112-118 | **Uses 2024 tax brackets, not 2025** — Inconsistent with taxEngine.ts which has 2025 values. | todo |
| 13 | TaxAware.jsx | **No inflation adjustment** — Nominal returns only, no real-dollar toggle. Both sides treated same way so relative comparison is valid. | todo |
| 14 | expenseEngine.ts:142 | **LTC cost capped at 3x base** — Unrealistically low for young users projecting 55+ years. | todo |
| 15 | WithdrawalStrategy.jsx:92-94 | **Growth after withdrawal, opposite of MyPlan** — Inconsistent convention across tabs. | todo |

---

## Learnings & Notes

_Add observations here as you use the app and spot issues._

- Working years "gap" in year-by-year table: the "gap" column shows net-after-tax minus expenses. During working years, monthly investment contributions are counted as part of expenses in the gap calc but are actually savings — investigate if this is intentional.
- Expenses at age 90-95 show spikes — possibly healthcare LTC costs kicking in without proper cap scaling.
