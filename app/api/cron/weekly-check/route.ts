/**
 * /api/cron/weekly-check — server-side weekly health check for all opted-in users.
 *
 * Triggered by GitHub Actions (.github/workflows/weekly-check.yml) every Monday at 8am.
 * Can also be triggered by AWS EventBridge or any HTTP cron service.
 *
 * Security: requires Authorization: Bearer ${CRON_SECRET} header.
 *
 * Flow per user:
 *   1. Load plan from user_plans table
 *   2. Load snapshot history from plan_snapshots
 *   3. Run autonomous health check agent (Claude + all tools)
 *   4. Send email via Resend
 *   5. Update last_emailed_at
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getUsersForWeeklyCheck, getUserPlan, getSnapshots, updateLastEmailed } from '@/lib/db';
import { sendEmail, buildHealthCheckEmail, isEmailConfigured } from '@/lib/email';
import { TOOL_DEFINITIONS, executeTool } from '@/lib/agentTools';
import type { PlanSnapshot } from '@/lib/planHistory';

const CRON_SECRET = process.env.CRON_SECRET ?? '';
const MAX_ITERATIONS = 8;

// Cost cap: max users processed per cron invocation. Each user triggers up to
// MAX_ITERATIONS Claude calls; at $0.001-0.003 per Haiku call, BATCH_SIZE=50
// caps a single run at ~$1.20. Override via env var if you want to raise it.
const BATCH_SIZE = Number(process.env.WEEKLY_CHECK_BATCH_SIZE ?? 50);
const HARD_CEILING = 200; // never process more than this regardless of env

// Emergency kill switch: set WEEKLY_CHECK_DISABLED=1 to no-op the cron without
// having to redeploy or remove the GitHub Actions workflow.
const KILL_SWITCH = process.env.WEEKLY_CHECK_DISABLED === '1';

function safeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

const HEALTH_CHECK_PROMPT = `You are an autonomous retirement plan health check agent. Analyze the user's retirement plan thoroughly and produce a structured health report.

Follow these steps in order:
1. Call get_plan_summary to read the user's plan
2. Call run_projection to get their baseline money-lasts-to age
3. Call get_verdict to check their savings benchmark status
4. Call optimize_ss_claiming to find the optimal SS claiming age
5. Call get_plan_history to check their progress trend
6. Call analyze_portfolio_recommendations for proactive account-level recs
7. Synthesize everything into a JSON health report — the top portfolio recommendation should appear in the recommendations array

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "overallScore": "excellent" | "good" | "needs_attention" | "critical",
  "scoreLabel": "short phrase",
  "alerts": [{ "severity": "high" | "medium" | "low", "message": "specific issue" }],
  "recommendations": ["action 1", "action 2", "action 3"],
  "keyMetrics": { "moneyLastsAge": <number|null>, "gapStatus": "<string>", "savingsGap": <number>, "portfolioAtRetire": <number> },
  "emailSummary": "2-3 sentence plain-text summary"
}`;

async function runHealthCheckForUser(
  plan: Record<string, unknown>,
  planHistory: PlanSnapshot[],
  apiKey: string
): Promise<Record<string, unknown> | null> {
  let messages: Array<{ role: string; content: unknown }> = [
    { role: 'user', content: 'Analyze my retirement plan and return the health report JSON.' },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5', // Haiku for cost efficiency in batch
        max_tokens: 1500,
        system: HEALTH_CHECK_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages,
      }),
    });

    if (!resp.ok) return null;

    const data = await resp.json() as {
      stop_reason: string;
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
    };

    if (data.stop_reason === 'end_turn') {
      const text = data.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n').trim();
      try {
        const clean = text.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```$/m, '').trim();
        return JSON.parse(clean) as Record<string, unknown>;
      } catch {
        return null;
      }
    }

    if (data.stop_reason === 'tool_use') {
      const toolUseBlocks = data.content.filter((c) => c.type === 'tool_use');
      messages.push({ role: 'assistant', content: data.content });
      const toolResults = toolUseBlocks.map((block) => {
        const result = executeTool(block.name!, block.input ?? {}, plan, planHistory);
        return {
          type: 'tool_result',
          tool_use_id: block.id,
          content: result.error ? JSON.stringify({ error: result.error }) : JSON.stringify(result.result),
        };
      });
      messages.push({ role: 'user', content: toolResults });
    }
  }

  return null;
}

export async function POST(request: Request) {
  // Kill switch — set WEEKLY_CHECK_DISABLED=1 to immediately stop the cron
  // without having to remove the GitHub Actions workflow.
  if (KILL_SWITCH) {
    return NextResponse.json({ skipped: true, reason: 'WEEKLY_CHECK_DISABLED' });
  }

  // Verify cron secret with timing-safe compare to prevent timing attacks
  const authHeader = request.headers.get('Authorization') ?? '';
  const expected = `Bearer ${CRON_SECRET}`;
  if (!CRON_SECRET || !safeEqualString(authHeader, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  // Fairness: DynamoDB scan order is stable, so slicing the raw list would
  // email the same first N users every week and starve the rest once the
  // opted-in count exceeds the batch cap. Prioritize never-emailed users,
  // then least-recently-emailed.
  const users = (await getUsersForWeeklyCheck()).sort((a, b) => {
    if (!a.last_emailed_at) return b.last_emailed_at ? -1 : 0;
    if (!b.last_emailed_at) return 1;
    return a.last_emailed_at.localeCompare(b.last_emailed_at);
  });
  const effectiveBatch = Math.min(BATCH_SIZE, HARD_CEILING);

  // Time budget: stop before the platform kills the invocation so we always
  // return a clean report. Users not reached stay eligible (lastEmailedAt
  // unchanged) and are picked up by the next run — no one starves, because
  // emailed users drop out of the next scan's filter.
  const TIME_BUDGET_MS = Number(process.env.WEEKLY_CHECK_TIME_BUDGET_MS ?? 240_000);
  const startedAt = Date.now();

  const results = { processed: 0, emailed: 0, errors: 0 };
  let attempted = 0;

  for (const user of users) {
    if (attempted >= effectiveBatch || Date.now() - startedAt > TIME_BUDGET_MS) break;
    attempted++;
    try {
      // Load plan and history for this user
      const planRow = await getUserPlan(user.user_id);
      if (!planRow?.plan) { results.errors++; continue; }

      const snapshots = await getSnapshots(user.user_id, 90);
      const planHistory: PlanSnapshot[] = snapshots.map((s) => s.data as unknown as PlanSnapshot);

      // Run health check
      const report = await runHealthCheckForUser(planRow.plan, planHistory, apiKey);
      if (!report) { results.errors++; continue; }

      results.processed++;

      // Send email if configured
      if (isEmailConfigured()) {
        const { subject, text, html } = buildHealthCheckEmail(report as Parameters<typeof buildHealthCheckEmail>[0]);
        const sent = await sendEmail({ to: user.email, subject, text, html });
        if (sent) {
          await updateLastEmailed(user.user_id);
          results.emailed++;
        }
      }
    } catch (e) {
      console.error(`Weekly check failed for user ${user.user_id}:`, e);
      results.errors++;
    }
  }

  console.log('Weekly check complete:', results);
  return NextResponse.json({
    ...results,
    total: users.length,
    batchSize: attempted,
    batchCap: effectiveBatch,
    remaining: Math.max(0, users.length - attempted),
  });
}
