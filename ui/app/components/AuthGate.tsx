"use client";

import { useState, ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { API_ENDPOINTS } from "../config";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, setApiKey } = useAuth();
  const [inputKey, setInputKey] = useState("");
  const [error, setError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = inputKey.trim();

    if (!key) {
      setError("Please enter your API key");
      return;
    }

    setIsValidating(true);
    setError("");

    try {
      const res = await fetch(API_ENDPOINTS.validateApiKey, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      const data = await res.json();

      if (data.valid) {
        setApiKey(key);
      } else {
        setError(data.error || "Invalid API key");
      }
    } catch {
      setError("Failed to validate API key. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-medium mb-2" style={{ color: "var(--foreground)" }}>
            bernd
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Enter your Mixedbread API key to continue
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="mxb-..."
              className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-colors"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              autoFocus
            />
            {error && (
              <p className="mt-2 text-xs" style={{ color: "var(--accent)" }}>
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isValidating}
            className="w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "white",
            }}
          >
            {isValidating ? "Validating..." : "Continue"}
          </button>
        </form>

        <div className="mt-6 text-xs text-center" style={{ color: "var(--muted)" }}>
          <p className="mb-2">How to get your API key:</p>
          <ol className="text-left space-y-1 pl-4">
            <li>1. Go to{" "}
              <a
                href="https://mixedbread.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:opacity-80"
                style={{ color: "var(--accent)" }}
              >
                mixedbread.com
              </a>
            </li>
            <li>2. Sign in or create an account</li>
            <li>3. Go to API Keys</li>
            <li>4. Create a new API key</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
