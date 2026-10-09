import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "vitest";
import { createDb, type ToonifyDB } from "@/lib/db/schema";
import { markCompleted, readSettings, recordOpen, saveProgress, setSetting, toggleLibrary, touchLatestChapter } from "@/lib/db/actions";

let d: ToonifyDB;
beforeEach(async () => { d = createDb(`t-${Math.random()}`); await d.open(); });

const h = { titleId: "md:a", title: "A", cover: "/c", chapterId: "c1", chapterName: "Ch. 1" };

describe("db actions", () => {
  test("toggleLibrary adds then removes", async () => {
    expect(await toggleLibrary(d, { titleId: "md:a", title: "A", cover: "/c" })).toBe(true);
    expect(await d.library.count()).toBe(1);
    expect(await toggleLibrary(d, { titleId: "md:a", title: "A", cover: "/c" })).toBe(false);
    expect(await d.library.count()).toBe(0);
  });
  test("touchLatestChapter only updates library items", async () => {
    await touchLatestChapter(d, "md:a", "c9");
    expect(await d.library.get("md:a")).toBeUndefined();
    await toggleLibrary(d, { titleId: "md:a", title: "A", cover: "/c" });
    await touchLatestChapter(d, "md:a", "c9");
    expect((await d.library.get("md:a"))?.latestChapterId).toBe("c9");
  });
  test("recordOpen keeps one history row per title", async () => {
    await recordOpen(d, h);
    await recordOpen(d, { ...h, chapterId: "c2", chapterName: "Ch. 2" });
    const rows = await d.history.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].chapterId).toBe("c2");
  });
  test("saveProgress then markCompleted", async () => {
    await toggleLibrary(d, { titleId: "md:a", title: "A", cover: "/c" });
    await saveProgress(d, { titleId: "md:a", chapterId: "c1", pageIndex: 3, scrollRatio: 0.4 });
    expect((await d.progress.get(["md:a", "c1"]))?.completed).toBe(false);
    await markCompleted(d, h);
    const p = await d.progress.get(["md:a", "c1"]);
    expect(p?.completed).toBe(true);
    expect(p?.pageIndex).toBe(3);
    expect((await d.library.get("md:a"))?.lastChapterSeenId).toBe("c1");
  });
  test("saveProgress does not un-complete", async () => {
    await markCompleted(d, h);
    await saveProgress(d, { titleId: "md:a", chapterId: "c1", pageIndex: 0, scrollRatio: 0.1 });
    expect((await d.progress.get(["md:a", "c1"]))?.completed).toBe(true);
  });
  test("settings defaults and set", async () => {
    expect((await readSettings(d)).mature).toBe(false);
    expect((await readSettings(d)).theme).toBe("dark");
    await setSetting(d, "mature", true);
    expect((await readSettings(d)).mature).toBe(true);
  });
});
