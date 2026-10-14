import { describe, expect, test } from "vitest";
import { MangaDexSource } from "@/lib/source/mangadex";
import { TokenBucket } from "@/lib/ratelimit";
import { UpstreamError } from "@/lib/source/errors";

const MID = "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0";
const CID = "1c65098a-7a6e-465b-8733-9d19fae27926";

const manga = (over: Record<string, unknown> = {}) => ({
  id: MID,
  type: "manga",
  attributes: {
    title: { "ko-ro": "Na Honjaman Level-Up" },
    altTitles: [{ ko: "나 혼자만 레벨업" }, { en: "Solo Leveling" }],
    description: { en: "Hunters." },
    status: "completed",
    contentRating: "safe",
    originalLanguage: "ko",
    tags: [
      { attributes: { name: { en: "Action" }, group: "genre" } },
      { attributes: { name: { en: "Monsters" }, group: "theme" } },
    ],
    ...over,
  },
  relationships: [
    { id: "a1", type: "author", attributes: { name: "Chugong" } },
    { id: "a2", type: "artist", attributes: { name: "DUBU" } },
    { id: "c1", type: "cover_art", attributes: { fileName: "cover.jpg" } },
  ],
});

const chapter = (id: string, num: string | null, extra: Record<string, unknown> = {}) => ({
  id,
  type: "chapter",
  attributes: {
    volume: null, chapter: num, title: null, translatedLanguage: "en",
    externalUrl: null, pages: 20, publishAt: "2024-01-01T00:00:00+00:00", readableAt: "2024-01-01T00:00:00+00:00",
    ...extra,
  },
  relationships: [{ id: "g", type: "scanlation_group", attributes: { name: "Group A" } }],
});

function source(routes: Record<string, unknown>) {
  const calls: string[] = [];
  const fetchJson = async (url: string) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new Error("unexpected " + url);
    const v = routes[key];
    return typeof v === "function" ? (v as (u: string) => unknown)(url) : v;
  };
  const b = new TokenBucket({ capacity: 100, refillPerSec: 100 });
  return { src: new MangaDexSource({ fetchJson, buckets: { general: b, atHome: b } }), calls };
}

