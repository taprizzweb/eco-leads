"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/dash/Toast";
import { Pill, Row, TableWrap, td, th } from "./ui";

type Role = "owner" | "manager" | "rep";
type Member = { user_id: string; email: string; role: Role; last_sign_in_at: string | null };
type Invite = { id: string; email: string; team_role: Role; created_at: string };

const ROLE_HELP: Record<Role, string> = {
  owner: "Everything, including adding and removing the team.",
  manager: "Clients, plans, plates and QR links, invites for business owners.",
  rep: "Can view clients and change plans and switches. Cannot create or move plates.",
};

export function TeamAdmin({ members: m0, invites: i0, me, canEdit }: { members: Member[]; invites: Invite[]; me: string; canEdit: boolean }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [members, setMembers] = useState(m0);
  const [invites, setInvites] = useState(i0);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("rep");
  const owners = members.filter((m) => m.role === "owner").length;

  async function setMemberRole(m: Member, r: Role) {
    if (m.role === "owner" && r !== "owner" && owners <= 1) return toast("There must always be at least one owner.", true);
    const { error } = await sb.from("team_members").update({ role: r }).eq("user_id", m.user_id);
    if (error) return toast("The role did not change. Only owners can do that.", true);
    setMembers((s) => s.map((x) => (x.user_id === m.user_id ? { ...x, role: r } : x)));
    toast("Role changed");
  }
  async function remove(m: Member) {
    if (m.user_id === me) return toast("You cannot remove yourself.", true);
    if (m.role === "owner" && owners <= 1) return toast("There must always be at least one owner.", true);
    const { error } = await sb.from("team_members").delete().eq("user_id", m.user_id);
    if (error) return toast("The person was not removed. Only owners can do that.", true);
    setMembers((s) => s.filter((x) => x.user_id !== m.user_id));
    toast(`${m.email} removed from the team`);
  }
  async function invite() {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return toast("That email looks incomplete.", true);
    const { data, error } = await sb.from("invites").insert({ email: e, kind: "team", team_role: role }).select("id, email, team_role, created_at").single();
    if (error || !data) return toast("The invite did not save. Only owners can invite team members.", true);
    setInvites((s) => [data as Invite, ...s]);
    setEmail("");
    toast(`${e} joins the team when they sign in with that email`);
  }
  async function cancel(id: string) {
    const { error } = await sb.from("invites").delete().eq("id", id);
    if (error) return toast("The invite was not removed.", true);
    setInvites((s) => s.filter((i) => i.id !== id));
    toast("Invite removed");
  }

  return (
    <div className="space-y-4">
      <TableWrap>
        <thead><tr style={{ color: "var(--d-muted)" }}><th className={th}>Person</th><th className={th}>Role</th><th className={th}>Last sign-in</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {members.map((m) => (
            <Row key={m.user_id}>
              <td className={td} style={{ color: "var(--d-text)" }}>{m.email} {m.user_id === me && <Pill tone="blue">You</Pill>}</td>
              <td className={td}>
                {canEdit ? (
                  <select aria-label={`Role for ${m.email}`} className="d-input !min-h-10 !w-40" value={m.role} onChange={(e) => setMemberRole(m, e.target.value as Role)}>
                    <option value="owner">Owner</option><option value="manager">Manager</option><option value="rep">Rep</option>
                  </select>
                ) : <Pill tone="gray">{m.role}</Pill>}
              </td>
              <td className={td}>{m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Never"}</td>
              <td className={`${td} text-right`}>{canEdit && m.user_id !== me && <button className="grid h-10 w-10 place-items-center" style={{ color: "var(--d-muted)" }} aria-label={`Remove ${m.email}`} onClick={() => remove(m)}><Trash2 size={16} /></button>}</td>
            </Row>
          ))}
        </tbody>
      </TableWrap>

      {invites.length > 0 && (
        <section className="d-card p-4">
          <h2 className="mb-3 font-semibold">Waiting to sign in</h2>
          <ul className="space-y-2">
            {invites.map((i) => (
              <li key={i.id} className="d-raise flex items-center gap-3 p-3"><span className="min-w-0 flex-1 truncate" style={{ color: "var(--d-text)" }}>{i.email}</span><Pill tone="amber">{i.team_role}</Pill>
                {canEdit && <button className="grid h-10 w-10 place-items-center" style={{ color: "var(--d-muted)" }} aria-label={`Cancel invite for ${i.email}`} onClick={() => cancel(i.id)}><Trash2 size={16} /></button>}</li>
            ))}
          </ul>
        </section>
      )}

      {canEdit ? (
        <form className="d-card flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); invite(); }}>
          <label className="block min-w-56 flex-1 text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Invite a team member</span>
            <input type="email" className="d-input mt-1.5" placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Role</span>
            <select className="d-input mt-1.5 !w-40" value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="rep">Rep</option><option value="manager">Manager</option><option value="owner">Owner</option></select></label>
          <button className="d-btn d-btn-p">Send invite</button>
          <p className="w-full text-xs" style={{ color: "var(--d-muted)" }}>{ROLE_HELP[role]} They get access the first time they sign in with this email.</p>
        </form>
      ) : <p className="text-sm" style={{ color: "var(--d-muted)" }}>Only owners can add or remove team members.</p>}
    </div>
  );
}
