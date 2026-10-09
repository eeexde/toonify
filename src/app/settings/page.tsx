"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useSettings } from "@/lib/db/hooks";
import { setSetting } from "@/lib/db/actions";
import { db } from "@/lib/db/schema";
import { exportData, importData, ImportError } from "@/lib/db/backup";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/db/types";
import { useHealth } from "@/lib/query/hooks";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Footer } from "@/components/Footer";

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-line py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const s = useSettings() ?? DEFAULT_SETTINGS;
  const health = useHealth();
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleMature = () => {
    if (s.mature) void setSetting(db, "mature", false);
    else setConfirm(true);
  };

  const doExport = async () => {
    const data = await exportData(db);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `toonify-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (file: File) => {
    try {
      const r = await importData(db, JSON.parse(await file.text()));
      toast.success(`Imported ${r.library} library titles and ${r.history} history entries.`);
    } catch (e) {
      toast.error(e instanceof ImportError ? e.message : "This file is not a valid Toonify backup.");
    }
  };

  const clearImages = async () => {
    if ("caches" in window) await caches.delete("toonify-images");
    toast.success("Image cache cleared.");
  };

  const sources = Object.entries(health.data ?? {});

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 text-xl font-bold">Settings</h1>

      <Row label="Show 18+ content" hint="Adds mature titles to browse and search.">
        <button role="switch" aria-checked={s.mature} aria-label="Show 18+ content" onClick={toggleMature}
          className={`h-7 w-12 rounded-full p-0.5 transition ${s.mature ? "bg-accent" : "bg-line"}`}>
          <span className={`block h-6 w-6 rounded-full bg-white transition ${s.mature ? "translate-x-5" : ""}`} />
        </button>
      </Row>

      <Row label="Theme">
        <select aria-label="Theme" value={s.theme} onChange={(e) => setSetting(db, "theme", e.target.value as Settings["theme"])}
          className="h-10 rounded-lg border border-line bg-card px-3 text-sm">
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
      </Row>

      <Row label="Reader width" hint="Desktop only.">
        <select aria-label="Reader width" value={s.readerWidth} onChange={(e) => setSetting(db, "readerWidth", Number(e.target.value))}
          className="h-10 rounded-lg border border-line bg-card px-3 text-sm">
          {[600, 720, 900, 1200].map((w) => <option key={w} value={w}>{w}px</option>)}
        </select>
      </Row>

      {sources.length > 1 && (
        <Row label="Source">
          <select aria-label="Source" value={s.source} onChange={(e) => setSetting(db, "source", e.target.value as Settings["source"])}
            className="h-10 rounded-lg border border-line bg-card px-3 text-sm">
            {sources.map(([k, st]) => (
              <option key={k} value={k} disabled={st === "down" && k !== s.source}>
                {k === "md" ? "MangaDex" : k === "sg" ? "ScraperGo (Toonily)" : k}{st === "down" ? " — offline" : ""}
              </option>
            ))}
          </select>
        </Row>
      )}

      <Row label="Backup" hint="Library, history, progress and settings.">
        <div className="flex gap-2">
          <button onClick={doExport} className="h-10 rounded-full border border-line px-4 text-sm">Export</button>
          <button onClick={() => fileRef.current?.click()} className="h-10 rounded-full border border-line px-4 text-sm">Import</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="import-input"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ""; }} />
        </div>
      </Row>

      <Row label="Image cache" hint="Frees space used by offline images.">
        <button onClick={clearImages} className="h-10 rounded-full border border-line px-4 text-sm">Clear</button>
      </Row>

      <ConfirmDialog
        open={confirm}
        title="Show 18+ content?"
        body="Mature titles will appear in browse and search. Confirm you are 18 or older."
        confirmLabel="I am 18 or older"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          await setSetting(db, "mature", true);
          await setSetting(db, "matureConfirmedAt", Date.now());
          setConfirm(false);
        }}
      />
      <Footer />
    </div>
  );
}
