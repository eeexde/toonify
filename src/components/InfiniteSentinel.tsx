"use client";
import { useEffect, useRef } from "react";

export function InfiniteSentinel({ onVisible, disabled }: { onVisible: () => void; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (disabled || !ref.current) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && onVisible(), { rootMargin: "800px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [onVisible, disabled]);
  return <div ref={ref} className="h-1" />;
}
