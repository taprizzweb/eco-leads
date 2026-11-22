import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEVICE_COOKIE } from "@/lib/security";

// Refreshes the Supabase session cookie and guards the dashboard:
// signed in -> verified (WhatsApp code, trusted device, or authenticator app).
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await sb.auth.getUser();
  const path = req.nextUrl.pathname;
  const redirect = (to: string) => {
    const url = req.nextUrl.clone();
    url.pathname = to;
    url.search = to === "/login" ? `?next=${encodeURIComponent(path)}` : "";
    const r = NextResponse.redirect(url);
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (path.startsWith("/dashboard") || path.startsWith("/admin") || path.startsWith("/group") || path.startsWith("/pos")) {
    if (!user) return redirect("/login");
    // Verified = authenticator (aal2), a WhatsApp code this session, or a trusted device.
    const { data: verified } = await sb.rpc("has_aal2");
    if (!verified) {
      const device = req.cookies.get(DEVICE_COOKIE)?.value;
      const trusted = device ? (await sb.rpc("device_trust_check", { p_token: device })).data : false;
      if (!trusted) {
        const url = req.nextUrl.clone();
        url.pathname = "/login/mfa";
        url.search = `?next=${encodeURIComponent(path)}`;
        const r = NextResponse.redirect(url);
        res.cookies.getAll().forEach((c) => r.cookies.set(c));
        return r;
      }
    }
  }
  if ((path === "/login/mfa" || path === "/auth/reset") && !user) return redirect("/login");
  return res;
}

export const config = { matcher: ["/dashboard/:path*", "/group/:path*", "/pos/:path*", "/admin/:path*", "/admin", "/login/:path*", "/login", "/auth/reset"] };
