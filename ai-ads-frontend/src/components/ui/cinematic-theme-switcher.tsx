"use client";

import { Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";

interface Particle {
  id: number;
  delay: number;
  duration: number;
}

// Adapted from a community "cinematic theme switcher" component. Two deliberate
// changes from the source: (1) framer-motion swapped for `motion/react`, the same
// package already used everywhere else in this app, instead of installing a second
// animation library; (2) recolored from the source's generic slate/blue/amber
// palette to Adit's own tokens (--background/--surface/--border-*) plus the same
// blue/yellow hues used in the .rgb-border flourish, so the particle burst reads as
// "this app's accent," not a stock demo color. The source also declared two SVG
// grain <filter> defs that nothing in the component ever referenced — dropped as
// dead code rather than carried over unused.
export function CinematicThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const isDark = mounted && (theme === "dark" || resolvedTheme === "dark");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  function generateParticles() {
    const particleCount = 3;
    const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      delay: i * 0.1,
      duration: 0.6 + i * 0.1,
    }));

    setParticles(newParticles);
    setIsAnimating(true);

    window.setTimeout(() => {
      setIsAnimating(false);
      setParticles([]);
    }, 1000);
  }

  function handleToggle() {
    generateParticles();
    setTheme(isDark ? "light" : "dark");
  }

  if (!mounted) {
    return (
      <div className="relative inline-block">
        <div className="relative flex h-16 w-[104px] items-center rounded-full border border-border-subtle bg-surface p-1.5" />
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <motion.button
        onClick={handleToggle}
        className="relative flex h-16 w-[104px] items-center rounded-full p-1.5 transition-all duration-300 focus:outline-none"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at top left, #1a1a1d 0%, #101012 45%, #0a0a0b 100%)"
            : "radial-gradient(ellipse at top left, #ffffff 0%, #fafafa 45%, #ececec 100%)",
          boxShadow: isDark
            ? `
              inset 5px 5px 12px rgba(0, 0, 0, 0.85),
              inset -5px -5px 12px rgba(255, 255, 255, 0.05),
              inset 0 2px 4px rgba(0, 0, 0, 0.9),
              inset 0 0 20px rgba(0, 0, 0, 0.5),
              0 2px 4px rgba(0, 0, 0, 0.4),
              0 8px 16px rgba(0, 0, 0, 0.35),
              0 16px 32px rgba(0, 0, 0, 0.25)
            `
            : `
              inset 5px 5px 12px rgba(10, 10, 11, 0.1),
              inset -5px -5px 12px rgba(255, 255, 255, 0.9),
              inset 0 2px 4px rgba(10, 10, 11, 0.08),
              inset 0 0 20px rgba(10, 10, 11, 0.06),
              0 2px 4px rgba(0, 0, 0, 0.08),
              0 8px 16px rgba(0, 0, 0, 0.06),
              0 16px 32px rgba(0, 0, 0, 0.04)
            `,
          border: isDark ? "2px solid var(--border-strong)" : "2px solid var(--border-strong)",
        }}
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        role="switch"
        aria-checked={isDark}
        whileTap={{ scale: 0.98 }}
      >
        {/* Inner groove */}
        <div
          className="pointer-events-none absolute inset-[3px] rounded-full"
          style={{
            boxShadow: isDark
              ? "inset 0 2px 6px rgba(0, 0, 0, 0.8), inset 0 -1px 3px rgba(255, 255, 255, 0.04)"
              : "inset 0 2px 6px rgba(10, 10, 11, 0.12), inset 0 -1px 3px rgba(255, 255, 255, 0.9)",
          }}
        />

        {/* Glossy overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: isDark
              ? "radial-gradient(ellipse at top, rgba(255, 255, 255, 0.06) 0%, transparent 50%), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 0%, transparent 30%, transparent 70%, rgba(0, 0, 0, 0.3) 100%)"
              : "radial-gradient(ellipse at top, rgba(255, 255, 255, 0.8) 0%, transparent 50%), linear-gradient(to bottom, rgba(255, 255, 255, 0.7) 0%, transparent 30%, transparent 70%, rgba(10, 10, 11, 0.06) 100%)",
            mixBlendMode: "overlay",
          }}
        />

        {/* Background icons */}
        <div className="absolute inset-0 flex items-center justify-between px-4">
          <Sun size={18} className={isDark ? "text-foreground/40" : "text-[#e8a94a]"} />
          <Moon size={18} className={isDark ? "text-foreground/70" : "text-foreground/40"} />
        </div>

        {/* Thumb */}
        <motion.div
          className="relative z-10 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full"
          style={{
            background: isDark
              ? "linear-gradient(145deg, #2a2a2e 0%, #1a1a1d 50%, #0f0f11 100%)"
              : "linear-gradient(145deg, #ffffff 0%, #fdfdfd 50%, #f4f4f5 100%)",
            boxShadow: isDark
              ? `
                inset 2px 2px 4px rgba(255, 255, 255, 0.06),
                inset -2px -2px 4px rgba(0, 0, 0, 0.8),
                0 8px 32px rgba(0, 0, 0, 0.5),
                0 4px 12px rgba(0, 0, 0, 0.4)
              `
              : `
                inset 2px 2px 4px rgba(10, 10, 11, 0.06),
                inset -2px -2px 4px rgba(255, 255, 255, 1),
                0 8px 32px rgba(0, 0, 0, 0.16),
                0 4px 12px rgba(0, 0, 0, 0.1)
              `,
            border: isDark ? "2px solid var(--border-subtle)" : "2px solid rgba(255, 255, 255, 0.9)",
          }}
          animate={{ x: isDark ? 46 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.3) 0%, transparent 40%, rgba(0, 0, 0, 0.08) 100%)",
              mixBlendMode: "overlay",
            }}
          />

          {isAnimating &&
            particles.map((particle) => (
              <div key={particle.id} className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="absolute h-2.5 w-2.5 rounded-full"
                  style={{
                    background: isDark
                      ? "radial-gradient(circle, rgba(99,170,255,0.55) 0%, rgba(99,170,255,0) 70%)"
                      : "radial-gradient(circle, rgba(255,214,99,0.7) 0%, rgba(255,214,99,0) 70%)",
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: isDark ? 6 : 8, opacity: [0, 1, 0] }}
                  transition={{ duration: isDark ? 0.5 : particle.duration, delay: particle.delay, ease: "easeOut" }}
                />
              </div>
            ))}

          <div className="relative z-10">
            {isDark ? (
              <Moon size={18} className="fill-foreground text-foreground" />
            ) : (
              <Sun size={18} className="fill-[#e8a94a] text-[#e8a94a]" />
            )}
          </div>
        </motion.div>
      </motion.button>
    </div>
  );
}
