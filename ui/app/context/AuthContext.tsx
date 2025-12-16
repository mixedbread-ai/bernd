"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSession, authClient } from "../lib/auth";

interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isPending: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession();

  const logout = async () => {
    await authClient.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user: data?.user ?? null,
        session: data?.session ?? null,
        isAuthenticated: !!data?.session,
        isPending,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
