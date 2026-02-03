"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/context/auth-context";
import { FloatingChat } from "@/components/chat/floating-chat";
import { Navbar } from "@/components/navbar";

export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  const showAuthenticatedUI = isAuthenticated && pathname !== "/sign-in";

  return (
    <div className="min-h-screen bg-background">
      {showAuthenticatedUI && <Navbar />}
      <main className={showAuthenticatedUI ? "md:ml-44 pb-20 md:pb-0" : ""}>
        {children}
      </main>
      {showAuthenticatedUI && <FloatingChat />}
    </div>
  );
}
