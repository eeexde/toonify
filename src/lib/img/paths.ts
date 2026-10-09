import { UUID_RE } from "../source/mangadex";

const FILE_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$/;
const IMG_EXT_RE = /\.(jpe?g|png|webp|gif)$/i;
const SLUG_RE = /^[a-z0-9-]{1,64}$/;

export type ImgTarget =
  | { kind: "md"; chapterId: string; file: string }
  | { kind: "cover"; mangaId: string; file: string }
  | { kind: "mock-cover"; slug: string }
  | { kind: "mock-page"; slug: string; chapter: string; n: number };

function safeFile(f: string | undefined): f is string {
  return !!f && FILE_RE.test(f) && !f.includes("..") && IMG_EXT_RE.test(f);
}

export function parseImgPath(s: string[]): ImgTarget | null {
  const [kind, a, b, c, d] = s;
  if (kind === "md" && s.length === 3 && UUID_RE.test(a ?? "") && safeFile(b)) return { kind: "md", chapterId: a, file: b };
  if (kind === "cover" && s.length === 3 && UUID_RE.test(a ?? "") && safeFile(b)) return { kind: "cover", mangaId: a, file: b };
  if (kind === "mock" && a === "cover" && s.length === 3 && SLUG_RE.test(b ?? "")) return { kind: "mock-cover", slug: b };
  if (kind === "mock" && a === "page" && s.length === 5 && SLUG_RE.test(b ?? "") && /^\d{1,4}$/.test(c ?? "") && /^\d{1,3}$/.test(d ?? "")) {
    return { kind: "mock-page", slug: b, chapter: c, n: Number(d) };
  }
  return null;
}

export function isAllowedImageHost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "uploads.mangadex.org" || u.hostname.endsWith(".mangadex.network"));
  } catch {
    return false;
  }
}
