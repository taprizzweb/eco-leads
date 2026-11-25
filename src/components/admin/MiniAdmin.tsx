/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, Loader2, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/dash/Toast";
import { linkUrl } from "@/lib/features";
import { Pill, Empty, fmtDate } from "./ui";
import { downloadCsv } from "./WhatsappAdmin";

type Pay = { id: string; status: "pending" | "approved" | "rejected"; utr: string; amount_inr: number; proof_path: string; note: string | null; created_at: string; slug: string; name: string; phone: string | null; email: string | null };
type Pg = { id: string; slug: string; name: string; published: boolean; paid_at: string | null; created_at: string; edit_token: string; phone: string; email: string | null; marketing_consent: boolean; reports: number };
type Rep = { id: string; reason: string; created_at: string; slug: string; name: string; published: boolean };
export type MiniOverview = { payments: Pay[]; pages: Pg[]; reports: Rep[]; settings: Record<string, string> };

function Proof({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { void supabaseBrowser().storage.from("pay-proofs").createSignedUrl(path, 600).then(({ data }) => setUrl(data?.signedUrl ?? null)); }, [path]);
  if (!url) return <div className="grid h-40 w-28 place-items-center rounded-lg text-xs" style={{ background: "var(--d-bg)", color: "var(--d-muted)" }}>Loading</div>;
  return (<a href={url} target="_blank" rel="noopener"><img src={url} alt="Payment screenshot" className="h-40 w-auto max-w-[220px] rounded-lg object-contain" style={{ background: "var(--d-bg)" }} /></a>);
}

