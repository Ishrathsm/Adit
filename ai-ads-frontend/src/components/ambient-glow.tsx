"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

interface Blob {
  color: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  size: number;
  opacity: number;
  delay: string;
}

interface GlowVariant {
  label: string;
  blobs: Blob[];
  blur: number;
}

const VARIANTS: GlowVariant[] = [
  {
    label: "Scattered",
    blur: 110,
    blobs: [
      { color: "255,99,99", top: "-8%", left: "8%", size: 550, opacity: 0.4, delay: "0s" },
      { color: "99,170,255", top: "-5%", right: "5%", size: 600, opacity: 0.4, delay: "-9s" },
      { color: "198,99,255", top: "38%", left: "-8%", size: 500, opacity: 0.35, delay: "-18s" },
      { color: "255,214,99", bottom: "-10%", right: "12%", size: 500, opacity: 0.35, delay: "-23s" },
    ],
  },
  {
    label: "Bold pop",
    blur: 90,
    blobs: [
      { color: "99,170,255", top: "-12%", left: "-5%", size: 700, opacity: 0.55, delay: "0s" },
      { color: "255,99,99", bottom: "-15%", right: "-5%", size: 700, opacity: 0.55, delay: "-14s" },
      { color: "198,99,255", top: "30%", right: "20%", size: 450, opacity: 0.4, delay: "-7s" },
    ],
  },
  {
    label: "Deep space",
    blur: 130,
    blobs: [
      { color: "99,255,173", top: "-10%", left: "20%", size: 380, opacity: 0.6, delay: "0s" },
      { color: "198,99,255", bottom: "-8%", left: "-6%", size: 420, opacity: 0.55, delay: "-11s" },
      { color: "255,214,99", top: "10%", right: "-6%", size: 380, opacity: 0.5, delay: "-20s" },
      { color: "255,99,99", bottom: "5%", right: "22%", size: 320, opacity: 0.45, delay: "-27s" },
    ],
  },
];

const ROTATE_INTERVAL_MS = 9000;
const FADE_MS = 3000;

function VariantLayer({ variant, active }: { variant: GlowVariant; active: boolean }) {
  return (
    <div
      className="absolute inset-0 transition-opacity ease-in-out"
      style={{ opacity: active ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
    >
      {variant.blobs.map((blob, i) => (
        <div
          key={`${variant.label}-${i}`}
          className="ambient-glow mix-blend-screen absolute rounded-full dark:opacity-100"
          style={{
            top: blob.top,
            bottom: blob.bottom,
            left: blob.left,
            right: blob.right,
            height: blob.size,
            width: blob.size,
            opacity: blob.opacity * 0.65,
            filter: `blur(${variant.blur}px)`,
            background: `radial-gradient(closest-side, rgba(${blob.color},0.85), transparent 70%)`,
            animationDelay: blob.delay,
          }}
        />
      ))}
    </div>
  );
}

export function AmbientGlow() {
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % VARIANTS.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      {/* Cross-fading slideshow of 3 blob layouts, not one static gradient — keeps the
          ambient glow feeling alive without any single variant overstaying. */}
      {VARIANTS.map((variant, i) => (
        <VariantLayer key={variant.label} variant={variant} active={reduceMotion ? i === 0 : i === activeIndex} />
      ))}
      <div className="ambient-glow-grain absolute inset-0" />
    </div>
  );
}
