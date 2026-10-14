"use client";
import { KINDS, type Kind } from "@/lib/source/filters";

const LABEL: Record<Kind, string> = { manga: "Manga", manhwa: "Manhwa" };

/** Segmented switch between the manga and manhwa catalogs. */
export function KindToggle({ kind, onChange }: { kind: Kind; onChange: (k: Kind) => void }) {
  return (
    <div role="group" aria-label="Catalog" className="mb-5 inline-flex rounded-full border border-line bg-card p-1">
      {KINDS.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={kind === k}
          onClick={() => kind !== k && onChange(k)}
          className={`press min-h-9 rounded-full px-4 text-[13px] font-bold ${kind === k ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}
        >
          {LABEL[k]}
        </button>
      ))}
    </div>
  );
}
