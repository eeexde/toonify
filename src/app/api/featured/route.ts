import type { NextRequest } from "next/server";
import { POLICIES } from "@/lib/cache/policies";
import { badRequest, errorResponse, jsonResult } from "@/lib/api/respond";
import { effectiveKind, parseFilters } from "@/lib/source/filters";
import { isSourceKey } from "@/lib/source/ids";
import { getSourceService } from "@/lib/source/service-instance";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const source = sp.get("source");
  if (source !== null && !isSourceKey(source)) return badRequest("Invalid source");
  const filters = parseFilters(sp);
  if (filters === null) return badRequest("Invalid filters");
  try {
    return jsonResult(await getSourceService().featured(sp.get("mature") === "1", source ?? undefined, effectiveKind(filters)), POLICIES.featured);
  } catch (err) {
    return errorResponse(err);
  }
}
