import { describe, expect, test } from "vitest";
import { ScraperGoSource, chapterNumberOf } from "@/lib/source/scrapergo";
import { TokenBucket } from "@/lib/ratelimit";
import { UpstreamError } from "@/lib/source/errors";

function source(routes: Record<string, unknown>) {
  const calls: string[] = [];
  const fetchJson = async (url: string) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new Error("unexpected " + url);
    return routes[key];
  };
  return { src: new ScraperGoSource({ fetchJson, bucket: new TokenBucket({ capacity: 100, refillPerSec: 100 }) }), calls };
}

describe("ScraperGoSource", () => {
  test("home", async () => {
    const { src, calls } = source({
      "/api/manwha/home/1": { success: true, pagination: [1, 2, 3], data: [
        { index: 0, title: "TBATE", image: "https://img/x.jpg", status: "HOT", manwhaId: "beginning-after-end",
          latestEp: [{ title: "Chapter 200", date: "1 day ago" }] },
      ] },
    });
    const p = await src.home(1, { mature: true });
    expect(calls[0]).toBe("https://scrapergo.vercel.app/api/manwha/home/1?mature=1");
    expect(p).toEqual({ page: 1, hasMore: true, items: [{
      id: "sg:beginning-after-end", title: "TBATE", cover: "https://img/x.jpg", badge: "HOT",
      latest: [{ label: "Chapter 200", date: "1 day ago" }],
    }] });
  });

  test("search encodes path segment", async () => {
    const { src, calls } = source({ "/api/search/": { success: true, data: [] } });
    await src.search("solo/leveling #1", 1, { mature: false });
    expect(calls[0]).toBe("https://scrapergo.vercel.app/api/search/solo%2Fleveling%20%231/1?mature=0");
  });

  test("success:false -> UpstreamError", async () => {
    const { src } = source({ "/api/manwha/home/1": { success: false, message: "Error with fetching Home Page" } });
    await expect(src.home(1, { mature: false })).rejects.toThrow(UpstreamError);
  });

  test("title maps info and chapters", async () => {
    const { src } = source({ "/api/manwha/tbate": { success: true, data: {
      title: "TBATE", status: "OnGoing", image: "https://img/c.jpg", summary: "King reborn.",
      info: [{ "Alt Name": "The Beginning After The End", Author: "TurtleMe", Artist: "Fuyuki23", Genre: ["Action", "Fantasy"] }],
      chaptersCount: 2,
      chapters: [
        { name: "Chapter 2", releaseDate: "2 days ago", chapterId: "chapter-2" },
        { name: "Chapter 1", releaseDate: "3 days ago", chapterId: "chapter-1" },
      ],
    } } });
    const t = await src.title("tbate");
    expect(t).toMatchObject({
      id: "sg:tbate", title: "TBATE", authors: ["TurtleMe"], artists: ["Fuyuki23"], genres: ["Action", "Fantasy"],
      altTitles: ["The Beginning After The End"],
    });
    expect(t.chapters.map((c) => c.id)).toEqual(["1", "2"]);
    expect(t.layout).toBe("strip");
  });

  test("chapter", async () => {
    const { src, calls } = source({ "/api/manwha/tbate/3": { success: true, data: { title: "TBATE - Chapter 3", images: ["https://p/1", "https://p/2"] } } });
    expect(await src.chapter("tbate", "3")).toEqual({ titleId: "sg:tbate", chapterId: "3", pages: ["https://p/1", "https://p/2"] });
    expect(calls[0]).toBe("https://scrapergo.vercel.app/api/manwha/tbate/3");
  });

  test("chapterNumberOf", () => {
    expect(chapterNumberOf("chapter-12", "Chapter 12")).toBe("12");
    expect(chapterNumberOf("x", "Chapter 10.5")).toBe("10.5");
    expect(chapterNumberOf("x", "Prologue")).toBeUndefined();
  });
});
