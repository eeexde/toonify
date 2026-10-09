import type { NextRequest } from "next/server";
import { POLICIES } from "@/lib/cache/policies";
import { badRequest, errorResponse, jsonResult, parsePage } from "@/lib/api/respond";
import { isSourceKey } from "@/lib/source/ids";
import { getSourceService } from "@/lib/source/service-instance";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = parsePage(sp.get("page"));
  if (page === null) return badRequest("Invalid page");
  const source = sp.get("source");
  if (source !== null && !isSourceKey(source)) return badRequest("Invalid source");
  try {
    const r = await getSourceService().home(page, sp.get("mature") === "1", source ?? undefined);
    return jsonResult(r, POLICIES.home);
  } catch (err) {
    return errorResponse(err);
  }
}
