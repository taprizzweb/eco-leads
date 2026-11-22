import type { NextConfig } from "next";

// Browser-side protections on every page. Camera and location stay off; the microphone is allowed only for guests recording a voice note.
const headers = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(self), microphone=(self), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

// Mini links live on their own host. Today: link-taprizz.vercel.app/<name>. After the domain is bought: links.tapres.in/<name> (any host starting with link. or links. works).
// On those hosts a one-word path is a mini link name; the same page also still opens at /l/<name> on every host.
const LINK_HOSTS = ["links?\\..+", "link-taprizz\\.vercel\\.app"];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return {
      beforeFiles: LINK_HOSTS.map((value) => ({ source: "/:slug([a-z0-9-]{2,40})", has: [{ type: "host" as const, value }], destination: "/l/:slug" })),
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      { source: "/:path*", headers },
      // Admin and dashboard pages are never stored by a browser or a shared cache.
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/dashboard/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/group/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
