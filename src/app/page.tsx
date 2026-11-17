import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold">Taprizz</h1>
      <p className="text-muted">One tap turns every guest into a review, a lead or a fix.</p>
      <Link href="/e/demo1" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 font-semibold text-white">
        Open the demo guest page
      </Link>
    </main>
  );
}
