import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { CreateForm } from "@/components/link/CreateForm";
import { ToastProvider } from "@/components/dash/Toast";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Create your premium mini link | Taprizz",
  description: "A clean, ad-free mini link page for your Instagram bio: photos, outlets, offers, menu, Zomato, Swiggy and more. Made in Jaipur.",
};

export default async function CreatePage() {
  const sb = await supabaseServer();
  const { data } = await sb.rpc("mini_public_settings");
  const price = (data as { price?: number } | null)?.price ?? 150;
  const points = [
    "No ads and no clutter. Your page, your brand colours, your logo.",
    "Photos, all your outlets in one list, offers, menu, Instagram, WhatsApp, Zomato, Swiggy and Google Maps.",
    "Pick a template or set any colour. We can read colours from your logo for you.",
    `One payment of Rs ${price}, no monthly fee. Build and preview it free first.`,
  ];
  return (
    <div className="dash min-h-dvh" data-mode="light">
      <ToastProvider>
        <main className="mx-auto max-w-xl px-4 pt-10 pb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: "var(--d-muted)" }}>Taprizz Mini Link</p>
          <h1 className="mt-2 text-[34px] leading-tight font-semibold tracking-[-0.03em]">Create your premium mini link</h1>
          <p className="mt-2" style={{ color: "var(--d-muted)" }}>One clean page for your Instagram bio, built for Jaipur businesses. Takes about 5 minutes.</p>
          <ul className="my-5 space-y-2 text-[15px]">
            {points.map((p) => <li key={p} className="flex gap-2"><span aria-hidden>✓</span><span>{p}</span></li>)}
          </ul>
          <CreateForm />
          <p className="mt-6 text-center text-xs" style={{ color: "var(--d-muted)" }}>Questions? WhatsApp +91 96729 99166</p>
        </main>
      </ToastProvider>
    </div>
  );
}
