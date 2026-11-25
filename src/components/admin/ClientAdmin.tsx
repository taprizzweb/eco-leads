"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Copy, QrCode, Trash2, ExternalLink, TriangleAlert } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { FEATURE_DEFS, PLATE_BASE, diffOverrides, effective, newPlateCode, type FeatureMap } from "@/lib/features";
import { useToast } from "@/components/dash/Toast";
import { OWNER_BUTTONS } from "@/lib/roles";
import { Pill, fmtDate } from "./ui";
import { downloadQr } from "./qr";

type Client = { id: string; slug: string; name: string; package_id: string; status: "active" | "paused"; expires_at: string | null; feature_overrides: FeatureMap; hidden_sections?: string[] };
type Pkg = { id: string; name: string; price_inr: number; features: FeatureMap };
type Plate = { code: string; label: string | null; active: boolean; menu_url?: string | null; redirect_url?: string | null };
type Member = { user_id: string; email: string; role: string };
type Invite = { id: string; email: string; created_at: string };
type Audit = { id: number; action: string; created_at: string };

const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const AUDIT_TEXT: Record<string, string> = {
  "client.plan_changed": "Plan, switches, status or expiry changed", "clients.insert": "Client created", "plates.insert": "Plate added",
  "plates.update": "Plate changed", "plates.delete": "Plate removed", "client_members.insert": "Person given access", "client_members.delete": "Person's access removed",
  "invites.insert": "Owner invited", "upgrade.requested": "Owner asked for an upgrade",
};

