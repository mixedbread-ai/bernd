"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useOrgSwitch } from "../context/OrgSwitchContext";
import { authClient } from "../lib/auth";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

export function OrgSwitcher() {
  const { data: activeOrg, isPending: isActiveOrgPending } =
    authClient.useActiveOrganization();
  const { setIsSwitching } = useOrgSwitch();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchOrgs() {
      const { data } = await authClient.organization.list();
      setOrgs(data ?? []);
      setIsLoading(false);
    }
    fetchOrgs();
  }, []);

  const handleSwitch = async (orgId: string) => {
    if (orgId === activeOrg?.id) return;
    setIsSwitching(true);
    await authClient.organization.setActive({ organizationId: orgId });
    window.location.reload();
  };

  const showDropdown = !isLoading && orgs.length > 1;

  return (
    <div>
      <div className="text-sm font-medium tracking-wide text-foreground">
        bernd
      </div>

      {isLoading || isActiveOrgPending ? (
        <div className="mt-1 h-5 w-20 bg-border/50 rounded animate-pulse" />
      ) : showDropdown ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="mt-1 flex items-center gap-1 text-sm text-muted hover:text-foreground transition-[color] outline-none"
            >
              <span className="truncate max-w-[100px]">{activeOrg?.name}</span>
              <ChevronsUpDownIcon size={12} />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={8}
              className="z-50 min-w-[180px] rounded-md border border-border bg-surface p-1 shadow-md animate-dropdown-in"
            >
              <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium text-muted">
                Workspaces
              </DropdownMenu.Label>
              <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-border" />
              {orgs.map((org) => (
                <DropdownMenu.Item
                  key={org.id}
                  onSelect={() => handleSwitch(org.id)}
                  className="relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none cursor-pointer data-highlighted:bg-surface-hover"
                >
                  <span className="w-4 shrink-0">
                    {org.id === activeOrg?.id && (
                      <CheckIcon size={14} className="text-foreground" />
                    )}
                  </span>
                  <span className="truncate">{org.name}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : (
        <div className="mt-1 text-xs text-muted truncate max-w-[120px]">
          {activeOrg?.name}
        </div>
      )}
    </div>
  );
}
