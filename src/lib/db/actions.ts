import type { ToonifyDB } from "./schema";
import { DEFAULT_SETTINGS, type HistoryItem, type ProgressItem, type Settings } from "./types";

export async function toggleLibrary(d: ToonifyDB, item: { titleId: string; title: string; cover: string }): Promise<boolean> {
  return d.transaction("rw", d.library, async () => {
    if (await d.library.get(item.titleId)) {
      await d.library.delete(item.titleId);
      return false;
    }
    await d.library.put({ ...item, addedAt: Date.now() });
    return true;
  });
}

export async function touchLatestChapter(d: ToonifyDB, titleId: string, latestChapterId: string | undefined) {
  if (!latestChapterId) return;
  await d.library.update(titleId, { latestChapterId });
}

export async function recordOpen(d: ToonifyDB, h: Omit<HistoryItem, "readAt">) {
  await d.history.put({ ...h, readAt: Date.now() });
}

export async function saveProgress(d: ToonifyDB, p: Omit<ProgressItem, "updatedAt" | "completed">) {
  await d.transaction("rw", d.progress, async () => {
    const prev = await d.progress.get([p.titleId, p.chapterId]);
    await d.progress.put({ ...p, completed: prev?.completed ?? false, updatedAt: Date.now() });
  });
}

export async function markCompleted(d: ToonifyDB, h: Omit<HistoryItem, "readAt">) {
  await d.transaction("rw", d.progress, d.history, d.library, async () => {
    const prev = await d.progress.get([h.titleId, h.chapterId]);
    await d.progress.put({
      titleId: h.titleId,
      chapterId: h.chapterId,
      pageIndex: prev?.pageIndex ?? 0,
      scrollRatio: 1,
      completed: true,
      updatedAt: Date.now(),
    });
    await d.history.put({ ...h, readAt: Date.now() });
    await d.library.update(h.titleId, { lastChapterSeenId: h.chapterId });
  });
}

export async function setSetting<K extends keyof Settings>(d: ToonifyDB, key: K, value: Settings[K]) {
  await d.settings.put({ key, value });
}

export async function readSettings(d: ToonifyDB): Promise<Settings> {
  const rows = await d.settings.toArray();
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) (out as unknown as Record<string, unknown>)[r.key] = r.value;
  return out;
}
