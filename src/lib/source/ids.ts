import { InvalidIdError } from "./errors";

export const SOURCE_KEYS = ["md", "sg", "mock"] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

export function isSourceKey(s: string): s is SourceKey {
  return (SOURCE_KEYS as readonly string[]).includes(s);
}

export function encodeId(source: SourceKey, raw: string): string {
  return `${source}:${raw}`;
}

export function decodeId(id: string): { source: SourceKey; raw: string } {
  let decoded: string;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    throw new InvalidIdError();
  }
  const i = decoded.indexOf(":");
  if (i <= 0) throw new InvalidIdError();
  const source = decoded.slice(0, i);
  const raw = decoded.slice(i + 1);
  if (!isSourceKey(source) || raw.length === 0) throw new InvalidIdError();
  return { source, raw };
}
