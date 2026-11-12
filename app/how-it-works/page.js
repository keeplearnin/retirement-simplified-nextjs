import TrustPage, { REPO, h2, muted, body, link, Item } from '@/components/trust/TrustPage';
import ArchitectureDiagram from '@/components/trust/ArchitectureDiagram';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'How Retire Simplified works — Retire Simplified',
  description:
    'One projection engine behind every screen, stress-tested across 500 markets and real history since 1928, with an AI assistant that explains the numbers but never produces them.',
  path: '/how-it-works',
});

const ol = { paddingLeft: 20, margin: 0 };

export default function HowItWorksPage() {
  return (
    <TrustPage
      title="How Retire.Simplified works"
      lead={
        <>
          Retire.Simplified is built around one rule: <strong style={{ color: 'var(--heading)' }}>one engine, one answer</strong>. Every
          screen, every tool and the AI assistant run the same year-by-year projection, so the app never gives two answers for the same
          household. The assistant’s job is to explain what the engine calculated, never to calculate on its own. This page is for
          anyone who wants to know what’s under the hood.
        </>
      }
    >
      <h2 style={h2}>At a glance</h2>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '8px 12px' }}>
        <ArchitectureDiagram />
      </div>
      <p style={{ ...muted, marginTop: 10 }}>
        Plan and Improve call the engine directly. Ask and the weekly check go through the assistant, which reaches the engine only
        through its tools. The stress test reruns the same engine; nothing else calculates.
      </p>

      <h2 style={h2}>The engine</h2>
      <p style={body}>The projection walks your plan one year at a time from today to your longevity age. Each year it:</p>
      <ol style={ol}>
        <Item title="Brings in income.">
          Salary while working; Social Security, pensions, annuities, rental and part-time income in retirement, each with its own start
          and end age and its own owner in a couple.
        </Item>
        <Item title="Figures the spending.">
          Base spending in phases (early, mid and late retirement), healthcare (an ACA bridge before 65, Medicare and IRMAA surcharges
          after), long-term care as a probability-weighted cost, and goals such as college.
        </Item>
        <Item title="Takes required minimum distributions">from tax-deferred accounts once you reach RMD age.</Item>
        <Item title="Withdraws the gap">
          from accounts in order (taxable, then tax-deferred, then Roth by default, or a bracket-fill strategy), grossing up for the tax
          the withdrawal itself creates.
        </Item>
        <Item title="Computes taxes.">
          Federal brackets, Social Security taxability, capital gains, NIIT, and state tax including retirement-income exemptions by
          state, with future-year thresholds indexed for inflation.
        </Item>
        <Item title="Grows what’s left">at your working or retired return, after the withdrawal, not before.</Item>
      </ol>
      <p style={{ ...body, marginTop: 12 }}>
        The output is the <strong>Ledger</strong>: a row per year showing every one of those lines, so any number on any screen can be
        traced to its row. Real estate and 529 balances are tracked but never counted as spendable, which is why “money lasts to” uses
        liquid balance only.
      </p>

      <h2 style={h2}>Stress testing</h2>
      <p style={body}>
        A single projection assumes markets return the same amount every year. They don’t, and the order of good and bad years matters
        more than the average. So the headline on the Plan screen is not one number but odds.
      </p>
      <ul style={ol}>
        <Item title="500 simulated markets.">
          The full projection runs 500 times with random yearly return shocks centred on your expected return, using a fixed seed so the
          result is the same every time you look. The share of runs where money lasts the whole plan is the headline odds.
        </Item>
        <Item title="Every real sequence since 1928.">
          The same projection also replays every complete run of historical US stock and bond returns (re-centered on your own expected return, with your plan's inflation), so you see how the plan would have
          fared starting in 1929, 1966, 2000 and every other year.
        </Item>
        <Item title="The bad-market age.">Alongside the odds, the Plan screen shows the age money runs out in the worst 1-in-10 case.</Item>
      </ul>
      <p style={{ ...body, marginTop: 12 }}>The Monte Carlo and backtest screens read these same results. There is no second, simplified engine.</p>

      <h2 style={h2}>The assistant</h2>
      <p style={body}>
        “Ask about your plan” is a language model (Claude) with a fixed set of 13 tools. The tools are thin wrappers around the engine’s
        own functions: read the plan, run the projection, get the odds, estimate taxes, compare scenarios, optimize Social Security
        claiming, model a Roth ladder, compare withdrawal orders, read plan history, and run a full ranked optimization.
      </p>
      <p style={body}>Three design decisions follow from “one engine, one answer”:</p>
      <ul style={ol}>
        <Item title="Tools, not arithmetic.">
          The assistant is instructed that every plan-specific number must come from a tool result in the conversation. Tests tie the
          core tools (the projection, the odds, the verdict) to the functions behind the matching screens, so chat and screen can’t drift apart.
        </Item>
        <Item title="Proposals, not changes.">
          The one tool that touches the plan only records a suggestion. The app renders an Apply button; nothing changes until you click
          it, the app checks the plan hasn’t moved since, and an Undo stays available for 30 seconds.
        </Item>
        <Item title="Scoped memory.">
          Chat history and health-check reports are stored per browser so the assistant can show trends, but it is instructed never to
          reference plan data outside the conversation.
        </Item>
      </ul>
      <p style={{ ...body, marginTop: 12 }}>
        The same model and the same rules also power the weekly health check, the quarterly review, the optimizer explanations and
        onboarding. The rules themselves are on <a href="/assistant-rules" style={link}>What the assistant will and won’t do</a>.
      </p>

      <h2 style={h2}>Guardrails in operation</h2>
      <ul style={ol}>
        <Item title="Rules in code.">
          One shared rule block (no named investments, no buy/sell/hold, never change the plan, no advisor claims, point tax and legal
          questions to a professional) is appended to every AI feature’s instructions. A test suite fails if the rules are removed or
          weakened.
        </Item>
        <Item title="Models in one place.">
          Every AI route reads its model name and request defaults from a single file. When a vendor retires a model, there is one line
          to change.
        </Item>
        <Item title="A daily probe.">
          A health endpoint sends a one-token request to each configured model every morning. If either fails, the scheduled check fails
          and the maintainer is emailed the same day.
        </Item>
        <Item title="Cost and abuse limits.">
          Daily chat caps per browser and per IP, per-identity rate limits on every API route, a cap on how many plans the weekly job
          processes, and a kill switch that stops scheduled AI work without a redeploy.
        </Item>
        <Item title="No accounts, by design.">
          Each browser carries a random ID that keys its own data. That isolates browsers from each other without collecting names or
          passwords, and it is stated plainly rather than dressed up as account security.
        </Item>
      </ul>

      <h2 style={h2}>How we know it’s right</h2>
      <p style={body}>
        Calculators disagree with each other, and a user can’t tell which to trust. So instead of claiming accuracy, the app shows its
        work.
      </p>
      <ul style={ol}>
        <Item title="Hand-worked reference cases.">
          Ten IRS and Social Security cases (federal tax at three incomes, Social Security taxability, claiming at 62, 64 and 70, spousal
          benefits, RMDs at 73 and 85) are worked by hand from the published rules. <a href="/accuracy" style={link}>How we check the math</a>{' '}
          shows the engine’s live result next to each, and the same cases run as automated tests on every change.
        </Item>
        <Item title="A few hundred automated tests">
          across the tax engine, projection, plan odds, Roth and Social Security optimizers, the AI rules and the tool-to-screen bindings.
        </Item>
        <Item title="An audit log.">
          Every calculation bug found, its cause and its fix is recorded in the repo’s{' '}
          <a href={`${REPO}/blob/main/AUDIT.md`} style={link}>AUDIT.md</a>. The most common cause so far: the same formula copied into two
          places and fixed in one.
        </Item>
        <Item title="Outside review.">
          Corrections have come from a financial planning and analysis professional (state retirement-income exemptions), a tax
          consultant, design reviewers and early testers. The builder is the worst person to find the builder’s blind spots.
        </Item>
      </ul>
      <p style={{ ...body, marginTop: 12 }}>
        What the engine does <strong>not</strong> model is also listed on <a href="/methodology" style={link}>How the math works</a>, so
        you know where to be careful.
      </p>

      <h2 style={h2}>Stack and source</h2>
      <p style={body}>
        Next.js and React on AWS Amplify. Charts are hand-rolled SVG with no charting dependency. Server-side data (chat history,
        health-check reports, email preference) lives in DynamoDB, keyed by browser ID. The assistant runs on Claude through the
        Anthropic API. Email, when turned on, goes through Resend.
      </p>
      <p style={body}>
        The whole thing is open source under the MIT license at <a href={REPO} style={link}>github.com/keeplearnin/retirement-simplified-nextjs</a>.
        The commit history is the real engineering log, including the bugs.
      </p>
    </TrustPage>
  );
}
