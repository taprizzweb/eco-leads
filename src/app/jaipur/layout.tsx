import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { HUB_NAME, HUB_PATH } from "@/lib/hub";
import { HUB_ENABLED } from "@/lib/hub-shared";
import { Mark } from "@/components/dash/AuthFrame";

export const dynamic = "force-dynamic";
export const metadata = { title: HUB_NAME, description: "Gulabi Nagri: the best cafes, salons, gyms and hotels in Jaipur, ranked by real guests, with the offers running today." };

// A bold, confident face for the whole guide, so it reads as a real Jaipur app and not a plain web page.
const face = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-hub", display: "swap" });

export default function HubLayout({ children }: { children: React.ReactNode }) {
  if (!HUB_ENABLED) notFound();
  const words = HUB_NAME.split(" ");
  return (
    <div className={`dash hub ${face.variable} min-h-dvh`} data-mode="dark">
      <div className="hub-bg" aria-hidden />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-10">
        <header className="mb-6 flex items-center justify-between">
          <Link href={HUB_PATH} className="hub-mark text-[24px] leading-none font-extrabold tracking-[-0.045em]">
            {words.slice(0, -1).join(" ")} <span className="hub-grad">{words.slice(-1)}</span>
          </Link>
          <span className="hub-pill">Jaipur</span>
        </header>
        {children}
        <footer className="mt-10 flex items-center justify-center gap-2 text-xs font-semibold" style={{ color: "var(--d-muted)" }}>
          <Mark size={20} /> Powered by Taprizz
        </footer>
      </main>
    </div>
  );
}
