import type { MetadataRoute } from "next";

// Makes Taprizz installable like an app on a phone (Android, iPhone) and on a laptop (Chrome, Edge).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Taprizz",
    short_name: "Taprizz",
    description: "Taprizz admin and dashboard: reviews, offers, mini links and customers in one place.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0f0f10",
    theme_color: "#0f0f10",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Clients", short_name: "Clients", url: "/admin/clients", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Tools", short_name: "Tools", url: "/admin/tools", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Alerts", short_name: "Alerts", url: "/admin/alerts", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
