'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * AnimatedNumber — counts smoothly between successive `value` props. Uses
 * requestAnimationFrame + easeOutCubic. Default 600ms duration.
 *
 * Usage:
 *   <AnimatedNumber value={portfolioAtRetire} format={(v) => fmt(v)} />
 *
 * Why: static "$5.99M" reads like a spreadsheet output. Counting up to
 * the number when the plan changes (or first paint) gives it presence
 * without being gimmicky. Respects prefers-reduced-motion — users with
 * that pref see the final value immediately.
 */
export default function AnimatedNumber({
  value,
  format = (v) => String(Math.round(v)),
  duration = 600,
  style,
  className,
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    // Respect reduced-motion users — show the final value immediately.
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !Number.isFinite(value) || !Number.isFinite(fromRef.current)) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const delta = value - from;
    if (Math.abs(delta) < 0.5) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const start = performance.now();
    const tick = (t) => {
      const elapsed = t - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = from + delta * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  // Tabular figures — keeps the digits aligned during the count so the
  // box doesn't jitter sideways as numbers change width.
  return (
    <span
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
    >
      {format(display)}
    </span>
  );
}
