export const quizQuestions = [
  { q: 'How would you react if your portfolio dropped 30% in a month?', opts: ['Sell everything immediately', 'Sell some to reduce risk', 'Do nothing, wait it out', 'Buy more at the discount'] },
  { q: 'When do you need this money?', opts: ['Within 5 years', '5-10 years', '10-20 years', '20+ years'] },
  { q: 'What is your current income stability?', opts: ['Unstable / irregular', 'Somewhat stable', 'Very stable with growth', 'Multiple income streams'] },
  { q: 'How much investing experience do you have?', opts: ['Complete beginner', 'I know the basics', 'Intermediate — a few years', 'Advanced — very comfortable'] },
  { q: 'What matters more to you?', opts: ['Protecting what I have', 'Steady, predictable growth', 'Strong growth with some risk', 'Maximum growth, I can handle drops'] },
];

export const sectionNav = [
  { id: 'start', label: 'Where to Start', icon: '🧭' },
  { id: 'checklist', label: 'Pre-Invest Checklist', icon: '✅' },
  { id: 'risk', label: 'Risk Quiz', icon: '🎯' },
  { id: 'what', label: 'What to Buy', icon: '🛒' },
  { id: 'dca', label: 'DCA Calculator', icon: '💰' },
  { id: 'mistakes', label: 'Mistakes to Avoid', icon: '🚫' },
];

export const investSteps = [
  { num: 1, title: 'Build an Emergency Fund', desc: 'Save 3-6 months of expenses in a high-yield savings account before investing. This protects you from selling investments at a loss when life happens.', priority: 'Essential', color: 'var(--danger)' },
  { num: 2, title: 'Pay Off High-Interest Debt', desc: 'Any debt above 6-7% interest should be paid off first. Guaranteed return that beats the stock market average.', priority: 'Essential', color: 'var(--danger)' },
  { num: 3, title: 'Get Your 401(k) Match', desc: 'Contribute enough to your employer&apos;s 401(k) to get the full match. It&apos;s an instant 50-100% return on your money.', priority: 'High', color: 'var(--warn)' },
  { num: 4, title: 'Max Out Roth IRA', desc: 'Contribute up to $7,000/year ($8,000 if 50+). Tax-free growth and withdrawals in retirement make this incredibly powerful.', priority: 'High', color: 'var(--warn)' },
  { num: 5, title: 'Max Out 401(k)', desc: 'After Roth IRA, increase 401(k) contributions toward the $23,500 annual limit. Pre-tax contributions reduce your tax bill today.', priority: 'Medium', color: 'var(--accent)' },
  { num: 6, title: 'Taxable Brokerage Account', desc: 'Once tax-advantaged accounts are maxed, invest in a regular brokerage account. No tax benefits but no restrictions either.', priority: 'Optional', color: 'var(--text-dim)' },
];

export const fundCards = [
  {
    title: 'US Total Stock Market',
    desc: 'Covers the entire US stock market — large, mid, and small cap companies. The core of most portfolios.',
    allocation: '50-70%',
    color: 'var(--accent)',
    tickers: { Vanguard: 'VTI / VTSAX', Fidelity: 'FSKAX / FZROX', Schwab: 'SWTSX' },
  },
  {
    title: 'International Stocks',
    desc: 'Developed and emerging markets outside the US. Provides geographic diversification.',
    allocation: '15-30%',
    color: 'var(--warn)',
    tickers: { Vanguard: 'VXUS / VTIAX', Fidelity: 'FTIHX / FZILX', Schwab: 'SWISX' },
  },
  {
    title: 'US Bond Market',
    desc: 'Government and corporate bonds. Reduces volatility and provides stability during stock downturns.',
    allocation: '10-30%',
    color: 'var(--blue)',
    tickers: { Vanguard: 'BND / VBTLX', Fidelity: 'FXNAX', Schwab: 'SCHZ' },
  },
  {
    title: 'Target Date Fund',
    desc: 'All-in-one fund that automatically adjusts allocation as you approach retirement. Choose the year closest to when you&apos;ll retire.',
    allocation: '100% (standalone)',
    color: 'var(--success)',
    tickers: { Vanguard: 'VLXVX (2065)', Fidelity: 'FFIJX (2065)', Schwab: 'SWYNX (2065)' },
  },
];

export const mistakes = [
  { title: 'Timing the Market', cost: 'Avg 1.5% annual return loss', fix: 'Set up automatic investments on a schedule and don&apos;t look at your portfolio daily.' },
  { title: 'Not Starting Early Enough', cost: '$500K+ in lost growth over 30 years', fix: 'Start with whatever you can, even $50/month. Time in the market beats timing the market.' },
  { title: 'Picking Individual Stocks', cost: '80% of stock pickers underperform index funds', fix: 'Buy broad index funds instead. You&apos;ll beat most professional fund managers.' },
  { title: 'Paying High Fees', cost: '1% fees can cost $590K over 40 years', fix: 'Only buy funds with expense ratios under 0.20%. Ideally under 0.05%.' },
  { title: 'Panic Selling During Crashes', cost: 'Missing the 10 best days cuts returns by 50%', fix: 'Zoom out. Every crash in history has been followed by recovery and new highs.' },
  { title: 'Not Diversifying', cost: 'Single stock can drop 90%+ permanently', fix: 'Index funds give you instant diversification across hundreds of companies.' },
  { title: 'Checking Portfolio Too Often', cost: 'Leads to emotional decisions and trading', fix: 'Check quarterly at most. Set it and forget it — rebalance once a year.' },
  { title: 'Waiting for the "Perfect" Time', cost: 'Every year delayed costs ~7% compounding', fix: 'The best time to invest was yesterday. The second best time is today.' },
];
