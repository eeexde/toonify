import { describe, expect, test } from "vitest";
import { MemoryLRUStore } from "@/lib/cache/memory";

describe("MemoryLRUStore", () => {
  test("get/set", async () => {
    const s = new MemoryLRUStore();
    await s.set("a", { value: 1, storedAt: 0 }, 10);
    expect(await s.get("a")).toEqual({ value: 1, storedAt: 0 });
  });
  test("expires after ttl", async () => {
    let t = 0;
    const s = new MemoryLRUStore(10, () => t);
    await s.set("a", { value: 1, storedAt: 0 }, 10);
    t = 9_999;
    expect(await s.get("a")).toBeDefined();
    t = 10_001;
    expect(await s.get("a")).toBeUndefined();
  });
  test("evicts least recently used", async () => {
    const s = new MemoryLRUStore(2);
    await s.set("a", { value: 1, storedAt: 0 }, 100);
    await s.set("b", { value: 2, storedAt: 0 }, 100);
    await s.get("a");
    await s.set("c", { value: 3, storedAt: 0 }, 100);
    expect(await s.get("b")).toBeUndefined();
    expect(await s.get("a")).toBeDefined();
    expect(await s.get("c")).toBeDefined();
  });
  test("delete", async () => {
    const s = new MemoryLRUStore();
    await s.set("a", { value: 1, storedAt: 0 }, 100);
    await s.delete("a");
    expect(await s.get("a")).toBeUndefined();
  });
});
