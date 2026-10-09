import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Toonify",
    short_name: "Toonify",
    description: "A fast, mobile-first manhwa reader.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d12",
    theme_color: "#0d0d12",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
