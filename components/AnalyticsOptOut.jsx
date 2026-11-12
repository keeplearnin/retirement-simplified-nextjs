'use client';

import { useEffect, useState } from 'react';
import { GA_ID, OPT_OUT_KEY, setAnalyticsOptOut } from '@/lib/analytics';

/** Per-browser analytics switch shown on /assistant-rules › Your data. */
export default function AnalyticsOptOut() {
  const [state, setState] = useState(null); // null until mounted

  useEffect(() => {
    let optedOut = false;
    try {
      optedOut = window.localStorage.getItem(OPT_OUT_KEY) === '1';
    } catch {}
    const gpc = window.navigator?.globalPrivacyControl === true;
    setState({ optedOut, gpc });
  }, []);

  if (!GA_ID || !state) return null;

  if (state.gpc) {
    return <span>Your browser sends Global Privacy Control, so analytics is already off here.</span>;
  }

  return (
    <span>
      {state.optedOut ? 'Analytics is off in this browser. ' : 'Analytics is on in this browser. '}
      <button
        type="button"
        onClick={() => {
          const next = !state.optedOut;
          setAnalyticsOptOut(next);
          setState({ ...state, optedOut: next });
        }}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'var(--accent)',
          font: 'inherit',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        {state.optedOut ? 'Turn it back on' : 'Turn it off'}
      </button>
    </span>
  );
}
