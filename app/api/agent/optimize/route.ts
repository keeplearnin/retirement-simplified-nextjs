/**
 * /api/agent/optimize — autonomous retirement optimization agent.
 *
 * Runs a full multi-step chain: projection → SS → Roth → withdrawal order
 * → scenario comparison → ranked action list with dollar impact.
 *
 * Returns a structured OptimizationReport the UI renders directly.
 */

import { NextResponse } from 'next/server';
import { verifyAuth, checkRateLimit, getClientIp } from '@/lib/apiAuth';
import { TOOL_DEFINITIONS, executeTool } from '@/lib/agentTools';
import type { PlanSnapshot } from '@/lib/planHistory';

const MAX_ITERATIONS = 10;

const OPTIMIZE_PROMPT = `You are an autonomous retirement optimization agent. Run a comprehensive analysis of the user's plan and return a ranked optimization report — with a transparent reasoning trail so the user can see your "chain of math."

Follow these steps in order — do NOT skip any:
1. Call get_plan_summary to understand the user's situation
2. Call run_full_optimization to get baseline metrics and ranked actions
3. Call optimize_ss_claiming to get detailed SS claiming analysis
4. Call analyze_withdrawal_order to compare withdrawal strategies
5. Call analyze_portfolio_recommendations for account-level opportunities
6. Synthesize all findings into the JSON report below — merge portfolio recommendations into the actions array alongside the other recommendations

AS YOU GO, build a reasoningSteps[] array — one entry per tool call you made, in the order you made them, plus one final "synthesis" step. Each step must contain a CONCRETE number, age, or dollar figure pulled from the tool result (not a vague phrase). The "nextAction" should explain what that finding made you check next.

Example reasoningSteps entries (do NOT copy verbatim — use the user's actual numbers):
  { "step": 1, "action": "Pulled current plan", "finding": "$850K savings, age 45, retire 65 target", "nextAction": "Run full optimization to find biggest levers" }
  { "step": 2, "action": "Modeled withdrawal waterfall", "finding": "$14,200 tax drag in 2038 from RMD bracket crossover", "nextAction": "Test a Roth conversion ladder to flatten the spike" }
  { "step": 3, "action": "Tried Roth conversion ladder ($11K/yr ages 60–63)", "finding": "Saves $42K lifetime tax", "nextAction": "Compare with SS-timing lever" }
  { "step": 4, "action": "Optimized SS claiming at 70 vs 67", "finding": "Adds $85K lifetime income", "nextAction": "Rank levers by dollar impact" }
  { "step": 5, "action": "Synthesized", "finding": "SS-delay is the biggest single lever ($85K); Roth ladder is second ($42K)", "nextAction": "Return ranked actions" }

Return ONLY a valid JSON object — no markdown, no explanation, just raw JSON:
{
  "headline": "one sentence summarizing the plan's biggest opportunity",
  "overallScore": "excellent" | "good" | "needs_attention" | "critical",
  "reasoningSteps": [
    {
      "step": <number, 1-indexed>,
      "action": "what I checked (short verb phrase)",
      "finding": "specific number/age/dollar figure from the tool result",
      "nextAction": "what this implied for my next call"
    }
  ],
  "actions": [
    {
      "rank": 1,
      "category": "Social Security" | "Tax Strategy" | "Contributions" | "Retirement Age" | "Withdrawal Order",
      "action": "short action title",
      "detail": "2-3 sentence explanation with actual numbers from the plan",
      "estimatedImpact": "e.g. +$85K lifetime income or -$42K lifetime taxes",
      "dollarValue": <number>,
      "urgency": "immediate" | "before-retirement" | "at-retirement"
    }
  ],
  "withdrawalStrategy": {
    "recommended": "Trad-First" | "Roth-First" | "Bracket-Fill",
    "reason": "one sentence with numbers"
  },
  "ssRecommendation": {
    "optimalAge": <number>,
    "monthlyBenefit": <number>,
    "reason": "one sentence with breakeven age"
  },
  "keyMetrics": {
    "currentMoneyLastsAge": <number>,
    "optimizedMoneyLastsAge": <number>,
    "currentLifetimeTax": <number>,
    "optimizedLifetimeTax": <number>
  }
}`;

export async function POST(request: Request) {
  try {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const ip = getClientIp(request);
    const rateLimited = checkRateLimit(`optimize:${ip}`, 5, 60_000);
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

    let messages: Array<{ role: string; content: unknown }> = [
      { role: 'user', content: 'Analyze and optimize my retirement plan.' },
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
          max_tokens: 3000,
          system: OPTIMIZE_PROMPT,
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
          const result = executeTool(block.name!, block.input ?? {}, plan, planHistory);
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

      finalText = data.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n');
      break;
    }

    try {
      const clean = finalText.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```$/m, '').trim();
      const report = JSON.parse(clean);
      return NextResponse.json({ report });
    } catch {
      return NextResponse.json(
        { error: 'Could not parse optimization report. Please try again.' },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error('Optimize route error:', e);
    return NextResponse.json({ error: 'Optimization failed. Please try again.' }, { status: 500 });
  }
}
