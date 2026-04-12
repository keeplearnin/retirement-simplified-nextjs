# Test Scenarios — Retire.Simplified

Comprehensive test scenarios for validating calculations and UI behavior.

---

## 1. Portfolio & Savings Calculations

### 1.1 Starting Balance
- **Input**: 401k=$150K, Roth=$50K, Taxable=$30K, HSA=$10K, all others=$0
- **Expected**: Total savings = $240K
- **Verify**: Hero card shows "$240K", badge on Savings section shows "$240K"

### 1.2 New Asset Types Included in Total
- **Input**: Above + Real Estate=$200K, Crypto=$25K, Cash=$10K
- **Expected**: Total = $475K
- **Verify**: Hero card shows "$475K" with breakdowns for all non-zero accounts

### 1.3 Portfolio Growth — Working Years
- **Input**: Age=35, RetireAge=65, 401k=$100K, Return=7%, Monthly Contrib=$1500
- **Expected**: 401k at 65 should be ~$1.1M (compound at 7% + $900/mo for 30 years)
- **Verify**: "Portfolio at Retire" metric card and year-by-year at age 65

### 1.4 Portfolio Growth — Retirement
- **Input**: Same as 1.3, verify retirement years use 60% of return rate
- **Expected**: Return drops from 7% to 4.2% at age 65
- **Verify**: Portfolio declines slower than if using full 7%

### 1.5 Account-Specific Growth Rates
- **Input**: Cash=$100K, Crypto=$50K, Real Estate=$300K, Annuity=$100K
- **Expected**: Cash grows at 3%, Crypto at 7%, RE at 3%, Annuity at 3.5%
- **Verify**: After 10 years — Cash~$134K, Crypto~$98K, RE~$403K, Annuity~$141K

---

## 2. RMD (Required Minimum Distribution)

### 2.1 RMD Starts at 73
- **Input**: 401k=$500K at age 73
- **Expected**: RMD = $500K / 26.5 = ~$18,868
- **Verify**: Year-by-year at age 73 shows withdrawal from 401k

### 2.2 RMD Not Double-Counted
- **Input**: Person at 73 with 401k=$500K, SS=$30K/yr, expenses=$40K/yr
- **Expected**: RMD should appear in income exactly once (as withdrawal), not in both base income AND withdrawal
- **Verify**: Fed tax > $0 at age 73 (RMD is taxable)

### 2.3 RMD When No Shortfall
- **Input**: Age 73, income covers expenses, 401k=$1M
- **Expected**: RMD still forced, appears as income, taxed appropriately
- **Verify**: withdrawal401k >= rmdAmount in year-by-year

---

## 3. Withdrawal Order

### 3.1 Cash First
- **Input**: Cash=$50K, Taxable=$100K, 401k=$200K, Roth=$50K, shortfall=$30K
- **Expected**: $30K withdrawn from Cash first
- **Verify**: Cash depletes before other accounts

### 3.2 Full Sequence
- **Input**: All accounts at $50K each, large annual shortfall of $60K
- **Expected**: Cash → Taxable → Crypto → Annuity → 401k → Pension → Roth
- **Verify**: Accounts deplete in this order in year-by-year

### 3.3 Real Estate Not Withdrawn
- **Input**: RE=$500K, all other accounts=$0, shortfall=$30K
- **Expected**: RE continues to appreciate but is NOT drawn down
- **Verify**: Gap shows shortfall, RE balance keeps growing

### 3.4 529 Not Withdrawn
- **Input**: 529=$100K, all other accounts=$0, shortfall=$20K
- **Expected**: 529 excluded from retirement withdrawals
- **Verify**: 529 balance keeps growing, gap shows shortfall

---

## 4. Tax Calculations

### 4.1 Working Year Taxes
- **Input**: Salary=$100K, Single, CA
- **Expected**: Federal ~$14K, CA state ~$5K
- **Verify**: Year-by-year tax columns

### 4.2 SS Taxability — 50% Tier
- **Input**: Combined income ~$30K (between $25K-$34K threshold)
- **Expected**: 50% of excess over $25K is taxable, NOT jumping to 85%
- **Verify**: In WithdrawalStrategy tab

