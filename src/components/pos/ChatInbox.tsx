"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, Send } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/dash/Toast";
import { beep, waLink } from "@/lib/pos";

type Thread = { id: string; table_label: string | null; customer_name: string | null; customer_phone: string | null; unread_staff: number; last_message_at: string };
type Msg = { id: string; thread_id: string; sender: "customer" | "staff"; body: string; created_at: string };

export function ChatInbox({ clientId, initial }: { clientId: string; initial: Thread[] }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [threads, setThreads] = useState(initial);
  const [cur, setCur] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sound, setSound] = useState(true);
  const curRef = useRef<string | null>(null);
  const soundRef = useRef(true);
  const bottom = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);
  useEffect(() => { curRef.current = cur; }, [cur]);
  useEffect(() => { soundRef.current = sound; }, [sound]);

  const loadThreads = useCallback(async () => {
    const { data } = await sb.from("chat_threads").select("id, table_label, customer_name, customer_phone, unread_staff, last_message_at").eq("client_id", clientId).gte("last_message_at", new Date(Date.now() - 3 * 86400e3).toISOString()).order("last_message_at", { ascending: false }).limit(60);
    if (!data) return;
    const unread = (data as Thread[]).reduce((a, t) => a + (t.id === curRef.current ? 0 : t.unread_staff), 0);
    if (unread > lastCount.current && soundRef.current) beep("chat");
    lastCount.current = unread;
    setThreads(data as Thread[]);
  }, [sb, clientId]);
  const loadMsgs = useCallback(async (id: string) => {
    const { data } = await sb.from("chat_messages").select("id, thread_id, sender, body, created_at").eq("thread_id", id).order("created_at").limit(300);
    if (data && curRef.current === id) setMsgs(data as Msg[]);
    await sb.from("chat_threads").update({ unread_staff: 0 }).eq("id", id).gt("unread_staff", 0);
  }, [sb]);

  useEffect(() => {
    const refresh = () => { void loadThreads(); if (curRef.current) void loadMsgs(curRef.current); };
    const ch = sb.channel(`chat-${clientId}`).on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `client_id=eq.${clientId}` }, refresh).subscribe();
    const poll = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 5000);
    return () => { sb.removeChannel(ch); clearInterval(poll); };
  }, [sb, clientId, loadThreads, loadMsgs]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const open = (id: string) => { setCur(id); curRef.current = id; setMsgs([]); setThreads((s) => s.map((t) => (t.id === id ? { ...t, unread_staff: 0 } : t))); void loadMsgs(id); };
  async function send() {
    const body = text.trim(); if (!body || !cur) return;
    setText("");
    const { error } = await sb.from("chat_messages").insert({ thread_id: cur, client_id: clientId, sender: "staff", body });
    if (error) { setText(body); return toast("That did not send. Please try again.", true); }
    await sb.from("chat_threads").update({ last_message_at: new Date().toISOString() }).eq("id", cur);
    void loadMsgs(cur);
  }
  const t = threads.find((x) => x.id === cur);
  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr]">
      <section aria-label="Chats" className={`${cur ? "hidden md:block" : ""} space-y-2`}>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={sound} onChange={(e) => setSound(e.target.checked)} /> Beep for new messages</label>
        {threads.length === 0 && <div className="d-card px-4 py-10 text-center text-sm" style={{ color: "var(--d-muted)" }}>No chats yet. When a guest writes from the menu page, it appears here at once.</div>}
        {threads.map((x) => (
          <button key={x.id} type="button" onClick={() => open(x.id)} className="d-card flex w-full items-center gap-3 p-3 text-left" style={x.id === cur ? { boxShadow: "inset 0 0 0 1.5px var(--d-blue)" } : undefined}>
            <MessageCircle size={18} />
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{x.customer_name || "Guest"} · {x.table_label ?? "Table"}</span><span className="block text-xs" style={{ color: "var(--d-muted)" }}>{new Date(x.last_message_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span></span>
            {x.unread_staff > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white" style={{ background: "var(--d-red)" }}>{x.unread_staff}</span>}
          </button>
        ))}
      </section>
      <section aria-label="Conversation" className={`${cur ? "" : "hidden md:block"} d-card flex min-h-[60dvh] flex-col`}>
        {!t ? <p className="m-auto p-8 text-sm" style={{ color: "var(--d-muted)" }}>Pick a chat to reply.</p> : (<>
          <header className="flex items-center gap-2 border-b p-3" style={{ borderColor: "var(--d-line)" }}>
            <button type="button" className="d-btn d-btn-s md:hidden" onClick={() => setCur(null)} aria-label="Back to chats"><ArrowLeft size={16} /></button>
            <p className="min-w-0 flex-1 truncate font-semibold">{t.customer_name || "Guest"} · {t.table_label ?? "Table"}</p>
            {t.customer_phone && <a className="d-btn d-btn-s" href={waLink(t.customer_phone, `Hi ${t.customer_name ?? ""}, `)} target="_blank" rel="noopener">Reply on WhatsApp</a>}
          </header>
          <div className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
            {msgs.map((m) => (
              <p key={m.id} className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] ${m.sender === "staff" ? "ml-auto" : ""}`} style={m.sender === "staff" ? { background: "var(--d-blue)", color: "#fff" } : { background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line)" }}>{m.body}</p>
            ))}
            <div ref={bottom} />
          </div>
          <form className="flex gap-2 border-t p-3" style={{ borderColor: "var(--d-line)" }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <input aria-label="Your reply" className="d-input" placeholder="Type a reply" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
            <button className="d-btn d-btn-p shrink-0" aria-label="Send reply"><Send size={16} /></button>
          </form>
        </>)}
      </section>
    </div>
  );
}
