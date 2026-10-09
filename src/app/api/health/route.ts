import { POLICIES } from "@/lib/cache/policies";
import { errorResponse, jsonResult } from "@/lib/api/respond";
import { getSourceService } from "@/lib/source/service-instance";

export async function GET() {
  try {
    return jsonResult(await getSourceService().health(), POLICIES.health);
  } catch (err) {
    return errorResponse(err);
  }
}
