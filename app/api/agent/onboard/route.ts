/**
 * /api/agent/onboard — conversational onboarding agent.
 *
 * Different shape from the other agents: instead of returning data the user
 * reads, this agent COLLECTS data to write into the plan. The agent's tool
 * calls don't return useful payloads — they accumulate field updates server-
 * side, which are returned to the client as a delta the client applies via
 * its existing PlanProvider.updatePlan / bulkUpdate methods.
 *
 * Response shape:
 *   {
 *     text:           string             // next agent message
 *     fieldUpdates:   { [k]: any }       // plan fields to write
 *     incomeUpdates:  IncomeSource[]     // new income sources to append
 *     isComplete:     boolean            // user finished — close the modal
 *   }
 */

import { NextResponse } from 'next/server';
import { verifyAuth, checkRateLimit, getClientIp } from '@/lib/apiAuth';
import { ONBOARDING_SYSTEM_PROMPT } from '@/lib/constants';

const MAX_ITERATIONS = 5;
const MODEL = 'claude-sonnet-4-20250514';

// ---------------------------------------------------------------------------
// Tools — these don't return data to the LLM; they record proposed writes
// that the route handler aggregates and returns to the client.
// ---------------------------------------------------------------------------

interface IncomeSourceProposal {
  type: 'salary' | 'socialSecurity' | 'pension' | 'partTime' | 'rental' | 'annuity';
  label: string;
  owner?: 'primary' | 'spouse';
  amount?: number;
  monthlyBenefit?: number;
  startAge?: number;
  monthlyAmount?: number;
  growthRate?: number;
  cola?: boolean;
}

const tools = [
  {
    name: 'record_field',
    description:
      "Record a value for a single plan field. Use one call per field. Allowed fields: currentAge, retireAge, longevityAge, hasSpouse, spouseCurrentAge, spouseRetireAge, filingStatus, savings401k, savingsRoth, savingsTaxable, savingsHSA, savingsCash, savingsRealEstate, useRealEstateInRetirement, spouseSavings401k, spouseSavingsRoth, spouseSavingsHSA, monthlyContribution, spouseMonthlyContribution, annualSpending, retireSpending, stateCode, expectedReturn, inflationRate.",
    input_schema: {
      type: 'object',
      properties: {
        field: { type: 'string', description: 'Plan field name (camelCase)' },
        value: { description: 'Number, boolean, or string depending on field' },
      },
      required: ['field', 'value'],
    },
  },
  {
    name: 'record_income_source',
    description:
      'Add an income source. Use one call per source. Common types: salary, socialSecurity, pension. For SS without an explicit benefit, omit monthlyBenefit and the engine will estimate it from salary.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['salary', 'socialSecurity', 'pension', 'partTime', 'rental', 'annuity'] },
        label: { type: 'string', description: 'Short display name e.g. "Salary"' },
        owner: { type: 'string', enum: ['primary', 'spouse'], description: 'Default primary' },
        amount: { type: 'number', description: 'Annual salary or part-time amount' },
        monthlyBenefit: { type: 'number', description: 'SS monthly benefit' },
        startAge: { type: 'number', description: 'SS or pension start age' },
        monthlyAmount: { type: 'number', description: 'Pension monthly amount' },
        growthRate: { type: 'number', description: 'Salary growth % (default 3)' },
        cola: { type: 'boolean', description: 'Pension has COLA (default false)' },
      },
      required: ['type', 'label'],
    },
  },
  {
    name: 'mark_complete',
    description:
      "Signal that onboarding is finished. Call this only AFTER you've recorded all fields and income sources AND you've given the user a brief summary of what you built. The frontend will then close the modal and show the user their first projection.",
    input_schema: { type: 'object', properties: {} },
  },
];

// ---------------------------------------------------------------------------
// Allow-list of field names — prevents the LLM from writing arbitrary keys
// onto the plan and shielding the engine from unexpected shapes.
// ---------------------------------------------------------------------------

const ALLOWED_FIELDS = new Set([
  'currentAge', 'retireAge', 'longevityAge',
  'hasSpouse', 'spouseCurrentAge', 'spouseRetireAge', 'spouseLongevityAge',
  'filingStatus', 'stateCode',
  'savings401k', 'savingsRoth', 'savingsTaxable', 'savingsHSA', 'savingsCash',
  'savingsRealEstate', 'useRealEstateInRetirement', 'savingsCrypto', 'savingsAnnuity',
  'spouseSavings401k', 'spouseSavingsRoth', 'spouseSavingsHSA',
  'monthlyContribution', 'spouseMonthlyContribution',
  'annualSpending', 'retireSpending',
  'expectedReturn', 'inflationRate', 'healthcareInflation',
  'goGoEndAge', 'slowGoEndAge',
]);

