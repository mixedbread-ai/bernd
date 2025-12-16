"use client";

import { useState, ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, setApiKey } = useAuth();
  const [inputKey, setInputKey] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputKey.trim()) {
      setApiKey(inputKey.trim());
      setError("");
    } else {
      setError("Please enter your API key");
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
            className="w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
            style={{
              background: "var(--accent)",
              color: "white",
            }}
          >
            Continue
          </button>
        </form>

        <p className="mt-6 text-xs text-center" style={{ color: "var(--muted)" }}>
          Get your API key from{" "}
          <a
            href="https://mixedbread.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            mixedbread.ai
          </a>
        </p>
      </div>
    </div>
  );
}
