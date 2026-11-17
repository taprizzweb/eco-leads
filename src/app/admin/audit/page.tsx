import { notFound } from "next/navigation";
import { requireTeam, atLeast } from "@/lib/admin";
import { loadOverview } from "@/lib/admin-data";
import { Empty, PageHead, Pill, Row, TableWrap, td, th } from "@/components/admin/ui";

const TEXT: Record<string, string> = {
  "client.plan_changed": "Plan, switches, status or expiry changed", "clients.insert": "Client created", "clients.delete": "Client deleted",
  "plates.insert": "Plate added", "plates.update": "Plate changed", "plates.delete": "Plate removed",
  "client_members.insert": "Person given access", "client_members.delete": "Access removed", "invites.insert": "Invite sent",
  "team_members.insert": "Team member added", "team_members.update": "Team role changed", "team_members.delete": "Team member removed",
  "packages.update": "Package edited", "upgrade.requested": "Upgrade requested",
};

// Who changed which switch and when, kept for disputes and security checks. Managers and owners only.
export default async function AuditPage() {
  const { role, user } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const { sb, clients } = await loadOverview();
  const [{ data: rows }, { data: team }] = await Promise.all([
    sb.from("audit_log").select("id, actor, client_id, action, detail, created_at").order("created_at", { ascending: false }).limit(150),
    sb.rpc("admin_team_list"),
  ]);
  const who = new Map(((team ?? []) as { user_id: string; email: string }[]).map((t) => [t.user_id, t.email]));
  const cname = new Map(clients.map((c) => [c.id, c.name]));
  const note = (a: { action: string; detail: Record<string, unknown> | null }) => {
    const d = a.detail ?? {};
    if (a.action === "client.plan_changed") {
      const bits: string[] = [];
      const pk = d.package as string[] | undefined; if (pk && pk[0] !== pk[1]) bits.push(`package ${pk[0]} to ${pk[1]}`);
      const st = d.status as string[] | undefined; if (st && st[0] !== st[1]) bits.push(`status ${st[0]} to ${st[1]}`);
      const ex = d.expires_at as string[] | undefined; if (ex && ex[0] !== ex[1]) bits.push(`ends ${ex[1] ?? "never"}`);
      const ov = d.overrides as unknown[] | undefined; if (ov && JSON.stringify(ov[0]) !== JSON.stringify(ov[1])) bits.push("switches changed");
      return bits.join(", ");
    }
    if (a.action.startsWith("plates.")) return `/e/${String(d.code ?? "")}${d.label ? ` (${String(d.label)})` : ""}`;
    if (a.action === "invites.insert") return String(d.email ?? "");
    if (a.action === "upgrade.requested") return String(d.package ?? "");
    if (a.action === "packages.update") return String(d.name ?? "");
    return "";
  };
  return (
    <>
      <PageHead title="Audit log" sub="Who changed what, and when. The latest 150 entries." />
      {!rows?.length ? <Empty title="Nothing recorded yet">Plan changes, plate changes, invites and team changes are listed here.</Empty> : (
        <TableWrap>
          <thead><tr style={{ color: "var(--d-muted)" }}><th className={th}>When</th><th className={th}>Who</th><th className={th}>What</th><th className={th}>Client</th><th className={th}>Detail</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <Row key={a.id}>
                <td className={`${td} whitespace-nowrap`}>{new Date(a.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                <td className={td}>{a.actor ? (a.actor === user.id ? <Pill tone="blue">You</Pill> : who.get(a.actor) ?? <Pill tone="gray">Client user</Pill>) : <Pill tone="gray">System</Pill>}</td>
                <td className={td} style={{ color: "var(--d-text)" }}>{TEXT[a.action] ?? a.action}</td>
                <td className={td}>{a.client_id ? cname.get(a.client_id) ?? "Deleted client" : ""}</td>
                <td className={td} style={{ color: "var(--d-muted)" }}>{note(a as { action: string; detail: Record<string, unknown> | null })}</td>
              </Row>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
