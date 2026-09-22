import { Sidebar } from "@/components/sidebar";

// Wraps every authenticated app page (projects, project detail, storyboard, account) — the
// parenthesized folder name is a Next.js route group, so it doesn't affect any URL. Kept
// separate from the root layout so the sidebar never shows on the marketing page, login,
// terms/privacy, or onboarding.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
