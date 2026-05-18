/**
 * planHistory.ts — client-side plan snapshot store.
 *
 * Saves one snapshot per calendar day to localStorage (key: plan-history-v1).
 * Max 90 entries (~3 months). Each snapshot captures the metrics that matter
 * for tracking progress over time so Claude can answer "how has my plan changed?"
 */

import { computeProjection } from '@/lib/computeProjection';
import { computeVerdict } from '@/lib/verdict';
import type { VerdictInput } from '@/lib/verdict';

const STORAGE_KEY = 'plan-history-v1';
const MAX_SNAPSHOTS = 90;

export interface PlanSnapshot {
  savedAt: string;           // YYYY-MM-DD
  retireAge: number;
  longevityAge: number;
  totalSavings: number;
  monthlyContribution: number;
  annualSpending: number;
  retireSpending: number;
  moneyLastsAge: number | null;
  portfolioAtRetire: number;
  gapStatus: string;
  savingsGap: number;
  projectedBalance: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function totalSavings(plan: Record<string, unknown>): number {
  const fields = [
    'savings401k', 'savingsRoth', 'savingsTaxable', 'savingsHSA',
    'savingsCash', 'savingsRealEstate', 'savingsCrypto', 'savingsAnnuity',
    'spouseSavings401k', 'spouseSavingsRoth', 'spouseSavingsHSA',
  ];
  return fields.reduce((sum, f) => sum + ((plan[f] as number) ?? 0), 0);
}

function primarySalary(plan: Record<string, unknown>): number {
  const sources = (plan.incomeSources as Array<Record<string, unknown>>) ?? [];
  const s = sources.find(
    (src) => src.type === 'salary' && (src.owner ?? 'primary') === 'primary'
  );
  return (s?.amount as number) ?? 0;
}

export function savePlanSnapshot(plan: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  try {
    const projection = computeProjection(plan as Parameters<typeof computeProjection>[0]) as Record<string, unknown>;

    const income =
      primarySalary(plan) +
      ((plan.hasSpouse
        ? ((plan.incomeSources as Array<Record<string, unknown>>)?.find(
            (s) => s.type === 'salary' && s.owner === 'spouse'
          )?.amount as number) ?? 0
        : 0));

    const verdictInput: VerdictInput = {
      currentAge: plan.currentAge as number,
      retirementAge: plan.retireAge as number,
      annualIncome: income || primarySalary(plan),
      currentSavings: totalSavings(plan),
      monthlyContribution:
        ((plan.monthlyContribution as number) ?? 0) +
        ((plan.spouseMonthlyContribution as number) ?? 0),
      filingStatus: (plan.filingStatus as 'single' | 'mfj') ?? 'single',
      hasSpouse: (plan.hasSpouse as boolean) ?? false,
      ...(plan.hasSpouse
        ? {
            spouseCurrentAge: plan.spouseCurrentAge as number,
            spouseRetirementAge: plan.spouseRetireAge as number,
          }
        : {}),
    };
    const verdict = computeVerdict(verdictInput);

    const snapshot: PlanSnapshot = {
      savedAt: todayKey(),
      retireAge: plan.retireAge as number,
      longevityAge: plan.longevityAge as number,
      totalSavings: totalSavings(plan),
      monthlyContribution: (plan.monthlyContribution as number) ?? 0,
      annualSpending: (plan.annualSpending as number) ?? 0,
      retireSpending: (plan.retireSpending as number) ?? 0,
      moneyLastsAge: (projection.moneyLastsAge as number) ?? null,
      portfolioAtRetire: Math.round((projection.portfolioAtRetire as number) ?? 0),
      gapStatus: verdict.gapStatus,
      savingsGap: Math.round(verdict.savingsGap),
      projectedBalance: Math.round(verdict.projectedBalance),
    };

    const existing = loadHistory();

    // Replace today's entry if it already exists, otherwise prepend
    const filtered = existing.filter((s) => s.savedAt !== todayKey());
    const updated = [snapshot, ...filtered].slice(0, MAX_SNAPSHOTS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Fire-and-forget sync to DB — non-blocking, never crashes
    syncSnapshotToDb(snapshot).catch(() => undefined);
  } catch {
    // Never crash the UI — history is best-effort
  }
}

async function syncSnapshotToDb(snapshot: PlanSnapshot): Promise<void> {
  try {
    const Auth = (await import('@/lib/auth')).default;
    const token = Auth.getIdToken?.();
    if (!token) return;

    await fetch('/api/db/snapshots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ savedAt: snapshot.savedAt, data: snapshot }),
    });
  } catch {
    // DB sync is best-effort — localStorage is the offline fallback
  }
}

export function loadHistory(): PlanSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PlanSnapshot[]) : [];
  } catch {
    return [];
  }
}

/**
 * Fetches history from DB and merges with localStorage.
 * DB is source of truth; localStorage fills gaps when offline.
 * Returns merged array sorted newest-first.
 */
export async function loadHistoryFromDb(token: string): Promise<PlanSnapshot[]> {
  try {
    const resp = await fetch('/api/db/snapshots', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return loadHistory();

    const { snapshots } = await resp.json() as { snapshots: Array<{ saved_at: string; data: PlanSnapshot }> };
    const dbSnapshots: PlanSnapshot[] = snapshots.map((row) => ({
      ...row.data,
      savedAt: row.saved_at,
    }));

    // Merge: DB rows + any localStorage entries not yet synced
    const local = loadHistory();
    const dbDates = new Set(dbSnapshots.map((s) => s.savedAt));
    const localOnly = local.filter((s) => !dbDates.has(s.savedAt));
    const merged = [...dbSnapshots, ...localOnly]
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .slice(0, MAX_SNAPSHOTS);

    // Update localStorage cache
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return loadHistory();
  }
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
