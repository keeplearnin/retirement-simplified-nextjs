'use client';

import { useState } from 'react';
import VerdictInputForm from '@/components/verdict/VerdictInputForm';
import VerdictResult from '@/components/verdict/VerdictResult';
import { computeVerdict } from '@/lib/verdict';

export default function VerdictPage() {
  const [output, setOutput] = useState(null);
  const [input, setInput] = useState(null);

  function handleSubmit(submitted) {
    setInput(submitted);
    setOutput(computeVerdict(submitted));
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }

  function restart() {
    setOutput(null);
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 16 }}>
      {/* Lightweight masthead so users can get back to the full app */}
      <header style={{ borderBottom: '4px double var(--rule)', marginBottom: 8 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          maxWidth: 720, margin: '0 auto', padding: '0 16px 14px',
        }}>
          <a href="/" style={{ textDecoration: 'none', color: 'var(--heading)' }}>
            <span className="brand-name" style={{ fontSize: 17 }}>Retire<span className="dot">.</span>Simplified</span>
          </a>
          <a href="/" className="mast-btn">Open the full planner</a>
        </div>
      </header>

      {output ? (
        <VerdictResult output={output} input={input} onRestart={restart} />
      ) : (
        <VerdictInputForm onSubmit={handleSubmit} />
      )}
    </main>
  );
}
