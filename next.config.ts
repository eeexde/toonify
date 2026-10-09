import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // The navigation fallback can only serve /~offline if it is precached.
  additionalPrecacheEntries: [{ url: "/~offline", revision: crypto.randomUUID() }],
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.*.*", "100.*.*.*", "**.ts.net"],
};

export default withSerwist(nextConfig);
