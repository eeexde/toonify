"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Chapter } from "@/lib/source/types";
import { readHref, titleHref } from "@/components/TitleCard";

export function ReaderOverlay(p: {
  visible: boolean;
  titleId: string;
  title: string;
  chapterId: string;
  chapters: Chapter[];
  prev?: Chapter;
  next?: Chapter;
}) {
  const router = useRouter();
  const current = p.chapters.find((c) => c.id === p.chapterId);
  const hide = p.visible ? "translate-y-0 opacity-100" : "pointer-events-none opacity-0";
  return (
    <>
      <div className={`fixed inset-x-0 top-0 z-40 bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur transition ${hide} ${p.visible ? "" : "-translate-y-full"}`}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-3 py-2">
          <Link href={titleHref(p.titleId)} aria-label="Back to title" className="flex h-11 w-11 items-center justify-center text-xl">←</Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{p.title}</p>
            <p className="truncate text-xs text-muted">{current?.name ?? ""}</p>
          </div>
        </div>
      </div>
      <div className={`fixed inset-x-0 bottom-0 z-40 bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition ${hide} ${p.visible ? "" : "translate-y-full"}`}>
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <button
            disabled={!p.prev}
            onClick={() => p.prev && router.push(readHref(p.titleId, p.prev.id))}
            className="h-11 rounded-full px-4 text-sm disabled:opacity-30"
          >
            ‹ Prev
          </button>
          <select
            aria-label="Chapter"
            value={p.chapterId}
            onChange={(e) => router.push(readHref(p.titleId, e.target.value))}
            className="h-11 min-w-0 flex-1 rounded-full border border-line bg-card px-3 text-sm"
          >
            {p.chapters.filter((c) => !c.externalUrl).map((c) => (
              <option key={c.id} value={c.id}>{c.group ? `${c.name} (${c.group})` : c.name}</option>
            ))}
          </select>
          <button
            disabled={!p.next}
            onClick={() => p.next && router.push(readHref(p.titleId, p.next.id))}
            className="h-11 rounded-full px-4 text-sm disabled:opacity-30"
          >
            Next ›
          </button>
        </div>
      </div>
    </>
  );
}
