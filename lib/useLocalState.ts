'use client';

import { useState, useEffect } from 'react';

/**
 * useState that persists to localStorage.
 * Reads from localStorage on mount, writes on every change.
 */
export function useLocalState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    try {
      return JSON.parse(stored);
    } catch (err) {
      // Corrupted data — clear it so the next mount doesn't fail again,
      // and warn so the user sees the regression instead of mysterious resets.
      console.warn(`[useLocalState] Corrupted data for "${key}", clearing.`, err);
      localStorage.removeItem(key);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      // Surface quota exceeded / unavailable — silent failure means the user
      // thinks their plan was saved when it wasn't.
      console.warn(`[useLocalState] Failed to persist "${key}".`, err);
    }
  }, [key, state]);

  return [state, setState];
}
