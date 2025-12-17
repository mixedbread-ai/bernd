"use client";

import { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isPending } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isPending) return;

    if (!isAuthenticated && pathname !== "/sign-in") {
      router.push("/sign-in");
    } else if (isAuthenticated && pathname === "/sign-in") {
      router.push("/");
    }
  }, [isPending, isAuthenticated, pathname, router]);

  // Show loading state while checking session
  if (isPending) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background)" }}
      >
        <div style={{ color: "var(--muted)" }}>...</div>
      </div>
    );
  }

  if (pathname === "/sign-in") {
    return <>{children}</>;
  }

  // Show loading state while redirecting
  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background)" }}
      >
        <div style={{ color: "var(--muted)" }}>...</div>
      </div>
    );
  }

  return <>{children}</>;
}
