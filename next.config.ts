import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const isDev = process.env.NODE_ENV === "development";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // The navigation fallback can only serve /~offline if it is precached.
  additionalPrecacheEntries: [{ url: "/~offline", revision: crypto.randomUUID() }],
  disable: isDev,
});

// MangaDex images go through /api/img; ScraperGo covers and pages are hotlinked, so it needs https: images.
const imgSrc = ["'self'", "data:", "blob:", ...(process.env.SOURCE_SCRAPERGO === "1" ? ["https:"] : [])];

const csp = [
  "default-src 'self'",
  // Next.js inlines its hydration scripts; nonces would force every page to render dynamically.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src ${imgSrc.join(" ")}`,
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.*.*", "100.*.*.*", "**.ts.net"],
  // A stray lockfile in a parent folder otherwise makes Next.js guess the wrong workspace root.
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSerwist(nextConfig);
