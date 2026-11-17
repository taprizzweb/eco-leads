import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { DEVICE_COOKIE, DEVICE_DAYS } from "@/lib/security";

// Remembers this browser for 30 days after a successful code check, so no new WhatsApp code
// is needed on the next sign-in from here. The token sits in an httpOnly cookie.
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const ua = req.headers.get("user-agent") ?? "";
  const label = /iPhone|iPad/.test(ua) ? "iPhone / iPad" : /Android/.test(ua) ? "Android phone" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : "Browser";
  const { data, error } = await sb.rpc("device_trust_create", { p_label: label });
  if (error || !data) return NextResponse.json({ ok: false }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEVICE_COOKIE, data as string, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_DAYS * 24 * 3600,
  });
  return res;
}
