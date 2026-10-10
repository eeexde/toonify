import { encodeId } from "../ids";
import { sortChapters } from "../chapters";
import type { Chapter, FeaturedItem, Title, TitleSummary } from "../types";
import type { MdChapter, MdManga } from "./schemas";

const MATURE = new Set(["erotica", "pornographic"]);

function relNames(m: MdManga, type: string): string[] {
  return m.relationships
    .filter((r) => r.type === type && typeof r.attributes?.name === "string")
    .map((r) => r.attributes!.name as string);
}

export function pickTitle(m: MdManga): string {
  const a = m.attributes;
  return a.title.en ?? a.altTitles.find((t) => t.en)?.en ?? Object.values(a.title)[0] ?? "Untitled";
}

export function coverUrl(m: MdManga): string {
  const rel = m.relationships.find((r) => r.type === "cover_art");
  const file = rel?.attributes?.fileName;
  return typeof file === "string" ? `/api/img/cover/${m.id}/${file}.512.jpg` : "/placeholder-cover.svg";
}

export function toSummary(m: MdManga): TitleSummary {
  return {
    id: encodeId("md", m.id),
    title: pickTitle(m),
    cover: coverUrl(m),
    badge: MATURE.has(m.attributes.contentRating) ? "18+" : undefined,
    status: m.attributes.status ?? undefined,
  };
}

function httpUrl(u: string | null | undefined): string | undefined {
  return u && /^https?:\/\//i.test(u) ? u : undefined;
}

/** A chapter with no pages and no usable external link cannot be read anywhere. */
export function isUsableChapter(c: MdChapter): boolean {
  return c.attributes.pages > 0 || httpUrl(c.attributes.externalUrl) !== undefined;
}

const SYNOPSIS_MAX = 280;

/** First paragraph of the English synopsis, markdown links reduced to their text, clipped for a banner. */
export function synopsis(m: MdManga): string {
  const d = m.attributes.description;
  const raw = (d.en ?? Object.values(d)[0] ?? "").split(/\n\s*\n/)[0].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
  return raw.length > SYNOPSIS_MAX ? `${raw.slice(0, SYNOPSIS_MAX).replace(/\s+\S*$/, "")}…` : raw;
}

export function toFeatured(m: MdManga): FeaturedItem {
  return {
    ...toSummary(m),
    summary: synopsis(m),
    genres: m.attributes.tags
      .filter((t) => t.attributes.group === "genre")
      .map((t) => t.attributes.name.en ?? Object.values(t.attributes.name)[0])
      .filter(Boolean)
      .slice(0, 3),
  };
}

export function toChapter(c: MdChapter): Chapter {
  const a = c.attributes;
  const group = c.relationships.find((r) => r.type === "scanlation_group")?.attributes?.name;
  const base = a.chapter ? `Ch. ${a.chapter}` : "Oneshot";
  const name = a.chapter ? (a.title ? `${base}: ${a.title}` : base) : a.title ?? base;
  return {
    id: c.id,
    number: a.chapter ?? undefined,
    name,
    date: a.readableAt ?? a.publishAt,
    group: typeof group === "string" ? group : undefined,
    externalUrl: a.pages === 0 ? httpUrl(a.externalUrl) : undefined,
  };
}

export function toTitle(m: MdManga, chapters: MdChapter[]): Title {
  const a = m.attributes;
  return {
    id: encodeId("md", m.id),
    title: pickTitle(m),
    altTitles: a.altTitles.flatMap((t) => Object.values(t)),
    cover: coverUrl(m),
    summary: a.description.en ?? Object.values(a.description)[0] ?? "",
    status: a.status ?? undefined,
    authors: relNames(m, "author"),
    artists: relNames(m, "artist"),
    genres: a.tags.map((t) => t.attributes.name.en ?? Object.values(t.attributes.name)[0]).filter(Boolean),
    contentRating: a.contentRating,
    chapters: sortChapters(chapters.filter(isUsableChapter).map(toChapter)),
  };
}
