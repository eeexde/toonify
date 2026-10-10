import type { ReactNode } from "react";

export function TitleGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 md:gap-x-5 lg:grid-cols-6">{children}</div>;
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading titles">
      <TitleGrid>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} aria-hidden>
            <div className="skeleton aspect-[2/3] rounded-cover" />
            <div className="skeleton mt-2.5 h-3 w-4/5 rounded-full" />
            <div className="skeleton mt-1.5 h-2.5 w-1/2 rounded-full" />
          </div>
        ))}
      </TitleGrid>
    </div>
  );
}
