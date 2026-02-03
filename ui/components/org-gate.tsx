"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { getDefaultOrganization } from "@/lib/utils/org";
import { useAuth } from "@/context/auth-context";
import { useOrgSwitch } from "@/context/org-switch-context";
import { authClient } from "@/lib/auth";
import { Loading } from "@/components/loading";

export function OrgGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isPending: authPending, user, session } = useAuth();
  const { isSwitching } = useOrgSwitch();
  const [isReady, setIsReady] = useState(false);
  const pathname = usePathname();
  const isSignIn = pathname === "/sign-in";

  useEffect(() => {
    if (isSignIn || authPending || !isAuthenticated) return;

    async function ensureOrg() {
      try {
        const { data: orgs } = await authClient.organization.list();

        if (!orgs || orgs.length === 0) {
          const { name, slug } = await getDefaultOrganization(
            user?.email ?? "",
            user?.name,
          );
          const { data: newOrg } = await authClient.organization.create({
            name,
            slug,
          });
          if (newOrg) {
            await authClient.organization.setActive({
              organizationId: newOrg.id,
            });
          }
        } else if (!session?.activeOrganizationId) {
          await authClient.organization.setActive({
            organizationId: orgs[0].id,
          });
        }
      } catch (error) {
        console.error("Failed to ensure organization:", error);
      } finally {
        setIsReady(true);
      }
    }

    ensureOrg();
  }, [
    isSignIn,
    authPending,
    isAuthenticated,
    user?.email,
    user?.name,
    session?.activeOrganizationId,
  ]);

  if (isSignIn) {
    return children;
  }

  if (authPending || !isReady || isSwitching) {
    return <Loading />;
  }

  return children;
}