describe("MangaDexSource", () => {
  test("home maps list and builds query", async () => {
    const { src, calls } = source({ "/manga?": { result: "ok", data: [manga()], limit: 24, offset: 0, total: 30 } });
    const page = await src.home(1, { mature: false, kind: "manhwa" });
    expect(page).toEqual({
      page: 1, hasMore: true,
      items: [{ id: `md:${MID}`, title: "Solo Leveling", cover: `/api/img/cover/${MID}/cover.jpg.512.jpg`, badge: undefined, status: "completed" }],
    });
    const u = new URL(calls[0]);
    expect(u.searchParams.getAll("contentRating[]")).toEqual(["safe", "suggestive"]);
    expect(u.searchParams.get("originalLanguage[]")).toBe("ko");
    expect(u.searchParams.get("offset")).toBe("0");
  });

  test("mature adds ratings and badges", async () => {
    const { src, calls } = source({ "/manga?": { result: "ok", data: [manga({ contentRating: "erotica" })], limit: 24, offset: 24, total: 30 } });
    const page = await src.home(2, { mature: true });
    expect(new URL(calls[0]).searchParams.getAll("contentRating[]")).toEqual(["safe", "suggestive", "erotica", "pornographic"]);
    expect(page.items[0].badge).toBe("18+");
    expect(page.hasMore).toBe(false);
  });

  test("search encodes title param", async () => {
    const { src, calls } = source({ "/manga?": { result: "ok", data: [], limit: 24, offset: 0, total: 0 } });
    await src.search("solo/leveling #1 & 나", 1, { mature: false });
    expect(new URL(calls[0]).searchParams.get("title")).toBe("solo/leveling #1 & 나");
  });

  test("title merges manga and paged feed, handles external + null chapters", async () => {
    const feedPage = (u: string) => {
      const offset = Number(new URL(u).searchParams.get("offset"));
      if (offset === 0) {
        return { result: "ok", limit: 2, offset: 0, total: 3, data: [
          chapter("c2", "2"),
          chapter("c1", "1", { pages: 0, externalUrl: "https://tappytoon.com/x" }),
        ] };
      }
      return { result: "ok", limit: 2, offset: 2, total: 3, data: [chapter("os", null, { title: "Special" })] };
    };
    const { src } = source({
      [`/manga/${MID}/feed`]: feedPage,
      [`/manga/${MID}?`]: { result: "ok", data: manga() },
    });
    const t = await src.title(MID);
    expect(t.title).toBe("Solo Leveling");
    expect(t.authors).toEqual(["Chugong"]);
    expect(t.artists).toEqual(["DUBU"]);
    expect(t.genres).toEqual(["Action", "Monsters"]);
    expect(t.summary).toBe("Hunters.");
    expect(t.chapters.map((c) => [c.id, c.name, c.externalUrl])).toEqual([
      ["c1", "Ch. 1", "https://tappytoon.com/x"],
      ["c2", "Ch. 2", undefined],
      ["os", "Special", undefined],
    ]);
    expect(t.chapters[1].group).toBe("Group A");
  });

  test("javascript: externalUrl is dropped; chapter with 0 pages and bad url is removed", async () => {
    const { src } = source({
      [`/manga/${MID}/feed`]: { result: "ok", limit: 500, offset: 0, total: 3, data: [
        chapter("ok", "1"),
        chapter("bad", "2", { pages: 0, externalUrl: "javascript:alert(1)" }),
        chapter("none", "3", { pages: 0, externalUrl: null }),
      ] },
      [`/manga/${MID}?`]: { result: "ok", data: manga() },
    });
    const t = await src.title(MID);
    expect(t.chapters.map((c) => c.id)).toEqual(["ok"]);
  });

  test("chapter rejects non-uuid title id", async () => {
    const { src } = source({});
    await expect(src.chapter("nope", CID)).rejects.toThrow();
  });

  test("description may be an empty array", async () => {
    const { src } = source({
      [`/manga/${MID}/feed`]: { result: "ok", limit: 500, offset: 0, total: 0, data: [] },
      [`/manga/${MID}?`]: { result: "ok", data: manga({ description: [] }) },
    });
    expect((await src.title(MID)).summary).toBe("");
  });

  test("chapter returns proxied page urls", async () => {
    const { src } = source({
      [`/at-home/server/${CID}`]: { result: "ok", baseUrl: "https://abc.mangadex.network", chapter: { hash: "h", data: ["1-a.jpg", "2-b.jpg"] } },
    });
    expect(await src.chapter(MID, CID)).toEqual({
      titleId: `md:${MID}`, chapterId: CID,
      pages: [`/api/img/md/${CID}/1-a.jpg`, `/api/img/md/${CID}/2-b.jpg`],
    });
  });

  test("filters: sort, included tags and selected ratings map to MangaDex params", async () => {
    const { src, calls } = source({ "/manga?": { result: "ok", data: [], limit: 24, offset: 0, total: 0 } });
    const TAG = "391b0423-d847-456f-aff0-8b0cfc03066b";
    await src.home(1, { mature: false, sort: "follows", tags: [TAG], ratings: ["suggestive", "erotica"] });
    const u = new URL(calls[0]);
    expect(u.searchParams.get("order[followedCount]")).toBe("desc");
    expect(u.searchParams.get("order[latestUploadedChapter]")).toBeNull();
    expect(u.searchParams.getAll("includedTags[]")).toEqual([TAG]);
    expect(u.searchParams.getAll("contentRating[]")).toEqual(["suggestive"]);
  });

  test.each([
    ["latest", "order[latestUploadedChapter]", "desc"],
    ["newest", "order[createdAt]", "desc"],
    ["title", "order[title]", "asc"],
  ] as const)("sort %s -> %s=%s", async (sort, key, dir) => {
    const { src, calls } = source({ "/manga?": { result: "ok", data: [], limit: 24, offset: 0, total: 0 } });
    await src.search("x", 1, { mature: false, sort });
    expect(new URL(calls[0]).searchParams.get(key)).toBe(dir);
    expect(new URL(calls[0]).searchParams.get("order[relevance]")).toBeNull();
  });

  test("relevance without a query falls back to latest", async () => {
    const { src, calls } = source({ "/manga?": { result: "ok", data: [], limit: 24, offset: 0, total: 0 } });
    await src.home(1, { mature: false, sort: "relevance" });
    expect(new URL(calls[0]).searchParams.get("order[latestUploadedChapter]")).toBe("desc");
  });

  test("ratings clipped to nothing -> empty page without an upstream call", async () => {
    const { src, calls } = source({});
    expect(await src.home(1, { mature: false, ratings: ["pornographic"] })).toEqual({ items: [], page: 1, hasMore: false });
    expect(calls).toHaveLength(0);
  });

  test("tags lists MangaDex tags with groups", async () => {
    const { src } = source({ "/manga/tag": { result: "ok", data: [
      { id: "t1", type: "tag", attributes: { name: { en: "Romance" }, group: "genre" } },
      { id: "t2", type: "tag", attributes: { name: { en: "Monsters" }, group: "theme" } },
    ] } });
    expect(await src.tags()).toEqual([
      { id: "t2", name: "Monsters", group: "theme" },
      { id: "t1", name: "Romance", group: "genre" },
    ].sort((a, b) => a.name.localeCompare(b.name)));
  });

  test("featured: most followed, updated in the last 30 days, with synopsis and genres", async () => {
    const { src, calls } = source({ "/manga?": { result: "ok", data: [manga()], limit: 10, offset: 0, total: 1 } });
    const now = Date.parse("2026-10-10T12:34:56Z");
    const items = await src.featured({ mature: false, now: () => now });
    const u = new URL(calls[0]);
    expect(u.searchParams.get("order[followedCount]")).toBe("desc");
    expect(u.searchParams.get("updatedAtSince")).toBe("2026-09-10T00:00:00");
    expect(u.searchParams.get("limit")).toBe("8");
    expect(u.searchParams.getAll("contentRating[]")).toEqual(["safe", "suggestive"]);
    expect(items).toEqual([{
      id: `md:${MID}`, title: "Solo Leveling", cover: `/api/img/cover/${MID}/cover.jpg.512.jpg`, badge: undefined,
      status: "completed", summary: "Hunters.", genres: ["Action"],
    }]);
  });

  test("language follows kind: manga (default) -> ja, manhwa -> ko", async () => {
    const { src, calls } = source({ "/manga?": { result: "ok", data: [], limit: 24, offset: 0, total: 0 } });
    await src.home(1, { mature: false });
    await src.search("x", 1, { mature: false, kind: "manhwa" });
    await src.featured({ mature: false, kind: "manga" });
    expect(calls.map((c) => new URL(c).searchParams.getAll("originalLanguage[]"))).toEqual([["ja"], ["ko"], ["ja"]]);
  });

  test("layout: ko strip, ja paged, ja with Long Strip tag strip", async () => {
    const longStrip = { attributes: { name: { en: "Long Strip" }, group: "format" } };
    const feed = { result: "ok", data: [], limit: 500, offset: 0, total: 0 };
    const cases: [Record<string, unknown>, string][] = [
      [{}, "strip"],
      [{ originalLanguage: "ja" }, "paged"],
      [{ originalLanguage: "ja", tags: [longStrip] }, "strip"],
    ];
    for (const [over, layout] of cases) {
      const { src } = source({ [`/manga/${MID}?`]: { result: "ok", data: manga(over) }, "/feed?": feed });
      expect((await src.title(MID)).layout).toBe(layout);
    }
  });

  test("featured synopsis: first paragraph, markdown links unwrapped, clipped on a word", async () => {
    const long = "Word ".repeat(80).trim();
    const { src } = source({ "/manga?": { result: "ok", limit: 10, offset: 0, total: 2, data: [
      manga({ description: { en: "Read [the novel](https://x.y) first.\n\n---\n**Links:** stuff" } }),
      manga({ description: { en: long } }),
    ] } });
    const [a, b] = await src.featured({ mature: false });
    expect(a.summary).toBe("Read the novel first.");
    expect(b.summary.endsWith("…")).toBe(true);
    expect(b.summary.length).toBeLessThanOrEqual(281);
    expect(b.summary).not.toMatch(/ …$/);
  });

  test("schema drift -> UpstreamError", async () => {
    const { src } = source({ "/manga?": { result: "ok", data: "nope" } });
    await expect(src.home(1, { mature: false })).rejects.toThrow(UpstreamError);
  });
});
