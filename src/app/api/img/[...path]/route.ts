import type { NextRequest } from "next/server";
import { parseImgPath } from "@/lib/img/paths";
import { proxyImage } from "@/lib/img/proxy";
import { getSourceService } from "@/lib/source/service-instance";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = parseImgPath(path.map((p) => decodeURIComponent(p)));
  if (!target) return new Response("Bad request", { status: 400 });
  const service = getSourceService();
  return proxyImage(target, {
    atHome: (chapterId, refresh) => service.mdAtHome(chapterId, refresh),
    mockEnabled: process.env.SOURCE_MODE === "mock",
  });
}
