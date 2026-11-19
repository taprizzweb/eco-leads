import { Check, Lock } from "lucide-react";
import { loadClient } from "@/lib/dash";
import { UpgradeButton } from "@/components/dash/UpgradeButton";

const ROWS: { key: string; label: string; show: (v: unknown) => string | boolean }[] = [
  { key: "review", label: "Review flow with guest-written drafts", show: (v) => !!v },
  { key: "photo_limit", label: "Gallery photos", show: (v) => `${v ?? 0} photos` },
  { key: "complaints", label: "Complaint and suggestion inbox with voice notes", show: (v) => !!v },
  { key: "offers_card", label: "Check offers card", show: (v) => !!v },
  { key: "whatsapp_capture", label: "WhatsApp contact capture", show: (v) => !!v },
  { key: "review_replies", label: "Google review replies", show: (v) => ({ copy: "Copy a suggested reply", approve: "Approve and post", auto_4_5: "Auto for 4 and 5 stars", managed: "Handled by our team" } as Record<string, string>)[String(v)] ?? false },
  { key: "events", label: "Events and membership", show: (v) => !!v },
  { key: "creators", label: "Creators corner", show: (v) => !!v },
  { key: "report", label: "Monthly report", show: (v) => ({ basic: "Basic", full: "Full", full_call: "Full, plus a call" } as Record<string, string>)[String(v)] ?? false },
];

export default async function PlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client, features } = await loadClient(slug);
  const { data: packages } = await sb.from("packages").select("id, name, price_inr, sort").order("sort");
  const current = packages?.find((p) => p.id === client.package_id);
  const higher = (packages ?? []).filter((p) => p.sort > (current?.sort ?? 0));
  const expires = client.expires_at ? new Date(client.expires_at) : null;
  const daysLeft = expires ? Math.ceil((expires.getTime() - Date.now()) / 864e5) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Plan</h1>

      <section className="d-card p-5" style={{ background: "radial-gradient(108% 60% at 86.8% 6.3%, color-mix(in srgb, var(--d-top) 80%, var(--d-surface)) 0%, var(--d-surface) 100%)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm" style={{ color: "var(--d-muted)" }}>Current plan</p>
            <p className="mt-1 text-[28px] font-semibold tracking-[-0.04em]" style={{ color: "var(--d-text)" }}>{current?.name ?? client.package_id}</p>
            {current && <p className="text-sm" style={{ color: "var(--d-muted)" }}>Rs {current.price_inr.toLocaleString("en-IN")} a month</p>}
          </div>
          <div className="text-right">
            <span className="d-chip" style={{ ["--c" as string]: client.status === "active" ? "var(--d-green)" : "var(--d-red)" }}>{client.status === "active" ? "Active" : "Paused"}</span>
            {expires && (
              <p className="mt-2 text-sm" style={{ color: daysLeft !== null && daysLeft <= 7 ? "var(--d-red)" : "var(--d-muted)" }}>
                {daysLeft !== null && daysLeft < 0 ? "Expired on " : "Renews on "}
                {expires.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
        </div>
        {client.status === "paused" && (
          <p className="mt-4 text-sm" style={{ color: "var(--d-sub)" }}>Your plates still open your Google review link while the page is paused, so guests never hit a dead end.</p>
        )}
      </section>

      <section className="d-card p-5">
        <h2 className="font-semibold">What your plan includes</h2>
        <ul className="mt-3 divide-y" style={{ borderColor: "var(--d-line)" }}>
          {ROWS.map((r) => {
            const v = r.show(features[r.key]);
            const on = v !== false;
            return (
              <li key={r.key} className="flex items-center gap-3 py-3" style={{ borderColor: "var(--d-line)" }}>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ background: on ? "color-mix(in srgb, var(--d-green) 18%, transparent)" : "var(--d-bg)", color: on ? "var(--d-green)" : "var(--d-muted)" }}>
                  {on ? <Check size={13} /> : <Lock size={12} />}
                </span>
                <span className="flex-1" style={{ color: on ? "var(--d-text)" : "var(--d-muted)" }}>{r.label}</span>
                {typeof v === "string" && <span className="text-sm" style={{ color: "var(--d-muted)" }}>{v}</span>}
                {!on && <span className="text-xs" style={{ color: "var(--d-muted)" }}>Locked</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {higher.length > 0 && (
        <section className="d-card p-5">
          <h2 className="font-semibold">Want more?</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>Tell us which plan you want and the Taprizz team will switch it on for you.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {higher.map((p) => (
              <div key={p.id} className="d-raise flex flex-col gap-3 p-4">
                <div>
                  <p className="font-semibold" style={{ color: "var(--d-text)" }}>{p.name}</p>
                  <p className="text-sm" style={{ color: "var(--d-muted)" }}>Rs {p.price_inr.toLocaleString("en-IN")} a month</p>
                </div>
                <UpgradeButton clientId={client.id} pkg={p.id} name={p.name} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
