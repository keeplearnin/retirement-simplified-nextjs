import { NextResponse } from 'next/server';
import { AI_AGENT_SYSTEM_PROMPT } from '@/lib/constants';
import { verifyAuth, checkRateLimit, getClientIp } from '@/lib/apiAuth';
import { TOOL_DEFINITIONS, executeTool } from '@/lib/agentTools';

const MAX_TOOL_ITERATIONS = 5;

export async function POST(request) {
  try {
    const authResult = verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const ip = getClientIp(request);
    const rateLimited = checkRateLimit(`chat:${ip}`, 20, 60_000);
    if (rateLimited) return rateLimited;

    const { messages, plan, planHistory } = await request.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 });
    }

    // Agentic loop — keep calling Claude until it stops requesting tools
    let loopMessages = messages.map((m) => ({ role: m.role, content: m.content }));
    let iterations = 0;

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const body = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: AI_AGENT_SYSTEM_PROMPT,
        tools: plan ? TOOL_DEFINITIONS : [],
        messages: loopMessages,
      };

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
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
        return NextResponse.json({ text });
      }

      // Claude wants to use tools — execute them and continue the loop
      if (data.stop_reason === 'tool_use') {
        const toolUseBlocks = data.content.filter((c) => c.type === 'tool_use');

        // Append Claude's response (which includes its reasoning + tool_use blocks)
        loopMessages.push({ role: 'assistant', content: data.content });

        // Execute each tool and collect results
        const toolResults = toolUseBlocks.map((block) => {
          const result = executeTool(block.name, block.input, plan || {}, planHistory || []);
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
      return NextResponse.json({ text });
    }

    // Hit iteration limit — return a graceful fallback
    return NextResponse.json({
      text: "I ran into a complex calculation. Please try rephrasing your question.",
    });
  } catch (e) {
    console.error('Chat route error:', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
