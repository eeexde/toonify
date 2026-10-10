import { z } from "zod";
import { READER_MODES } from "../reader/mode";
import { isSourceKey } from "../source/ids";
import type { ToonifyDB } from "./schema";

const Library = z.object({
  titleId: z.string(), title: z.string(), cover: z.string(), addedAt: z.number(),
  lastChapterSeenId: z.string().optional(), latestChapterId: z.string().optional(),
});
const History = z.object({
  titleId: z.string(), title: z.string(), cover: z.string(), chapterId: z.string(), chapterName: z.string(), readAt: z.number(),
});
const Progress = z.object({
  titleId: z.string(), chapterId: z.string(), pageIndex: z.number().int().min(0), scrollRatio: z.number().min(0).max(1), completed: z.boolean(), updatedAt: z.number(),
});
const TitlePref = z.object({ titleId: z.string(), mode: z.enum(READER_MODES) });
const Setting = z.discriminatedUnion("key", [
  z.object({ key: z.literal("mature"), value: z.boolean() }),
  z.object({ key: z.literal("matureConfirmedAt"), value: z.number() }),
  z.object({ key: z.literal("theme"), value: z.enum(["dark", "light", "system"]) }),
  z.object({ key: z.literal("readerWidth"), value: z.number().int().min(360).max(1600) }),
  z.object({ key: z.literal("source"), value: z.string().refine(isSourceKey) }),
]);

export const BackupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.number(),
  library: z.array(Library).max(10_000),
  history: z.array(History).max(10_000),
  progress: z.array(Progress).max(200_000),
  settings: z.array(Setting).max(20),
  /** Added with manga support; absent in older backups. */
  titlePrefs: z.array(TitlePref).max(10_000).optional(),
});
export type Backup = z.infer<typeof BackupSchema>;

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

export async function exportData(d: ToonifyDB): Promise<Backup> {
  const [library, history, progress, settings, titlePrefs] = await Promise.all([
    d.library.toArray(), d.history.toArray(), d.progress.toArray(), d.settings.toArray(), d.titlePrefs.toArray(),
  ]);
  return {
    version: 1,
    exportedAt: Date.now(),
    library,
    history,
    progress,
    settings: settings.filter((s) => Setting.safeParse(s).success) as Backup["settings"],
    titlePrefs,
  };
}

export async function importData(d: ToonifyDB, input: unknown) {
  const parsed = BackupSchema.safeParse(input);
  if (!parsed.success) throw new ImportError("This file is not a valid Toonify backup.");
  const b = parsed.data;
  await d.transaction("rw", d.library, d.history, d.progress, d.settings, d.titlePrefs, async () => {
    for (const item of b.library) {
      const cur = await d.library.get(item.titleId);
      await d.library.put(cur ? { ...item, ...cur, lastChapterSeenId: cur.lastChapterSeenId ?? item.lastChapterSeenId } : item);
    }
    for (const item of b.history) {
      const cur = await d.history.get(item.titleId);
      if (!cur || cur.readAt < item.readAt) await d.history.put(item);
    }
    for (const item of b.progress) {
      const cur = await d.progress.get([item.titleId, item.chapterId]);
      if (!cur || cur.updatedAt < item.updatedAt) await d.progress.put(item);
    }
    for (const s of b.settings) await d.settings.put(s);
    for (const p of b.titlePrefs ?? []) await d.titlePrefs.put(p);
  });
  return { library: b.library.length, history: b.history.length, progress: b.progress.length };
}
