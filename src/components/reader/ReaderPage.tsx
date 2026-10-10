"use client";
import { useState } from "react";

export function ReaderPage({ src, index, eager }: { src: string; index: number; eager: boolean }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const url = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;
  return (
    <div data-page-index={index} className={state === "ok" ? "" : "relative aspect-[2/3] w-full bg-neutral-950"}>
      {state !== "error" && (
        <img
          key={url}
          src={url}
          alt={`Page ${index + 1}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={state === "ok" ? "block w-full select-none" : "absolute inset-0 h-full w-full opacity-0"}
          draggable={false}
        />
      )}
      {state === "loading" && (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-neutral-700">
          {index + 1}
        </span>
      )}
      {state === "error" && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-neutral-300">
          <p>Page {index + 1} failed to load.</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAttempt((a) => a + 1);
              setState("loading");
            }}
            className="press min-h-11 rounded-full bg-[var(--accent)] px-6 font-bold text-[var(--accent-fg)]"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
