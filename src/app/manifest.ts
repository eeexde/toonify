import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Toonify",
    short_name: "Toonify",
    description: "A fast, mobile-first manhwa & manga reader.",
    start_url: "/",
    display: "standalone",
    background_color: "#15121b",
    theme_color: "#15121b",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
