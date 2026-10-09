"use client";
import { useStale } from "@/lib/query/stale-store";

export function StaleBanner() {
  const stale = useStale();
  if (!stale) return null;
  return (
    <div role="status" className="bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-300">
      Source unavailable — showing cached data.
    </div>
  );
}
