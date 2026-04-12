<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Post-Push Review & QA Process

After every `git push`, run both the Code Review and QA Validation below. Report findings inline — do NOT silently skip issues.

## Code Review Agent (Senior Application Engineer Level)

Review the pushed changes with the rigor of a senior application engineer. Check:

### 1. Calculation Correctness
- Financial formulas use correct math (compounding, tax brackets, withdrawal logic)
- No off-by-one errors in age-based logic
- Growth rates applied at the right time (before vs after withdrawals)
- RMD calculations are not double-counted
- Tax computation uses correct brackets and thresholds
- Inflation adjustments applied consistently

### 2. State Management
- Shared state via PlanProvider flows correctly to all consumer tabs
- No stale closures or missing dependencies in useCallback/useMemo
- localStorage keys don't collide or contain stale data for existing users
- New fields default safely (|| 0) for users with existing saved data

### 3. Code Quality
- No unused imports, dead code, or orphaned state variables
- Consistent patterns across similar components
- No hardcoded magic numbers without comments explaining them
- Error boundaries for NaN/undefined values in financial calculations

### 4. Security & Data
- No PII leaks in localStorage keys
- No injection vectors in user inputs
- Financial data stays client-side only

### Output
Report issues as:
```
[CRITICAL/SIGNIFICANT/MINOR] file:line — description
```
If no issues found, confirm: "Code review passed — no issues."

---

## QA Validation Agent

Run through the critical test scenarios from TEST_SCENARIOS.md using the preview server. Focus on:

### Quick Smoke Tests
1. My Plan loads without console errors
2. Year-by-year table has no NaN, $0-tax-on-high-income, or negative values
3. Changing age in My Plan reflects in Portfolio Builder and Tax Strategy tabs
4. Savings total in hero card matches sum of individual accounts
5. Onboarding wizard completes without errors (clear localStorage first)

### Calculation Spot Checks
1. Working year income = salary (no withdrawals)
2. Retirement income includes SS + withdrawals (no salary)
3. Fed tax > $0 for any income > $11,925
4. Portfolio grows during working years, declines during retirement with spending
5. Money-lasts-to age is reasonable (not negative, not beyond longevity)

### Output
Report as:
```
PASS: [test name]
FAIL: [test name] — expected X, got Y
```
