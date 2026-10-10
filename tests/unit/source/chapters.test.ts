import { describe, expect, test } from "vitest";
import { neighbors, readableChapters, sortChapters } from "@/lib/source/chapters";
import type { Chapter } from "@/lib/source/types";

const ch = (id: string, number?: string, externalUrl?: string, group?: string): Chapter => ({ id, number, name: id, externalUrl, group });

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

describe("neighbors with duplicate numbers", () => {
  const list = sortChapters([ch("1A", "1", undefined, "A"), ch("1B", "1", undefined, "B"), ch("2A", "2", undefined, "A"), ch("2B", "2", undefined, "B")]);
  test("prefers same group", () => {
    expect(neighbors(list, "1A").next?.id).toBe("2A");
    expect(neighbors(list, "1B").next?.id).toBe("2B");
    expect(neighbors(list, "2B").prev?.id).toBe("1B");
    expect(neighbors(list, "2A").prev?.id).toBe("1A");
  });
  test("never returns same-number sibling", () => {
    expect(neighbors(list, "1A").prev).toBeUndefined();
    expect(neighbors(list, "2B").next).toBeUndefined();
  });
  test("missing group -> first of next number", () => {
    const l = sortChapters([ch("1C", "1", undefined, "C"), ch("2A", "2", undefined, "A"), ch("2B", "2", undefined, "B")]);
    expect(neighbors(l, "1C").next?.id).toBe("2A");
    expect(neighbors(l, "2B").prev?.id).toBe("1C");
  });
  test("decimals", () => {
    const l = sortChapters([ch("a", "10"), ch("b", "10.5"), ch("c", "11")]);
    expect(neighbors(l, "a").next?.id).toBe("b");
    expect(neighbors(l, "b").next?.id).toBe("c");
    expect(neighbors(l, "c").prev?.id).toBe("b");
  });
  test("null-number oneshots use positional neighbors", () => {
    const l = sortChapters([ch("n", "5"), ch("o1"), ch("o2")]);
    expect(neighbors(l, "n").next?.id).toBe("o1");
    expect(neighbors(l, "o1").next?.id).toBe("o2");
    expect(neighbors(l, "o2").prev?.id).toBe("o1");
    expect(neighbors(l, "o1").prev?.id).toBe("n");
  });
});
