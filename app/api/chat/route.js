import { NextResponse } from 'next/server';
import { AI_SYSTEM_PROMPT } from '@/lib/constants';
import { verifyAuth, checkRateLimit, getClientIp } from '@/lib/apiAuth';

export async function POST(request) {
  try {
    // --- Auth: require a valid Cognito token ---
    const authResult = verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    // --- Rate limit: 20 requests per minute per IP ---
    const ip = getClientIp(request);
    const rateLimited = checkRateLimit(`chat:${ip}`, 20, 60_000);
    if (rateLimited) return rateLimited;

    const { messages } = await request.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service is not configured' },
        { status: 503 }
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
      console.error('Anthropic API error:', resp.status, await resp.text());
      return NextResponse.json(
        { error: 'AI service temporarily unavailable' },
        { status: 502 }
      );
    }

    const data = await resp.json();
    const text = data.content?.map(c => c.text || '').join('\n') || 'Sorry, I had trouble responding.';

    return NextResponse.json({ text });
  } catch (e) {
    console.error('Chat route error:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
