import Link from "next/link";
import type { TitleSummary } from "@/lib/source/types";

export const titleHref = (id: string) => `/title/${encodeURIComponent(id)}`;
export const readHref = (titleId: string, chapterId: string) =>
  `/read/${encodeURIComponent(titleId)}/${encodeURIComponent(chapterId)}`;

export function TitleCard({ item, dot, href, subtitle }: { item: TitleSummary; dot?: boolean; href?: string; subtitle?: string }) {
  const sub = subtitle ?? item.latest?.[0]?.label;
  return (
    <Link href={href ?? titleHref(item.id)} className="press group block rounded-cover" data-testid="title-card">
      <div className="relative aspect-[2/3] overflow-hidden rounded-cover bg-surface-2 shadow-card">
        <img
          src={item.cover}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.04]"
        />
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-cover ring-1 ring-inset ring-white/10" />
        {item.badge && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white backdrop-blur-sm">
            {item.badge}
          </span>
        )}
        {dot && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-fg shadow-glow">
            <span className="sr-only">New chapters</span>
            <span aria-hidden>New</span>
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug sm:text-sm">{item.title}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>}
    </Link>
  );
}
