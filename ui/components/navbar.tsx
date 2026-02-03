"use client";

import {
  CircleCheckIcon,
  FileTextIcon,
  FolderIcon,
  LogOutIcon,
  MessageSquareIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils/ui";
import { useAuth } from "@/context/auth-context";
import { OrgSwitcher } from "@/components/org-switcher";

const navItems = [
  { href: "/", label: "todos", key: "t", icon: CircleCheckIcon },
  { href: "/chat", label: "chat", key: "c", icon: MessageSquareIcon },
  { href: "/notes", label: "notes", key: "n", icon: FileTextIcon },
  { href: "/search", label: "search", key: "s", icon: SearchIcon },
  { href: "/files", label: "files", key: "f", icon: FolderIcon },
  { href: "/settings", label: "settings", key: ",", icon: SettingsIcon },
];

function isNavActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (confirm("Are you sure you want to sign out?")) {
      await logout();
      router.push("/sign-in");
    }
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      const item = navItems.find((nav) => nav.key === e.key.toLowerCase());
      if (item) {
        router.push(item.href);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-44 flex-col border-r border-border px-6 py-8 bg-background">
        <div className="mb-12">
          <OrgSwitcher />
        </div>

        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = isNavActive(item.href, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center justify-between py-1.5 text-sm transition-colors",
                    isActive ? "text-foreground" : "text-muted",
                  )}
                >
                  <span className="hover:opacity-80">{item.label}</span>
                  <span
                    className={cn(
                      "text-xs",
                      isActive ? "text-accent" : "text-muted opacity-50",
                    )}
                  >
                    {item.key}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {user && (
          <div className="mt-auto pt-6 border-t border-border">
            <div className="mb-3 text-sm truncate text-muted">{user.email}</div>

            <button
              type="button"
              onClick={handleLogout}
              className="text-sm transition-colors hover:opacity-80 flex items-center gap-2 text-muted"
            >
              <LogOutIcon size={14} />
              sign out
            </button>
          </div>
        )}
      </nav>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border z-30 safe-area-bottom bg-background">
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map((item) => {
            const isActive = isNavActive(item.href, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  isActive ? "text-accent" : "text-muted",
                )}
              >
                <Icon size={20} />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
