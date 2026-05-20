/**
 * quarterlyReview.ts — client-side scheduling + storage for the
 * Progress / Quarterly Review agent.
 *
 * "Quarterly" is the framing; the actual cadence is intelligent based on
 * how long the user has been using the app:
 *   - < 7 days of history  → no review yet (not enough signal)
 *   - 7–30 days            → "Weekly progress" (auto-fires after 7d)
 *   - 30–90 days           → "Monthly progress" (auto-fires after 30d)
 *   - 90+ days             → "Quarterly review" (auto-fires every 90d)
 *
 * The agent endpoint picks the right framing based on the period it sees.
 */

const LAST_RUN_KEY = 'rs:quarterly-review-last-run-v1';
const REPORT_KEY = 'rs:quarterly-review-report-v1';
const ONE_DAY = 86_400_000;

export type ReviewTrend = 'improving' | 'declining' | 'stable';

export interface QuarterlyReportChange {
  field: string;            // user-friendly label, e.g. "Retirement age"
  before: string;           // formatted display value
  after: string;
  significance: 'major' | 'minor';
}

export interface QuarterlyReport {
  generatedAt: string;             // ISO
  periodDays: number;
  framing: 'weekly' | 'monthly' | 'quarterly';
  headline: string;                // 1-sentence summary
  trend: ReviewTrend;
  changes: QuarterlyReportChange[];
  metrics: {
    moneyLastsAge: { before: number | null; after: number | null };
    portfolioAtRetire: { before: number; after: number };
  };
  topRecommendation: string;
  nextReviewInDays: number;
}

function intervalForFraming(framing: QuarterlyReport['framing']): number {
  return framing === 'weekly' ? 7 : framing === 'monthly' ? 30 : 90;
}

export function isReviewDue(snapshotCount: number): boolean {
  if (typeof window === 'undefined') return false;
  if (snapshotCount < 2) return false; // need at least today + one prior day

  const lastRun = Number(localStorage.getItem(LAST_RUN_KEY) ?? 0);
  if (!lastRun) {
    // No prior review — fire if user has at least 7 days of history.
    return snapshotCount >= 7;
  }
  const daysSince = (Date.now() - lastRun) / ONE_DAY;
  // The interval depends on the framing of the LAST report — use the saved
  // report's framing if available, else default to weekly (most permissive).
  const last = loadReport();
  const interval = last ? intervalForFraming(last.framing) : 7;
  return daysSince >= interval;
}

export function markReviewRan(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
}

export function saveReport(report: QuarterlyReport): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REPORT_KEY, JSON.stringify(report));
}

export function loadReport(): QuarterlyReport | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    return raw ? (JSON.parse(raw) as QuarterlyReport) : null;
  } catch {
    return null;
  }
}

export function clearReport(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REPORT_KEY);
  localStorage.removeItem(LAST_RUN_KEY);
}
