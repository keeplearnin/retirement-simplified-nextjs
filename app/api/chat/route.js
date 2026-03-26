import { NextResponse } from 'next/server';
import { AI_SYSTEM_PROMPT } from '@/lib/constants';

export async function POST(request) {
  try {
    const { messages } = await request.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: AI_SYSTEM_PROMPT,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!resp.ok) {
      const error = await resp.text();
      return NextResponse.json({ error }, { status: resp.status });
    }

    const data = await resp.json();
    const text = data.content?.map(c => c.text || '').join('\n') || 'Sorry, I had trouble responding.';

    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
