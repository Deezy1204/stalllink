"use client";

import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { checkAdmin } from "@/lib/data";
import { auth, firebaseConfigured } from "@/lib/firebase";

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  /** True until Firebase has said whether someone is signed in. */
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ user: null, isAdmin: false, loading: true, error: null, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, "signOut">>({ user: null, isAdmin: false, loading: true, error: null });

  useEffect(() => {
    if (!firebaseConfigured) {
      setState({ user: null, isAdmin: false, loading: false, error: "Firebase is not configured. Copy .env.example to .env.local and fill it in." });
      return;
    }
    return onAuthStateChanged(auth(), async (user) => {
      if (!user) {
        setState({ user: null, isAdmin: false, loading: false, error: null });
        return;
      }
      setState((s) => ({ ...s, user, loading: true }));
      try {
        const isAdmin = await checkAdmin(user.uid, user.email, user.displayName);
        setState({ user, isAdmin, loading: false, error: null });
      } catch (e) {
        setState({ user, isAdmin: false, loading: false, error: `Could not check admin access: ${(e as Error).message}` });
      }
    });
  }, []);

  return <AuthContext.Provider value={{ ...state, signOut: () => fbSignOut(auth()) }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
