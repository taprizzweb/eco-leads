import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AuthFrame, authBtn } from "@/components/dash/AuthFrame";

export const dynamic = "force-dynamic";

// Sends an owner straight to their business. Team members and multi-location owners pick one.
export default async function DashboardIndex() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  // First sign-in after an invite: link this email to the business or team it was invited to.
  await sb.rpc("claim_invites");
  // Taprizz team members belong in the admin panel, not in one client's dashboard.
  const { data: teamRole } = await sb.rpc("my_team_role");
  if (teamRole) redirect("/admin");
  const { data: clients } = await sb.from("clients").select("slug, name").order("name");
  if (clients?.length === 1) redirect(`/dashboard/${clients[0].slug}`);

  return (
    <AuthFrame
      title={clients?.length ? "Choose a business" : "No business linked yet"}
      sub={clients?.length ? "Pick the page you want to manage." : `${user?.email ?? "This account"} is not linked to a business. Ask Taprizz to add you, then sign in again.`}
    >
      {clients?.length ? (
        <ul className="flex flex-col gap-3">
          {clients.map((c) => (
            <li key={c.slug}>
              <Link href={`/dashboard/${c.slug}`} className={authBtn}>{c.name}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <form action="/auth/signout" method="post">
          <button className={authBtn}>Sign out</button>
        </form>
      )}
    </AuthFrame>
  );
}
