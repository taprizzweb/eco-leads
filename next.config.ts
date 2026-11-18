import type { NextConfig } from "next";

// Browser-side protections on every page. Camera and location stay off; the microphone is allowed only for guests recording a voice note.
const headers = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
