# Retire.Simplified — Pilot Test

**You're testing a new AI-powered retirement planning tool.** Free, open-source, no ads. About 10 minutes to set up your plan, then the AI takes it from there.

🌐 **retiresimplified.com** · ⏱️ **15-20 min for a full pass**

---

## What's new

You probably know retirement calculators that ask 3 questions and spit out a chart. This one is different in two ways:

1. **The math is real.** A full year-by-year projection — taxes (federal + state + IRMAA), RMDs, Social Security claiming math, Roth conversions, withdrawal sequencing, healthcare cost ramps. Same engine professionals pay $1,000+/year for.

2. **There's an AI advisor that actually uses your numbers.** Not a chatbot pretending to be helpful. Ask "Am I on track to retire at 62?" and it runs the projection. Ask "Should I do a Roth conversion?" and it models a 25-year ladder. Click ⚡ Optimize and it chains 5 analyses into a ranked action list.

---

## 5 things to try (in order)

### 1. Set up your plan (~5 min)
Go to **My Plan**. Expand each section, fill in real numbers — current age, retirement age, savings split (401k / Roth / Taxable / Cash / Real Estate), income sources, expected spending. Approximate is fine. The app saves locally as you type.

### 2. Look at the chart
Above the inputs you'll see a net worth projection from today to your longevity, plus three summary boxes (Portfolio at Retire / Money Lasts To / Lifetime Taxes). Note the "Estate / Legacy" block — for couples it shows what passes to your surviving spouse vs. what reaches heirs.

### 3. Open the AI Advisor tab
Top nav → **AI Advisor**. You'll see a row of status chips:
- **Plan health** — color-coded (green = good, yellow = needs attention, red = critical)
- **Insights** — proactive recommendations the AI found in your portfolio
- **🏠 RE excluded** (if you have real estate) — important nuance, click to expand
- **⚡ Optimize** — run the full multi-step analysis (~20 sec)
- **⚙️** — settings (optional weekly email digest)

### 4. Click ⚡ Optimize
This is the headline feature. The AI runs: projection → Social Security timing analysis (62/65/67/70) → Roth conversion ladder → withdrawal order comparison → portfolio recommendations. Returns a ranked action list with dollar impact per change ("Delay SS to 70: +$85K lifetime income").

### 5. Chat with the advisor
The chat box at the bottom. Try one of the suggested questions OR type your own. The AI has real access to your plan — it can run calculations on demand, not just talk in generalities.

---

## What we're trying to learn from you

- **Did you trust the numbers?** If the AI told you something surprising, did you believe it?
- **Did you understand the recommendations?** Were the dollar impacts believable?
- **What did you try to do that didn't work?** Friction points are gold.
- **Where did you give up?** If you closed the tab, when and why?

---
<div style="page-break-after: always;"></div>

## Sample questions worth asking the AI

The AI is best on **plan-specific** questions. It runs real calculations for these:

- *"Am I on track to retire at 62?"*
- *"What if I delayed retirement by 3 years?"*
- *"Should I do a Roth conversion? How much?"*
- *"When should I claim Social Security?"*
- *"What's the tax cost of withdrawing $50K from my 401(k) at age 60?"*
- *"How does my plan compare to last year?"* (after using the app for a week)
- *"My portfolio is 80% in my 401(k). Is that a problem?"*

And **educational** questions for context:
- *"What's the difference between Traditional and Roth?"*
- *"How do RMDs work?"*
- *"What's the rule of 55?"*

---

## Known rough edges (don't waste time on these)

We're shipping fast and being honest about what isn't polished yet:

- **The chat won't remember prior conversations** — each session starts fresh. We're working on persistent memory.
- **Roth conversion savings estimates can swing wildly** for unusual plans (small balances, very late retirement). Treat the dollar figure as approximate.
- **Mobile layout is still being tuned** — desktop / tablet experience is smoother.
- **No PDF export yet** — if you want to share results, screenshots work for now.
- **The Plaid integration in the codebase isn't wired up** — you'll enter balances manually.

---

## Privacy

- **Your plan data is yours.** Stored in your browser by default; optionally synced to your private account if you sign in.
- **Nothing is sold, shared, or used for ads.** This is a free tool, not a lead-gen funnel.
- **The AI only sees your numbers when you talk to it.** No background scraping.
- **You can delete everything** by clearing your browser storage or asking us to delete your account.

---

## How to give feedback

Three options, pick whichever is easiest:

1. **Reply to the invite email** — quickest, just freeform thoughts
2. **GitHub Issues** — `github.com/keeplearnin/retirement-simplified-nextjs/issues` — best for bugs with reproduction steps
3. **Quick survey** *(link in invite email)* — 5 questions, 2 minutes

**Most useful feedback format:**
> "I tried to do X, expected Y, but Z happened. Confusing because [reason]."

Less useful: "It's pretty good" or "I like it." (Friction wins.)

---

## What this is *not*

- ❌ A financial advisor — it's an **educational tool**. We say this loudly.
- ❌ A licensed retirement product.
- ❌ A replacement for a CPA on tax questions or a fee-only fiduciary on big decisions.
- ❌ Connected to any brokerage — it can't move money.

It's a **planning sandbox** that's smarter than a spreadsheet. Use it to pressure-test decisions before talking to a professional.

---

**Thanks for testing.** Honest feedback in the first 2 weeks is the most valuable thing you can give us — every confused click teaches us something.

*— The Retire.Simplified team*
