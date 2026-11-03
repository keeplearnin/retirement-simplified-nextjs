'use client';

import { usePlan } from '@/components/PlanProvider';
import Optimize from '@/components/tabs/Optimize';
import Scenarios from '@/components/tabs/Scenarios';
import { relevantTools } from '@/lib/relevantTools';

// Improve: the ranked moves (Optimize), deeper tools that apply to this
// plan, and side-by-side what-ifs (Scenarios) — one page instead of three.
export default function Improve() {
  const { plan } = usePlan();
  const tools = relevantTools(plan);
  const open = (tab) => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: tab }));

  return (
    <div className="fade-up">
      <h1 className="tools-title">Improve your plan</h1>
      <p className="tools-sub">Your best moves, ranked by what they are worth in dollars. Each one re-runs your full plan.</p>
      <Optimize />

      {tools.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 className="tools-section">Worth a look for you</h2>
          <div className="tools-grid">
            {tools.map(t => (
              <button key={t.tab} type="button" className="tool-card" onClick={() => open(t.tab)}>
                <span className="tool-card-title">{t.title}</span>
                <span className="tool-card-desc">{t.why}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 32 }}>
        <h2 className="tools-section">Compare what-ifs</h2>
        <Scenarios />
      </section>
    </div>
  );
}
