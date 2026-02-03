"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Loading } from "@/components/loading";

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