### 4.3 SS Taxability — 85% Tier
- **Input**: Combined income > $34K
- **Expected**: $4,500 + 85% of excess over $34K
- **Verify**: In WithdrawalStrategy tab

### 4.4 401k Withdrawal Tax Gross-Up
- **Input**: $50K shortfall, 22% marginal bracket
- **Expected**: Withdraw ~$64K from 401k to net $50K after tax
- **Verify**: withdrawal401k > shortfall amount

---

## 5. Income Projections

### 5.1 Salary Stops at Retirement
- **Input**: Salary=$100K, RetireAge=65
- **Expected**: Income from salary is $0 at age 65+
- **Verify**: Year-by-year income drops at 65

### 5.2 SS Starts at Claim Age
- **Input**: SS benefit=$2500/mo, claim age=67
- **Expected**: $0 SS income before 67, $30K/yr at 67+
- **Verify**: Year-by-year shows SS kicking in at 67

### 5.3 Salary Growth
- **Input**: Salary=$85K, growth=3%
- **Expected**: Salary at age 65 (30 years later) = $85K * 1.03^30 = ~$206K
- **Verify**: Year-by-year income at age 60-64

---

## 6. Expense Projections

### 6.1 Spending Phases
- **Input**: GoGo ends=75, SlowGo ends=85
- **Expected**: 100% spending 65-75, 85% from 75-85, 70% from 85+
- **Verify**: Year-by-year expenses decrease at 75 and 85

### 6.2 Healthcare / LTC at End of Life
- **Input**: Longevity=95
- **Expected**: LTC costs kick in at max(85, 95-5)=90, ramp from 50% to 100%
- **Verify**: Expenses spike in last 5 years

### 6.3 Retirement Spending Base
- **Input**: Current spending=$75K, Retirement spending=$60K
- **Expected**: Retirement years use $60K base (not $75K * 0.8)
- **Verify**: Expenses at age 65 should be around $60K (adjusted for inflation)

---

## 7. Monte Carlo

### 7.1 Inflation Indexing
- **Input**: Age=35, RetireAge=65, Spend=$50K, Inflation=2.5%
- **Expected**: First retirement year spending = $50K (NOT $50K * 1.025)
- **Verify**: Run simulation, check that success rate is reasonable

### 7.2 Success Rate Sanity
- **Input**: Large savings ($2M), moderate spending ($40K)
- **Expected**: Success rate > 95%
- **Verify**: Should not show failure with very conservative setup

---

## 8. Shared State (Context)

### 8.1 Age Syncs Across Tabs
- **Input**: Set age=42 in My Plan
- **Expected**: Portfolio Builder shows "Age: 42", Tax Strategy shows "Age 42", Monte Carlo starts at 42
- **Verify**: Navigate to each tab after changing

### 8.2 Savings Sync
- **Input**: Set 401k=$300K in My Plan
- **Expected**: GrowthProjector shows "Balance: $300K (from My Plan)"
- **Verify**: Navigate to Build > Growth Projector

---

## 9. Onboarding

### 9.1 First Visit Shows Wizard
- **Pre**: Clear localStorage
- **Expected**: Onboarding overlay appears with "Plan Your Retirement"
- **Verify**: 4 dots visible, "Get Started" button

### 9.2 Values Flow to Dashboard
- **Input**: Set age=30, salary=$120K, 401k=$80K in wizard
- **Expected**: Dashboard shows age 30, income ~$10K/mo, savings including $80K
- **Verify**: Hero cards after clicking "See My Plan"

### 9.3 Skip Preserves Defaults
- **Input**: Click "Skip" immediately
- **Expected**: Dashboard loads with DEFAULT_PLAN values (age 40, $100K salary)
- **Verify**: Hero card shows defaults

---

## 10. UI / Layout

### 10.1 Desktop 2-Column
- **Viewport**: 1280px+
- **Expected**: Inputs on left (sticky), results on right
- **Verify**: Both columns visible simultaneously

### 10.2 Mobile Single Column
- **Viewport**: 375px
- **Expected**: Results first, inputs below
- **Verify**: No horizontal overflow, nav scrollable

### 10.3 Light Theme Contrast
- **Toggle**: Switch to light theme
- **Expected**: Cards have visible borders, text readable, accent color visible
- **Verify**: No white-on-white text
