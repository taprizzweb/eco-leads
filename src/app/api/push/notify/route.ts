import { NextResponse } from "next/server";
import * as webpushNs from "web-push";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

// web-push is a CommonJS package: depending on how the bundler loads it, its functions are on the module or on its default export.
const webpush: typeof webpushNs = (webpushNs as unknown as { default?: typeof webpushNs }).default ?? webpushNs;

export const runtime = "nodejs";
export const maxDuration = 20;

// The database calls this the moment a guest orders, asks for the waiter or writes a chat message.
// Only the database knows the server key, so nobody else can send alerts to a business's staff.
const Body = z.object({ client_id: z.string().uuid(), kind: z.enum(["order", "request", "chat"]), title: z.string().max(160), body: z.string().max(300).default(""), url: z.string().max(200).startsWith("/") });
const WHO: Record<string, string[]> = { order: ["owner", "manager", "reception", "waiter", "kitchen"], request: ["owner", "manager", "reception", "waiter"], chat: ["owner", "manager", "reception"] };

export async function POST(req: Request) {
  const key = process.env.REVIEW_SERVER_KEY;
  if (!key || req.headers.get("x-notify-key") !== key) return NextResponse.json({ error: "no" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad" }, { status: 400 });
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return NextResponse.json({ sent: 0, note: "push is not set up" });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://app.taprizz.in", pub, priv);

  const b = parsed.data;
  const sb = await supabaseServer();
  const { data } = await sb.rpc("push_targets", { p_client: b.client_id, p_key: key });
  const targets = ((data ?? []) as { endpoint: string; p256dh: string; auth: string; role: string }[]).filter((t) => WHO[b.kind].includes(t.role));
  const payload = JSON.stringify({ title: b.title, body: b.body, url: b.url, tag: `${b.kind}-${b.client_id}`, kind: b.kind });
  let sent = 0;
  await Promise.all(targets.map(async (t) => {
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 120, urgency: "high" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.rpc("push_drop", { p_endpoint: t.endpoint, p_key: key });   // the phone removed the app or the permission
    }
  }));
  return NextResponse.json({ sent, of: targets.length });
}
