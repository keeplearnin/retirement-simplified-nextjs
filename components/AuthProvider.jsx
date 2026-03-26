'use client';

import { createContext, useContext, useState, useEffect } from 'react';
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

  const signIn = () => Auth.signIn();
  const signOut = () => { Auth.signOut(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, isConfigured: configured, authLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