const NUMBER_BOUNDS: Record<string, [number, number]> = {
  currentAge: [18, 100],
  retireAge: [40, 95],
  longevityAge: [60, 110],
  spouseCurrentAge: [18, 100],
  spouseRetireAge: [40, 95],
  savings401k: [0, 50_000_000],
  savingsRoth: [0, 50_000_000],
  savingsTaxable: [0, 50_000_000],
  savingsHSA: [0, 5_000_000],
  savingsCash: [0, 5_000_000],
  savingsRealEstate: [0, 100_000_000],
  savingsCrypto: [0, 50_000_000],
  spouseSavings401k: [0, 50_000_000],
  spouseSavingsRoth: [0, 50_000_000],
  spouseSavingsHSA: [0, 5_000_000],
  monthlyContribution: [0, 100_000],
  spouseMonthlyContribution: [0, 100_000],
  annualSpending: [0, 2_000_000],
  retireSpending: [0, 2_000_000],
  expectedReturn: [0, 15],
  inflationRate: [0, 15],
};

function validateAndCoerce(field: string, value: unknown): unknown | null {
  if (!ALLOWED_FIELDS.has(field)) return null;
  if (field === 'hasSpouse' || field === 'useRealEstateInRetirement') {
    return Boolean(value);
  }
  if (field === 'filingStatus') {
    return value === 'mfj' || value === 'single' ? value : null;
  }
  if (field === 'stateCode') {
    return typeof value === 'string' && /^[A-Z]{2}$/i.test(value) ? value.toUpperCase() : null;
  }
  // Numeric — coerce, then range-check
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const bounds = NUMBER_BOUNDS[field];
  if (bounds && (n < bounds[0] || n > bounds[1])) return null;
  return n;
}

// ---------------------------------------------------------------------------
// Endpoint
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const authResult = await verifyAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const ip = getClientIp(request);
  const rateLimited = checkRateLimit(`onboard:${ip}`, 30, 60_000);
  if (rateLimited) return rateLimited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  const body = (await request.json()) as {
    messages?: Array<{ role: string; content: string }>;
    plan?: Record<string, unknown>;
  };
  const messages = body.messages ?? [];
  const plan = body.plan ?? {};

  // Build the conversation we'll send to Claude. We seed with a system-level
  // hint summarizing what's been collected so far (avoids re-asking).
  let loopMessages: Array<{ role: string; content: unknown }> = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Accumulators — populated by tool calls during the loop
  const fieldUpdates: Record<string, unknown> = {};
  const incomeUpdates: IncomeSourceProposal[] = [];
  let isComplete = false;
  let finalText = '';

  let iterations = 0;
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
        max_tokens: 1024,
        system: ONBOARDING_SYSTEM_PROMPT + `\n\nCurrent plan state (already collected): ${JSON.stringify(plan)}`,
        tools,
        messages: loopMessages,
      }),
    });

    if (!resp.ok) {
      console.error('Onboard agent error:', resp.status, await resp.text());
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
      loopMessages.push({ role: 'assistant', content: data.content });

      const toolResults = toolUseBlocks.map((block) => {
        let result: unknown = { ok: true };
        try {
          if (block.name === 'record_field') {
            const { field, value } = block.input ?? {};
            const validated = validateAndCoerce(String(field), value);
            if (validated === null) {
              result = { ok: false, error: `Rejected: ${field}=${value} (not allowed or out of range)` };
            } else {
              fieldUpdates[String(field)] = validated;
              result = { ok: true, recorded: { field, value: validated } };
            }
          } else if (block.name === 'record_income_source') {
            const src = block.input as unknown as IncomeSourceProposal;
            incomeUpdates.push(src);
            result = { ok: true, recorded: src };
          } else if (block.name === 'mark_complete') {
            isComplete = true;
            result = { ok: true, complete: true };
          } else {
            result = { ok: false, error: `Unknown tool: ${block.name}` };
          }
        } catch (e) {
          result = { ok: false, error: e instanceof Error ? e.message : 'tool error' };
        }
        return {
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        };
      });

      loopMessages.push({ role: 'user', content: toolResults });
      continue;
    }

    finalText = data.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n');
    break;
  }

  return NextResponse.json({
    text: finalText,
    fieldUpdates,
    incomeUpdates,
    isComplete,
  });
}
