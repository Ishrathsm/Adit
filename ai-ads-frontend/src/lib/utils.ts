import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// clsx joins conditional classes; twMerge resolves Tailwind conflicts so a later class wins
// (e.g. a component's default `text-lg` overridden by a caller's `text-9xl`) — the standard
// shadcn `cn`, which components copied from shadcn rely on.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
