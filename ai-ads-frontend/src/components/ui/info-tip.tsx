"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

// Small (i) that shows a short explanation on hover, focus, or tap. Rendered in a portal with fixed
// positioning so a parent's overflow can't clip it. `side` picks where the bubble opens.
export function InfoTip({
  text,
  label,
  side = "right",
  className = "",
}: {
  text: string;
  label: string;
  side?: "right" | "top";
  className?: string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const show = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setPos(side === "top" ? { top: rect.top - 8, left: rect.left + rect.width / 2 } : { top: rect.top + rect.height / 2, left: rect.right + 8 });
  };
  return (
    <>
      <button
        type="button"
        aria-label={`About ${label}`}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={() => setPos(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setPos(null)}
        onClick={(e) => (pos ? setPos(null) : show(e.currentTarget))}
        className={`h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground ${className || "flex"}`}
      >
        <Info size={13} />
      </button>
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className={`pointer-events-none fixed z-50 w-60 rounded-xl border border-border-strong bg-surface px-3 py-2 text-xs text-foreground shadow-lg ${
              side === "top" ? "-translate-x-1/2 -translate-y-full" : "-translate-y-1/2"
            }`}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}
