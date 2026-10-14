import { createCache } from "../cache/cached";
import { getCacheStore } from "../cache/instance";
import { defer } from "../api/defer";
import { createFetchJson, userAgent } from "./http";
import { MangaDexSource } from "./mangadex";
import { MockSource } from "./mock";
import { ScraperGoSource } from "./scrapergo";
import { SourceService } from "./service";

let service: SourceService | undefined;

export function scraperGoEnabled(): boolean {
  return process.env.SOURCE_SCRAPERGO === "1";
}

export function getSourceService(): SourceService {
  if (service) return service;
  const cache = createCache(getCacheStore(), { defer });
  if (process.env.SOURCE_MODE === "mock") {
    service = new SourceService({ sources: { mock: new MockSource() }, cache, defaultSource: "mock" });
  } else {
    const fetchJson = createFetchJson({ headers: { "User-Agent": userAgent() } });
    service = new SourceService({
      sources: {
        md: new MangaDexSource({ fetchJson }),
        // Opt-in only: ScraperGo mirrors a third-party site, so public deploys leave it off.
        ...(scraperGoEnabled() ? { sg: new ScraperGoSource({ fetchJson }) } : {}),
      },
      cache,
      defaultSource: "md",
    });
  }
  return service;
}
