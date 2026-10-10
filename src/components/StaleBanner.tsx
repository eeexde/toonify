"use client";
import { useStale } from "@/lib/query/stale-store";
import { Icon } from "./icons";

export function StaleBanner() {
  const stale = useStale();
  if (!stale) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warn-bg px-4 py-2 text-center text-sm font-medium text-warn-fg">
      <Icon name="offline" className="h-4 w-4 shrink-0" />
      Source unavailable — showing cached data.
    </div>
  );
}
