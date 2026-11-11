import TrustPage, { REPO, h2, muted, body, link, Rule, Item } from '@/components/trust/TrustPage';

export const metadata = {
  title: 'What the assistant will and won’t do — Retire Simplified',
  description:
    'Exactly what “Ask about your plan” can do, the five rules it never breaks, where its numbers come from, and what happens to your data.',
  alternates: { canonical: 'https://retiresimplified.com/assistant-rules' },
};

export default function AssistantRulesPage() {
  return (
    <TrustPage
      title="What the assistant will and won’t do"
      lead={
        <>
          “Ask about your plan” is the question-answering part of Retire.Simplified. It reads the plan you entered, runs the same
          calculation engine that powers the Plan and Improve screens, and explains the results in plain language. It is not a
          financial advisor, it does not know your full financial picture, and it will not tell you what to buy. This page says
          exactly what it will and won’t do, so you can decide how much to rely on it.
        </>
      }
    >
      <h2 style={h2}>What it will do</h2>
      <p style={body}>It answers questions about your own plan by running calculations, not by guessing. For example:</p>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        <Item title="Am I on track?">
          It runs your plan through 500 simulated markets and every real market sequence since 1928, and tells you the chance your
          money lasts, plus the age it runs out in a bad market.
        </Item>
        <Item title="What if I retire at 62 instead of 65?">It reruns the full projection with the change and shows the difference.</Item>
        <Item title="When should I claim Social Security?">
          It compares claiming at 62, 65, 67 and 70: monthly benefit, lifetime total and break-even ages.
        </Item>
        <Item title="How much tax will I pay?">It runs the federal and state tax engine for the year you ask about.</Item>
        <Item title="Should I do Roth conversions?">
          It models a conversion ladder against no conversions, including the Medicare surcharge (IRMAA) effect.
        </Item>
        <Item title="What should I do first?">
          It chains the projection, Social Security, Roth and withdrawal-order analyses into a ranked list with the dollar impact of each.
        </Item>
      </ul>
      <p style={{ ...body, marginTop: 12 }}>
        It will also answer general questions, such as how a 401(k) works or what an index fund is, from general knowledge. For
        those, it does not use your numbers.
      </p>

      <h2 style={h2}>What it won’t do</h2>
      <p style={body}>
        Five rules apply to every AI feature in the app: the chat, the health check, the optimizer, the quarterly review and the
        weekly email.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Rule n="1" title="It never names an investment.">
          No funds, tickers, fund companies, brokerages, annuities or insurance products, and never “buy”, “sell” or “hold”. It can
          explain what a bond or an index fund is in general terms. If you ask what to buy, it will say that this tool doesn’t pick
          investments and suggest a fee-only fiduciary.
        </Rule>
        <Rule n="2" title="It never changes your plan on its own.">
          It can propose a change. You decide whether to apply it. It will never say a change “has been made”.
        </Rule>
        <Rule n="3" title="It never claims to be an advisor.">
          No credentials, certifications or exam scores. No advisor-client relationship is created by using it.
        </Rule>
        <Rule n="4" title="It doesn’t give tax or legal advice for your situation.">
          It can show what the tax engine calculates for a scenario. For decisions, it points you to a CPA or fee-only fiduciary.
        </Rule>
        <Rule n="5" title="It doesn’t promise outcomes.">
          Every number is framed as “given the assumptions you entered”. A projection is a model, not a forecast.
        </Rule>
      </div>

      <h2 style={h2}>Where its numbers come from</h2>
      <p style={body}>
        Every number about your plan comes from the calculation engine, never from the AI’s own arithmetic. The assistant has a set
        of tools (read the plan, run the projection, run the tax estimate, compare scenarios, and so on) that call the same functions
        the Plan and Improve screens use. If it hasn’t run a calculation, it says so rather than estimating.
      </p>
      <p style={body}>That means you can check anything it tells you:</p>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        <Item title="A year-specific figure">points to the Ledger on the Plan screen (“see age 67 in the Ledger”).</Item>
        <Item title="A dollar impact">points to Improve → Show the math, which lists the steps.</Item>
        <Item title="The engine itself">
          is checked against hand-worked IRS and Social Security cases on <a href="/accuracy" style={link}>How we check the math</a>.
        </Item>
      </ul>
      <p style={{ ...body, marginTop: 12 }}>
        If the assistant and a screen ever disagree, the screen is right and the assistant has a bug. Please report it (see the last
        section).
      </p>

      <h2 style={h2}>Changes to your plan</h2>
      <p style={body}>
        When the assistant suggests a specific change, such as claiming Social Security at 70 or raising a monthly contribution, it
        shows an <strong>Apply</strong> button next to the suggestion. Nothing happens until you click it.
      </p>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        <Item title="You apply, it doesn’t.">The assistant records a proposal; the app changes the plan only on your click.</Item>
        <Item title="Stale suggestions are caught.">
          If you have edited the plan since the suggestion was made, the app checks the current value before applying, so an old
          suggestion can’t overwrite a newer decision.
        </Item>
        <Item title="You can undo.">After you apply a change, an Undo button stays available for 30 seconds and restores the previous value.</Item>
      </ul>
      <p style={{ ...body, marginTop: 12 }}>Every suggestion is a hypothetical scenario based on your inputs, not personalized advice.</p>

      <h2 style={h2}>Your data</h2>
      <p style={body}>
        There are no accounts. Your plan lives in your browser and is tied to a random ID your browser created on first visit.
      </p>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        <Item title="In your browser:">your plan, saved scenarios and settings. Clear your site data and they’re gone.</Item>
        <Item title="On our server, keyed to that browser ID:">
          chat history, past health-check reports, and your email preference if you turn on the weekly digest. This is what lets the
          assistant remember earlier conversations and show your plan’s trend over time.
        </Item>
        <Item title="Sent to the AI model:">
          the plan figures needed to answer your question, for that request only. The assistant is instructed never to reference your
          data outside the conversation, and we do not use your plan to train anything.
        </Item>
        <Item title="Never collected:">
          your name, account numbers or login credentials. We have no way to link a plan to a person unless you enter an email for the
          digest.
        </Item>
      </ul>
      <p style={{ ...body, marginTop: 12 }}>
        If you use the app on two devices, they are two separate plans. Export and import on the Tools page moves a plan between them.
      </p>

      <h2 style={h2}>How these rules are enforced</h2>
      <p style={body}>The rules above are not just a promise on a page.</p>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        <li style={muted}>They are written once, in code, and attached to every AI feature. A new feature can’t skip them.</li>
        <li style={muted}>Automated tests fail if the rules are removed or weakened, so they can’t be dropped quietly.</li>
        <li style={muted}>The assistant can only get plan numbers through tools that call the real engine, so it can’t invent them.</li>
        <li style={muted}>The AI model each feature uses is set in one place and checked daily, so a retired or misnamed model is caught within a day.</li>
        <li style={muted}>
          The source code is <a href={REPO} style={link}>open on GitHub</a>, so anyone can verify this.
        </li>
      </ul>
      <p style={{ ...body, marginTop: 12 }}>
        The assistant will still get things wrong sometimes. If it names an investment, claims to be an advisor, quotes a number that
        disagrees with a screen, or does anything else this page says it won’t,{' '}
        <a href={`${REPO}/issues`} style={link}>open an issue</a> with the question you asked. That is how the rules get tighter.
      </p>
    </TrustPage>
  );
}
