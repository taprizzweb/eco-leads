import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, Building2, Link2, MapPin, MessageCircle, Megaphone } from "lucide-react";
import { requireTeam, atLeast } from "@/lib/admin";
import { PageHead } from "@/components/admin/ui";

export default async function ToolsPage() {
  const { sb, role } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const { count } = await sb.from("wa_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
  const { count: hubPending } = await sb.from("hub_offers").select("id", { count: "exact", head: true }).eq("status", "pending");
  const tools = [
    { href: "/admin/tools/jaipur", title: "Gulabi Nagar page", text: "The public Jaipur guide: who is listed, special offers to approve, sponsored spots and areas.", Icon: MapPin, badge: hubPending ?? 0 },
    { href: "/admin/tools/chains", title: "Chains", text: "A company with many branches in one dashboard: make a group, add its branches, and give its head a login.", Icon: Building2, badge: 0 },
    { href: "/admin/tools/links", title: "Mini Links", text: "A premium one-page site for a business to put in its Instagram bio: photos, menus, outlets, Zomato, Swiggy and reviews.", Icon: Link2, badge: 0 },
    { href: "/admin/ai-studio", title: "AI Agent", text: "The review writer: connection, writing rules, categories and questions, and a playground to test it.", Icon: Bot, badge: 0 },
    { href: "/admin/tools/whatsapp", title: "WhatsApp Automation", text: "Switch WhatsApp offers on for a business, see its customers, and check the WhatsApp API connection.", Icon: MessageCircle, badge: 0 },
    { href: "/admin/tools/offers", title: "WhatsApp Offers", text: "Offer requests from owners. Check the message and image, pick the audience, approve or reject.", Icon: Megaphone, badge: count ?? 0 },
  ];
  return (
    <>
      <PageHead title="Tools" sub="Everything that works across all your businesses." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((t) => (
          <Link key={t.href} href={t.href} className="d-card block p-5 transition hover:opacity-90">
            <t.Icon size={22} style={{ color: "var(--d-text)" }} aria-hidden />
            <h2 className="mt-3 flex items-center gap-2 font-semibold">{t.title}{!!t.badge && <span className="d-chip" style={{ ["--c" as string]: "var(--d-red)" }}>{t.badge} waiting</span>}</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>{t.text}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
