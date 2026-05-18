/**
 * email.ts — Resend email helper.
 *
 * Gracefully degrades: if RESEND_API_KEY is not set, sendEmail() is a no-op.
 * Server-side only — never import in client components.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM_ADDRESS = 'noreply@retiresimplified.com';

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        ...(payload.html ? { html: payload.html } : {}),
      }),
    });

    if (!resp.ok) {
      console.error('Resend error:', resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('Email send error:', e);
    return false;
  }
}

export function buildHealthCheckEmail(report: {
  scoreLabel: string;
  emailSummary: string;
  alerts: Array<{ severity: string; message: string }>;
  recommendations: string[];
  keyMetrics: { moneyLastsAge: number | null; gapStatus: string };
}): { subject: string; text: string; html: string } {
  const subject = `Your weekly retirement plan check — ${report.scoreLabel}`;

  const alertLines = report.alerts
    .slice(0, 3)
    .map((a) => `  ${a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🟢'} ${a.message}`)
    .join('\n');

  const recLines = report.recommendations
    .slice(0, 3)
    .map((r, i) => `  ${i + 1}. ${r}`)
    .join('\n');

  const text = `
Retire.Simplified — Weekly Plan Update
=======================================

${report.emailSummary}

YOUR PLAN STATUS: ${report.scoreLabel}
${report.keyMetrics.moneyLastsAge ? `Money lasts to: Age ${report.keyMetrics.moneyLastsAge}` : ''}
Savings status: ${report.keyMetrics.gapStatus}

${alertLines ? `ALERTS:\n${alertLines}\n` : ''}
TOP RECOMMENDATIONS:
${recLines}

---
Log in at retiresimplified.com to run a full analysis or ask your AI advisor.

To unsubscribe from weekly emails, open the AI Advisor tab and turn off Weekly Email Check.
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="margin:0 0 4px;font-size:20px">Retire<span style="color:#10b981">.</span>Simplified</h2>
  <p style="color:#6b7280;margin:0 0 24px;font-size:13px">Weekly Plan Update</p>

  <div style="background:#f9fafb;border-radius:12px;padding:16px 20px;margin-bottom:20px">
    <p style="margin:0 0 8px;font-size:15px">${report.emailSummary}</p>
    <div style="font-size:13px;color:#6b7280">
      <strong>Status:</strong> ${report.scoreLabel}
      ${report.keyMetrics.moneyLastsAge ? ` &nbsp;·&nbsp; <strong>Money lasts to:</strong> Age ${report.keyMetrics.moneyLastsAge}` : ''}
    </div>
  </div>

  ${report.alerts.length > 0 ? `
  <h3 style="font-size:14px;margin:0 0 8px">Alerts</h3>
  <ul style="margin:0 0 20px;padding-left:20px;font-size:14px">
    ${report.alerts.slice(0, 3).map((a) => `<li style="margin-bottom:4px">${a.message}</li>`).join('')}
  </ul>` : ''}

  <h3 style="font-size:14px;margin:0 0 8px">Top Recommendations</h3>
  <ol style="margin:0 0 24px;padding-left:20px;font-size:14px">
    ${report.recommendations.slice(0, 3).map((r) => `<li style="margin-bottom:4px">${r}</li>`).join('')}
  </ol>

  <a href="https://retiresimplified.com" style="display:inline-block;background:#10b981;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600">Open My Plan</a>

  <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
    To unsubscribe, open the AI Advisor tab and turn off Weekly Email Check.<br>
    Retire.Simplified · Educational tool only · Not financial advice
  </p>
</body>
</html>`.trim();

  return { subject, text, html };
}
