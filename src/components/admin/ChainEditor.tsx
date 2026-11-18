"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImagePlus, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toWebp } from "@/lib/image";
import { useToast } from "@/components/dash/Toast";
import { slugify } from "@/lib/features";
import { Pill } from "./ui";

type Group = { id: string; slug: string; name: string; logo_url: string | null };
export type Branch = { id: string; name: string; slug: string; status: string };
export type Head = { id: string; email: string; claimed_at: string | null; claimed_by: string | null; created_at: string };
type Found = { id: string; name: string; group_id: string | null };

// Module level on purpose: defined inside the editor it would remount on every keystroke and the field would lose focus.
function Sec({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <section className="d-card space-y-4 p-5"><div><h2 className="font-semibold">{title}</h2>{sub && <p className="mt-0.5 text-sm" style={{ color: "var(--d-muted)" }}>{sub}</p>}</div>{children}</section>;
}

export function ChainEditor({ group, branches: b0, heads: h0 }: { group: Group; branches: Branch[]; heads: Head[] }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [g, setG] = useState(group);
  const [branches, setBranches] = useState(b0);
  const [heads, setHeads] = useState(h0);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const logoIn = useRef<HTMLInputElement>(null);

  // search registered businesses that are not in a chain yet
  useEffect(() => {
    const term = q.trim();
    if (!term) { setFound(null); return; }
    const t = setTimeout(async () => {
      const { data } = await sb.from("clients").select("id, name, group_id").ilike("name", `%${term.replace(/[%_]/g, "")}%`).order("name").limit(12);
      setFound((data ?? []) as Found[]);
    }, 250);
    return () => clearTimeout(t);
  }, [q, sb]);

  async function saveProfile() {
    const slug = slugify(g.slug);
    if (!g.name.trim()) return toast("Add the name of the chain.", true);
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) return toast("The link name needs 3 to 40 letters, numbers or dashes.", true);
    setBusy("profile");
    const { error } = await sb.from("groups").update({ name: g.name.trim(), slug, logo_url: g.logo_url }).eq("id", g.id);
    setBusy(null);
    if (error) return toast(/duplicate|unique/i.test(error.message) ? "That link name is taken." : "That did not save.", true);
    setG({ ...g, slug });
    toast("Saved");
    router.refresh();
  }

  async function uploadLogo(file: File) {
    setBusy("logo");
    try {
      const blob = await toWebp(file, 500);
      const path = `links/groups/${g.id}/${crypto.randomUUID()}.webp`;
      const { error } = await sb.storage.from("page-assets").upload(path, blob, { contentType: "image/webp" });
      if (error) throw error;
      setG((s) => ({ ...s, logo_url: sb.storage.from("page-assets").getPublicUrl(path).data.publicUrl }));
      toast("Logo ready. Press Save.");
    } catch { toast("The logo did not upload. Try a JPG or PNG.", true); } finally { setBusy(null); }
  }

  async function addBranch(c: Found) {
    setBusy("add" + c.id);
    const { error } = await sb.from("clients").update({ group_id: g.id }).eq("id", c.id);
    setBusy(null);
    if (error) return toast("The branch was not added.", true);
    setBranches((s) => [...s, { id: c.id, name: c.name, slug: "", status: "" }].sort((a, b) => a.name.localeCompare(b.name)));
    setFound((s) => (s ?? []).map((x) => (x.id === c.id ? { ...x, group_id: g.id } : x)));
    toast(`${c.name} is now a branch`);
    router.refresh();
  }
  async function removeBranch(c: Branch) {
    if (!confirm(`Take ${c.name} out of ${g.name}? The business stays; it just stops being part of this chain.`)) return;
    setBusy("rm" + c.id);
    const { error } = await sb.from("clients").update({ group_id: null }).eq("id", c.id);
    setBusy(null);
    if (error) return toast("That did not work.", true);
    setBranches((s) => s.filter((x) => x.id !== c.id));
    router.refresh();
  }

  async function invite() {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return toast("That email looks incomplete.", true);
    if (heads.some((h) => h.email === e)) return toast("That person already has an invite.", true);
    setBusy("invite");
    const { data, error } = await sb.from("invites").insert({ email: e, kind: "group", group_id: g.id }).select("id, email, claimed_at, claimed_by, created_at").single();
    setBusy(null);
    if (error || !data) return toast("The invite did not save. Only the Taprizz owner can invite.", true);
    setHeads((s) => [data as Head, ...s]);
    setEmail("");
    toast(`${e} gets access the first time they sign in with this email`);
  }
  async function removeHead(h: Head) {
    if (!confirm(`Remove ${h.email}? They lose access to all branches of ${g.name}.`)) return;
    setBusy("h" + h.id);
    if (h.claimed_by) await sb.from("group_members").delete().eq("group_id", g.id).eq("user_id", h.claimed_by);
    const { error } = await sb.from("invites").delete().eq("id", h.id);
    setBusy(null);
    if (error) return toast("That did not work.", true);
    setHeads((s) => s.filter((x) => x.id !== h.id));
  }

  const inGroup = new Set(branches.map((x) => x.id));
  return (
    <div className="space-y-4">
      <Sec title="Chain">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => logoIn.current?.click()} aria-label="Change logo" className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>
            {busy === "logo" ? <Loader2 className="animate-spin" /> : g.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={g.logo_url} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={22} style={{ color: "var(--d-muted)" }} />}
          </button>
          <input ref={logoIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadLogo(f); }} />
          <p className="text-sm" style={{ color: "var(--d-muted)" }}>The chain&apos;s logo, shown on its dashboard.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Name</span><input className="d-input mt-1.5" maxLength={80} value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} /></label>
          <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Link name</span><span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>/group/{slugify(g.slug)}</span><input className="d-input mt-1.5" maxLength={40} value={g.slug} onChange={(e) => setG({ ...g, slug: e.target.value.toLowerCase() })} /></label>
        </div>
        <div className="flex gap-2"><button className="d-btn d-btn-p" disabled={busy === "profile"} onClick={saveProfile}>{busy === "profile" && <Loader2 size={15} className="animate-spin" />} Save</button>
          <Link className="d-btn d-btn-s" href={`/group/${g.slug}`}>Open the chain dashboard</Link></div>
      </Sec>

      <Sec title={`Branches (${branches.length})`} sub="The businesses that belong to this chain. The chain head sees all of them in one place.">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" style={{ color: "var(--d-muted)" }} aria-hidden />
          <input type="search" aria-label="Search registered businesses to add" className="d-input !pl-10" placeholder="Search a registered business to add" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {found && (
          <ul className="d-raise divide-y" style={{ borderColor: "var(--d-line)" }}>
            {found.length === 0 && <li className="p-3 text-sm" style={{ color: "var(--d-muted)" }}>No registered business matches &ldquo;{q}&rdquo;.</li>}
            {found.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1 truncate" style={{ color: "var(--d-text)" }}>{c.name}</span>
                {inGroup.has(c.id) ? <Pill tone="green">Added</Pill> : c.group_id ? <Pill tone="amber">In another chain</Pill> : (
                  <button className="d-btn d-btn-s !min-h-9" disabled={busy === "add" + c.id} onClick={() => addBranch(c)}>{busy === "add" + c.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {branches.length === 0 ? <p className="text-sm" style={{ color: "var(--d-muted)" }}>No branches yet. Search above and add the first one.</p> : (
          <ul className="space-y-1.5">
            {branches.map((c) => (
              <li key={c.id} className="d-raise flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate" style={{ color: "var(--d-text)" }}>{c.name}</span>
                {c.slug && <Link className="text-xs underline underline-offset-4" style={{ color: "var(--d-muted)" }} href={`/admin/clients/${c.slug}`}>Open</Link>}
                <button className="grid h-9 w-9 place-items-center" aria-label={`Remove ${c.name} from the chain`} disabled={busy === "rm" + c.id} onClick={() => removeBranch(c)} style={{ color: "var(--d-muted)" }}><X size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </Sec>

      <Sec title="Who can open it" sub="The head of the chain. They sign in with this email (Google, or a password they set themselves) and see every branch.">
        <div className="flex gap-2">
          <input className="d-input" type="email" inputMode="email" autoComplete="off" aria-label="Email of the chain head" placeholder="head@kanagroup.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void invite(); }} />
          <button className="d-btn d-btn-p shrink-0" disabled={busy === "invite"} onClick={invite}>{busy === "invite" && <Loader2 size={15} className="animate-spin" />} Invite</button>
        </div>
        {heads.length === 0 ? <p className="text-sm" style={{ color: "var(--d-muted)" }}>Nobody yet.</p> : (
          <ul className="space-y-1.5">
            {heads.map((h) => (
              <li key={h.id} className="d-raise flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate" style={{ color: "var(--d-text)" }}>{h.email}</span>
                {h.claimed_at ? <Pill tone="green">Signed in</Pill> : <Pill tone="amber">Waiting for first sign in</Pill>}
                <button className="grid h-9 w-9 place-items-center" aria-label={`Remove ${h.email}`} disabled={busy === "h" + h.id} onClick={() => removeHead(h)} style={{ color: "var(--d-muted)" }}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </Sec>
    </div>
  );
}
