import Link from "next/link";
import { Mark } from "@/components/dash/AuthFrame";

// The home page of the site. Guests never land here (they come through a plate or a mini link), so it only offers sign in.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-6 text-center" style={{ background: "#0f0f10", color: "#f2f2f2", maxWidth: "none" }}>
      <Mark size={72} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Taprizz</h1>
        <p className="mt-2 max-w-xs text-[15px]" style={{ color: "#9b9b9f" }}>One tap turns every guest into a review, a lead or a fix.</p>
      </div>
      <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-8 text-[15px] font-semibold text-black">Sign in</Link>
    </main>
  );
}
