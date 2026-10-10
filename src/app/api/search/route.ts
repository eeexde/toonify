import type { NextRequest } from "next/server";
import { POLICIES } from "@/lib/cache/policies";
import { badRequest, errorResponse, jsonResult, parsePage } from "@/lib/api/respond";
import { parseFilters } from "@/lib/source/filters";
import { isSourceKey } from "@/lib/source/ids";
import { getSourceService } from "@/lib/source/service-instance";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 100) return badRequest("Query must be 2-100 characters");
  const page = parsePage(sp.get("page"));
  if (page === null) return badRequest("Invalid page");
  const source = sp.get("source");
  if (source !== null && !isSourceKey(source)) return badRequest("Invalid source");
  const filters = parseFilters(sp);
  if (filters === null) return badRequest("Invalid filters");
  try {
    const r = await getSourceService().search(q, page, sp.get("mature") === "1", source ?? undefined, filters);
    return jsonResult(r, POLICIES.search);
  } catch (err) {
    return errorResponse(err);
  }
}
