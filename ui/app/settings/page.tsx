"use client";

import { useState, useEffect, useCallback } from "react";
import { API_ENDPOINTS } from "../config";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

interface GoogleAuthStatus {
  connected: boolean;
  connected_at?: string;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SettingsPage() {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [googleStatus, setGoogleStatus] = useState<GoogleAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const checkGoogleStatus = useCallback(async () => {
    try {
      const res = await api.get(API_ENDPOINTS.googleAuthStatus);
      const data = await res.json();
      setGoogleStatus(data);
    } catch {
      setGoogleStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkGoogleStatus();

    // Listen for OAuth callback message
    const handleMessage = (event: MessageEvent) => {
      if (event.data === "google-auth-success") {
        checkGoogleStatus();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [checkGoogleStatus]);

  const connectGoogle = async () => {
    try {
      const res = await api.get(API_ENDPOINTS.googleAuth);
      const data = await res.json();
      if (data.auth_url) {
        window.open(data.auth_url, "google-auth", "width=500,height=600");
      } else if (data.error) {
        alert(data.error);
      }
    } catch (e) {
      console.error("Failed to start Google auth", e);
    }
  };

  const disconnectGoogle = async () => {
    if (!confirm("Are you sure you want to disconnect Google Calendar?")) {
      return;
    }
    setDisconnecting(true);
    try {
      await api.delete(API_ENDPOINTS.googleAuth);
      setGoogleStatus({ connected: false });
    } catch (e) {
      console.error("Failed to disconnect Google", e);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      logout();
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-12" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-xl">
        <h1 className="text-lg font-medium mb-8" style={{ color: "var(--foreground)" }}>
          Settings
        </h1>

        {/* Integrations section */}
        <section className="mb-8">
          <h2 className="text-sm font-medium mb-4" style={{ color: "var(--foreground)" }}>
            Integrations
          </h2>

          {/* Google Calendar */}
          <div
            className="p-4 rounded-lg"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "var(--background)" }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "var(--foreground)" }}
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    Google Calendar
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    {loading ? (
                      "Checking..."
                    ) : googleStatus?.connected ? (
                      <>
                        <span style={{ color: "var(--accent)" }}>Connected</span>
                        {googleStatus.connected_at && (
                          <span> since {formatDate(googleStatus.connected_at)}</span>
                        )}
                      </>
                    ) : (
                      "Not connected"
                    )}
                  </div>
                </div>
              </div>

              <div>
                {loading ? null : googleStatus?.connected ? (
                  <button
                    onClick={disconnectGoogle}
                    disabled={disconnecting}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
                    style={{
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      color: "var(--muted)",
                    }}
                  >
                    {disconnecting ? "Disconnecting..." : "Disconnect"}
                  </button>
                ) : (
                  <button
                    onClick={connectGoogle}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                    style={{
                      background: "var(--accent)",
                      color: "white",
                    }}
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>

            {googleStatus?.connected && (
              <div
                className="mt-3 pt-3 text-xs"
                style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}
              >
                Bernd can create, update, and manage calendar events for your todos.
              </div>
            )}
          </div>
        </section>

        {/* Appearance section */}
        <section className="mb-8">
          <h2 className="text-sm font-medium mb-4" style={{ color: "var(--foreground)" }}>
            Appearance
          </h2>

          <div
            className="p-4 rounded-lg"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "var(--background)" }}
                >
                  {theme === "light" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground)" }}>
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground)" }}>
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    Theme
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    {theme === "light" ? "Light mode" : "Dark mode"}
                  </div>
                </div>
              </div>

              <button
                onClick={toggleTheme}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                style={{
                  background: "var(--accent)",
                  color: "white",
                }}
              >
                {theme === "light" ? "Switch to dark" : "Switch to light"}
              </button>
            </div>
          </div>
        </section>

        {/* Account section */}
        <section>
          <h2 className="text-sm font-medium mb-4" style={{ color: "var(--foreground)" }}>
            Account
          </h2>

          <div
            className="p-4 rounded-lg"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm" style={{ color: "var(--foreground)" }}>
                  Logout
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  Clear your API key from this browser
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
