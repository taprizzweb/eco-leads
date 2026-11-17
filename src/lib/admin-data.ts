import { cache } from "react";
import { requireTeam } from "@/lib/admin";

export type AdminClient = {
  id: string; slug: string; name: string; business_type: string | null; package_id: string;
  status: "active" | "paused"; expires_at: string | null; created_at: string;
  feature_overrides: Record<string, unknown>;
};
export type Stats = {
  client_id: string; taps_30d: number; taps_month: number; last_tap_at: string | null;
  reviews_month: number; open_complaints: number; late_complaints: number; plates: number;
};
export type Pkg = { id: string; name: string; price_inr: number; sort: number; features: Record<string, unknown> };
export type Alert = { id: string; kind: string; level: "red" | "amber" | "blue"; title: string; detail: string; slug?: string };

const daysFrom = (iso: string | null) => (iso ? Math.ceil((new Date(iso + "T23:59:59+05:30").getTime() - Date.now()) / 864e5) : null);
export { daysFrom };

export const loadOverview = cache(async () => {
  const { sb, role } = await requireTeam();
  const [clients, stats, packages] = await Promise.all([
    sb.from("clients").select("id, slug, name, business_type, package_id, status, expires_at, created_at, feature_overrides").order("name"),
    sb.rpc("admin_client_stats"),
    sb.from("packages").select("id, name, price_inr, sort, features").order("sort"),
  ]);
  const list = (clients.data ?? []) as AdminClient[];
  const st = new Map(((stats.data ?? []) as Stats[]).map((s) => [s.client_id, s]));
  const pk = new Map(((packages.data ?? []) as Pkg[]).map((p) => [p.id, p]));
  return { sb, role, clients: list, stats: st, packages: (packages.data ?? []) as Pkg[], pk };
});

export const loadAlerts = cache(async (): Promise<Alert[]> => {
  const { sb, clients, stats } = await loadOverview();
  const out: Alert[] = [];
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const { data: ups } = await sb.from("audit_log").select("id, client_id, detail, created_at").eq("action", "upgrade.requested").gte("created_at", since).order("created_at", { ascending: false });
  const byId = new Map(clients.map((c) => [c.id, c]));
  for (const c of clients) {
    const d = daysFrom(c.expires_at);
    const s = stats.get(c.id);
    if (c.status === "active" && d !== null && d < 0) out.push({ id: `exp-${c.id}`, kind: "expired", level: "red", slug: c.slug, title: `${c.name}: plan expired ${-d} day${-d === 1 ? "" : "s"} ago`, detail: "The page only shows the Google review link until you renew." });
    else if (c.status === "active" && d !== null && d <= 5) out.push({ id: `ren-${c.id}`, kind: "renewal", level: "amber", slug: c.slug, title: `${c.name}: renewal due in ${d} day${d === 1 ? "" : "s"}`, detail: `Renews on ${new Date(c.expires_at!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.` });
    if (s && s.late_complaints > 0) out.push({ id: `late-${c.id}`, kind: "complaint", level: "red", slug: c.slug, title: `${c.name}: ${s.late_complaints} complaint${s.late_complaints === 1 ? "" : "s"} unresolved over 24 hours`, detail: "Ask the owner to reply, or open it as the client." });
    const old = Date.now() - new Date(c.created_at).getTime() > 30 * 864e5;
    if (c.status === "active" && old && s && s.taps_30d === 0) out.push({ id: `idle-${c.id}`, kind: "inactive", level: "amber", slug: c.slug, title: `${c.name}: no taps for 30 days`, detail: "Check that the plates are still in place." });
  }
  for (const u of ups ?? []) {
    const c = u.client_id ? byId.get(u.client_id) : undefined;
    out.push({ id: `up-${u.id}`, kind: "upgrade", level: "blue", slug: c?.slug, title: `${c?.name ?? "A client"} asked for ${String((u.detail as { package?: string })?.package ?? "an upgrade")}`, detail: `Requested ${new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}. Call them, then switch the plan on the client page.` });
  }
  const order = { red: 0, amber: 1, blue: 2 } as const;
  return out.sort((a, b) => order[a.level] - order[b.level]);
});
