"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load API key from localStorage on mount
    const stored = localStorage.getItem("mxb_api_key");
    if (stored) {
      setApiKeyState(stored);
    }
    setIsLoading(false);
  }, []);

  const setApiKey = (key: string | null) => {
    setApiKeyState(key);
    if (key) {
      localStorage.setItem("mxb_api_key", key);
    } else {
      localStorage.removeItem("mxb_api_key");
    }
  };

  const logout = () => {
    setApiKey(null);
  };

  if (isLoading) {
    return null; // Or a loading spinner
  }

  return (
    <AuthContext.Provider
      value={{
        apiKey,
        setApiKey,
        isAuthenticated: !!apiKey,
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

// Helper to create fetch with auth header
export function useAuthFetch() {
  const { apiKey } = useAuth();

  return (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    if (apiKey) {
      headers.set("Authorization", `Bearer ${apiKey}`);
    }
    return fetch(url, { ...options, headers });
  };
}
