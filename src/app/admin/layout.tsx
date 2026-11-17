import { requireTeam } from "@/lib/admin";
import { loadAlerts } from "@/lib/admin-data";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Taprizz Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireTeam();
  const alerts = await loadAlerts();
  return (
    <AdminShell role={role} email={user.email ?? ""} alerts={alerts.filter((a) => a.level !== "blue").length}>
      {children}
    </AdminShell>
  );
}
