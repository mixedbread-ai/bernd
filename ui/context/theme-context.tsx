"use client";

import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
  const { theme, setTheme } = useNextTheme();

  function toggleTheme() {
    setTheme(theme === "light" ? "dark" : "light");
  }

  return { theme: theme as "light" | "dark" | undefined, toggleTheme };
}
