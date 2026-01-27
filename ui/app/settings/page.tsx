"use client";

import { CalendarIcon, MoonIcon, SunIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_ENDPOINTS } from "../../config";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../lib/api";

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
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [googleStatus, setGoogleStatus] = useState<GoogleAuthStatus | null>(
    null,
  );
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

  const handleLogout = async () => {
    if (confirm("Are you sure you want to sign out?")) {
      await logout();
      router.push("/sign-in");
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-12 bg-background">
      <div className="mx-auto max-w-xl">
        <h1 className="text-lg font-medium mb-8 text-foreground">Settings</h1>

        {/* Integrations section */}
        <section className="mb-8">
          <h2 className="text-sm font-medium mb-4 text-foreground">
            Integrations
          </h2>

          {/* Google Calendar */}
          <div className="p-4 rounded-lg bg-surface border border-border">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-background">
                  <CalendarIcon size={20} className="text-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    Google Calendar
                  </div>
                  <div className="text-xs mt-0.5 text-muted">
                    {loading ? (
                      "Checking..."
                    ) : googleStatus?.connected ? (
                      <>
                        <span className="text-accent">Connected</span>
                        {googleStatus.connected_at && (
                          <span>
                            {" "}
                            since {formatDate(googleStatus.connected_at)}
                          </span>
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
                    type="button"
                    onClick={disconnectGoogle}
                    disabled={disconnecting}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50 bg-background border border-border text-muted"
                  >
                    {disconnecting ? "Disconnecting..." : "Disconnect"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={connectGoogle}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 bg-accent text-white"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>

            {googleStatus?.connected && (
              <div className="mt-3 pt-3 text-xs border-t border-border text-muted">
                Bernd can create, update, and manage calendar events for your
                todos.
              </div>
            )}
          </div>
        </section>

        {/* Appearance section */}
        <section className="mb-8">
          <h2 className="text-sm font-medium mb-4 text-foreground">
            Appearance
          </h2>

          <div className="p-4 rounded-lg bg-surface border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-background">
                  {theme === "light" ? (
                    <SunIcon size={20} className="text-foreground" />
                  ) : (
                    <MoonIcon size={20} className="text-foreground" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    Theme
                  </div>
                  <div className="text-xs mt-0.5 text-muted">
                    {theme === "light" ? "Light mode" : "Dark mode"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 bg-accent text-white"
              >
                {theme === "light" ? "Switch to dark" : "Switch to light"}
              </button>
            </div>
          </div>
        </section>

        {/* Account section */}
        <section>
          <h2 className="text-sm font-medium mb-4 text-foreground">Account</h2>

          <div className="p-4 rounded-lg bg-surface border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground">
                  {user?.email || "Signed in"}
                </div>
                <div className="text-xs mt-0.5 text-muted">
                  {user?.name || "Sign out of your account"}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 bg-background border border-border text-muted"
              >
                Sign out
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
