import type { NextRequest } from "next/server";
import { POLICIES } from "@/lib/cache/policies";
import { badRequest, errorResponse, jsonResult } from "@/lib/api/respond";
import { isSourceKey } from "@/lib/source/ids";
import { getSourceService } from "@/lib/source/service-instance";

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source");
  if (source !== null && !isSourceKey(source)) return badRequest("Invalid source");
  try {
    return jsonResult(await getSourceService().tags(source ?? undefined), POLICIES.tags);
  } catch (err) {
    return errorResponse(err);
  }
}
