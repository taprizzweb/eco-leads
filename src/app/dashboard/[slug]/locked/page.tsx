import Link from "next/link";
import { Lock } from "lucide-react";
import { loadClient } from "@/lib/dash";

export default async function Locked({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ x?: string }> }) {
  const { slug } = await params;
  const { x } = await searchParams;
  const { sb, client } = await loadClient(slug);
  const { data: cfg } = await sb.rpc("mini_public_settings");
  const wnum = String((cfg as { whatsapp?: string } | null)?.whatsapp ?? "").replace(/\D/g, "");
  const what = (x ?? "").slice(0, 40) || "This screen";
  const msg = encodeURIComponent(`Hi Taprizz, I am ${client.name}. I want to open "${what}" in my dashboard.`);
  return (
    <div className="d-card mx-auto max-w-lg p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl" style={{ background: "var(--d-surface-2, var(--d-surface))", boxShadow: "inset 0 0 0 1px var(--d-line)" }}><Lock size={24} /></span>
      <h1 className="mt-4 text-xl font-semibold">{what} is locked</h1>
      <p className="mt-2" style={{ color: "var(--d-muted)" }}>Right now your dashboard has only the Mini link open. The rest of Taprizz (complaints inbox, reviews, orders, offers, staff report and more) opens when your plan is switched on. Ask us what it can do for {client.name}.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href={`/dashboard/${slug}/mini-link`} className="d-btn d-btn-p">Back to Mini link</Link>
        {wnum && <a href={`https://wa.me/${wnum}?text=${msg}`} target="_blank" rel="noopener" className="d-btn d-btn-s">Ask Taprizz on WhatsApp</a>}
      </div>
    </div>
  );
}
