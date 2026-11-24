"use client";

import { useState } from "react";
import { Copy, KeyRound, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/dash/Toast";

// The private control link for a mini link: whoever holds it can edit the page and see its numbers, with no login.
export function LinkControl({ linkId, initialToken, initialEnabled }: { linkId: string; initialToken: string | null; initialEnabled: boolean }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [token, setToken] = useState(initialToken);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const url = token && typeof window !== "undefined" ? `${window.location.origin}/edit/${token}` : "";

  async function act(action: "create" | "reset" | "disable" | "enable") {
    if (action === "reset" && !confirm("Make a new control link? The old one stops working at once.")) return;
    setBusy(true);
    const { data, error } = await sb.rpc("link_token_set", { p_id: linkId, p_action: action });
    setBusy(false);
    if (error) return toast("That did not work. Please try again.", true);
    setToken((data as string | null) ?? null);
    setEnabled(action !== "disable");
    toast(action === "disable" ? "Control link switched off" : action === "enable" ? "Control link switched on" : "New control link made");
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); toast("Link copied"); }
    catch { toast("Could not copy. Select the link and copy it.", true); }
  }

  return (
    <section className="d-card space-y-3 p-5">
      <div className="flex items-center gap-2"><KeyRound size={17} /><h2 className="font-semibold">Control link</h2></div>
      <p className="text-sm" style={{ color: "var(--d-muted)" }}>Give this to a customer who only has a mini link. They open it on any phone, with no login, to edit the page and see which buttons get tapped. Anyone with the link can change the page, so send it only to them.</p>
      {token ? (
        <>
          <input readOnly aria-label="Control link" className="d-input !min-h-10 font-mono text-xs" value={url} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap items-center gap-2">
            <button className="d-btn d-btn-p" onClick={copy} disabled={!enabled}><Copy size={15} /> Copy link</button>
            <button className="d-btn d-btn-s" disabled={busy} onClick={() => act(enabled ? "disable" : "enable")}>{enabled ? "Switch off" : "Switch on"}</button>
            <button className="d-btn d-btn-s" disabled={busy} onClick={() => act("reset")}>Make a new link</button>
            {busy && <Loader2 size={16} className="animate-spin" />}
            <span className="text-sm" style={{ color: enabled ? "var(--d-green)" : "var(--d-red)" }}>{enabled ? "On" : "Off"}</span>
          </div>
        </>
      ) : (
        <button className="d-btn d-btn-p" disabled={busy} onClick={() => act("create")}>{busy && <Loader2 size={16} className="animate-spin" />} Make a control link</button>
      )}
    </section>
  );
}
