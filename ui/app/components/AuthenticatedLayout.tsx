"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { Navbar } from "./Navbar";
import { FloatingChat } from "./FloatingChat";

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