export function MiniAdmin({ data }: { data: MiniOverview }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"pay" | "pages" | "reports" | "settings">("pay");
  const [busy, setBusy] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({ price_inr: data.settings.price_inr ?? "150", upi_id: data.settings.upi_id ?? "", upi_name: data.settings.upi_name ?? "Taprizz", whatsapp: data.settings.whatsapp ?? "919672999166" });
  const pending = data.payments.filter((p) => p.status === "pending");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function review(p: Pay, approve: boolean) {
    let note: string | null = null;
    if (!approve) { note = window.prompt("Why? The person will see this (optional)", "We could not find this payment in our bank. Please check the transaction ID."); if (note === null) return; }
    else if (!confirm(`Unlock Premium for ${p.name}? Make sure Rs ${p.amount_inr} with UTR ${p.utr} is in your bank.`)) return;
    setBusy(p.id);
    const { error } = await sb.rpc("mini_admin_review", { p_id: p.id, p_approve: approve, p_note: note });
    setBusy(null);
    if (error) return toast("That did not save. Please try again.", true);
    toast(approve ? "Premium unlocked." : "Rejected");
    router.refresh();
  }
  async function toggle(pg: Pg) {
    setBusy(pg.id);
    const { error } = await sb.rpc("mini_admin_set_published", { p_link: pg.id, p_pub: !pg.published });
    setBusy(null);
    if (error) return toast("That did not save.", true);
    toast(pg.published ? "Page switched off" : "Page switched on");
    router.refresh();
  }
  async function saveSetting(k: string) {
    setBusy(k);
    const { error } = await sb.rpc("mini_admin_set_setting", { p_key: k, p_value: vals[k] });
    setBusy(null);
    toast(error ? "That did not save. Check the value." : "Saved", !!error);
  }
  const copy = (t: string, m: string) => navigator.clipboard.writeText(t).then(() => toast(m), () => toast("Could not copy.", true));
  const tabs: [typeof tab, string][] = [["pay", `Payments${pending.length ? ` (${pending.length})` : ""}`], ["pages", `Pages (${data.pages.length})`], ["reports", `Reports (${data.reports.length})`], ["settings", "Settings"]];

  return (
    <div className="space-y-4">
      <div className="d-seg w-fit" role="group" aria-label="Section">{tabs.map(([k, l]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === "pay" && (data.payments.length === 0 ? <Empty title="No payments yet">When someone pays, it shows here with the screenshot.</Empty> : (
        <ul className="space-y-3">
          {data.payments.map((p) => (
            <li key={p.id} className="d-card flex flex-wrap items-start gap-4 p-4">
              <Proof path={p.proof_path} />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className="flex items-center gap-2 font-semibold">{p.name} <Pill tone={p.status === "pending" ? "amber" : p.status === "approved" ? "green" : "red"}>{p.status}</Pill></p>
                <p style={{ color: "var(--d-muted)" }}>{linkUrl(p.slug)}</p>
                <p>Rs {p.amount_inr} · UTR <b className="select-all">{p.utr}</b></p>
                <p style={{ color: "var(--d-muted)" }}>{p.phone ? `+91 ${p.phone}` : ""}{p.email ? ` · ${p.email}` : ""} · {fmtDate(p.created_at)}</p>
                {p.note && <p style={{ color: "var(--d-muted)" }}>Note: {p.note}</p>}
              </div>
              {p.status === "pending" && (
                <div className="flex gap-2">
                  <button className="d-btn d-btn-p" disabled={busy === p.id} onClick={() => void review(p, true)}>{busy === p.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Approve</button>
                  <button className="d-btn d-btn-s" disabled={busy === p.id} onClick={() => void review(p, false)}><X size={15} /> Reject</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ))}

      {tab === "pages" && (
        <>
          <div className="flex flex-wrap gap-2">
            <button className="d-btn d-btn-s" disabled={!data.pages.length} onClick={() => downloadCsv("mini-link-contacts.csv", [["Name", "Page", "Phone", "Email", "OK to message", "Premium", "Joined"], ...data.pages.map((g) => [g.name, g.slug, g.phone, g.email ?? "", g.marketing_consent ? "yes" : "no", g.paid_at ? "yes" : "no", g.created_at.slice(0, 10)])])}><Download size={15} /> All contacts (CSV)</button>
            <button className="d-btn d-btn-s" disabled={!data.pages.some((g) => g.marketing_consent)} onClick={() => downloadCsv("mini-link-ok-to-message.csv", [["Name", "Page", "Phone", "Email"], ...data.pages.filter((g) => g.marketing_consent).map((g) => [g.name, g.slug, g.phone, g.email ?? ""])])}><Download size={15} /> Only who agreed to messages</button>
          </div>
          {data.pages.length === 0 ? <Empty title="No pages yet">Pages people build show here.</Empty> : (
            <ul className="space-y-2">
              {data.pages.map((g) => (
                <li key={g.id} className="d-card flex flex-wrap items-center gap-3 p-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">{g.name} <Pill tone={g.paid_at ? "green" : "gray"}>{g.paid_at ? "Premium" : "Free"}</Pill>{!g.published && <Pill tone="red">switched off</Pill>}{g.reports > 0 && <Pill tone="red">{g.reports} reports</Pill>}{g.marketing_consent && <Pill tone="blue">OK to message</Pill>}</p>
                    <p style={{ color: "var(--d-muted)" }}>{linkUrl(g.slug)} · +91 {g.phone}{g.email ? ` · ${g.email}` : ""} · {fmtDate(g.created_at)}</p>
                  </div>
                  <button className="d-btn d-btn-s" onClick={() => void copy(`${origin}/edit/${g.edit_token}`, "Control link copied. Send it to the owner if they lost it.")}><Copy size={15} /> Control link</button>
                  <button className="d-btn d-btn-s" disabled={busy === g.id} onClick={() => void toggle(g)}>{g.published ? "Switch off" : "Switch on"}</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "reports" && (data.reports.length === 0 ? <Empty title="No reports">Nothing has been reported.</Empty> : (
        <ul className="space-y-2">
          {data.reports.map((r) => (
            <li key={r.id} className="d-card flex flex-wrap items-center gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1"><p className="font-semibold">{r.name} <span style={{ color: "var(--d-muted)" }} className="font-normal">· {r.reason}</span></p><p style={{ color: "var(--d-muted)" }}>{linkUrl(r.slug)} · {fmtDate(r.created_at)}</p></div>
              <a className="d-btn d-btn-s" href={linkUrl(r.slug)} target="_blank" rel="noopener">Open</a>
            </li>
          ))}
        </ul>
      ))}

      {tab === "settings" && (
        <div className="d-card grid max-w-xl gap-4 p-5">
          {([["price_inr", "Price (Rs)", "150"], ["upi_id", "UPI ID that receives the money", "name@bank"], ["upi_name", "Name shown in the UPI app", "Taprizz"], ["whatsapp", "WhatsApp number for help (with 91)", "919672999166"]] as const).map(([k, l, ph]) => (
            <label key={k} className="block text-sm"><span className="font-medium">{l}</span>
              <span className="mt-1.5 flex gap-2"><input className="d-input" value={vals[k]} placeholder={ph} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} /><button type="button" className="d-btn d-btn-s shrink-0" disabled={busy === k} onClick={() => void saveSetting(k)}>Save</button></span></label>
          ))}
          <p className="text-xs" style={{ color: "var(--d-muted)" }}>A new price applies to payments from now on. Use a UPI ID you can check in your bank app every day.</p>
        </div>
      )}
    </div>
  );
}
