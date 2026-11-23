"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, Smartphone, Volume2, VolumeX, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { audioReady, beep, pushSupported, setSound, toKey, unlockAudio, useSound, vapidKey, type AlertKind } from "@/lib/alerts";
import { useToast } from "@/components/dash/Toast";

/** Plays the alert sound the moment a new order, request or chat message arrives. Mounted once for the whole food-orders area, so it keeps going on every page. */
export function PosAlerts({ clientId, kinds = ["order", "request", "chat"] }: { clientId: string; kinds?: AlertKind[] }) {
  const sound = useSound();
  const soundRef = useRef(sound);
  const [locked, setLocked] = useState(false);
  useEffect(() => { soundRef.current = sound; }, [sound]);

  useEffect(() => {
    const unlock = () => { unlockAudio(); setLocked(!audioReady()); };
    window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock);
    const t = setTimeout(() => setLocked(sound && !audioReady()), 600);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); clearTimeout(t); };
  }, [sound]);

  useEffect(() => {
    const sb = supabaseBrowser();
    const ring = (k: AlertKind) => { if (soundRef.current && kinds.includes(k)) beep(k); };
    const ch = sb.channel(`alerts-${clientId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `client_id=eq.${clientId}` }, (p) => { if ((p.new as { status?: string }).status === "new") ring("order"); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "server_calls", filter: `client_id=eq.${clientId}` }, () => ring("request"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `client_id=eq.${clientId}` }, (p) => { if ((p.new as { sender?: string }).sender === "customer") ring("chat"); })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [clientId, kinds]);

  if (!sound || !locked) return null;
  return (
    <button type="button" onClick={() => { unlockAudio(); setLocked(false); beep("chat"); }} className="fixed inset-x-3 top-[4.6rem] z-50 mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl" style={{ background: "var(--d-amber, #f59e0b)", color: "#111" }}>
      <Volume2 size={16} /> Tap here once to start the alert sound
    </button>
  );
}

/** The bell in the top bar: alert sound and notifications on this phone or computer, each switched on or off by the person. */
export function AlertsButton({ clientId }: { clientId: string }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const sound = useSound();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"unsupported" | "blocked" | "off" | "on" | "busy">("off");

  useEffect(() => {
    if (!pushSupported()) return setState("unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    navigator.serviceWorker.getRegistration().then((r) => r?.pushManager.getSubscription()).then((s) => setState(s && Notification.permission === "granted" ? "on" : "off")).catch(() => setState("off"));
  }, [open]);

  async function enable() {
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "blocked" : "off");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const key = vapidKey();
      if (!key) { toast("Notifications are not set up yet", true); return setState("off"); }
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) as BufferSource }));
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error } = await sb.rpc("push_subscribe", { p_client: clientId, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_label: navigator.userAgent.slice(0, 60) });
      if (error) { toast("Could not turn notifications on. Please try again.", true); return setState("off"); }
      setState("on"); toast("Notifications are on for this device");
      void reg.showNotification("Alerts are on", { body: "You will see new orders and table requests here.", icon: "/icons/icon-192.png" });
    } catch { toast("Could not turn notifications on on this device", true); setState("off"); }
  }
  async function disable() {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await sb.rpc("push_unsubscribe", { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
      toast("Notifications are off for this device");
    } catch { /* fine */ }
    setState("off");
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Alerts" title="Alerts" className="relative grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)", color: "var(--d-text)" }}>
        {state === "on" ? <BellRing size={17} /> : <Bell size={17} />}
        <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full" style={{ background: state === "on" || sound ? "var(--d-green)" : "var(--d-muted)" }} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Alerts">
          <div className="d-card w-full max-w-md space-y-4 p-4" style={{ background: "var(--d-bg)" }}>
            <div className="flex items-center"><h2 className="text-lg font-semibold">Alerts</h2><button type="button" className="d-btn d-btn-s ml-auto" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button></div>
            <div className="d-card flex items-center gap-3 p-3">
              {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
              <div className="min-w-0 flex-1"><p className="font-semibold">Alert sound</p><p className="text-xs" style={{ color: "var(--d-muted)" }}>Plays when an order, request or message arrives. It stays on until you switch it off, even after you leave this page.</p></div>
              <button type="button" className={sound ? "d-btn d-btn-p" : "d-btn d-btn-s"} onClick={() => { setSound(!sound); if (!sound) { unlockAudio(); beep("order"); } }}>{sound ? "On" : "Off"}</button>
            </div>
            <div className="d-card flex items-center gap-3 p-3">
              <Smartphone size={20} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Notifications on this device</p>
                <p className="text-xs" style={{ color: "var(--d-muted)" }}>
                  {state === "unsupported" ? "This browser cannot show notifications. On iPhone, add the app to the Home Screen first (Share, then Add to Home Screen) and open it from there."
                    : state === "blocked" ? "Notifications are blocked for this site. Allow them in the browser or phone settings, then try again."
                    : "Order, table request and chat alerts appear on the screen like a message, even when the app is closed."}
                </p>
              </div>
              {state === "on" ? <button type="button" className="d-btn d-btn-s" onClick={disable}><BellOff size={15} /> Off</button>
                : <button type="button" className="d-btn d-btn-p" disabled={state === "unsupported" || state === "blocked" || state === "busy"} onClick={enable}>Turn on</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
