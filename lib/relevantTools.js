// Deeper tools that only matter in some situations — shown here only when
// the plan says they apply, so most people never see a list of planners.
export function relevantTools(plan) {
  const age = plan.currentAge;
  const ss = (plan.incomeSources || []).find(s => s.type === 'socialSecurity' && (s.owner || 'primary') === 'primary');
  const pretax = (plan.savings401k || 0) + (plan.spouseSavings401k || 0);
  const yearsToRetire = plan.retireAge - age;
  const out = [];
  if (ss && ss.startAge > age && yearsToRetire <= 15) {
    out.push({ tab: 'income:claim', title: 'When to claim Social Security', why: `You plan to claim at ${ss.startAge}. Each year you wait raises the check for life.` });
  }
  if (plan.retireAge < 65) {
    out.push({ tab: 'income:bridge', title: 'Health cover before Medicare', why: `You retire at ${plan.retireAge}, ${65 - plan.retireAge} year${65 - plan.retireAge === 1 ? '' : 's'} before Medicare starts.` });
  }
  if (age >= 50 && pretax >= 250_000) {
    out.push({ tab: 'roth-strategy:conversions', title: 'Converting to Roth', why: 'Large 401(k)/IRA balances face big required withdrawals later; converting in low-tax years can cut lifetime tax.' });
  } else if (age < 50 && yearsToRetire > 0 && (plan.monthlyContribution || 0) > 0) {
    out.push({ tab: 'roth-strategy:contributions', title: 'Roth or traditional?', why: 'Where your new savings go now decides how they are taxed later.' });
  }
  if (yearsToRetire <= 10) {
    out.push({ tab: 'income:withdrawal', title: 'Which accounts to draw from first', why: 'The order you spend from your accounts in retirement changes your tax bill.' });
  }
  return out;
}
