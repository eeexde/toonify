import { sortChapters } from "../chapters";
import { NotFoundError } from "../errors";
import { encodeId } from "../ids";
import { effectiveRatings, type Tag } from "../filters";
import type { Chapter, ChapterPages, ListOpts, Page, Source, Title, TitleSummary } from "../types";
import { MOCK_PAGES_PER_CHAPTER, MOCK_TITLES, type MockTitle } from "./fixtures";

function summary(t: MockTitle): TitleSummary {
  return {
    id: encodeId("mock", t.slug),
    title: t.title,
    cover: `/api/img/mock/cover/${t.slug}`,
    badge: t.rating === "erotica" ? "18+" : undefined,
    status: t.status,
  };
}

function chaptersOf(t: MockTitle): Chapter[] {
  const out: Chapter[] = [];
  for (let n = 1; n <= t.readable; n++) {
    out.push({ id: String(n), number: String(n), name: `Ch. ${n}`, date: "2026-10-01T00:00:00Z", group: "Mock Scans" });
  }
  if (t.external) out.push({ id: String(t.external), number: String(t.external), name: `Ch. ${t.external}`, externalUrl: "https://example.com/official" });
  return sortChapters(out);
}

const tagId = (genre: string) => genre.toLowerCase().replace(/\s+/g, "-");

function find(slug: string): MockTitle {
  const t = MOCK_TITLES.find((m) => m.slug === slug);
  if (!t) throw new NotFoundError();
  return t;
}

export class MockSource implements Source {
  private visible(opts: ListOpts) {
    const ratings = effectiveRatings(opts.mature, opts.ratings);
    const out = MOCK_TITLES.filter(
      (t) => ratings.includes(t.rating) && (opts.tags ?? []).every((id) => t.genres.some((g) => tagId(g) === id)),
    );
    if (opts.sort === "title") return [...out].sort((a, b) => a.title.localeCompare(b.title));
    if (opts.sort === "newest") return [...out].reverse();
    return out;
  }

  async tags(): Promise<Tag[]> {
    const genres = [...new Set(MOCK_TITLES.flatMap((t) => t.genres))];
    return genres.map((g) => ({ id: tagId(g), name: g, group: "genre" })).sort((a, b) => a.id.localeCompare(b.id));
  }

  async home(page: number, opts: ListOpts): Promise<Page<TitleSummary>> {
    return { items: page === 1 ? this.visible(opts).map(summary) : [], page, hasMore: false };
  }

  async search(q: string, page: number, opts: ListOpts): Promise<Page<TitleSummary>> {
    const needle = q.toLowerCase();
    const items = this.visible(opts).filter((t) => t.title.toLowerCase().includes(needle)).map(summary);
    return { items: page === 1 ? items : [], page, hasMore: false };
  }

  async title(rawId: string): Promise<Title> {
    const t = find(rawId);
    return {
      id: encodeId("mock", t.slug),
      title: t.title,
      altTitles: [],
      cover: `/api/img/mock/cover/${t.slug}`,
      summary: t.summary,
      status: "ongoing",
      authors: ["Mock Author"],
      artists: ["Mock Artist"],
      genres: t.genres,
      contentRating: t.rating,
      chapters: chaptersOf(t),
    };
  }

  async chapter(rawId: string, chapterId: string): Promise<ChapterPages> {
    const t = find(rawId);
    const ch = chaptersOf(t).find((c) => c.id === chapterId && !c.externalUrl);
    if (!ch) throw new NotFoundError();
    return {
      titleId: encodeId("mock", t.slug),
      chapterId,
      pages: Array.from({ length: MOCK_PAGES_PER_CHAPTER }, (_, i) => `/api/img/mock/page/${t.slug}/${chapterId}/${i + 1}`),
    };
  }
}
