/**
 * healthCheck.ts — client-side health check scheduling + report storage.
 *
 * Tracks when the last autonomous plan health check ran so the AI Advisor
 * can auto-trigger a new one after 7 days without being asked.
 */

const LAST_CHECK_KEY = 'health-check-last-run-v1';
const REPORT_KEY = 'health-check-report-v1';
const CHECK_INTERVAL_DAYS = 7;

export type AlertSeverity = 'high' | 'medium' | 'low';
export type OverallScore = 'excellent' | 'good' | 'needs_attention' | 'critical';

export interface HealthAlert {
  severity: AlertSeverity;
  message: string;
}

export interface HealthReport {
  generatedAt: string;
  overallScore: OverallScore;
  scoreLabel: string;
  alerts: HealthAlert[];
  recommendations: string[];
  keyMetrics: {
    moneyLastsAge: number | null;
    gapStatus: string;
    savingsGap: number;
    portfolioAtRetire: number;
  };
  emailSummary: string;
}

export function isHealthCheckDue(): boolean {
  if (typeof window === 'undefined') return false;
  const last = localStorage.getItem(LAST_CHECK_KEY);
  if (!last) return true;
  const daysSince = (Date.now() - Number(last)) / 86_400_000;
  return daysSince >= CHECK_INTERVAL_DAYS;
}

export function markHealthCheckRan(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
}

export function saveHealthReport(report: HealthReport): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REPORT_KEY, JSON.stringify(report));
}

export function loadHealthReport(): HealthReport | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    return raw ? (JSON.parse(raw) as HealthReport) : null;
  } catch {
    return null;
  }
}

export function clearHealthReport(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REPORT_KEY);
  localStorage.removeItem(LAST_CHECK_KEY);
}
