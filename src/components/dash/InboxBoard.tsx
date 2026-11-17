"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquareWarning, Lightbulb, Paperclip, Mic, Phone, X, MessageCircle, Loader2, Inbox as InboxIcon, Lock } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/dash-time";
import { useToast } from "./Toast";

export type Status = "new" | "in_progress" | "resolved";
export type Item = {
  id: string;
  kind: "complaint" | "suggestion";
  body: string;
  media_paths: string[];
  contact_name: string | null;
  contact_phone: string | null;
  contact_consent: boolean;
  status: Status;
  private_note: string | null;
  plate_code: string | null;
  created_at: string;
  resolved_at: string | null;
};

const COLS: { id: Status; name: string; tone: string; done: string }[] = [
  { id: "new", name: "New", tone: "var(--d-red)", done: "Moved back to New" },
  { id: "in_progress", name: "In progress", tone: "var(--d-amber)", done: "Marked in progress" },
  { id: "resolved", name: "Resolved", tone: "var(--d-green)", done: "Marked resolved" },
];
const DAY = 864e5;
const isLate = (i: Item) => i.status !== "resolved" && Date.now() - new Date(i.created_at).getTime() > DAY;

export function InboxBoard({ initial, labels, openId, enabled, slug }: { initial: Item[]; labels: Record<string, string>; openId: string | null; enabled: boolean; slug: string }) {
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"all" | "complaint" | "suggestion">("all");
  const [mobileCol, setMobileCol] = useState<Status>("new");
  const [open, setOpen] = useState<string | null>(openId);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  const shown = useMemo(() => items.filter((i) => filter === "all" || i.kind === filter), [items, filter]);
  const selected = items.find((i) => i.id === open) ?? null;

  async function move(id: string, status: Status) {
    const prev = items.find((i) => i.id === id);
    if (!prev || prev.status === status) return;
    setItems((s) => s.map((i) => (i.id === id ? { ...i, status } : i)));
    const { error } = await supabaseBrowser().from("feedback").update({ status }).eq("id", id);
    if (error) {
      setItems((s) => s.map((i) => (i.id === id ? prev : i)));
      toast("That change did not save. Check your connection and try again.", true);
    } else {
      toast(COLS.find((c) => c.id === status)!.done);
    }
  }

  async function saveNote(id: string, note: string) {
    const { error } = await supabaseBrowser().from("feedback").update({ private_note: note || null }).eq("id", id);
    if (error) return toast("The note did not save. Please try again.", true);
    setItems((s) => s.map((i) => (i.id === id ? { ...i, private_note: note || null } : i)));
    toast("Note saved");
  }

  if (!enabled) {
    return (
      <div className="d-card mx-auto max-w-lg p-8 text-center">
        <Lock className="mx-auto" style={{ color: "var(--d-muted)" }} />
        <h1 className="mt-4 text-xl font-semibold">The inbox comes with Growth</h1>
        <p className="mt-2" style={{ color: "var(--d-muted)" }}>Guests can send complaints and suggestions privately, with photos and voice notes, so you fix things before they reach Google.</p>
        <Link href={`/dashboard/${slug}/plan`} className="d-btn d-btn-p mt-6">See plans</Link>
      </div>
    );
  }

  const counts = (s: Status) => shown.filter((i) => i.status === s).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Inbox</h1>
        <div className="d-seg" role="group" aria-label="Filter">
          {(["all", "complaint", "suggestion"] as const).map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "complaint" ? "Complaints" : "Suggestions"}
            </button>
          ))}
        </div>
      </div>

      {/* Phone: one column at a time */}
      <div className="d-seg md:hidden" role="group" aria-label="Status">
        {COLS.map((c) => (
          <button key={c.id} aria-pressed={mobileCol === c.id} onClick={() => setMobileCol(c.id)} className="flex-1 justify-center">
            {c.name} <span className="tabular-nums" style={{ color: "var(--d-muted)" }}>{counts(c.id)}</span>
          </button>
        ))}
      </div>

      <div className="d-dots grid gap-4 rounded-2xl md:grid-cols-3">
        {COLS.map((c) => {
          const list = shown.filter((i) => i.status === c.id);
          return (
            <section
              key={c.id}
              aria-label={c.name}
              className={`${mobileCol === c.id ? "block" : "hidden"} rounded-lg p-2 pt-3 transition-shadow md:block`}
              style={{
                background: "color-mix(in srgb, var(--d-surface) 70%, transparent)",
                boxShadow: `inset 0 0 0 1px ${overCol === c.id ? c.tone : "var(--d-line)"}`,
                minHeight: 240,
              }}
              onDragOver={(e) => { e.preventDefault(); setOverCol(c.id); }}
              onDragLeave={() => setOverCol((o) => (o === c.id ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOverCol(null); if (dragId) move(dragId, c.id); setDragId(null); }}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="d-col-h text-[15px]" style={{ ["--c" as string]: c.tone }}>{c.name}</span>
                <span className="text-sm tabular-nums" style={{ color: "var(--d-muted)" }}>{list.length}</span>
              </div>
              <ul className="space-y-2.5">
                {list.map((i) => (
                  <li key={i.id}>
                    <button
                      draggable
                      onDragStart={(e) => { setDragId(i.id); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      onClick={() => setOpen(i.id)}
                      className="d-raise block w-full p-3 text-left transition-opacity"
                      style={{ opacity: dragId === i.id ? 0.4 : 1, boxShadow: isLate(i) ? "inset 0 0 0 1px color-mix(in srgb, var(--d-red) 60%, transparent)" : undefined }}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs" style={{ color: isLate(i) ? "var(--d-red)" : "var(--d-muted)" }}>
                        <span>{timeAgo(i.created_at)}{isLate(i) ? " · over 24 h" : ""}</span>
                        <span>{i.plate_code ? labels[i.plate_code] ?? i.plate_code : ""}</span>
                      </span>
                      <span className="mt-1.5 line-clamp-2 block text-[15px]" style={{ color: "var(--d-text)" }}>{i.body}</span>
                      <span className="mt-2.5 flex items-center gap-2">
                        <span className="d-chip" style={{ ["--c" as string]: i.kind === "complaint" ? "var(--d-red)" : "var(--d-amber)" }}>
                          {i.kind === "complaint" ? <MessageSquareWarning size={11} /> : <Lightbulb size={11} />}
                          {i.kind === "complaint" ? "Complaint" : "Suggestion"}
                        </span>
                        {i.media_paths.some((p) => /\.(webm|m4a|ogg|mp3|aac)$/.test(p)) && <Mic size={14} aria-label="Voice note" style={{ color: "var(--d-muted)" }} />}
                        {i.media_paths.some((p) => !/\.(webm|m4a|ogg|mp3|aac)$/.test(p)) && <Paperclip size={14} aria-label="Attachment" style={{ color: "var(--d-muted)" }} />}
                        {i.contact_phone && i.contact_consent && <Phone size={14} aria-label="Can be contacted" style={{ color: "var(--d-muted)" }} />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {list.length === 0 && (
                <div className="flex flex-col items-center px-4 py-10 text-center text-sm" style={{ color: "var(--d-muted)" }}>
                  <InboxIcon size={22} />
                  <p className="mt-2">
                    {c.id === "new" ? "Nothing new. When a guest writes in from your plate, it lands here." : c.id === "in_progress" ? "Drag a card here, or open it and tap Mark in progress." : "Resolved messages collect here."}
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {selected && (
        <Detail key={selected.id} item={selected} label={selected.plate_code ? labels[selected.plate_code] ?? selected.plate_code : null} onClose={() => setOpen(null)} onMove={move} onSaveNote={saveNote} />
      )}
    </div>
  );
}

function Detail({ item, label, onClose, onMove, onSaveNote }: { item: Item; label: string | null; onClose: () => void; onMove: (id: string, s: Status) => void; onSaveNote: (id: string, n: string) => Promise<void> }) {
  const [urls, setUrls] = useState<{ path: string; url: string }[] | null>(item.media_paths.length ? null : []);
  const [note, setNote] = useState(item.private_note ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!item.media_paths.length) return;
    supabaseBrowser().storage.from("guest-uploads").createSignedUrls(item.media_paths, 600).then(({ data }) => {
      setUrls((data ?? []).filter((d) => d.signedUrl).map((d) => ({ path: d.path ?? "", url: d.signedUrl })));
    });
  }, [item.media_paths]);

  const phone = item.contact_phone?.replace(/\D/g, "");
  const wa = phone && item.contact_consent ? `https://wa.me/${phone.length === 10 ? "91" + phone : phone}?text=${encodeURIComponent(`Hi${item.contact_name ? " " + item.contact_name : ""}, thank you for telling us about your visit. `)}` : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Message details">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mt-auto max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl p-5 md:mt-0 md:h-full md:max-h-none md:w-[440px] md:rounded-none" style={{ background: "var(--d-bg)", boxShadow: "inset 1px 0 0 var(--d-line)" }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <span className="d-chip" style={{ ["--c" as string]: item.kind === "complaint" ? "var(--d-red)" : "var(--d-amber)" }}>{item.kind === "complaint" ? "Complaint" : "Suggestion"}</span>
            <p className="mt-2 text-sm" style={{ color: "var(--d-muted)" }}>
              {new Date(item.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{label ? ` · ${label}` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--d-surface)", boxShadow: "inset 0 0 0 1px var(--d-line)", color: "var(--d-text)" }}><X size={18} /></button>
        </div>

        <p className="text-[17px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--d-text)" }}>{item.body}</p>

        {item.media_paths.length > 0 && (
          <div className="mt-4 space-y-2">
            {urls === null && <p className="flex items-center gap-2 text-sm" style={{ color: "var(--d-muted)" }}><Loader2 size={14} className="animate-spin" /> Loading attachments</p>}
            {urls?.map((u) =>
              /\.(webm|m4a|ogg|mp3|aac)$/.test(u.path) ? <audio key={u.url} controls src={u.url} className="w-full" /> :
              /\.(mp4|mov|webm)$/.test(u.path) ? <video key={u.url} controls src={u.url} className="w-full rounded-lg" /> :
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u.url} src={u.url} alt="Photo from the guest" className="w-full rounded-lg" />,
            )}
          </div>
        )}

        {(item.contact_name || item.contact_phone) && (
          <div className="d-card mt-4 p-3 text-sm">
            <p style={{ color: "var(--d-text)" }}>{item.contact_name || "Guest"}{item.contact_phone ? ` · ${item.contact_phone}` : ""}</p>
            <p className="mt-0.5" style={{ color: "var(--d-muted)" }}>{item.contact_consent ? "Agreed to be contacted" : "Did not agree to be contacted"}</p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          {wa && <a href={wa} target="_blank" rel="noopener" className="d-btn d-btn-p col-span-2"><MessageCircle size={16} /> Reply on WhatsApp</a>}
          {item.status !== "in_progress" && item.status !== "resolved" && <button onClick={() => onMove(item.id, "in_progress")} className="d-btn d-btn-s">Mark in progress</button>}
          {item.status !== "resolved" ? (
            <button onClick={() => onMove(item.id, "resolved")} className={`d-btn ${wa ? "d-btn-s" : "d-btn-p"} ${item.status === "in_progress" ? "col-span-2" : ""}`}>Mark resolved</button>
          ) : (
            <button onClick={() => onMove(item.id, "in_progress")} className="d-btn d-btn-s col-span-2">Reopen</button>
          )}
        </div>

        <form className="mt-6" onSubmit={async (e) => { e.preventDefault(); setSaving(true); await onSaveNote(item.id, note.trim()); setSaving(false); }}>
          <label htmlFor="note" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--d-text)" }}>Private note</label>
          <p className="mb-2 text-xs" style={{ color: "var(--d-muted)" }}>Only your team sees this.</p>
          <textarea id="note" className="d-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="d-btn d-btn-s mt-2" disabled={saving || note === (item.private_note ?? "")}>{saving && <Loader2 size={14} className="animate-spin" />} Save note</button>
        </form>
      </div>
    </div>
  );
}
