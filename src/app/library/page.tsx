"use client";
import { useState } from "react";
import { useHistory, useLibrary } from "@/lib/db/hooks";
import { readHref, TitleCard } from "@/components/TitleCard";
import { TitleGrid } from "@/components/TitleGrid";

export default function LibraryPage() {
  const [tab, setTab] = useState<"library" | "history">("library");
  const library = useLibrary();
  const history = useHistory();

  return (
    <>
      <div role="tablist" className="mb-5 flex gap-2">
        {(["library", "history"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-10 rounded-full px-4 text-sm capitalize ${tab === t ? "bg-accent font-semibold text-accent-fg" : "border border-line text-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "library" ? (
        library?.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">Your library is empty. Add titles from their page.</p>
        ) : (
          <TitleGrid>
            {library?.map((l) => (
              <TitleCard
                key={l.titleId}
                item={{ id: l.titleId, title: l.title, cover: l.cover }}
                dot={!!l.latestChapterId && l.latestChapterId !== l.lastChapterSeenId}
              />
            ))}
          </TitleGrid>
        )
      ) : history?.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">Nothing read yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {history?.map((h) => (
            <li key={h.titleId}>
              <a href={readHref(h.titleId, h.chapterId)} className="flex items-center gap-3 py-2">
                <img src={h.cover} alt="" className="h-16 w-11 rounded object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{h.title}</p>
                  <p className="text-xs text-muted">{h.chapterName} · {new Date(h.readAt).toLocaleDateString()}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
