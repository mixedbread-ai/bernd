"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTheme } from "../context/ThemeContext";

const navItems = [
  { href: "/", label: "todos", key: "t" },
  { href: "/chat", label: "chat", key: "c" },
  { href: "/notes", label: "notes", key: "n" },
  { href: "/search", label: "search", key: "s" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

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
    <nav className="fixed left-0 top-0 flex h-screen w-44 flex-col border-r px-6 py-8" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
      <div className="mb-12">
        <span className="text-sm font-medium tracking-wide" style={{ color: 'var(--foreground)' }}>bernd</span>
      </div>

      <ul className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-center justify-between py-1.5 text-sm transition-colors"
                style={{ color: isActive ? 'var(--foreground)' : 'var(--muted)' }}
              >
                <span className="hover:opacity-80">{item.label}</span>
                <span style={{ color: isActive ? 'var(--accent)' : 'var(--muted)', opacity: isActive ? 1 : 0.5 }} className="text-xs">
                  {item.key}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
          style={{ color: 'var(--muted)' }}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </button>
      </div>
    </nav>
  );
}
