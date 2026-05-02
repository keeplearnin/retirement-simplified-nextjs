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
    <main style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 24 }}>
      {/* Lightweight header so users can navigate back to the full app */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        maxWidth: 720, margin: '0 auto', padding: '0 16px 16px',
      }}>
        <a
          href="/"
          style={{
            display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
            color: 'var(--text)', fontFamily: 'var(--sans)',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Retire<span style={{ color: 'var(--accent)' }}>.</span>Simplified
          </span>
        </a>
        <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2 }}>
          Verdict
        </span>
      </div>

      {output ? (
        <VerdictResult output={output} input={input} onRestart={restart} />
      ) : (
        <VerdictInputForm onSubmit={handleSubmit} />
      )}
    </main>
  );
}
