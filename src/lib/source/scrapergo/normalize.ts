import { sortChapters } from "../chapters";
import { encodeId } from "../ids";
import type { Chapter, Title, TitleSummary } from "../types";
import type { z } from "zod";
import type { DetailSchema, ListSchema } from "./schemas";

const NUM_RE = /(\d+(?:\.\d+)?)(?!.*\d)/;

export function chapterNumberOf(chapterId: string, name: string): string | undefined {
  return chapterId.match(NUM_RE)?.[1] ?? name.match(NUM_RE)?.[1];
}

export function toSummaries(body: z.infer<typeof ListSchema>): TitleSummary[] {
  return body.data.map((d) => ({
    id: encodeId("sg", d.manwhaId),
    title: d.title,
    cover: d.image,
    badge: d.status || undefined,
    latest: d.latestEp?.map((e) => ({ label: e.title, date: e.date })),
  }));
}

function asList(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean);
}

export function toTitle(rawId: string, body: z.infer<typeof DetailSchema>): Title {
  const d = body.data;
  const info = Object.assign({}, ...(d.info ?? [])) as Record<string, string | string[]>;
  const chapters: Chapter[] = [];
  for (const c of d.chapters) {
    const number = chapterNumberOf(c.chapterId, c.name);
    if (!number) continue;
    chapters.push({ id: number, number, name: c.name, date: c.releaseDate });
  }
  return {
    id: encodeId("sg", rawId),
    title: d.title,
    altTitles: asList(info["Alt Name"]),
    cover: d.image,
    summary: d.summary ?? "",
    status: d.status,
    authors: asList(info.Author),
    artists: asList(info.Artist),
    genres: asList(info.Genre),
    layout: "strip",
    chapters: sortChapters(chapters),
  };
}
