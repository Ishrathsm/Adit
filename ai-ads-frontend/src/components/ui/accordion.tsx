"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

// FAQ-style collapsible row for optional form sections: a header that slides its content open on
// click. Starts closed unless `defaultOpen` (e.g. the section already has something filled in).
export function Accordion({
  title,
  hint,
  badge,
  defaultOpen = false,
  className = "",
  children,
}: {
  title: string;
  hint?: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <div className={`border-t border-border-subtle pt-4 ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="text-sm font-medium">{title}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
        {badge}
        <ChevronDown size={16} className={`ml-auto shrink-0 text-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {/* grid-rows 0fr → 1fr animates to the content's natural height without measuring it. */}
      <div
        id={contentId}
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className={`overflow-hidden ${open ? "" : "invisible"}`}>
          <div className="flex flex-col gap-3 pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
