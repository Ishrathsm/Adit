import { requireAdminPage } from "@/lib/admin-guard";
import { AdminConsole } from "./admin-console";

export const metadata = { title: "Admin console - Adit" };

export default async function AdminPage() {
  await requireAdminPage();
  return <AdminConsole />;
}
