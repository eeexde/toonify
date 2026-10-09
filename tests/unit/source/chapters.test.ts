import { describe, expect, test } from "vitest";
import { neighbors, readableChapters, sortChapters } from "@/lib/source/chapters";
import type { Chapter } from "@/lib/source/types";

const ch = (id: string, number?: string, externalUrl?: string): Chapter => ({ id, number, name: id, externalUrl });

describe("sortChapters", () => {
  test("numeric, decimals, duplicates stable, null last", () => {
    const out = sortChapters([ch("c10", "10"), ch("one", undefined), ch("c2a", "2"), ch("c10.5", "10.5"), ch("c2b", "2"), ch("c1", "1")]);
    expect(out.map((c) => c.id)).toEqual(["c1", "c2a", "c2b", "c10", "c10.5", "one"]);
  });
});

describe("neighbors", () => {
  const list = sortChapters([ch("a", "1"), ch("b", "2", "https://official"), ch("c", "3"), ch("d", "4")]);
  test("skips external chapters", () => {
    expect(neighbors(list, "a").next?.id).toBe("c");
    expect(neighbors(list, "c").prev?.id).toBe("a");
  });
  test("edges", () => {
    expect(neighbors(list, "a").prev).toBeUndefined();
    expect(neighbors(list, "d").next).toBeUndefined();
  });
  test("all external -> nothing readable", () => {
    const ext = [ch("x", "1", "https://o"), ch("y", "2", "https://o")];
    expect(readableChapters(ext)).toEqual([]);
    expect(neighbors(ext, "x")).toEqual({ prev: undefined, next: undefined });
  });
});
