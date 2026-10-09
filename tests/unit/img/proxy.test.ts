import { describe, expect, test, vi } from "vitest";
import { isAllowedImageHost, parseImgPath } from "@/lib/img/paths";
import { proxyImage } from "@/lib/img/proxy";

const CID = "1c65098a-7a6e-465b-8733-9d19fae27926";

describe("parseImgPath", () => {
  test("md", () => expect(parseImgPath(["md", CID, "1-abc.jpg"])).toEqual({ kind: "md", chapterId: CID, file: "1-abc.jpg" }));
  test("cover", () => expect(parseImgPath(["cover", CID, "f.jpg.512.jpg"])).toEqual({ kind: "cover", mangaId: CID, file: "f.jpg.512.jpg" }));
  test("mock", () => {
    expect(parseImgPath(["mock", "cover", "alpha"])).toEqual({ kind: "mock-cover", slug: "alpha" });
    expect(parseImgPath(["mock", "page", "alpha", "2", "3"])).toEqual({ kind: "mock-page", slug: "alpha", chapter: "2", n: 3 });
  });
  test.each([
    [["md", "not-a-uuid", "a.jpg"]],
    [["md", CID, "../etc"]],
    [["md", CID, ".hidden"]],
    [["md", CID, "a.jpg", "extra"]],
    [["cover", CID, "evil.exe"]],
    [["http:", "", "evil.com"]],
    [[]],
  ])("rejects %j", (segs) => expect(parseImgPath(segs)).toBeNull());
});

describe("isAllowedImageHost", () => {
  test.each([
    ["https://uploads.mangadex.org/x", true],
    ["https://abc.mangadex.network/data/x", true],
    ["https://mangadex.network.evil.com/x", false],
    ["http://abc.mangadex.network/x", false],
    ["https://evil.com/x", false],
  ])("%s -> %s", (u, ok) => expect(isAllowedImageHost(u)).toBe(ok));
});

describe("proxyImage", () => {
  const atHomeOk = { baseUrl: "https://abc.mangadex.network", hash: "h1", files: ["1-a.jpg"] };
  const img = () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/jpeg" } });

  test("md fetches from at-home baseUrl with immutable cache", async () => {
    const fetch = vi.fn().mockResolvedValue(img());
    const res = await proxyImage({ kind: "md", chapterId: CID, file: "1-a.jpg" }, { atHome: async () => atHomeOk, fetch, mockEnabled: false });
    expect(fetch.mock.calls[0][0]).toBe("https://abc.mangadex.network/data/h1/1-a.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  test("file not in chapter -> 404", async () => {
    const res = await proxyImage({ kind: "md", chapterId: CID, file: "9-z.jpg" }, { atHome: async () => atHomeOk, fetch: vi.fn(), mockEnabled: false });
    expect(res.status).toBe(404);
  });

  test("retries with refreshed baseUrl, then falls back to uploads", async () => {
    const atHome = vi.fn().mockResolvedValueOnce(atHomeOk).mockResolvedValueOnce({ ...atHomeOk, baseUrl: "https://def.mangadex.network" });
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response("x", { status: 500 }))
      .mockResolvedValueOnce(new Response("x", { status: 500 }))
      .mockResolvedValueOnce(img());
    const res = await proxyImage({ kind: "md", chapterId: CID, file: "1-a.jpg" }, { atHome, fetch, mockEnabled: false });
    expect(atHome).toHaveBeenLastCalledWith(CID, true);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      "https://abc.mangadex.network/data/h1/1-a.jpg",
      "https://def.mangadex.network/data/h1/1-a.jpg",
      "https://uploads.mangadex.org/data/h1/1-a.jpg",
    ]);
    expect(res.status).toBe(200);
  });

  test("disallowed baseUrl host is never fetched", async () => {
    const fetch = vi.fn().mockResolvedValue(img());
    await proxyImage({ kind: "md", chapterId: CID, file: "1-a.jpg" }, { atHome: async () => ({ ...atHomeOk, baseUrl: "https://evil.com" }), fetch, mockEnabled: false });
    expect(fetch.mock.calls.every((c) => String(c[0]).startsWith("https://uploads.mangadex.org/"))).toBe(true);
  });

  test("mock disabled -> 404, enabled -> svg", async () => {
    const t = { kind: "mock-cover", slug: "alpha" } as const;
    expect((await proxyImage(t, { atHome: vi.fn(), mockEnabled: false })).status).toBe(404);
    const res = await proxyImage(t, { atHome: vi.fn(), mockEnabled: true });
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
  });
});
