"use client";

import { motion, useReducedMotion } from "motion/react";
import { Building2, Check, User } from "lucide-react";
import { fadeUpTransition, fadeUpVariants, fadeUpViewport } from "@/lib/motion-variants";

// Grounded in the real onboarding/account model (src/app/onboarding), not invented
// pricing tiers — Adit has no plans, seats, or billing gating. The only structural
// difference between the two account types is how brand kits are scoped: Individual
// gets one shared brand kit; Organisation gets one brand kit per "product," and picks
// or creates a product before generating (see src/app/onboarding/organisation).
const ROWS: { label: string; individual: boolean | string; organisation: boolean | string }[] = [
  { label: "Poster ads", individual: true, organisation: true },
  { label: "Video ads", individual: true, organisation: true },
  { label: "Storyboards (shot by shot)", individual: true, organisation: true },
  { label: "Prompt refinement", individual: true, organisation: true },
  { label: "Brand kits", individual: "One, shared", organisation: "One per product" },
  { label: "Products", individual: "N/A", organisation: "Unlimited" },
  { label: "Setup", individual: "Start right away", organisation: "Brand questionnaire per product" },
];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border-strong">
        <Check size={11} strokeWidth={3} />
      </span>
    ) : (
      <span className="text-muted">N/A</span>
    );
  }
  return <span className="text-sm text-muted">{value}</span>;
}

export function AccountComparison() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={fadeUpViewport}
      variants={fadeUpVariants}
      transition={fadeUpTransition}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2 text-center">
        <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">Individual or organisation</p>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">One account type, either way.</h2>
        <p className="mx-auto max-w-md text-sm text-muted">
          Every generation feature is the same. The only difference is how brand kits are scoped.
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="rgb-border mx-auto min-w-[480px] max-w-xl overflow-hidden">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="p-4 font-normal text-muted"></th>
                <th className="p-4 font-medium">
                  <div className="flex items-center gap-1.5">
                    <User size={14} />
                    Individual
                  </div>
                </th>
                <th className="p-4 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Building2 size={14} />
                    Organisation
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-border-subtle last:border-0">
                  <td className="p-4 text-muted">{row.label}</td>
                  <td className="p-4">
                    <Cell value={row.individual} />
                  </td>
                  <td className="p-4">
                    <Cell value={row.organisation} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.section>
  );
}
