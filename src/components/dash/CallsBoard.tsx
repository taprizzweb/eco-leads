"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Check, Volume2, VolumeX } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "./Toast";

type C = { id: string; label: string | null; status: "new" | "done"; created_at: string };

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m === 1 ? "1 min ago" : `${m} min ago`;
};

// Live list of tables that called. Polls every 6 seconds, which needs no extra setup and is plenty for a counter screen.
export function CallsBoard({ clientId, initial }: { clientId: string; initial: C[] }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [calls, setCalls] = useState(initial);
  const [sound, setSound] = useState(false);
  const [, tick] = useState(0);
  const seen = useRef(new Set(initial.map((c) => c.id)));
  const soundOn = useRef(false);
  useEffect(() => { soundOn.current = sound; }, [sound]);

  const beep = useCallback(() => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.25, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.start(); o.stop(ctx.currentTime + 0.5); setTimeout(() => ctx.close(), 700);
    } catch {}
  }, []);

  useEffect(() => {
    const load = async () => {
      const since = new Date(Date.now() - 12 * 3600e3).toISOString();
      const { data } = await sb.from("server_calls").select("id, label, status, created_at").eq("client_id", clientId).gte("created_at", since).order("created_at", { ascending: false }).limit(60);
      if (!data) return;
      const fresh = data.filter((c) => c.status === "new" && !seen.current.has(c.id));
      data.forEach((c) => seen.current.add(c.id));
      if (fresh.length && soundOn.current) beep();
      setCalls(data as C[]);
    };
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); tick((n) => n + 1); }, 6000);
    return () => clearInterval(t);
  }, [sb, clientId, beep]);

  async function done(c: C) {
    const { error } = await sb.from("server_calls").update({ status: "done", done_at: new Date().toISOString() }).eq("id", c.id);
    if (error) return toast("That did not save. Please try again.", true);
    setCalls((s) => s.map((x) => (x.id === c.id ? { ...x, status: "done" } : x)));
  }
  const open = calls.filter((c) => c.status === "new");
  const closed = calls.filter((c) => c.status === "done").slice(0, 10);

  return (
    <div className="space-y-5">
      <button type="button" className="d-btn d-btn-s" aria-pressed={sound} onClick={() => { setSound((v) => !v); if (!sound) beep(); }}>
        {sound ? <Volume2 size={15} /> : <VolumeX size={15} />} {sound ? "Beep is on" : "Turn on the beep"}
      </button>
      {open.length === 0 ? (
        <div className="d-card px-6 py-12 text-center text-sm" style={{ color: "var(--d-muted)" }}>No table is calling right now.</div>
      ) : (
        <ul className="space-y-3" aria-live="polite">
          {open.map((c) => (
            <li key={c.id} className="d-card flex items-center gap-4 p-4" style={{ boxShadow: "inset 0 0 0 1.5px var(--d-red)" }}>
              <BellRing style={{ color: "var(--d-red)" }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[20px] font-semibold">{c.label ?? "A table"}</p>
                <p className="text-xs" style={{ color: "var(--d-muted)" }}>{ago(c.created_at)}</p>
              </div>
              <button type="button" className="d-btn d-btn-p" onClick={() => done(c)}><Check size={15} /> Done</button>
            </li>
          ))}
        </ul>
      )}
      {closed.length > 0 && (
        <section aria-label="Done">
          <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--d-muted)" }}>Done</h2>
          <ul className="space-y-1.5 text-sm" style={{ color: "var(--d-muted)" }}>
            {closed.map((c) => <li key={c.id}>{c.label ?? "A table"} · {ago(c.created_at)}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
