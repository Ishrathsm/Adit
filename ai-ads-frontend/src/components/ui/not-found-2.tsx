import Link from "next/link";
import { CompassIcon, HomeIcon } from "lucide-react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

// Adapted from a shadcn block: its buttons used shadcn's <Button asChild> (Radix Slot + shadcn
// color tokens), but this app has its own Button (components/ui/button.tsx, primary/ghost) used
// across the product — so the links are Next <Link>s styled to match those two variants instead
// of replacing the app's Button. Links point at real pages rather than "#".
const primaryClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-button-bg px-6 text-sm font-medium text-button-fg transition-opacity hover:opacity-90";
const outlineClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border-strong px-6 text-sm font-medium text-foreground transition-colors hover:bg-white/5";

export function NotFound() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      <Empty>
        <EmptyHeader>
          <EmptyTitle className="mask-b-from-20% mask-b-to-80% text-9xl font-extrabold">404</EmptyTitle>
          <EmptyDescription className="-mt-8 text-nowrap text-foreground/80">
            The page you&apos;re looking for might have been <br />
            moved or doesn&apos;t exist.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            <Link href="/" className={primaryClass}>
              <HomeIcon className="size-4" data-icon="inline-start" />
              Go Home
            </Link>
            <Link href="/projects" className={outlineClass}>
              <CompassIcon className="size-4" data-icon="inline-start" />
              Explore
            </Link>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
