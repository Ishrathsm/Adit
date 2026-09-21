"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid rendering a theme-dependent state before hydration settles.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-6 w-11 shrink-0 rounded-full border border-border-subtle" />;

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex h-6 w-11 shrink-0 items-center rounded-full border border-border-strong bg-transparent px-1"
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="flex h-4 w-4 items-center justify-center"
        style={{ marginLeft: isDark ? 0 : "auto", marginRight: isDark ? "auto" : 0 }}
      >
        {isDark ? (
          <Moon size={13} className="fill-foreground text-foreground" />
        ) : (
          <Sun size={13} className="fill-amber-400 text-amber-400" />
        )}
      </motion.span>
    </button>
  );
}
