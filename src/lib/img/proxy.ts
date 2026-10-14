import { MOCK_TITLES } from "../source/mock/fixtures";
import type { AtHome } from "../source/mangadex";
import { userAgent } from "../source/http";
import { isAllowedImageHost, type ImgTarget } from "./paths";
import { mockSvg } from "./mock-svg";

const IMMUTABLE = "public, max-age=31536000, immutable";
const UPLOADS = "https://uploads.mangadex.org";

interface Deps {
  /** failedBaseUrl: refresh the at-home server only if the cached one is this node. */
  atHome: (chapterId: string, failedBaseUrl?: string) => Promise<AtHome>;
  fetch?: typeof fetch;
  mockEnabled: boolean;
  /** Called after each MangaDex@Home node fetch, so the node network can be told how it did. */
  report?: (r: NodeReport) => void;
}

/** Body of a MangaDex@Home report: https://api.mangadex.org/docs/04-chapter/retrieving-chapter/ */
export interface NodeReport {
  url: string;
  success: boolean;
  bytes: number;
  duration: number;
  cached: boolean;
}

const IMAGE_TYPE = /^image\/(jpeg|png|webp|gif|avif)\b/i;

const notFound = () => new Response("Not found", { status: 404 });

// At-home nodes get a shorter budget so a dead node cannot eat the whole request.
const NODE_TIMEOUT_MS = 5_000;
const UPLOADS_TIMEOUT_MS = 10_000;

async function tryFetch(
  url: string,
  doFetch: typeof fetch,
  timeoutMs = UPLOADS_TIMEOUT_MS,
  report?: (r: NodeReport) => void,
): Promise<Response | null> {
  if (!isAllowedImageHost(url)) return null;
  const start = Date.now();
  let res: Response | undefined;
  let good = false;
  try {
    res = await doFetch(url, { headers: { "User-Agent": userAgent() }, signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
    good = res.ok && !!res.body && IMAGE_TYPE.test(res.headers.get("Content-Type") ?? "");
    if (!good) await res.body?.cancel().catch(() => {});
  } catch {
    good = false;
  }
  report?.({
    url,
    success: good,
    bytes: good ? Number(res?.headers.get("Content-Length")) || 0 : 0,
    duration: Date.now() - start,
    cached: (res?.headers.get("X-Cache") ?? "").startsWith("HIT"),
  });
  return good ? res! : null;
}

function pass(res: Response): Response {
  return new Response(res.body, {
    status: 200,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg", "Cache-Control": IMMUTABLE, "X-Content-Type-Options": "nosniff" },
  });
}

function svg(body: string): Response {
  return new Response(body, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": IMMUTABLE } });
}

export async function proxyImage(t: ImgTarget, deps: Deps): Promise<Response> {
  const doFetch = deps.fetch ?? fetch;

  if (t.kind === "mock-cover" || t.kind === "mock-page") {
    if (!deps.mockEnabled) return notFound();
    const m = MOCK_TITLES.find((x) => x.slug === t.slug);
    if (!m) return notFound();
    return t.kind === "mock-cover"
      ? svg(mockSvg(m.title, m.hue, 1200))
      : svg(mockSvg(`${m.title} · Ch ${t.chapter} · p${t.n}`, (m.hue + t.n * 25) % 360, 1400));
  }

  if (t.kind === "cover") {
    const res = await tryFetch(`${UPLOADS}/covers/${t.mangaId}/${t.file}`, doFetch);
    return res ? pass(res) : notFound();
  }

  let ah: AtHome;
  try {
    ah = await deps.atHome(t.chapterId);
  } catch {
    return new Response("Source unavailable", { status: 502 });
  }
  if (!ah.files.includes(t.file)) return notFound();
  // MangaDex asks for reports from @Home nodes only, never from uploads.mangadex.org.
  const nodeReport = (r: NodeReport) => {
    if (new URL(r.url).hostname.endsWith(".mangadex.network")) deps.report?.(r);
  };

  let res = await tryFetch(`${ah.baseUrl}/data/${ah.hash}/${t.file}`, doFetch, NODE_TIMEOUT_MS, nodeReport);
  if (!res) {
    try {
      const fresh = await deps.atHome(t.chapterId, ah.baseUrl);
      if (fresh.baseUrl !== ah.baseUrl) {
        res = await tryFetch(`${fresh.baseUrl}/data/${fresh.hash}/${t.file}`, doFetch, NODE_TIMEOUT_MS, nodeReport);
      }
    } catch {
      res = null;
    }
  }
  if (!res) res = await tryFetch(`${UPLOADS}/data/${ah.hash}/${t.file}`, doFetch);
  return res ? pass(res) : new Response("Image unavailable", { status: 502 });
}
