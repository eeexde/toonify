import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "vitest";
import { createDb, type ToonifyDB } from "@/lib/db/schema";
import { exportData, importData, ImportError } from "@/lib/db/backup";
import { recordOpen, setSetting, toggleLibrary } from "@/lib/db/actions";

let d: ToonifyDB;
beforeEach(async () => { d = createDb(`b-${Math.random()}`); await d.open(); });

describe("backup", () => {
  test("export -> import into fresh db round trips", async () => {
    await toggleLibrary(d, { titleId: "md:a", title: "A", cover: "/c" });
    await recordOpen(d, { titleId: "md:a", title: "A", cover: "/c", chapterId: "c1", chapterName: "Ch. 1" });
    await setSetting(d, "theme", "light");
    const dump = await exportData(d);
    expect(dump.version).toBe(1);
    const d2 = createDb(`b2-${Math.random()}`);
    await d2.open();
    expect(await importData(d2, JSON.parse(JSON.stringify(dump)))).toEqual({ library: 1, history: 1, progress: 0 });
    expect((await d2.settings.get("theme"))?.value).toBe("light");
  });

  test("newer history wins on merge", async () => {
    await recordOpen(d, { titleId: "md:a", title: "A", cover: "/c", chapterId: "c5", chapterName: "Ch. 5" });
    const dump = await exportData(d);
    dump.history[0] = { ...dump.history[0], chapterId: "c1", readAt: 1 };
    await importData(d, dump);
    expect((await d.history.get("md:a"))?.chapterId).toBe("c5");
  });

  test.each([
    ["not an object", "hello"],
    ["wrong version", { version: 2, exportedAt: 1, library: [], history: [], progress: [], settings: [] }],
    ["bad row", { version: 1, exportedAt: 1, library: [{ titleId: 5 }], history: [], progress: [], settings: [] }],
  ])("rejects %s without writing", async (_n, input) => {
    await expect(importData(d, input)).rejects.toThrow(ImportError);
    expect(await d.library.count()).toBe(0);
  });
});
