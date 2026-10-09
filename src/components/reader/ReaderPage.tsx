"use client";
import { useState } from "react";

export function ReaderPage({ src, index, eager }: { src: string; index: number; eager: boolean }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const url = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;
  return (
    <div data-page-index={index} className={state === "ok" ? "" : "relative aspect-[2/3] w-full bg-card"}>
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
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted">
          <p>Page {index + 1} failed to load.</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAttempt((a) => a + 1);
              setState("loading");
            }}
            className="rounded-full bg-accent px-4 py-2 font-semibold text-accent-fg"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
