"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Search } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/dash/Toast";
import { Pill } from "./ui";

type Cl = { id: string; name: string; slug: string; review_setup: Record<string, unknown> | null };
type Acct = { sender: "taprizz" | "own"; display_name: string; waba_id: string; phone_number_id: string; setup_status: "not_started" | "in_progress" | "ready"; notes: string };
const EMPTY: Acct = { sender: "taprizz", display_name: "", waba_id: "", phone_number_id: "", setup_status: "not_started", notes: "" };
type Contact = { name: string; phone: string; whatsapp_consent: boolean; last_seen_at: string; created_at: string };

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;
export function downloadCsv(filename: string, rows: string[][]) {
  const body = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function WhatsappAdmin({ clients, api, retentionDays }: { clients: Cl[]; api: { token: boolean; phone: boolean }; retentionDays: number }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(clients.map((c) => [c.id, c.review_setup?.collect_contact === true])));
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [acct, setAcct] = useState<Acct>(EMPTY);
  const [savingAcct, setSavingAcct] = useState(false);
  const list = useMemo(() => clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())), [clients, q]);
  const cur = clients.find((c) => c.id === sel);

  useEffect(() => {
    if (!sel) return;
    sb.from("wa_accounts").select("sender, display_name, waba_id, phone_number_id, setup_status, notes").eq("client_id", sel).maybeSingle()
      .then(({ data }) => setAcct(data ? { ...EMPTY, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ""])) } as Acct : EMPTY));
    setContacts(null);
    sb.from("contacts").select("name, phone, whatsapp_consent, last_seen_at, created_at").eq("client_id", sel).order("last_seen_at", { ascending: false }).limit(2000)
      .then(({ data }) => setContacts((data ?? []) as Contact[]));
  }, [sel, sb]);

  async function toggle(c: Cl, v: boolean) {
    setBusy(true);
    const next = { ...(c.review_setup ?? {}), collect_contact: v };
    const { error } = await sb.from("clients").update({ review_setup: next }).eq("id", c.id);
    setBusy(false);
    if (error) return toast("That did not save. Please try again.", true);
    c.review_setup = next;
    setOn((s) => ({ ...s, [c.id]: v }));
    toast(v ? `WhatsApp offers are ON for ${c.name}. Guests will see the name and number form once.` : `WhatsApp offers are OFF for ${c.name}. Guests go straight in.`);
    router.refresh();
  }

  async function saveAcct(c: Cl) {
    setSavingAcct(true);
    const row = { client_id: c.id, sender: acct.sender, display_name: acct.display_name.trim() || null, waba_id: acct.waba_id.trim() || null, phone_number_id: acct.phone_number_id.trim() || null, setup_status: acct.sender === "own" ? acct.setup_status : "not_started", notes: acct.notes.trim() || null, updated_at: new Date().toISOString() };
    if (acct.sender === "own" && acct.setup_status === "ready" && (!row.waba_id || !row.phone_number_id)) { setSavingAcct(false); return toast("Add the WhatsApp Business Account ID and Phone number ID before marking it ready.", true); }
    const { error } = await sb.from("wa_accounts").upsert(row);
    setSavingAcct(false);
    toast(error ? "That did not save. Please try again." : "Sender saved", !!error);
  }

  const consented = contacts?.filter((c) => c.whatsapp_consent).length ?? 0;
  const apiReady = api.token && api.phone;

  return (
    <div className="space-y-4">
      <section className="d-card p-5">
        <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">WhatsApp API</h2>{apiReady ? <Pill tone="green">Keys found</Pill> : <Pill tone="amber">Not connected</Pill>}</div>
        <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>
          {apiReady
            ? "The keys are set. Sending through the API is not switched on yet: approved offers are exported as a numbers file for now."
            : "Messages are not sent from here yet. Once your WhatsApp Business API is ready, its keys go into Vercel as WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID. Until then, approved offers give you a numbers file (CSV) to send from your own tool."}
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--d-muted)" }}>Customer numbers are deleted automatically {retentionDays} days after the customer was last seen.</p>
      </section>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" style={{ color: "var(--d-muted)" }} aria-hidden />
        <input type="search" aria-label="Search businesses" className="d-input !pl-10" placeholder="Search a business by name" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <button key={c.id} type="button" aria-pressed={sel === c.id} onClick={() => setSel(c.id)} className="d-card flex items-center justify-between gap-3 p-3 text-left" style={sel === c.id ? { boxShadow: "inset 0 0 0 2px var(--d-text)" } : undefined}>
            <span className="truncate text-sm font-medium" style={{ color: "var(--d-text)" }}>{c.name}</span>
            {on[c.id] ? <Pill tone="green">WhatsApp ON</Pill> : <Pill tone="gray">Off</Pill>}
          </button>
        ))}
        {list.length === 0 && <p className="text-sm" style={{ color: "var(--d-muted)" }}>No business matches &ldquo;{q}&rdquo;.</p>}
      </div>

      {cur && (
        <section className="d-card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">{cur.name}</h2>
            <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!!on[cur.id]} disabled={busy} onChange={(e) => toggle(cur, e.target.checked)} />WhatsApp offers {busy && <Loader2 size={14} className="animate-spin" />}</label>
          </div>
          {!on[cur.id] && <p className="text-sm" style={{ color: "var(--d-muted)" }}>This business does not ask guests for a name and number, and the owner cannot request offers. Switch it on to start collecting.</p>}
          <div className="space-y-3 rounded-2xl p-4" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--d-text)" }}>Which WhatsApp number sends the offers</h3>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sender">
              {([["taprizz", "Taprizz number (default)"], ["own", "This business's own number"]] as const).map(([v, l]) => (
                <button key={v} role="radio" aria-checked={acct.sender === v} type="button" onClick={() => setAcct({ ...acct, sender: v })} className="d-btn !min-h-10 !px-4 !text-[13px]" style={acct.sender === v ? { background: "var(--d-text)", color: "var(--d-bg)" } : { background: "var(--d-surface)", color: "var(--d-sub)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>{l}</button>
              ))}
            </div>
            {acct.sender === "taprizz" ? (
              <p className="text-sm" style={{ color: "var(--d-muted)" }}>Messages go out from your Taprizz (Meta) WhatsApp Business number, in the name of Taprizz.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm" style={{ color: "var(--d-muted)" }}>Messages go out from the business&apos;s own WhatsApp Business API number and in its own name. Offers are blocked until the status below is <b>Ready</b>.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Display name</span><input className="d-input mt-1.5" maxLength={60} value={acct.display_name} onChange={(e) => setAcct({ ...acct, display_name: e.target.value })} placeholder="Shown to customers" /></label>
                  <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Setup status</span>
                    <select className="d-input mt-1.5" value={acct.setup_status} onChange={(e) => setAcct({ ...acct, setup_status: e.target.value as Acct["setup_status"] })}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="ready">Ready</option></select></label>
                  <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>WhatsApp Business Account ID</span><input className="d-input mt-1.5" maxLength={40} inputMode="numeric" value={acct.waba_id} onChange={(e) => setAcct({ ...acct, waba_id: e.target.value })} /></label>
                  <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Phone number ID</span><input className="d-input mt-1.5" maxLength={40} inputMode="numeric" value={acct.phone_number_id} onChange={(e) => setAcct({ ...acct, phone_number_id: e.target.value })} /></label>
                </div>
                <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Notes</span><textarea className="d-input mt-1.5" rows={2} maxLength={500} value={acct.notes} onChange={(e) => setAcct({ ...acct, notes: e.target.value })} placeholder="Where the setup is stuck, who is helping, dates" /></label>
                <details className="text-sm" style={{ color: "var(--d-sub)" }}>
                  <summary className="cursor-pointer font-medium" style={{ color: "var(--d-text)" }}>Setup checklist for the business</summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li>Meta Business account for the business, with business verification done.</li>
                    <li>A WhatsApp Business Account (WABA) created inside it.</li>
                    <li>A phone number that is not already on WhatsApp, registered to the WABA.</li>
                    <li>Display name submitted and approved by Meta.</li>
                    <li>Message templates (marketing / utility) submitted and approved.</li>
                    <li>A permanent access token from a system user, shared with the Taprizz team through Vercel, never by chat.</li>
                  </ol>
                </details>
              </div>
            )}
            <button className="d-btn d-btn-p" disabled={savingAcct} onClick={() => saveAcct(cur)}>{savingAcct && <Loader2 size={15} className="animate-spin" />} Save sender</button>
          </div>

          {contacts === null ? <div className="grid h-20 place-items-center"><Loader2 className="animate-spin" /></div> : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Pill tone="blue">{contacts.length} customers</Pill><Pill tone="green">{consented} said yes to WhatsApp offers</Pill>
                <button className="d-btn d-btn-s ml-auto" disabled={contacts.length === 0} onClick={() => downloadCsv(`${cur.slug}-customers.csv`, [["Name", "Phone", "WhatsApp offers", "Last seen"], ...contacts.map((c) => [c.name, c.phone, c.whatsapp_consent ? "yes" : "no", c.last_seen_at.slice(0, 10)])])}><Download size={15} /> Download all (CSV)</button>
              </div>
              {contacts.length === 0 ? <p className="text-sm" style={{ color: "var(--d-muted)" }}>No customers yet.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead><tr style={{ color: "var(--d-muted)" }}><th className="py-2 pr-4 font-medium">Name</th><th className="py-2 pr-4 font-medium">Phone</th><th className="py-2 pr-4 font-medium">WhatsApp offers</th><th className="py-2 font-medium">Last seen</th></tr></thead>
                    <tbody>{contacts.slice(0, 200).map((c, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--d-line)", color: "var(--d-text)" }}><td className="py-2 pr-4">{c.name}</td><td className="py-2 pr-4 tabular-nums">{c.phone}</td><td className="py-2 pr-4">{c.whatsapp_consent ? "Yes" : "No"}</td><td className="py-2">{c.last_seen_at.slice(0, 10)}</td></tr>
                    ))}</tbody>
                  </table>
                  {contacts.length > 200 && <p className="mt-2 text-xs" style={{ color: "var(--d-muted)" }}>Showing the latest 200. The CSV has all {contacts.length}.</p>}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
