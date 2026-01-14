"use client";

import { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { Loading } from "./Loading";

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
    return <Loading />;
  }

  if (pathname === "/sign-in") {
    return <>{children}</>;
  }

  // Show loading state while redirecting
  if (!isAuthenticated) {
    return <Loading />;
  }

  return <>{children}</>;
}
