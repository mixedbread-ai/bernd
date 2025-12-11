"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const navItems = [
  { href: "/", label: "todos", key: "t" },
  { href: "/chat", label: "chat", key: "c" },
  { href: "/search", label: "search", key: "s" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
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
    <nav className="fixed left-0 top-0 flex h-screen w-44 flex-col border-r border-[#e8e6e3] bg-[#faf9f7] px-6 py-8">
      <div className="mb-12">
        <span className="text-sm font-medium tracking-wide text-[#1a1a1a]">bernd</span>
      </div>

      <ul className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`group flex items-center justify-between py-1.5 text-sm transition-colors ${
                  isActive
                    ? "text-[#1a1a1a]"
                    : "text-[#a8a8a8] hover:text-[#1a1a1a]"
                }`}
              >
                <span>{item.label}</span>
                <span className={`text-xs ${isActive ? "text-[#c45d3a]" : "text-[#d4d4d4] group-hover:text-[#a8a8a8]"}`}>
                  {item.key}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto">
        <span className="text-xs text-[#d4d4d4]">0.1</span>
      </div>
    </nav>
  );
}
