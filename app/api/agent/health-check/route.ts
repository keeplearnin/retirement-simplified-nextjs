/**
 * /api/agent/health-check — autonomous plan health check agent.
 *
 * Called weekly by the client (or by any external cron / AWS EventBridge).
 * Claude uses all 8 tools without a user prompt to produce a structured
 * health report + email-ready summary.
 *
 * To wire to AWS EventBridge: create a rule targeting a Lambda that POSTs
 * to this endpoint with the user's plan + planHistory. The plan must be
 * stored server-side (e.g. DynamoDB) for true server-side scheduling.
 */

import { NextResponse } from 'next/server';
import { verifyAuth, checkRateLimit, getClientIp } from '@/lib/apiAuth';
import { TOOL_DEFINITIONS, executeTool } from '@/lib/agentTools';
import type { HealthReport } from '@/lib/healthCheck';
import type { PlanSnapshot } from '@/lib/planHistory';

const MAX_ITERATIONS = 8;

const HEALTH_CHECK_PROMPT = `You are an autonomous retirement plan health check agent. Analyze the user's retirement plan thoroughly and produce a structured health report.

Follow these steps in order:
1. Call get_plan_summary to read the user's plan
2. Call run_projection to get their baseline money-lasts-to age
3. Call get_verdict to check their savings benchmark status
4. Call optimize_ss_claiming to find the optimal SS claiming age
5. Call get_plan_history to check their progress trend
6. Synthesize everything into a JSON health report

Return ONLY a valid JSON object matching this exact shape — no markdown, no explanation, just raw JSON:
{
  "overallScore": "excellent" | "good" | "needs_attention" | "critical",
  "scoreLabel": "one short phrase like 'On Track' or 'Action Needed'",
  "alerts": [
    { "severity": "high" | "medium" | "low", "message": "specific issue with numbers" }
  ],
  "recommendations": ["actionable step 1", "actionable step 2", "actionable step 3"],
  "keyMetrics": {
    "moneyLastsAge": <number or null>,
    "gapStatus": "<string>",
    "savingsGap": <number>,
    "portfolioAtRetire": <number>
  },
  "emailSummary": "2-3 sentence plain-text summary suitable for a weekly email"
}

Score guide:
- excellent: money lasts to longevity, on-track or ahead on savings
- good: money lasts within 5 years of longevity, minor gap
- needs_attention: money runs out 5-15 years before longevity OR significantly behind
- critical: money runs out more than 15 years early OR major gap`;

export async function POST(request: Request) {
  try {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const ip = getClientIp(request);
    const rateLimited = checkRateLimit(`health-check:${ip}`, 5, 60_000);
    if (rateLimited) return rateLimited;

    const body = await request.json() as {
      plan: Record<string, unknown>;
      planHistory?: PlanSnapshot[];
    };
    const { plan, planHistory = [] } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 });
    }

    if (!plan) {
      return NextResponse.json({ error: 'plan is required' }, { status: 400 });
    }

    // Autonomous agentic loop — same pattern as /api/chat but driven by a
    // fixed analysis prompt instead of a user message
    let messages: Array<{ role: string; content: unknown }> = [
      { role: 'user', content: 'Analyze my retirement plan and return the health report JSON.' },
    ];
    let iterations = 0;
    let finalText = '';

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: HEALTH_CHECK_PROMPT,
          tools: TOOL_DEFINITIONS,
          messages,
        }),
      });

      if (!resp.ok) {
        console.error('Anthropic API error:', resp.status, await resp.text());
        return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status: 502 });
      }

      const data = await resp.json() as {
        stop_reason: string;
        content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      };

      if (data.stop_reason === 'end_turn') {
        finalText = data.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text ?? '')
          .join('\n')
          .trim();
        break;
      }

      if (data.stop_reason === 'tool_use') {
        const toolUseBlocks = data.content.filter((c) => c.type === 'tool_use');
        messages.push({ role: 'assistant', content: data.content });

        const toolResults = toolUseBlocks.map((block) => {
          const result = executeTool(
            block.name!,
            block.input ?? {},
            plan,
            planHistory
          );
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: result.error
              ? JSON.stringify({ error: result.error })
              : JSON.stringify(result.result),
          };
        });

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Unexpected stop
      finalText = data.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n');
      break;
    }

    // Parse the JSON report from Claude's response
    let report: HealthReport;
    try {
      // Strip markdown fences if Claude wrapped it
      const clean = finalText.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```$/m, '').trim();
      const parsed = JSON.parse(clean) as Omit<HealthReport, 'generatedAt'>;
      report = { ...parsed, generatedAt: new Date().toISOString() };
    } catch {
      // Fallback: build a basic report if JSON parsing fails
      report = {
        generatedAt: new Date().toISOString(),
        overallScore: 'needs_attention',
        scoreLabel: 'Review Needed',
        alerts: [{ severity: 'medium', message: 'Could not fully analyze your plan. Please review manually.' }],
        recommendations: ['Open My Plan and verify your income sources are up to date.'],
        keyMetrics: { moneyLastsAge: null, gapStatus: 'unknown', savingsGap: 0, portfolioAtRetire: 0 },
        emailSummary: 'Your weekly retirement plan health check encountered an issue. Please log in to review your plan.',
      };
    }

    // --- Email stub ---
    // To send email, install Resend (`npm i resend`) and uncomment:
    //
    // if (process.env.RESEND_API_KEY && body.email) {
    //   const resend = new Resend(process.env.RESEND_API_KEY);
    //   await resend.emails.send({
    //     from: 'noreply@retiresimplified.com',
    //     to: body.email,
    //     subject: `Your weekly retirement plan check — ${report.scoreLabel}`,
    //     text: report.emailSummary,
    //   });
    // }

    return NextResponse.json({ report });
  } catch (e) {
    console.error('Health check error:', e);
    return NextResponse.json({ error: 'Health check failed. Please try again.' }, { status: 500 });
  }
}
