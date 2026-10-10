"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Chapter } from "@/lib/source/types";
import { readHref, titleHref } from "@/components/TitleCard";
import { Dropdown } from "@/components/Dropdown";
import { Icon } from "@/components/icons";

const navBtn =
  "press flex h-11 shrink-0 items-center gap-1 rounded-full px-3.5 text-sm font-bold text-fg hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-35";

export function ReaderOverlay(p: {
  visible: boolean;
  progress: number;
  titleId: string;
  title: string;
  chapterId: string;
  chapters: Chapter[];
  prev?: Chapter;
  next?: Chapter;
}) {
  const router = useRouter();
  const current = p.chapters.find((c) => c.id === p.chapterId);
  const pct = Math.round(p.progress * 100);
  // Enter eases out over 220ms; leaving is quicker so the strip is never waiting on chrome.
  const motion = p.visible
    ? "opacity-100 translate-y-0 duration-[220ms]"
    : "pointer-events-none opacity-0 duration-150";
  return (
    <>
      <div
        role="progressbar"
        aria-label="Chapter progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] bg-white/10"
      >
        <div
          className="h-full origin-left bg-accent shadow-[0_0_10px_var(--accent)] transition-transform duration-150 ease-linear"
          style={{ transform: `scaleX(${p.progress})` }}
        />
      </div>

      <div
        className={`fixed inset-x-0 top-0 z-40 border-b border-line bg-chrome pt-[env(safe-area-inset-top)] backdrop-blur-xl transition ease-out-soft ${motion} ${
          p.visible ? "" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-2 py-1.5">
          <Link
            href={titleHref(p.titleId)}
            aria-label="Back to title"
            className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg hover:bg-surface-2"
          >
            <Icon name="back" className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight">{p.title}</p>
            <p className="truncate text-[13px] text-muted">{current?.name ?? ""}</p>
          </div>
          <span className="shrink-0 px-3 text-sm font-bold tabular-nums text-accent-text" aria-hidden>
            {pct}%
          </span>
        </div>
      </div>

      <div
        className={`fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition ease-out-soft ${motion} ${
          p.visible ? "" : "translate-y-[calc(100%+1rem)]"
        }`}
      >
        <div className="mx-auto flex max-w-xl items-center gap-1 rounded-full border border-line bg-chrome p-1 shadow-card backdrop-blur-xl">
          <button disabled={!p.prev} onClick={() => p.prev && router.push(readHref(p.titleId, p.prev.id))} className={navBtn}>
            ‹ Prev
          </button>
          <Dropdown
            label="Chapter"
            value={p.chapterId}
            options={p.chapters.filter((c) => !c.externalUrl).map((c) => ({ value: c.id, label: c.name, hint: c.group }))}
            onChange={(id) => router.push(readHref(p.titleId, id))}
            align="center"
            className="min-w-0 flex-1"
            triggerClassName="h-11 rounded-full bg-surface-2 pl-4 pr-3 text-center text-sm font-semibold text-fg"
            renderValue={(o) => (o ? (o.hint ? `${o.label} (${o.hint})` : o.label) : "")}
          />
          <button disabled={!p.next} onClick={() => p.next && router.push(readHref(p.titleId, p.next.id))} className={navBtn}>
            Next ›
          </button>
        </div>
      </div>
    </>
  );
}
