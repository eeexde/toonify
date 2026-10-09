"use client";
export function ConfirmDialog(p: {
  open: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  if (!p.open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl">
        <h2 id="confirm-title" className="text-lg font-semibold">{p.title}</h2>
        <p className="mt-2 text-sm text-muted">{p.body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={p.onCancel} className="min-h-11 rounded-full px-4 text-sm">Cancel</button>
          <button onClick={p.onConfirm} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">{p.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
