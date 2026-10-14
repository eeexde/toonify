import type { NextRequest } from "next/server";
import { parseImgPath } from "@/lib/img/paths";
import { defer } from "@/lib/api/defer";
import { proxyImage, type NodeReport } from "@/lib/img/proxy";
import { userAgent } from "@/lib/source/http";
import { getSourceService } from "@/lib/source/service-instance";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  let segs: string[];
  try {
    segs = path.map((p) => decodeURIComponent(p));
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const target = parseImgPath(segs);
  if (!target) return new Response("Bad request", { status: 400 });
  const service = getSourceService();
  return proxyImage(target, {
    atHome: (chapterId, failedBaseUrl) => service.mdAtHome(chapterId, failedBaseUrl),
    mockEnabled: process.env.SOURCE_MODE === "mock",
    report,
  });
}

function report(r: NodeReport) {
  defer(
    fetch("https://api.mangadex.network/report", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": userAgent() },
      body: JSON.stringify(r),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {}),
  );
}
