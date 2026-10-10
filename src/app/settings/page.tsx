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
import { Icon } from "@/components/icons";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="mb-6">
      <h2 className="mb-2 px-1 text-sm font-bold text-muted">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">{children}</div>
    </section>
  );
}

function Row({ label, children, hint, stack }: { label: string; children: React.ReactNode; hint?: string; stack?: boolean }) {
  return (
    <div className={`flex min-h-16 gap-3 px-4 py-3 ${stack ? "flex-col" : "items-center justify-between"}`}>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{label}</p>
        {hint && <p className="mt-0.5 text-[13px] leading-snug text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Segmented single choice with radio semantics and arrow-key movement. */
function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (idx + d + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className="grid w-full auto-cols-fr grid-flow-col rounded-full bg-surface-2 p-1">
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          className={`press min-h-11 rounded-full px-2 text-sm font-semibold ${
            o.value === value ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const btn = "press inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong/70 px-4 text-sm font-semibold hover:bg-surface-2";

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
      <h1 className="display mb-6 text-[2.25rem] md:text-[2.75rem]">Settings</h1>

      <Group title="Reading">
        <Row label="Theme" stack>
          <Segmented
            label="Theme"
            value={s.theme}
            onChange={(v) => setSetting(db, "theme", v)}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
              { value: "system", label: "System" },
            ] as { value: Settings["theme"]; label: string }[]}
          />
        </Row>
        <Row label="Reader width" hint="How wide pages appear on a desktop screen. Phones always read edge to edge." stack>
          <Segmented
            label="Reader width"
            value={s.readerWidth}
            onChange={(v) => setSetting(db, "readerWidth", v)}
            options={[600, 720, 900, 1200].map((w) => ({ value: w, label: `${w}px` }))}
          />
        </Row>
      </Group>

      <Group title="Content">
        <Row label="Show 18+ content" hint="Adds mature titles to browse and search.">
          <button role="switch" aria-checked={s.mature} aria-label="Show 18+ content" onClick={toggleMature}
            className="press flex h-11 w-16 shrink-0 items-center justify-center rounded-full">
            <span className={`flex h-8 w-[52px] items-center rounded-full p-1 transition-colors duration-200 ${s.mature ? "bg-accent" : "bg-surface-2 ring-1 ring-inset ring-line-strong"}`}>
              <span className={`block h-6 w-6 rounded-full shadow transition-transform duration-200 ease-out-soft ${s.mature ? "translate-x-5 bg-accent-fg" : "bg-muted"}`} />
            </span>
          </button>
        </Row>
        {sources.length > 1 && (
          <Row label="Source" hint="Where browse and search results come from.">
            <select aria-label="Source" value={s.source} onChange={(e) => setSetting(db, "source", e.target.value as Settings["source"])}
              className="h-11 max-w-[55%] rounded-xl border border-line-strong/70 bg-surface-2 px-3 text-sm font-semibold">
              {sources.map(([k, st]) => (
                <option key={k} value={k} disabled={st === "down" && k !== s.source}>
                  {k === "md" ? "MangaDex" : k === "sg" ? "ScraperGo (Toonily)" : k}{st === "down" ? " — offline" : ""}
                </option>
              ))}
            </select>
          </Row>
        )}
      </Group>

      <Group title="Your data">
        <Row label="Backup" hint="Library, history, progress and settings, as one JSON file." stack>
          <div className="flex gap-2">
            <button onClick={doExport} className={btn}><Icon name="download" className="h-4 w-4" />Export</button>
            <button onClick={() => fileRef.current?.click()} className={btn}><Icon name="upload" className="h-4 w-4" />Import</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="import-input"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ""; }} />
          </div>
        </Row>
        <Row label="Image cache" hint="Frees space used by offline images.">
          <button onClick={clearImages} className={btn}><Icon name="trash" className="h-4 w-4" />Clear</button>
        </Row>
      </Group>

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
