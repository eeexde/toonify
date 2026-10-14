import { describe, expect, test, vi } from "vitest";
import { createPreloader, preloadIndexes } from "@/lib/reader/preload";

describe("preloadIndexes", () => {
  test("next three pages first, then the one behind", () => {
    expect(preloadIndexes(5, 20)).toEqual([6, 7, 8, 4]);
  });

  test("clamps at the chapter's start and end", () => {
    expect(preloadIndexes(0, 20)).toEqual([1, 2, 3]);
    expect(preloadIndexes(18, 20)).toEqual([19, 17]);
    expect(preloadIndexes(19, 20)).toEqual([18]);
    expect(preloadIndexes(0, 0)).toEqual([]);
  });
});

describe("createPreloader", () => {
  const fake = () => {
    const made: { src: string; decode: ReturnType<typeof vi.fn> }[] = [];
    const make = () => {
      const img = { src: "", decode: vi.fn(() => Promise.resolve()) };
      made.push(img);
      return img as unknown as HTMLImageElement;
    };
    return { made, make };
  };

  test("loads and decodes each page once while it stays in the window", () => {
    const { made, make } = fake();
    const p = createPreloader(make);
    p.set(["a", "b"]);
    p.set(["b", "c"]);
    expect(made.map((i) => i.src)).toEqual(["a", "b", "c"]);
    expect(made.every((i) => i.decode.mock.calls.length === 1)).toBe(true);
  });

  test("lets go of pages that leave the window", () => {
    const { make } = fake();
    const p = createPreloader(make);
    p.set(["a", "b"]);
    p.set(["b", "c"]);
    expect([...p.held.keys()]).toEqual(["b", "c"]);
    p.clear();
    expect(p.held.size).toBe(0);
  });

  test("a failed decode is swallowed", async () => {
    const p = createPreloader(() => ({ src: "", decode: () => Promise.reject(new Error("bad")) }) as unknown as HTMLImageElement);
    expect(() => p.set(["a"])).not.toThrow();
    await Promise.resolve();
  });
});
