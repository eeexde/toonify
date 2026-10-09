import { NextResponse } from "next/server";
import type { CachedResult, CachePolicy } from "../cache/cached";
import { InvalidIdError, NotFoundError } from "../source/errors";

export function jsonResult<T>(r: CachedResult<T>, policy: CachePolicy): Response {
  const cc = r.stale
    ? "public, s-maxage=60"
    : policy.stale > 0
      ? `public, s-maxage=${policy.fresh}, stale-while-revalidate=${policy.stale}`
      : `public, s-maxage=${policy.fresh}`;
  return NextResponse.json({ data: r.value, stale: r.stale }, { headers: { "Cache-Control": cc } });
}

export function badRequest(message: string): Response {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (err instanceof InvalidIdError) return badRequest(err.message);
  console.error("[api] upstream failure", err);
  return NextResponse.json({ error: "Source unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
}

export function parsePage(v: string | null): number | null {
  if (v === null) return 1;
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= 1000 ? n : null;
}
