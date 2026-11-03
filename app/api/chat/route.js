import { NextResponse } from 'next/server';
import { AI_AGENT_SYSTEM_PROMPT } from '@/lib/constants';
import { verifyAuth, checkRateLimit, getClientIp } from '@/lib/apiAuth';
import { TOOL_DEFINITIONS, executeTool } from '@/lib/agentTools';
import { CLAUDE_SONNET_BODY, claudeHeaders } from '@/lib/claude';

const MAX_TOOL_ITERATIONS = 5;

// Abuse guards: the request body is client-controlled, and every message in
// it becomes Anthropic input tokens on OUR bill. Cap conversation length and
// total payload size so 20 req/min can't each carry a megabyte of history.
const MAX_MESSAGES = 40;
const MAX_BODY_BYTES = 100_000; // ~25K tokens worst case
const ALLOWED_ROLES = new Set(['user', 'assistant']);

// Daily caps keep the AI bill bounded (each chat costs real money). Per
// identity, plus per IP so rotating anonymous device ids doesn't reset it.
// In-memory like checkRateLimit, so best-effort per server instance.
const DAILY_CHATS_ANONYMOUS = 30;
const DAILY_CHATS_SIGNED_IN = 100;
const DAILY_CHATS_PER_IP = 100;
const DAY_MS = 86_400_000;

export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const ip = getClientIp(request);
    const rateLimited = checkRateLimit(`chat:${ip}`, 20, 60_000);
    if (rateLimited) return rateLimited;
    const dailyLimit = authResult.anonymous ? DAILY_CHATS_ANONYMOUS : DAILY_CHATS_SIGNED_IN;
    if (checkRateLimit(`chat-day:${authResult.sub}`, dailyLimit, DAY_MS) || checkRateLimit(`chat-day-ip:${ip}`, DAILY_CHATS_PER_IP, DAY_MS)) {
      return NextResponse.json({
        error: authResult.anonymous
          ? `You've reached today's limit of ${DAILY_CHATS_ANONYMOUS} questions. Sign in for more, or come back tomorrow — the Plan and Improve screens still work.`
          : "You've reached today's question limit. Come back tomorrow — the Plan and Improve screens still work.",
        daily: true,
      }, { status: 429 });
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    }
    const { messages: rawMessages, plan, planHistory } = JSON.parse(rawBody);
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json({ error: 'messages must be a non-empty array' }, { status: 400 });
    }
    if (!rawMessages.every((m) => m && ALLOWED_ROLES.has(m.role) && typeof m.content === 'string')) {
      return NextResponse.json({ error: 'messages must be {role: user|assistant, content: string}' }, { status: 400 });
    }
    // Long chats: keep only the most recent window rather than rejecting.
    // Trim any leading assistant turns — Anthropic requires user-first.
    let messages = rawMessages.slice(-MAX_MESSAGES);
    while (messages.length && messages[0].role !== 'user') messages = messages.slice(1);
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 });
    }

    // Agentic loop — keep calling Claude until it stops requesting tools
    let loopMessages = messages.map((m) => ({ role: m.role, content: m.content }));
    let iterations = 0;
    const proposedChanges = [];

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      // The system prompt and tool definitions are identical on every call,
      // so cache them: tool loops and follow-up turns then pay ~10% of the
      // input price for that prefix (render order is tools → system).
      const body = {
        ...CLAUDE_SONNET_BODY,
        system: [{ type: 'text', text: AI_AGENT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: plan ? TOOL_DEFINITIONS : [],
        messages: loopMessages,
      };

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: claudeHeaders(apiKey),
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        console.error('Anthropic API error:', resp.status, await resp.text());
        return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status: 502 });
      }

      const data = await resp.json();

      // End of turn — extract final text and return
      if (data.stop_reason === 'end_turn') {
        const text =
          data.content
            ?.filter((c) => c.type === 'text')
            .map((c) => c.text)
            .join('\n') || 'Sorry, I had trouble responding.';
        return NextResponse.json({ text, proposedChanges });
      }

      // Claude wants to use tools — execute them and continue the loop
      if (data.stop_reason === 'tool_use') {
        const toolUseBlocks = data.content.filter((c) => c.type === 'tool_use');

        // Append Claude's response (which includes its reasoning + tool_use blocks)
        loopMessages.push({ role: 'assistant', content: data.content });

        // Execute each tool and collect results
        const toolResults = toolUseBlocks.map((block) => {
          const result = executeTool(block.name, block.input, plan || {}, planHistory || []);
          // Side-channel: collect propose_plan_change proposals for the client.
          if (
            block.name === 'propose_plan_change' &&
            result.result &&
            typeof result.result === 'object' &&
            result.result.ok &&
            result.result.recorded
          ) {
            proposedChanges.push(result.result.recorded);
          }
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: result.error
              ? JSON.stringify({ error: result.error })
              : JSON.stringify(result.result),
          };
        });

        loopMessages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Unexpected stop reason — return whatever text we have
      const text =
        data.content
          ?.filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('\n') || 'Sorry, I had trouble responding.';
      return NextResponse.json({ text, proposedChanges });
    }

    // Hit iteration limit — return a graceful fallback
    return NextResponse.json({
      text: "I ran into a complex calculation. Please try rephrasing your question.",
      proposedChanges,
    });
  } catch (e) {
    console.error('Chat route error:', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
