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
      // Every page except the two below. A header set by two matching rules is not overridden by the later one, so those two get their own full lists.
      { source: "/:path((?!l/|edit/).*)", headers },
      // Admin and dashboard pages are never stored by a browser or a shared cache.
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/dashboard/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/group/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      // The editor shows a live preview of the mini link in a frame on the same site. Nobody else may frame it.
      { source: "/l/:path*", headers: headers.map((h) => (h.key === "X-Frame-Options" ? { ...h, value: "SAMEORIGIN" } : h)) },
      // The private control link is never stored and never leaked through a referrer.
      { source: "/edit/:path*", headers: [...headers.filter((h) => h.key !== "Referrer-Policy"), { key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
