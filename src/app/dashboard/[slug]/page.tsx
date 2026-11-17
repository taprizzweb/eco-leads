import Link from "next/link";
import { MessageSquareWarning, Lightbulb, ChevronRight, Plus, PencilLine, CheckCircle2 } from "lucide-react";
import { loadClient, timeAgo } from "@/lib/dash";
import { TapsPeakCard, type PeriodSeries } from "@/components/dash/TapsPeakCard";
import { QrButton } from "@/components/dash/QrButton";

const TZ = "Asia/Kolkata";
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

// Builds Weekly / Monthly / Yearly series (and the period before, for the trend) from daily counts.
function buildSeries(rows: { day: string; taps: number }[]): Record<"Weekly" | "Monthly" | "Yearly", PeriodSeries> {
  const byDay = new Map(rows.map((r) => [r.day, r.taps]));
  const dayAt = (ago: number) => new Date(Date.now() - ago * 864e5);
  const count = (ago: number) => byDay.get(ymd(dayAt(ago))) ?? 0;
  const span = (from: number, to: number) => { let n = 0; for (let a = from; a < to; a++) n += count(a); return n; };
  const daily = (n: number, label: Intl.DateTimeFormatOptions) => {
    const data: number[] = [], labels: string[] = [];
    for (let a = n - 1; a >= 0; a--) { data.push(count(a)); labels.push(dayAt(a).toLocaleDateString("en-IN", { ...label, timeZone: TZ })); }
    return { data, labels };
  };
  const months: { key: string; label: string }[] = [];
  const [y, m] = ymd(new Date()).split("-").map(Number);
  for (let i = 23; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }) });
  }
  const perMonth = new Map<string, number>();
  for (const r of rows) perMonth.set(r.day.slice(0, 7), (perMonth.get(r.day.slice(0, 7)) ?? 0) + r.taps);
  const last12 = months.slice(12), prev12 = months.slice(0, 12);
  const w = daily(7, { weekday: "short", day: "numeric" });
  const mo = daily(30, { day: "numeric", month: "short" });
  const yearData = last12.map((x) => perMonth.get(x.key) ?? 0);
  return {
    Weekly: { ...w, total: span(0, 7), prev: span(7, 14), vs: "the week before" },
    Monthly: { ...mo, total: span(0, 30), prev: span(30, 60), vs: "the 30 days before" },
    Yearly: { data: yearData, labels: last12.map((x) => x.label), total: yearData.reduce((a, b) => a + b, 0), prev: prev12.reduce((a, x) => a + (perMonth.get(x.key) ?? 0), 0), vs: "the year before" },
  };
}

function monthStartIST(): string {
  const [y, m] = ymd(new Date()).split("-");
  return new Date(`${y}-${m}-01T00:00:00+05:30`).toISOString();
}

export default async function Home({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client } = await loadClient(slug);
  const since = monthStartIST();
  const cid = client.id;
  const head = { count: "exact" as const, head: true };

  const [reviews, taps, contacts, open, attention, week, plates] = await Promise.all([
    sb.from("review_drafts").select("id", head).eq("client_id", cid).eq("copied", true).gte("created_at", since),
    sb.from("taps").select("id", head).eq("client_id", cid).gte("created_at", since),
    sb.from("contacts").select("id", head).eq("client_id", cid).gte("created_at", since),
    sb.from("feedback").select("id", head).eq("client_id", cid).eq("kind", "complaint").neq("status", "resolved"),
    sb.from("feedback").select("id, kind, body, plate_code, created_at").eq("client_id", cid).eq("status", "new").order("created_at", { ascending: false }).limit(5),
    sb.rpc("client_tap_days", { p_client: cid, p_days: 760 }),
    sb.from("plates").select("code, label").eq("client_id", cid).eq("active", true),
  ]);

  const plateLabel = Object.fromEntries((plates.data ?? []).map((p) => [p.code, p.label ?? p.code]));
  const series = buildSeries((week.data ?? []) as { day: string; taps: number }[]);
  const updated = `Updated ${new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ })}`;

  const stats = [
    { label: "Reviews sent to Google", value: reviews.count ?? 0, tone: "var(--d-blue)" },
    { label: "Taps", value: taps.count ?? 0, tone: "var(--d-green)" },
    { label: "Contacts collected", value: contacts.count ?? 0, tone: "var(--d-amber)" },
    { label: "Open complaints", value: open.count ?? 0, tone: "var(--d-red)" },
  ];
  const month = new Date().toLocaleDateString("en-IN", { month: "long", timeZone: TZ });
  const base = process.env.NEXT_PUBLIC_PLATE_BASE_URL || "https://taprizz.in";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Good to see you</h1>
          <p className="mt-1" style={{ color: "var(--d-muted)" }}>Here is {month} so far at {client.name}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/${slug}/my-page#offers`} className="d-btn d-btn-p"><Plus size={16} /> Add offer</Link>
          <Link href={`/dashboard/${slug}/my-page`} className="d-btn d-btn-s"><PencilLine size={16} /> Edit page</Link>
          <QrButton plates={plates.data ?? []} base={base} />
        </div>
      </div>

      <section aria-label={`${month} numbers`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="d-card p-4">
            <p className="d-col-h text-[13px] font-medium" style={{ ["--c" as string]: s.tone, color: "var(--d-muted)" }}>{s.label}</p>
            <p className="mt-3 text-[34px] leading-none font-semibold tabular-nums tracking-[-0.04em]" style={{ color: "var(--d-text)" }}>{s.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="d-card p-5 lg:col-span-3" aria-labelledby="attn">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="attn" className="font-semibold">Needs your attention</h2>
            <Link href={`/dashboard/${slug}/inbox`} className="flex min-h-11 items-center gap-1 text-sm" style={{ color: "var(--d-muted)" }}>Open inbox <ChevronRight size={14} /></Link>
          </div>
          {attention.data?.length ? (
            <ul className="space-y-2">
              {attention.data.map((f) => {
                const complaint = f.kind === "complaint";
                const late = Date.now() - new Date(f.created_at).getTime() > 864e5;
                return (
                  <li key={f.id}>
                    <Link href={`/dashboard/${slug}/inbox?open=${f.id}`} className="d-raise flex items-center gap-3 p-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${complaint ? "var(--d-red)" : "var(--d-amber)"} 16%, transparent)`, color: complaint ? "var(--d-red)" : "var(--d-amber)" }}>
                        {complaint ? <MessageSquareWarning size={17} /> : <Lightbulb size={17} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px]" style={{ color: "var(--d-text)" }}>{f.body}</span>
                        <span className="text-xs" style={{ color: late ? "var(--d-red)" : "var(--d-muted)" }}>
                          {complaint ? "Complaint" : "Suggestion"}{f.plate_code ? ` · ${plateLabel[f.plate_code] ?? f.plate_code}` : ""} · {timeAgo(f.created_at)}
                        </span>
                      </span>
                      <ChevronRight size={16} style={{ color: "var(--d-muted)" }} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 size={28} style={{ color: "var(--d-green)" }} />
              <p className="mt-3 font-medium" style={{ color: "var(--d-text)" }}>You are all caught up</p>
              <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>New complaints and suggestions will show up here.</p>
            </div>
          )}
        </section>
        <section aria-label="Taps over time" className="lg:col-span-2">
          <TapsPeakCard series={series} updated={updated} />
        </section>
      </div>
    </div>
  );
}
