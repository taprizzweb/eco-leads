import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { FREE_PERKS, PREMIUM_PERKS } from "@/lib/mini";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "What Premium gives you | Taprizz Mini Link",
  description: "Videos, more photos, offers and a keywords line for your mini link, and what Taprizz can do beyond it for your cafe or shop.",
};

export default async function PremiumPage() {
  const sb = await supabaseServer();
  const { data } = await sb.rpc("mini_public_settings");
  const price = (data as { price?: number } | null)?.price ?? 150;
  const more = [
    ["More Google reviews", "Guests tap a plate or scan a code, pick what they liked and get a review draft in three taps. They edit it and post it themselves. Unhappy guests get a private feedback box, so you hear it first."],
    ["Everything in one place", "Your menu, offers, every outlet, Instagram, WhatsApp, Zomato and Swiggy on one clean page. Guests do not have to hunt for anything."],
    ["Know your guests better", "See taps, reviews started and feedback in one dashboard, per outlet. Run offers and events your guests actually see."],
  ];
  const partners = ["Coffeekaart", "Green Feast", "The Tattoo Cafe & Lounge", "Jaipur Vista", "24 Society Salon & Wellness", "Chitra Katha", "NG Ayurveda"];
  return (
    <div className="dash min-h-dvh" data-mode="light">
      <main className="mx-auto max-w-2xl px-4 pt-10 pb-20">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: "var(--d-muted)" }}>Taprizz Mini Link</p>
        <h1 className="mt-2 text-[34px] leading-tight font-semibold tracking-[-0.03em]">Your link is the front door. Make it work harder.</h1>
        <p className="mt-2" style={{ color: "var(--d-muted)" }}>Start free. Go Premium once, for Rs {price}, when you want videos, offers and more. And when you are ready for more reviews and happier guests, Taprizz does that too.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <section className="d-card p-5"><h2 className="font-semibold">Free</h2><p className="text-sm" style={{ color: "var(--d-muted)" }}>Rs 0</p><ul className="mt-3 space-y-2 text-sm">{FREE_PERKS.map((p) => <li key={p} className="flex gap-2"><span aria-hidden>✓</span>{p}</li>)}</ul></section>
          <section className="d-card p-5" style={{ boxShadow: "inset 0 0 0 2px var(--d-green)" }}><h2 className="font-semibold">Premium</h2><p className="text-sm" style={{ color: "var(--d-muted)" }}>Rs {price}, once. No monthly fee.</p><ul className="mt-3 space-y-2 text-sm">{PREMIUM_PERKS.map((p) => <li key={p} className="flex gap-2"><span aria-hidden>✓</span>{p}</li>)}</ul></section>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="d-btn d-btn-p" href="/create">Create my free page</a>
          <span className="self-center text-sm" style={{ color: "var(--d-muted)" }}>Upgrade anytime from your editor.</span>
        </div>

        <h2 className="mt-12 text-2xl font-semibold tracking-[-0.02em]">More than a link</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>The same Taprizz that built your page also runs the guest experience for cafes across Jaipur.</p>
        <div className="mt-4 space-y-3">
          {more.map(([t, d]) => <section key={t} className="d-card p-5"><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--d-sub)" }}>{d}</p></section>)}
        </div>

        <section className="d-card mt-4 p-5">
          <h3 className="font-semibold">What we have already seen</h3>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--d-sub)" }}>At Jaipur Vistas Cafe, 240 guests started a review in 20 days, and 73 took it to Google (counts from our own system). Tourists who tried it have recommended it.</p>
          <p className="mt-3 text-xs" style={{ color: "var(--d-muted)" }}>Working with Taprizz in Jaipur: {partners.join(", ")}.</p>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          <a className="d-btn d-btn-p" href="https://wa.me/919672999166?text=Hi%20Taprizz%2C%20I%20want%20to%20know%20more%20about%20reviews%20and%20guest%20experience%20for%20my%20business." target="_blank" rel="noopener">Talk to us on WhatsApp</a>
          <a className="d-btn d-btn-s" href="/create">Create my free page</a>
        </div>
      </main>
    </div>
  );
}
