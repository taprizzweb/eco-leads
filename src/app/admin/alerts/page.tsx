import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { loadAlerts } from "@/lib/admin-data";
import { PageHead, Pill } from "@/components/admin/ui";

export default async function AlertsPage() {
  const alerts = await loadAlerts();
  return (
    <>
      <PageHead title="Alerts" sub="Renewals, late complaints, idle plates and upgrade requests." />
      {alerts.length === 0 ? (
        <div className="d-card flex flex-col items-center px-6 py-14 text-center">
          <CheckCircle2 style={{ color: "var(--d-green)" }} />
          <p className="mt-3 font-medium" style={{ color: "var(--d-text)" }}>All clear</p>
          <p className="mt-1 max-w-md text-sm" style={{ color: "var(--d-muted)" }}>Nothing is overdue. Alerts appear here when a plan is about to end, a complaint waits more than a day, or a client asks to upgrade.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.id} className="d-card flex flex-wrap items-center gap-3 p-4">
              <Pill tone={a.level}>{a.level === "red" ? "Urgent" : a.level === "amber" ? "Soon" : "Info"}</Pill>
              <div className="min-w-0 flex-1">
                <p style={{ color: "var(--d-text)" }}>{a.title}</p>
                <p className="text-sm" style={{ color: "var(--d-muted)" }}>{a.detail}</p>
              </div>
              {a.slug && <Link href={`/admin/clients/${a.slug}`} className="d-btn d-btn-s !min-h-10">Open client</Link>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
