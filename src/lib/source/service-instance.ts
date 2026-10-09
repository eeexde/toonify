import { createCache } from "../cache/cached";
import { getCacheStore } from "../cache/instance";
import { defer } from "../api/defer";
import { createFetchJson, userAgent } from "./http";
import { MangaDexSource } from "./mangadex";
import { MockSource } from "./mock";
import { ScraperGoSource } from "./scrapergo";
import { SourceService } from "./service";

let service: SourceService | undefined;

export function getSourceService(): SourceService {
  if (service) return service;
  const cache = createCache(getCacheStore(), { defer });
  if (process.env.SOURCE_MODE === "mock") {
    service = new SourceService({ sources: { mock: new MockSource() }, cache, defaultSource: "mock" });
  } else {
    const fetchJson = createFetchJson({ headers: { "User-Agent": userAgent() } });
    service = new SourceService({
      sources: { md: new MangaDexSource({ fetchJson }), sg: new ScraperGoSource({ fetchJson }) },
      cache,
      defaultSource: "md",
    });
  }
  return service;
}
