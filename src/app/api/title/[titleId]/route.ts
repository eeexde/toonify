import type { NextRequest } from "next/server";
import { POLICIES } from "@/lib/cache/policies";
import { errorResponse, jsonResult } from "@/lib/api/respond";
import { getSourceService } from "@/lib/source/service-instance";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ titleId: string }> }) {
  const { titleId } = await params;
  try {
    return jsonResult(await getSourceService().title(decodeURIComponent(titleId)), POLICIES.title);
  } catch (err) {
    return errorResponse(err);
  }
}
