import { describe, expect, test } from "vitest";
import { decodeId, encodeId, isSourceKey } from "@/lib/source/ids";
import { InvalidIdError } from "@/lib/source/errors";

describe("ids", () => {
  test("round trips", () => {
    const id = encodeId("md", "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0");
    expect(id).toBe("md:32d76d19-8a05-4db0-9fc2-e0b0648fe9d0");
    expect(decodeId(id)).toEqual({ source: "md", raw: "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0" });
  });
  test("keeps colons inside raw", () => {
    expect(decodeId("sg:a:b")).toEqual({ source: "sg", raw: "a:b" });
  });
  test("decodes percent-encoded ids", () => {
    expect(decodeId("md%3Aabc")).toEqual({ source: "md", raw: "abc" });
  });
  test.each(["", "md", "md:", "xx:abc", ":abc"])("rejects %s", (bad) => {
    expect(() => decodeId(bad)).toThrow(InvalidIdError);
  });
  test("isSourceKey", () => {
    expect(isSourceKey("md")).toBe(true);
    expect(isSourceKey("nope")).toBe(false);
  });
});
