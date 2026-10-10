import Link from "next/link";
import type { Chapter } from "@/lib/source/types";
import { Icon } from "@/components/icons";
import { readHref, titleHref } from "@/components/TitleCard";

export function EndCard({ titleId, current, next }: { titleId: string; current?: Chapter; next?: Chapter }) {
  return (
    <section aria-label="End of chapter" className="mx-auto max-w-md px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-14 text-center text-white">
      <p className="display text-[2.5rem] text-white">End of {current?.name ?? "chapter"}</p>
      {current?.group && (
        <p className="mt-2 text-sm text-neutral-400">
          Scanlated by <span className="font-semibold text-neutral-200">{current.group}</span>
          {titleId.startsWith("md:") ? " · via MangaDex" : ""}
        </p>
      )}
      {next ? (
        <Link
          href={readHref(titleId, next.id)}
          className="press mt-7 flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-base font-bold text-[var(--accent-fg)] shadow-[0_10px_40px_-10px_var(--accent)]"
        >
          Next: {next.name}
          <Icon name="forward" className="h-5 w-5" strokeWidth={2.4} />
        </Link>
      ) : (
        <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 px-5 py-6">
          <p className="text-lg font-bold text-white">You&apos;re caught up.</p>
          <p className="mt-1 text-sm text-neutral-400">New chapters will show up on the title page and in your library.</p>
        </div>
      )}
      <Link
        href={titleHref(titleId)}
        className={`press mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-5 text-sm font-semibold hover:text-white ${next ? "text-neutral-300" : "mt-5 border border-white/20 text-white"}`}
      >
        <Icon name="back" className="h-4 w-4" />
        Back to title
      </Link>
    </section>
  );
}
