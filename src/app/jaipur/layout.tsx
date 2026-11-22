import Link from "next/link";
import { notFound } from "next/navigation";
import { HUB_NAME, HUB_PATH } from "@/lib/hub";
import { HUB_ENABLED } from "@/lib/hub-shared";
import { Mark } from "@/components/dash/AuthFrame";

export const dynamic = "force-dynamic";
export const metadata = { title: HUB_NAME, description: "Gulabi Nagar: Jaipur ke sabse acche cafes, salons, gyms aur hotels. Asli guests ki rating, aur aaj ki khaas offers." };

export default function HubLayout({ children }: { children: React.ReactNode }) {
  if (!HUB_ENABLED) notFound();
  return (
    <div className="dash min-h-dvh" data-mode="dark">
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-10">
        <header className="mb-5 flex items-center justify-between">
          <Link href={HUB_PATH} className="text-[19px] font-bold tracking-[-0.04em]" style={{ color: "var(--d-text)" }}>
            {HUB_NAME.split(" ").slice(0, -1).join(" ")} <span style={{ color: "var(--d-amber)" }}>{HUB_NAME.split(" ").slice(-1)}</span>
          </Link>
        </header>
        {children}
        <footer className="mt-10 flex items-center justify-center gap-2 text-xs" style={{ color: "var(--d-muted)" }}>
          <Mark size={20} /> Powered by Taprizz
        </footer>
      </main>
    </div>
  );
}
