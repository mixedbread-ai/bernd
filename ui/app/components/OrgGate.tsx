"use client";

import { useEffect, useState, ReactNode, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { authClient } from "../lib/auth";
import { Loading } from "./Loading";
import { getDefaultOrganization } from "@/lib/utils/org";

export function OrgGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isPending: authPending, user, session } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const pathname = usePathname();
  const hasChecked = useRef(false);
  const isSignIn = pathname === "/sign-in";

  useEffect(() => {
    if (isSignIn || authPending || !isAuthenticated || hasChecked.current) return;

    hasChecked.current = true;

    async function ensureOrg() {
      try {
        const { data: orgs } = await authClient.organization.list();

        if (!orgs || orgs.length === 0) {
          const { name, slug } = await getDefaultOrganization(
            user?.email ?? "",
            user?.name
          );
          const { data: newOrg } = await authClient.organization.create({ name, slug });
          if (newOrg) {
            await authClient.organization.setActive({ organizationId: newOrg.id });
          }
        } else if (!session?.activeOrganization) {
          await authClient.organization.setActive({ organizationId: orgs[0].id });
        }
      } catch (error) {
        console.error("Failed to ensure organization:", error);
      } finally {
        setIsReady(true);
      }
    }

    ensureOrg();
  }, [isSignIn, authPending, isAuthenticated, user?.email, user?.name, session?.activeOrganization]);

  if (isSignIn) {
    return children;
  }

  if (authPending || !isReady) {
    return <Loading />;
  }

  return children;
}
