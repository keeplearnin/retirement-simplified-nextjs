/**
 * /api/agent/quarterly-review — autonomous Progress / Quarterly Review agent.
 *
 * Pulls in the user's current plan + snapshot history, runs the standard
 * projection / verdict / portfolio insights chain, and returns a structured
 * QuarterlyReport JSON that the UI renders into a "review" drawer.
 *
 * Same agentic-loop pattern as health-check and optimize. Sonnet (not Haiku)
 * because the synthesis step benefits from the better summarization.
 */

import { NextResponse } from 'next/server';
import { verifyAuth, checkRateLimit, getClientIp } from '@/lib/apiAuth';
import { TOOL_DEFINITIONS, executeTool } from '@/lib/agentTools';
import { QUARTERLY_REVIEW_SYSTEM_PROMPT } from '@/lib/constants';
import type { PlanSnapshot } from '@/lib/planHistory';

const MAX_ITERATIONS = 8;
const MODEL = 'claude-sonnet-4-20250514';

export async function POST(request: Request) {
  const authResult = await verifyAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const ip = getClientIp(request);
  const rateLimited = checkRateLimit(`quarterly:${ip}`, 5, 60_000);
  if (rateLimited) return rateLimited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  const body = (await request.json()) as {
    plan?: Record<string, unknown>;
    planHistory?: PlanSnapshot[];
  };
  const { plan, planHistory = [] } = body;

  if (!plan) {
    return NextResponse.json({ error: 'plan is required' }, { status: 400 });
  }

  let messages: Array<{ role: string; content: unknown }> = [
    { role: 'user', content: 'Generate my progress review report as raw JSON.' },
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
        model: MODEL,
        max_tokens: 1500,
        system: QUARTERLY_REVIEW_SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages,
      }),
    });

    if (!resp.ok) {
      console.error('Quarterly review agent error:', resp.status, await resp.text());
      return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status: 502 });
    }

    const data = (await resp.json()) as {
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

  // Parse the JSON report and stamp it with generatedAt
  try {
    const clean = finalText
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*/m, '')
      .replace(/```$/m, '')
      .trim();
    const parsed = JSON.parse(clean) as Record<string, unknown>;
    const report = { ...parsed, generatedAt: new Date().toISOString() };
    return NextResponse.json({ report });
  } catch {
    return NextResponse.json(
      { error: 'Could not parse review report. Try again.' },
      { status: 500 },
    );
  }
}
