"use client";
import { useEffect, useRef } from "react";
import { buttonPrimary } from "./EmptyState";

export function ConfirmDialog(p: {
  open: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelCb = useRef(p.onCancel);
  cancelCb.current = p.onCancel;
  const { open } = p;

  // Focus the safe choice, close on Escape, keep Tab inside, restore focus on close.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelCb.current();
      if (e.key !== "Tab" || !panelRef.current) return;
      const els = panelRef.current.querySelectorAll<HTMLElement>("button");
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open]);

  if (!p.open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-[2px] motion-safe:animate-[fade_160ms_ease-out] sm:items-center"
      onClick={(e) => e.target === e.currentTarget && p.onCancel()}
    >
      <div
        ref={panelRef}
        className="w-full max-w-sm rounded-[22px] border border-line bg-card p-6 shadow-card motion-safe:animate-[rise_220ms_var(--ease-out-soft)]"
      >
        <div aria-hidden className="mx-auto -mt-2 mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
        <h2 id="confirm-title" className="display text-[2rem]">{p.title}</h2>
        <p id="confirm-body" className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} onClick={p.onCancel} className="press min-h-11 rounded-full px-5 text-sm font-semibold text-fg hover:bg-surface-2">
            Cancel
          </button>
          <button onClick={p.onConfirm} className={buttonPrimary}>{p.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
