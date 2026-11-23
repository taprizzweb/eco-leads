"use client";

import { useState } from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ROLE_HELP, ROLE_LABEL, type Role } from "@/lib/roles";
import { useToast } from "./Toast";

type Member = { user_id: string; email: string; role: Role; last_seen: string | null };
type Invite = { id: string; email: string; role: Role };
const ASSIGN: Role[] = ["manager", "reception", "waiter"];

export function AccessBoard({ clientId, me, initialMembers, initialInvites }: { clientId: string; me: Role; initialMembers: Member[]; initialInvites: Invite[] }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("reception");
  const [busy, setBusy] = useState(false);
  const options = ASSIGN.filter((r) => r !== "manager" || me === "owner");

  async function reload() {
    const { data } = await sb.rpc("client_access_list", { p_client: clientId });
    const d = data as { members: Member[]; invites: Invite[] } | null;
    if (d) { setMembers(d.members); setInvites(d.invites); }
  }
  async function add() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast("Enter a valid email address", true);
    setBusy(true);
    const { data, error } = await sb.rpc("client_staff_invite", { p_client: clientId, p_email: email, p_role: role });
    setBusy(false);
    if (error) return toast(error.message?.length < 120 ? error.message : "That did not save. Please try again.", true);
    toast((data as { added?: boolean })?.added ? "Added. They can sign in now." : "Invited. They sign in with Google using this email, and get their access.");
    setEmail(""); void reload();
  }
  async function setRoleOf(m: Member, r: string) {
    const { error } = await sb.rpc("client_member_set", { p_client: clientId, p_user: m.user_id, p_role: r });
    if (error) return toast(error.message?.length < 120 ? error.message : "That did not save.", true);
    toast(r === "remove" ? "Access removed" : "Role changed"); void reload();
  }
  async function cancel(i: Invite) {
    const { error } = await sb.rpc("client_invite_cancel", { p_client: clientId, p_invite: i.id });
    if (error) return toast("That did not save.", true);
    setInvites((s) => s.filter((x) => x.id !== i.id));
  }
  return (
    <div className="space-y-5">
      <section className="d-card space-y-3 p-4" aria-label="Add a person">
        <h2 className="font-semibold">Add a person</h2>
        <form className="grid gap-2 sm:grid-cols-[1fr_180px_auto]" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <input className="d-input" type="email" inputMode="email" autoComplete="off" placeholder="Their Google email address" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="d-input" aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>{options.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          <button className="d-btn d-btn-p" disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Add</button>
        </form>
        <ul className="space-y-1 text-xs" style={{ color: "var(--d-muted)" }}>{ASSIGN.map((r) => <li key={r}><b style={{ color: "var(--d-text)" }}>{ROLE_LABEL[r]}:</b> {ROLE_HELP[r]}</li>)}</ul>
        <p className="text-xs" style={{ color: "var(--d-muted)" }}>They open app.taprizz.in and sign in with Google using this email. Each person sees only what their role allows, so you can keep the rest to yourself.</p>
      </section>

      <section className="d-card overflow-x-auto" aria-label="People with access">
        <h2 className="p-4 pb-2 font-semibold">People with access</h2>
        <ul>
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 border-t p-3" style={{ borderColor: "var(--d-line)" }}>
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{m.email}</p><p className="text-xs" style={{ color: "var(--d-muted)" }}>{m.last_seen ? `Last seen ${new Date(m.last_seen).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Not signed in yet"}</p></div>
              {m.role === "owner" ? <span className="d-chip" style={{ ["--c" as string]: "var(--d-green)" }}>Owner</span> : (
                <>
                  <select className="d-input !w-36" aria-label={`Role of ${m.email}`} value={m.role} onChange={(e) => void setRoleOf(m, e.target.value)} disabled={m.role === "manager" && me !== "owner"}>
                    {ASSIGN.map((r) => <option key={r} value={r} disabled={r === "manager" && me !== "owner"}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button type="button" className="d-btn d-btn-s !px-2.5" aria-label={`Remove ${m.email}`} disabled={m.role === "manager" && me !== "owner"} onClick={() => { if (window.confirm(`Remove access for ${m.email}?`)) void setRoleOf(m, "remove"); }}><Trash2 size={15} /></button>
                </>
              )}
            </li>
          ))}
          {invites.map((i) => (
            <li key={i.id} className="flex items-center gap-3 border-t p-3" style={{ borderColor: "var(--d-line)" }}>
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{i.email}</p><p className="text-xs" style={{ color: "var(--d-muted)" }}>Invited as {ROLE_LABEL[i.role]}. Waiting for the first sign in.</p></div>
              <button type="button" className="d-btn d-btn-s" onClick={() => void cancel(i)}>Cancel</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
