"use client";

import { Plus, Trash2 } from "lucide-react";
import { PhoneField } from "@/components/ui/PhoneField";
import type { LinkButton, LinkSocials } from "@/lib/linkpage";
import { MINI_SOCIALS, isCustomBtn, isMenuBtn, isOffersBtn, isOutletsBtn } from "@/lib/mini";

function Sec({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <section className="d-card space-y-4 p-5"><div><h2 className="font-semibold">{title}</h2>{sub && <p className="mt-0.5 text-sm" style={{ color: "var(--d-muted)" }}>{sub}</p>}</div>{children}</section>;
}

/** Preset link rows for the self-serve mini link: nothing to choose, just type where each one goes. */
export function MiniLinks({ socials, setSocials, buttons, setButtons, hasOutlets, hasOffers, canOffers, maxExtra }: {
  socials: LinkSocials; setSocials: (s: LinkSocials) => void; buttons: LinkButton[]; setButtons: (b: LinkButton[]) => void; hasOutlets: boolean; hasOffers: boolean; canOffers: boolean; maxExtra: number;
}) {
  const menu = buttons.find(isMenuBtn), outlets = buttons.find(isOutletsBtn), offers = buttons.find(isOffersBtn), custom = buttons.filter(isCustomBtn);
  const compose = (m: LinkButton | undefined, o: LinkButton | undefined, f: LinkButton | undefined, c: LinkButton[]) => setButtons([m, o, f, ...c].filter(Boolean) as LinkButton[]);
  return (
    <>
      <Sec title="Your links" sub="Fill the ones you have and leave the rest empty. They show as round icons under your name. There is nothing to choose, just type where each one goes.">
        <div className="space-y-3">
          {MINI_SOCIALS.map((p) => (
            <div key={p.key} className="grid items-center gap-2 sm:grid-cols-[150px_1fr]">
              <span className="text-sm font-medium" style={{ color: "var(--d-text)" }}>{p.label}</span>
              {p.kind === "phone"
                ? <PhoneField label={p.label} value={socials[p.key] ?? ""} onChange={(v) => setSocials({ ...socials, [p.key]: v })} />
                : <input aria-label={p.label} className="d-input !min-h-10" inputMode="url" maxLength={300} value={socials[p.key] ?? ""} onChange={(e) => setSocials({ ...socials, [p.key]: e.target.value })} placeholder={p.ph} />}
            </div>
          ))}
        </div>
      </Sec>

      <Sec title="Big buttons" sub="These show as large buttons on your page.">
        <div className="grid items-center gap-2 sm:grid-cols-[150px_1fr]">
          <span className="text-sm font-medium" style={{ color: "var(--d-text)" }}>Menu</span>
          <input aria-label="Menu link" className="d-input !min-h-10" inputMode="url" maxLength={500} value={menu?.url ?? ""} placeholder="Paste your menu link (Google Drive, website or PDF)"
            onChange={(e) => { const url = e.target.value; compose(url || menu ? { label: menu?.label || "Menu", url, icon: "menu" } : undefined, outlets, offers, custom); }} />
        </div>
        <label className="flex min-h-10 items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={!!outlets} onChange={(e) => compose(menu, e.target.checked ? { label: "Our outlets", url: "#outlets", icon: "outlets" } : undefined, offers, custom)} />
          <span><span className="font-medium" style={{ color: "var(--d-text)" }}>Outlets</span><br /><span className="text-xs" style={{ color: "var(--d-muted)" }}>Guests see every outlet of yours in one list, with directions and call buttons.{!hasOutlets ? " Add your outlets in the Outlets section below." : ""}</span></span></label>
{canOffers ? (        <label className="flex min-h-10 items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={!!offers} onChange={(e) => compose(menu, outlets, e.target.checked ? { label: "Offers", url: "#offers", icon: "gift" } : undefined, custom)} />
          <span><span className="font-medium" style={{ color: "var(--d-text)" }}>Offers</span><br /><span className="text-xs" style={{ color: "var(--d-muted)" }}>Opens your current offers.{!hasOffers ? " Add them in the Offers section below." : ""}</span></span></label>) : (<p className="text-sm" style={{ color: "var(--d-muted)" }}>🔒 <b style={{ color: "var(--d-text)" }}>Offers</b> button: Premium.</p>)}
      </Sec>

      <Sec title="Add another link" sub={maxExtra > 1 ? `Anything else, like Order online or Book a table. Up to ${maxExtra}.` : "One more link of your own, like Order online or Book a table. Premium gives you 6."}>
        <div className="space-y-2">
          {custom.map((b, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label={`Button ${i + 1} name`} className="d-input !min-h-10 !w-40" maxLength={40} value={b.label} placeholder="Button name, like Order online" onChange={(e) => compose(menu, outlets, offers, custom.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
              <input aria-label={`Button ${i + 1} link`} className="d-input !min-h-10" inputMode="url" maxLength={500} value={b.url} placeholder="Paste the link" onChange={(e) => compose(menu, outlets, offers, custom.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} />
              <button type="button" className="grid h-10 w-10 shrink-0 place-items-center" aria-label={`Remove button ${i + 1}`} onClick={() => compose(menu, outlets, offers, custom.filter((_, k) => k !== i))} style={{ color: "var(--d-muted)" }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <button type="button" className="d-btn d-btn-s" disabled={custom.length >= maxExtra} onClick={() => compose(menu, outlets, offers, [...custom, { label: "", url: "", icon: "link" }])}><Plus size={15} /> Add a link</button>
      </Sec>
    </>
  );
}
