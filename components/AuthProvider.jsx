'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import Auth, { isConfigured } from '@/lib/auth';

const AuthContext = createContext({ user: null, isConfigured: false });

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const configured = isConfigured();

  useEffect(() => {
    (async () => {
      if (configured) {
        await Auth.handleCallback();
        setUser(Auth.getUser());
      }
      setAuthLoading(false);
    })();
  }, [configured]);

  const signIn = useCallback(() => Auth.signIn(), []);
  const signOut = useCallback(() => { Auth.signOut(); setUser(null); }, []);

  // Stable identity prevents every useAuth() consumer from re-rendering on
  // unrelated AuthProvider renders. Mirrors the PlanProvider pattern.
  const value = useMemo(
    () => ({ user, isConfigured: configured, authLoading, signIn, signOut }),
    [user, configured, authLoading, signIn, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
