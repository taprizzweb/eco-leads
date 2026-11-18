import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requireTeam, atLeast } from "@/lib/admin";
import { PageHead } from "@/components/admin/ui";

export default async function TeamPage() {
  const { role, user } = await requireTeam();
  if (!atLeast(role, "owner")) notFound();
  return (
    <>
      <PageHead title="Admin access" sub="Who can open this admin." />
      <section className="d-card max-w-xl space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><Lock size={17} /> Locked to you</h2>
        <p className="text-sm" style={{ color: "var(--d-sub)" }}>Only <b>{user.email}</b> can open the admin. Nobody else can be added: the database refuses new admin people, and every other account is sent to its own dashboard.</p>
        <p className="text-sm" style={{ color: "var(--d-muted)" }}>Businesses and their owners are not affected. They only ever see their own dashboard.</p>
        <p className="text-xs" style={{ color: "var(--d-muted)" }}>Tip: keep a strong password and switch on the two-step code for this account when you are ready.</p>
      </section>
    </>
  );
}