// Module level on purpose: defined inside the component it would remount on every keystroke and inputs inside would lose focus.
function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="d-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {sub && <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Two steps before a business is deleted: open the panel, then type the exact name and tick the box.
function DeleteBusiness({ id, name, onDeleted }: { id: string; name: string; onDeleted: () => void }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const match = typed.trim() === name.trim();

  async function remove() {
    if (!match || !sure) return;
    setBusy(true);
    const { error } = await sb.from("clients").delete().eq("id", id);
    setBusy(false);
    if (error) return toast("The business was not deleted. Only the Taprizz owner can do this.", true);
    toast(`${name} was deleted`);
    onDeleted();
  }

  return (
    <section className="d-card p-5" style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--d-red) 45%, transparent)" }}>
      <h2 className="flex items-center gap-2 font-semibold" style={{ color: "var(--d-red)" }}><TriangleAlert size={17} /> Delete this business</h2>
      {!open ? (
        <>
          <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>Removes the business and everything that belongs to it. To stop it for a while without losing anything, use <b>Pause client</b> above instead.</p>
          <button className="d-btn d-btn-s mt-4" onClick={() => setOpen(true)}>Delete this business...</button>
        </>
      ) : (
        <div className="mt-3 space-y-4">
          <div className="text-sm" style={{ color: "var(--d-sub)" }}>
            <p className="font-medium" style={{ color: "var(--d-text)" }}>This cannot be undone. These are deleted for good:</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              <li>its plates (printed QR codes stop working) and the guest page</li>
              <li>customers, feedback, complaints, review drafts and pasted reviews</li>
              <li>offers, events, gallery photos, moments and WhatsApp offer requests</li>
              <li>access for its owners and staff</li>
            </ul>
            <p className="mt-1.5">Its Mini Link, if it has one, stays online as a link-only page.</p>
          </div>
          <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Type <b>{name}</b> to confirm</span>
            <input className="d-input mt-1.5" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-label="Type the business name to confirm" placeholder={name} /></label>
          <label className="flex min-h-10 items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={sure} onChange={(e) => setSure(e.target.checked)} />I understand this deletes everything above and cannot be undone.</label>
          <div className="flex flex-wrap gap-2">
            <button className="d-btn !text-white" style={{ background: "var(--d-red)", opacity: match && sure ? 1 : 0.4 }} disabled={!match || !sure || busy} onClick={remove}>{busy && <Loader2 size={15} className="animate-spin" />} Delete forever</button>
            <button className="d-btn d-btn-s" onClick={() => { setOpen(false); setTyped(""); setSure(false); }}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

export function ClientAdmin({ client, packages, plates: p0, members: m0, invites: i0, audit, role }: { client: Client; packages: Pkg[]; plates: Plate[]; members: Member[]; invites: Invite[]; audit: Audit[]; role: "owner" | "manager" | "rep" }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [c, setC] = useState(client);
  const [plates, setPlates] = useState(p0);
  const [members, setMembers] = useState(m0);
  const [invites, setInvites] = useState(i0);
  const [date, setDate] = useState(client.expires_at ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const canManage = role !== "rep";
  const pkg = packages.find((p) => p.id === c.package_id) ?? packages[0];
  const eff = effective(pkg.features, c.feature_overrides ?? {});

  async function patch(label: string, update: Partial<Client>, done: string) {
    setBusy(label);
    const { error } = await sb.from("clients").update(update).eq("id", c.id);
    setBusy(null);
    if (error) return toast("That change did not save. Please try again.", true);
    setC((s) => ({ ...s, ...update }));
    if ("expires_at" in update && update.expires_at) setDate(update.expires_at);
    toast(done);
    router.refresh();
  }

  const renew = (days: number) => {
    const base = c.expires_at && c.expires_at > todayIso() ? c.expires_at : todayIso();
    return patch("renew", { expires_at: addDays(base, days), status: "active" }, `Renewed to ${fmtDate(addDays(base, days))}`);
  };

  function setFeature(key: string, value: unknown) {
    const wanted = { ...eff, [key]: value };
    return patch("f-" + key, { feature_overrides: diffOverrides(pkg.features, wanted) }, "Switch saved");
  }

  async function addPlate() {
    setBusy("plate");
    for (let t = 0; t < 5; t++) {
      const code = newPlateCode();
      const label = `Table ${plates.length + 1}`;
      const { error } = await sb.from("plates").insert({ code, client_id: c.id, label });
      if (!error) { setPlates((s) => [...s, { code, label, active: true }]); toast("Plate added"); setBusy(null); return; }
      if (!/duplicate|unique/i.test(error.message)) break;
    }
    setBusy(null);
    toast("The plate was not added. Only managers can add plates.", true);
  }

  async function togglePlate(code: string, active: boolean) {
    const { error } = await sb.from("plates").update({ active }).eq("code", code);
    if (error) return toast("The plate change did not save.", true);
    setPlates((s) => s.map((p) => (p.code === code ? { ...p, active } : p)));
    toast(active ? "Plate switched on" : "Plate switched off");
  }

  const [redirectTo, setRedirectTo] = useState("");
  async function saveTableLink(code: string, url: string) {
    const u = url.trim();
    if (u && !/^https:\/\/\S+$/.test(u)) return toast("The link must start with https://", true);
    const { error } = await sb.rpc("set_plate_menu", { p_code: code, p_url: u });
    if (error) return toast("The table link did not save.", true);
    setPlates((s) => s.map((p) => (p.code === code ? { ...p, menu_url: u || null } : p)));
    toast(u ? "Table link saved" : "Table link removed");
  }
  async function redirectPlates(url: string | null) {
    const u = (url ?? "").trim();
    if (url !== null && !/^https:\/\/\S+$/.test(u)) return toast("Paste a link that starts with https://", true);
    if (url !== null && !confirm(`Send every plate of ${c.name} to this link? Guests who scan any printed plate will land there until you remove it.`)) return;
    setBusy("redirect");
    const { error } = await sb.from("plates").update({ redirect_url: url === null ? null : u }).eq("client_id", c.id);
    setBusy(null);
    if (error) return toast("The redirect did not save. Only managers can do this.", true);
    setPlates((s) => s.map((p) => ({ ...p, redirect_url: url === null ? null : u })));
    toast(url === null ? "Redirect removed. Plates show the guest page again." : "All plates now open that link");
  }

  async function invite() {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return toast("That email looks incomplete.", true);
    setBusy("invite");
    const { data, error } = await sb.from("invites").insert({ email: e, kind: "client", client_id: c.id, member_role: "owner" }).select("id, email, created_at").single();
    setBusy(null);
    if (error || !data) return toast("The invite did not save. Only managers can invite.", true);
    setInvites((s) => [data, ...s]);
    setEmail("");
    toast(`${e} will get access when they sign in`);
  }

  async function removeMember(id: string) {
    const { error } = await sb.from("client_members").delete().eq("client_id", c.id).eq("user_id", id);
    if (error) return toast("Access was not removed.", true);
    setMembers((s) => s.filter((m) => m.user_id !== id));
    toast("Access removed");
  }

  async function removeInvite(id: string) {
    const { error } = await sb.from("invites").delete().eq("id", id);
    if (error) return toast("The invite was not removed.", true);
    setInvites((s) => s.filter((i) => i.id !== id));
    toast("Invite removed");
  }

  const link = (code: string) => `${PLATE_BASE}/e/${code}`;
  const days = c.expires_at ? Math.ceil((new Date(c.expires_at + "T23:59:59+05:30").getTime() - Date.now()) / 864e5) : null;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <Card title="Plan and status">
          <div className="flex flex-wrap items-center gap-3">
            {c.status === "active" ? <Pill tone="green">Active</Pill> : <Pill tone="red">Paused</Pill>}
            <span className="text-sm" style={{ color: "var(--d-sub)" }}>
              {c.expires_at ? `${days !== null && days < 0 ? "Expired" : "Renews"} ${fmtDate(c.expires_at)}` : "No expiry date"}
            </span>
          </div>
          {c.status === "paused" && <p className="mt-3 text-sm" style={{ color: "var(--d-sub)" }}>Paused: their plates still open the Google review link, so nobody holds a dead plate.</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium" style={{ color: "var(--d-text)" }}>Package</span>
              <select className="d-input mt-1.5" value={c.package_id} disabled={busy === "pkg"} onChange={(e) => patch("pkg", { package_id: e.target.value }, "Package changed")}>
                {packages.map((p) => <option key={p.id} value={p.id}>{p.name} · Rs {p.price_inr.toLocaleString("en-IN")}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium" style={{ color: "var(--d-text)" }}>Plan ends on</span>
              <span className="mt-1.5 flex gap-2">
                <input type="date" className="d-input" value={date} onChange={(e) => setDate(e.target.value)} />
                <button className="d-btn d-btn-s" disabled={!date || date === c.expires_at || busy === "renew"} onClick={() => patch("renew", { expires_at: date }, "Date saved")}>Save</button>
              </span>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="d-btn d-btn-p" disabled={busy === "renew"} onClick={() => renew(30)}>{busy === "renew" && <Loader2 size={16} className="animate-spin" />} Renew 30 days</button>
            <button className="d-btn d-btn-s" disabled={busy === "renew"} onClick={() => renew(365)}>Renew 1 year</button>
            {c.status === "active" ? (
              <button className="d-btn d-btn-s" disabled={busy === "status"} onClick={() => patch("status", { status: "paused" }, "Paused. Plates now show the Google link.")}>Pause client</button>
            ) : (
              <button className="d-btn d-btn-s" disabled={busy === "status"} onClick={() => patch("status", { status: "active" }, "Client is live again")}>Resume client</button>
            )}
          </div>
        </Card>

        <Card title="Plates" sub="Each plate has its own link. The code never changes once printed.">
          {plates.length === 0 && <p className="text-sm" style={{ color: "var(--d-muted)" }}>No plates yet. Add one, then download its QR code.</p>}
          <ul className="space-y-2">
            {plates.map((p) => (
              <li key={p.code} className="d-raise flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium" style={{ color: "var(--d-text)" }}>{p.label ?? "Plate"} {!p.active && <Pill tone="gray">Off</Pill>}</p>
                  <p className="truncate text-xs" style={{ color: "var(--d-muted)" }}>{link(p.code)}</p>
                </div>
                <button className="d-btn d-btn-s !min-h-10 !px-3" aria-label={`Copy link for ${p.label ?? p.code}`} onClick={() => navigator.clipboard.writeText(link(p.code)).then(() => toast("Link copied")).catch(() => toast("Could not copy. Select it instead.", true))}><Copy size={15} /></button>
                <button className="d-btn d-btn-s !min-h-10 !px-3" aria-label={`Download QR for ${p.label ?? p.code}`} onClick={() => downloadQr(p.code, `${c.slug}-${p.label ?? p.code}`).then(() => toast("QR downloaded"))}><QrCode size={15} /></button>
                <a className="d-btn d-btn-s !min-h-10 !px-3" aria-label="Open the guest page" href={`/e/${p.code}`} target="_blank" rel="noopener"><ExternalLink size={15} /></a>
                {canManage && <button className="d-btn d-btn-s !min-h-10 !px-3 !text-[13px]" onClick={() => togglePlate(p.code, !p.active)}>{p.active ? "Switch off" : "Switch on"}</button>}
                {eff.table_ordering === true && (
                  <label className="block w-full text-xs" style={{ color: "var(--d-muted)" }}>Ordering link for {p.label ?? "this table"} (opens from View menu)
                    <input key={p.menu_url ?? ""} className="d-input mt-1 !min-h-10 !text-[13px]" inputMode="url" placeholder="https://" defaultValue={p.menu_url ?? ""} onBlur={(e) => { if ((e.target.value.trim() || null) !== (p.menu_url ?? null)) void saveTableLink(p.code, e.target.value); }} />
                  </label>
                )}
                {p.redirect_url && <p className="w-full truncate text-xs" style={{ color: "var(--d-amber)" }}>Redirected to {p.redirect_url}</p>}
              </li>
            ))}
          </ul>
          {canManage ? (
            <button className="d-btn d-btn-s mt-3" disabled={busy === "plate"} onClick={addPlate}>{busy === "plate" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add plate</button>
          ) : (
            <p className="mt-3 text-xs" style={{ color: "var(--d-muted)" }}>Only managers can create plates.</p>
          )}
          {canManage && plates.length > 0 && (
            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--d-line)" }}>
              <p className="text-sm font-medium" style={{ color: "var(--d-text)" }}>Send all plates somewhere else</p>
              <p className="mt-1 text-xs" style={{ color: "var(--d-muted)" }}>For when a client stops paying or closes: every printed plate opens your link instead, so nobody scans a dead code.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input aria-label="Link to send all plates to" className="d-input min-w-0 flex-1" inputMode="url" placeholder="https://taprizz.in" value={redirectTo} onChange={(e) => setRedirectTo(e.target.value)} />
                <button className="d-btn d-btn-s" disabled={busy === "redirect" || !redirectTo.trim()} onClick={() => redirectPlates(redirectTo)}>Redirect all plates</button>
                {plates.some((p) => p.redirect_url) && <button className="d-btn d-btn-s" disabled={busy === "redirect"} onClick={() => redirectPlates(null)}>Remove redirect</button>}
              </div>
            </div>
          )}
        </Card>

        <Card title="Who has access" sub="Owners and staff of this business.">
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.user_id} className="d-raise flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1 truncate" style={{ color: "var(--d-text)" }}>{m.email}</span><Pill tone="gray">{m.role}</Pill>
                {canManage && <button className="grid h-10 w-10 place-items-center" aria-label={`Remove ${m.email}`} style={{ color: "var(--d-muted)" }} onClick={() => removeMember(m.user_id)}><Trash2 size={16} /></button>}
              </li>
            ))}
            {invites.map((i) => (
              <li key={i.id} className="d-raise flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1 truncate" style={{ color: "var(--d-text)" }}>{i.email}</span><Pill tone="amber">Invited</Pill>
                {canManage && <button className="grid h-10 w-10 place-items-center" aria-label={`Cancel invite for ${i.email}`} style={{ color: "var(--d-muted)" }} onClick={() => removeInvite(i.id)}><Trash2 size={16} /></button>}
              </li>
            ))}
            {members.length + invites.length === 0 && <li className="text-sm" style={{ color: "var(--d-muted)" }}>Nobody yet. Invite the owner by email.</li>}
          </ul>
          {canManage && (
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); invite(); }}>
              <label className="sr-only" htmlFor="inv">Owner email</label>
              <input id="inv" type="email" className="d-input" placeholder="owner@cafe.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="d-btn d-btn-s" disabled={busy === "invite"}>Invite</button>
            </form>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Package switches" sub={`Starts from ${pkg.name}. Changing a switch here grants or removes one feature for this client only.`}>
          <ul className="divide-y" style={{ borderColor: "var(--d-line)" }}>
            {FEATURE_DEFS.map((d) => {
              const custom = Object.prototype.hasOwnProperty.call(c.feature_overrides ?? {}, d.key);
              const v = eff[d.key];
              return (
                <li key={d.key} className="flex min-h-12 items-center gap-3 py-2" style={{ borderColor: "var(--d-line)" }}>
                  <span className="min-w-0 flex-1">
                    <span style={{ color: "var(--d-text)" }}>{d.label}</span>
                    {d.hint && <span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>{d.hint}</span>}
                    {custom && <span className="ml-2"><Pill tone="blue">custom</Pill></span>}
                  </span>
                  {d.type === "bool" && (
                    <button role="switch" aria-checked={!!v} aria-label={d.label} disabled={busy === "f-" + d.key} onClick={() => setFeature(d.key, !v)} className="relative h-7 w-12 shrink-0 rounded-full transition-colors" style={{ background: v ? "var(--d-green)" : "var(--d-line-2)" }}>
                      <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: v ? 22 : 2 }} />
                    </button>
                  )}
                  {d.type === "number" && (
                    <input type="number" aria-label={d.label} className="d-input !w-24 !min-h-10 text-center" min={d.min} max={d.max} defaultValue={Number(v ?? 0)} onBlur={(e) => { const n = Math.max(d.min, Math.min(d.max, parseInt(e.target.value) || 0)); if (n !== Number(v)) setFeature(d.key, n); }} />
                  )}
                  {d.type === "enum" && (
                    <select aria-label={d.label} className="d-input !w-52 !min-h-10" value={String(v ?? "")} onChange={(e) => setFeature(d.key, e.target.value)}>
                      {d.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
          {Object.keys(c.feature_overrides ?? {}).length > 0 && (
            <button className="d-btn d-btn-s mt-3" onClick={() => patch("reset", { feature_overrides: {} }, "Back to the package preset")}>Reset to {pkg.name} preset</button>
          )}
        </Card>

        <Card title="Mini link only (lock the rest)" sub="For brands that only try the mini link and AI Review by Tap. The owner sees every button, but only Mini link opens; the others show a lock and a short note. Switch off to open everything again.">
          <button role="switch" aria-checked={(c.hidden_sections ?? []).includes("mini_only")} aria-label="Mini link only" disabled={busy === "h-mini_only"} onClick={() => { const on = (c.hidden_sections ?? []).includes("mini_only"); patch("h-mini_only", { hidden_sections: on ? (c.hidden_sections ?? []).filter((x) => x !== "mini_only") : [...(c.hidden_sections ?? []), "mini_only"] }, on ? "Everything is open again" : "Only Mini link is open"); }} className="relative h-7 w-12 shrink-0 rounded-full transition-colors" style={{ background: (c.hidden_sections ?? []).includes("mini_only") ? "var(--d-green)" : "var(--d-line-2)" }}>
            <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: (c.hidden_sections ?? []).includes("mini_only") ? 22 : 2 }} />
          </button>
        </Card>

        <Card title="Owner dashboard buttons" sub="Which buttons this business's owner and managers see. A button that is switched off disappears and its page cannot be opened. Home always shows. Floor staff and the Taprizz team are not affected.">
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {OWNER_BUTTONS.map((b) => {
              const shown = !(c.hidden_sections ?? []).includes(b.key);
              const flip = () => patch("h-" + b.key, { hidden_sections: shown ? [...(c.hidden_sections ?? []), b.key] : (c.hidden_sections ?? []).filter((x) => x !== b.key) }, shown ? `${b.label} hidden` : `${b.label} shown`);
              return (
                <li key={b.key} className="flex min-h-12 items-center gap-3 py-2">
                  <span className="min-w-0 flex-1"><span style={{ color: "var(--d-text)" }}>{b.label}</span><span className="block text-xs" style={{ color: "var(--d-muted)" }}>{b.help}</span></span>
                  <button role="switch" aria-checked={shown} aria-label={`${b.label} button`} disabled={busy === "h-" + b.key} onClick={flip} className="relative h-7 w-12 shrink-0 rounded-full transition-colors" style={{ background: shown ? "var(--d-green)" : "var(--d-line-2)" }}>
                    <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: shown ? 22 : 2 }} />
                  </button>
                </li>
              );
            })}
          </ul>
          {(c.hidden_sections ?? []).length > 0 && (
            <button className="d-btn d-btn-s mt-3" onClick={() => patch("h-all", { hidden_sections: [] }, "All buttons shown")}>Show all buttons</button>
          )}
        </Card>

        <Card title="Recent changes">
          {audit.length === 0 ? <p className="text-sm" style={{ color: "var(--d-muted)" }}>Nothing recorded yet.</p> : (
            <ul className="space-y-2 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex justify-between gap-3"><span style={{ color: "var(--d-text)" }}>{AUDIT_TEXT[a.action] ?? a.action}</span><span style={{ color: "var(--d-muted)" }}>{new Date(a.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span></li>
              ))}
            </ul>
          )}
        </Card>
        {role === "owner" && <DeleteBusiness id={c.id} name={c.name} onDeleted={() => { router.push("/admin/clients"); router.refresh(); }} />}
        <p className="text-xs" style={{ color: "var(--d-muted)" }}><Link href={`/dashboard/${c.slug}`} className="underline underline-offset-4">Open their dashboard as the client</Link></p>
      </div>
    </div>
  );
}
