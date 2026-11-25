import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms, refund and privacy | Taprizz Mini Link" };

export default function MiniTerms() {
  const items: [string, string[]][] = [
    ["What you get", ["Free: a live mini link with your template and colours, preset links, 1 extra link, your outlets and 3 photos. No videos, offers or scrolling keywords line. A free page is not offered to Google search.", "Premium: one payment of Rs 150 per page, with no monthly fee. It adds videos (2), up to 10 photos, offers, the keywords line, 6 extra links, and lets your page show up in Google search. Premium lasts for as long as Taprizz runs Mini Links. If we ever close it, we will tell you at least 30 days before and help you move."]]
    , ["Payment and refund", ["You pay by UPI and send the transaction ID and a screenshot. We match the payment with our bank before Premium opens. This is done by hand, so it can take a few hours.", "If we cannot unlock Premium, or we remove your page for a reason that is not your fault, we refund the Rs 150. Ask on WhatsApp +91 96729 99166 within 7 days."]]
    , ["Your page and what is allowed", ["You are responsible for what you put on your page. Do not post anything illegal, scam or phishing, adult, hateful, or that pretends to be another person or business.", "Anyone can report a page. We may switch off a page that breaks these rules, and we do not refund if the page was misused."]]
    , ["Privacy: what we keep", ["We keep your name, mobile number, email (if you gave it), the content of your page, and your payment screenshot and transaction ID. Only the Taprizz team can see your details.", "If you ticked the marketing box, we may message you about your page and new Taprizz offers. You can say stop anytime. We never sell your details.", "Visitors to your page are not tracked by name. We count visits and taps on buttons, with no personal details.", "To see or delete your details, message us on WhatsApp. Deleting them takes your page offline."]]
    , ["Your control link", ["Your editor is a private link. Anyone who has it can change your page, so keep it safe. If you lose it, message us on WhatsApp from the number you signed up with."]],
  ];
  return (
    <div className="dash min-h-dvh" data-mode="light">
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Terms, refund and privacy</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>Taprizz Mini Link, Jaipur. In plain words.</p>
        {items.map(([h, ps]) => (
          <section key={h} className="mt-6">
            <h2 className="font-semibold">{h}</h2>
            {ps.map((p) => <p key={p} className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--d-sub)" }}>{p}</p>)}
          </section>
        ))}
      </main>
    </div>
  );
}
