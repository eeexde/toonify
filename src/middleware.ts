import { NextResponse, type NextRequest } from "next/server";
import { checkLimit, clientKey, MemoryCounter, UpstashCounter, type WindowCounter } from "@/lib/client-limit";

let counter: WindowCounter | undefined;

function getCounter(): WindowCounter {
  if (!counter) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    counter = url && token ? new UpstashCounter(url, token) : new MemoryCounter();
  }
  return counter;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path === "/api/health") return NextResponse.next();
  const bucket = path.startsWith("/api/img/") ? "img" : "api";
  const r = await checkLimit(getCounter(), bucket, clientKey(req.headers));
  if (r.ok) return NextResponse.next();
  // Headers only on refusals: successful responses are CDN-cached and would freeze stale counts.
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: { "Retry-After": String(r.resetSec), "RateLimit-Limit": String(r.limit), "RateLimit-Remaining": "0", "Cache-Control": "no-store" },
    },
  );
}

export const config = { matcher: "/api/:path*" };
