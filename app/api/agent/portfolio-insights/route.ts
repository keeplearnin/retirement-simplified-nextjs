/**
 * /api/agent/portfolio-insights — pure-calc portfolio recommendations.
 *
 * No LLM round-trip. Just runs lib/portfolioInsights.ts against the supplied
 * plan and returns the structured PortfolioInsightsResult. Used by the
 * AIAdvisor Portfolio Insights panel for cheap, instant recommendations.
 *
 * The same engine is exposed to the agent loops as the
 * analyze_portfolio_recommendations tool when Claude needs to reason about
 * recommendations as part of a broader chain.
 */

import { NextResponse } from 'next/server';
import { verifyAuth, checkRateLimit, getClientIp } from '@/lib/apiAuth';
import { analyzePortfolio } from '@/lib/portfolioInsights';

export async function POST(request: Request) {
  const authResult = await verifyAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const ip = getClientIp(request);
  const rateLimited = checkRateLimit(`portfolio-insights:${ip}`, 30, 60_000);
  if (rateLimited) return rateLimited;

  let body: { plan?: Record<string, unknown> };
  try {
    body = (await request.json()) as { plan?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.plan) {
    return NextResponse.json({ error: 'plan is required' }, { status: 400 });
  }

  const result = analyzePortfolio(body.plan);
  return NextResponse.json(result);
}
