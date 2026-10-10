import type { CacheApi, CachedResult } from "../cache/cached";
import { POLICIES } from "../cache/policies";
import { InvalidIdError } from "./errors";
import { decodeId, type SourceKey } from "./ids";
import { mdChapterPages, UUID_RE, type AtHome, type MangaDexSource } from "./mangadex";
import type { ChapterPages, Page, Source, Title, TitleId, TitleSummary } from "./types";

export class SourceService {
  constructor(private deps: { sources: Partial<Record<SourceKey, Source>>; cache: CacheApi; defaultSource: SourceKey }) {}

  enabledSources(): SourceKey[] {
    return Object.keys(this.deps.sources) as SourceKey[];
  }

  private get(key: SourceKey | undefined): { key: SourceKey; src: Source } {
    const k = key ?? this.deps.defaultSource;
    const src = this.deps.sources[k];
    if (!src) throw new InvalidIdError(`Source "${k}" is not enabled`);
    return { key: k, src };
  }

  /** List endpoints: an unknown or disabled requested source falls back to the default. */
  private list(key: SourceKey | undefined) {
    return this.get(key && this.deps.sources[key] ? key : undefined);
  }

  async home(page: number, mature: boolean, source?: SourceKey): Promise<CachedResult<Page<TitleSummary>>> {
    const { key, src } = this.list(source);
    return this.deps.cache.cached(`v1:${key}:home:${page}:${mature ? 1 : 0}`, POLICIES.home, () => src.home(page, { mature }));
  }

  async search(q: string, page: number, mature: boolean, source?: SourceKey): Promise<CachedResult<Page<TitleSummary>>> {
    const { key, src } = this.list(source);
    const norm = q.trim().replace(/\s+/g, " ");
    return this.deps.cache.cached(
      `v1:${key}:search:${encodeURIComponent(norm.toLowerCase())}:${page}:${mature ? 1 : 0}`,
      POLICIES.search,
      () => src.search(norm, page, { mature }),
    );
  }

  async title(id: TitleId): Promise<CachedResult<Title>> {
    const { source, raw } = decodeId(id);
    const { src } = this.get(source);
    return this.deps.cache.cached(`v1:${source}:title:${raw}`, POLICIES.title, () => src.title(raw));
  }

  async chapter(titleId: TitleId, chapterId: string): Promise<CachedResult<ChapterPages>> {
    const { source, raw } = decodeId(titleId);
    const { src } = this.get(source);
    const key = `v1:${source}:chapter:${raw}:${chapterId}`;
    if (source === "md") {
      // Reuse the at-home cache so the reader's page list and image proxy share one upstream call.
      return this.deps.cache.cached(key, POLICIES.chapter, async () => {
        if (!UUID_RE.test(raw) || !UUID_RE.test(chapterId)) throw new InvalidIdError();
        return mdChapterPages(raw, chapterId, await this.mdAtHome(chapterId));
      });
    }
    return this.deps.cache.cached(key, POLICIES.chapter, () => src.chapter(raw, chapterId));
  }

  /**
   * At-home server for a chapter. Pass `failedBaseUrl` after an image fetch from that node failed:
   * the cache is refreshed only if it still holds that node, so concurrent image failures share one
   * upstream refresh instead of each spending the at-home rate limit.
   */
  async mdAtHome(chapterId: string, failedBaseUrl?: string): Promise<AtHome> {
    const md = this.deps.sources.md as MangaDexSource | undefined;
    if (!md) throw new InvalidIdError("MangaDex is not enabled");
    const key = `v1:md:athome:${chapterId}`;
    const load = async () => (await this.deps.cache.cached(key, POLICIES.atHome, () => md.atHome(chapterId))).value;
    const current = await load();
    if (!failedBaseUrl || current.baseUrl !== failedBaseUrl) return current;
    await this.deps.cache.invalidate(key);
    return load();
  }

  health(): Promise<CachedResult<Record<string, "up" | "down">>> {
    return this.deps.cache.cached("v1:health", POLICIES.health, async () => {
      const out: Record<string, "up" | "down"> = {};
      await Promise.all(
        this.enabledSources().map(async (k) => {
          try {
            await this.deps.sources[k]!.home(1, { mature: false });
            out[k] = "up";
          } catch {
            out[k] = "down";
          }
        }),
      );
      return out;
    });
  }
}
