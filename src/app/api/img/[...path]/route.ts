import type { NextRequest } from "next/server";
import { parseImgPath } from "@/lib/img/paths";
import { proxyImage } from "@/lib/img/proxy";
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
  });
}
