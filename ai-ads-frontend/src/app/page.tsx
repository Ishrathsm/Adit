"use client";

import { Building2, User } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

type AccountType = "individual" | "organisation";

const OPTIONS: {
  id: AccountType;
  icon: typeof User;
  title: string;
  description: string;
}[] = [
  {
    id: "individual",
    icon: User,
    title: "Individual",
    description: "One brand kit, straight into your Projects. Best if it's just you.",
  },
  {
    id: "organisation",
    icon: Building2,
    title: "Organisation",
    description:
      "Multiple products, each with its own brand kit. Starts with a quick brand questionnaire per product.",
  },
];

export default function OnboardingPage() {
  const [selected, setSelected] = useState<AccountType | null>(null);

  return (
    <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center overflow-hidden"
      >
        <div
          className="h-[420px] w-[720px] opacity-15 blur-[110px] dark:opacity-30"
          style={{
            background:
              "radial-gradient(closest-side, rgba(99,140,255,0.55), rgba(198,99,255,0.35) 45%, rgba(255,99,170,0.2) 70%, transparent 80%)",
          }}
        />
      </div>

      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-10 py-16">
        <div className="flex flex-col gap-3 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">
            Welcome
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            How will you be creating ads?
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted">
            This decides how your account is set up. You can't switch it later without
            starting a new account.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selected === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelected(option.id)}
                className={clsx(
                  "rgb-border cursor-pointer p-6 text-left transition-transform duration-150",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                  isSelected ? "scale-[1.01]" : "hover:scale-[1.005]",
                )}
              >
                <div
                  className={clsx(
                    "mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                    isSelected
                      ? "border-transparent bg-button-bg text-button-fg"
                      : "border-border-strong text-foreground",
                  )}
                >
                  <Icon size={18} />
                </div>
                <h2 className="mb-1.5 text-base font-medium">{option.title}</h2>
                <p className="text-sm leading-relaxed text-muted">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Button disabled={!selected}>Continue</Button>
        </div>
      </div>
    </main>
  );
}
