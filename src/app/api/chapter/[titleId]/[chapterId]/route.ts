import type { NextRequest } from "next/server";
import { POLICIES } from "@/lib/cache/policies";
import { badRequest, errorResponse, jsonResult } from "@/lib/api/respond";
import { getSourceService } from "@/lib/source/service-instance";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ titleId: string; chapterId: string }> },
) {
  const { titleId, chapterId } = await params;
  let chapter: string;
  try {
    chapter = decodeURIComponent(chapterId);
  } catch {
    return badRequest("Invalid id");
  }
  try {
    const r = await getSourceService().chapter(titleId, chapter);
    return jsonResult(r, POLICIES.chapter);
  } catch (err) {
    return errorResponse(err);
  }
}
