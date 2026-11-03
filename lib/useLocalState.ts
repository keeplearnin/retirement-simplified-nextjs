'use client';

import { useState, useEffect } from 'react';

/**
 * useState that persists to localStorage.
 *
 * The first render uses `defaultValue` on the server and in the browser
 * alike, and the saved value loads right after mount. Reading localStorage
 * during render made a returning user's first render differ from the server
 * HTML (React error #418), so React threw the page away and re-rendered it.
 * Writes wait until the saved value has loaded, so the default never
 * overwrites it.
 */
export function useLocalState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setState(JSON.parse(stored));
      } catch (err) {
        // Corrupted data — clear it so the next mount doesn't fail again,
        // and warn so the user sees the regression instead of mysterious resets.
        console.warn(`[useLocalState] Corrupted data for "${key}", clearing.`, err);
        localStorage.removeItem(key);
      }
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      // Surface quota exceeded / unavailable — silent failure means the user
      // thinks their plan was saved when it wasn't.
      console.warn(`[useLocalState] Failed to persist "${key}".`, err);
    }
  }, [key, state, loaded]);

  return [state, setState];
}
