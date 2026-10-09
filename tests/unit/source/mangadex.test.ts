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
    const page = await src.home(1, { mature: false });
    expect(page).toEqual({
      page: 1, hasMore: true,
      items: [{ id: `md:${MID}`, title: "Solo Leveling", cover: `/api/img/cover/${MID}/cover.jpg.512.jpg`, badge: undefined }],
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

  test("schema drift -> UpstreamError", async () => {
    const { src } = source({ "/manga?": { result: "ok", data: "nope" } });
    await expect(src.home(1, { mature: false })).rejects.toThrow(UpstreamError);
  });
});
