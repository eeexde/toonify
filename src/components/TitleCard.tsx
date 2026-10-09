import Link from "next/link";
import type { TitleSummary } from "@/lib/source/types";

export const titleHref = (id: string) => `/title/${encodeURIComponent(id)}`;
export const readHref = (titleId: string, chapterId: string) =>
  `/read/${encodeURIComponent(titleId)}/${encodeURIComponent(chapterId)}`;

export function TitleCard({ item, dot, href, subtitle }: { item: TitleSummary; dot?: boolean; href?: string; subtitle?: string }) {
  return (
    <Link href={href ?? titleHref(item.id)} className="group block" data-testid="title-card">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-card">
        <img src={item.cover} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        {item.badge && (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">{item.badge}</span>
        )}
        {dot && <span aria-label="New chapters" className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-bg" />}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{item.title}</p>
      {(subtitle ?? item.latest?.[0]?.label) && <p className="truncate text-xs text-muted">{subtitle ?? item.latest?.[0]?.label}</p>}
    </Link>
  );
}
