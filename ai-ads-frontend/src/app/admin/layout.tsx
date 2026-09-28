import { AdminHeader } from "./admin-header";

// The admin console is its own shell, outside the product: no app sidebar or create flows, just
// the console and a way back. Same /admin URL as before. Access is checked in the page (see
// lib/admin-guard.ts), not here — layouts don't re-run on navigation.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      {children}
    </div>
  );
}
