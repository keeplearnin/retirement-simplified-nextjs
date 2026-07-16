/**
 * plaidMapping.js — normalize Plaid accounts into the plan's savings buckets.
 *
 * Plaid returns accounts tagged with a `type` (depository | investment |
 * credit | loan) and a finer `subtype` (checking, 401k, roth, brokerage, hsa,
 * …). The projection engine thinks in buckets (savings401k, savingsRoth,
 * savingsTaxable, savingsCash, savingsHSA, savings529, savingsCrypto) plus a
 * debts[] list. This module is the pure, tested bridge between the two so a
 * linked account lands in the right tax treatment.
 *
 * No SDK import — operates on already-fetched, normalized account objects, so
 * it runs client- or server-side and is trivially testable.
 */

// Plaid subtype → plan bucket. Anything not listed falls through to a
// type-level default below. Tax treatment is what matters: tax-deferred vs
// Roth vs taxable vs cash vs HSA — getting this wrong misprojects tax.
const SUBTYPE_TO_BUCKET = {
  // Tax-deferred (pre-tax): taxed as ordinary income on withdrawal + RMDs
  '401k': 'savings401k',
  '403b': 'savings401k',
  '457b': 'savings401k',
  ira: 'savings401k',
  'traditional 401k': 'savings401k',
  'traditional ira': 'savings401k',
  sep: 'savings401k',
  'sep ira': 'savings401k',
  simple: 'savings401k',
  'simple ira': 'savings401k',
  'thrift savings plan': 'savings401k',
  pension: 'savings401k',
  'retirement pension': 'savings401k',
  keogh: 'savings401k',
  // Roth (post-tax): tax-free growth + withdrawal, no RMD
  roth: 'savingsRoth',
  'roth ira': 'savingsRoth',
  'roth 401k': 'savingsRoth',
  // HSA: triple-tax-advantaged
  hsa: 'savingsHSA',
  // 529: education, not drawn for retirement
  '529': 'savings529',
  // Taxable brokerage
  brokerage: 'savingsTaxable',
  'non-taxable brokerage account': 'savingsTaxable',
  'taxable brokerage': 'savingsTaxable',
  'mutual fund': 'savingsTaxable',
  'stock plan': 'savingsTaxable',
  'non-custodial wallet': 'savingsCrypto',
  crypto: 'savingsCrypto',
  'cryptocurrency': 'savingsCrypto',
  // Cash / depository
  checking: 'savingsCash',
  savings: 'savingsCash',
  'money market': 'savingsCash',
  cd: 'savingsCash',
  'prepaid': 'savingsCash',
  'cash management': 'savingsCash',
};

// Type-level fallback when the subtype is unknown/null.
const TYPE_DEFAULT = {
  depository: 'savingsCash',
  investment: 'savingsTaxable', // conservative: unknown investment → taxable
  brokerage: 'savingsTaxable',
};

const DEBT_TYPES = new Set(['credit', 'loan']);

// Normalize to lower-case words: Plaid and demo data mix underscores and
// spaces ('roth_ira' vs 'roth ira'), so collapse both to spaces.
const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/[_-]+/g, ' ');

// Keyword fallback when the exact subtype isn't in the table — robust to
// Plaid's real-world subtype variance (roth 401k, sep ira, rollover, etc.).
// Order matters: check Roth before generic 401k/ira so "roth 401k" → Roth.
function keywordBucket(subtype) {
  const s = ` ${subtype} `;
  if (/\broth\b/.test(s)) return 'savingsRoth';
  if (/\bhsa\b/.test(s)) return 'savingsHSA';
  if (/\b529\b/.test(s)) return 'savings529';
  if (/\b(401k|403b|457b|401a|ira|sep|simple|pension|keogh|tsp|thrift|annuity)\b/.test(s)) return 'savings401k';
  if (/\b(crypto|cryptocurrency|wallet)\b/.test(s)) return 'savingsCrypto';
  if (/\b(brokerage|taxable|mutual fund|stock|non taxable)\b/.test(s)) return 'savingsTaxable';
  if (/\b(checking|savings|money market|cd|cash|prepaid)\b/.test(s)) return 'savingsCash';
  return null;
}

/** Classify a single Plaid account. Returns { kind: 'bucket'|'debt'|'skip', ... }. */
export function classifyAccount(account) {
  const type = norm(account.type);
  const subtype = norm(account.subtype);
  const balance = Number(account.balance ?? account.balances?.current ?? 0) || 0;

  if (DEBT_TYPES.has(type)) {
    // Plaid reports owed balances as positive on credit/loan accounts.
    return { kind: 'debt', balance: Math.abs(balance), subtype, type };
  }

  const bucket = SUBTYPE_TO_BUCKET[subtype] || keywordBucket(subtype) || TYPE_DEFAULT[type];
  if (!bucket) return { kind: 'skip', reason: `unmapped ${type}/${subtype}` };
  return { kind: 'bucket', bucket, balance: Math.max(0, balance) };
}

/**
 * Aggregate a list of normalized Plaid accounts into plan-bucket deltas.
 * Returns { buckets: { savings401k, ... }, debts: [...], skipped: [...] }.
 * Balances are SUMMED per bucket — the caller decides whether to replace or
 * add to the plan's existing manual values.
 */
export function aggregateAccounts(accounts) {
  const buckets = {
    savings401k: 0, savingsRoth: 0, savingsTaxable: 0,
    savingsCash: 0, savingsHSA: 0, savings529: 0, savingsCrypto: 0,
  };
  const debts = [];
  const skipped = [];

  for (const acct of accounts || []) {
    const c = classifyAccount(acct);
    if (c.kind === 'bucket') {
      buckets[c.bucket] += Math.round(c.balance);
    } else if (c.kind === 'debt') {
      if (c.balance > 0) {
        debts.push({
          name: acct.name || acct.officialName || (c.subtype ? c.subtype : 'Linked debt'),
          remainingBalance: Math.round(c.balance),
          // Plaid balance endpoints don't return APR/payment; seed sensible
          // defaults the user can adjust. Credit cards ~ 22%, loans ~ 7%.
          interestRate: c.type === 'credit' ? 22 : 7,
          monthlyPayment: Math.max(50, Math.round(c.balance * (c.type === 'credit' ? 0.03 : 0.012))),
        });
      }
    } else {
      skipped.push({ name: acct.name, reason: c.reason });
    }
  }

  return { buckets, debts, skipped };
}

/**
 * Merge aggregated Plaid balances into a plan. `mode`:
 *   'replace' — linked buckets overwrite the plan's manual values (the
 *               default: aggregation is the source of truth once connected).
 *   'add'     — linked balances add on top (for supplementing manual entry).
 * Returns a shallow-updated plan patch (not the whole plan) for bulkUpdate.
 */
export function mergeIntoPlan(plan, aggregated, mode = 'replace') {
  const patch = {};
  for (const [bucket, val] of Object.entries(aggregated.buckets)) {
    if (val <= 0 && mode === 'replace') continue; // don't zero out manual entries with an empty link
    patch[bucket] = mode === 'add' ? (plan[bucket] || 0) + val : val;
  }
  if (aggregated.debts.length > 0) {
    const existing = mode === 'add' ? (plan.debts || []) : (plan.debts || []).filter(d => !d._fromPlaid);
    const maxId = [...existing].reduce((m, d) => Math.max(m, Number(d.id) || 0), 200);
    patch.debts = [
      ...existing,
      ...aggregated.debts.map((d, i) => ({ ...d, id: maxId + 1 + i, _fromPlaid: true })),
    ];
  }
  return patch;
}
