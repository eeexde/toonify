import type { ReactNode } from "react";

export function TitleGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">{children}</div>;
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <TitleGrid>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[2/3] rounded-lg bg-card" />
          <div className="mt-2 h-3 w-3/4 rounded bg-card" />
        </div>
      ))}
    </TitleGrid>
  );
}
