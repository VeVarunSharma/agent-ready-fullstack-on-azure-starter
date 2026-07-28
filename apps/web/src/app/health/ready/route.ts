import { checkReadiness } from "../../../server/health/readiness";
import { resolveCorrelationId } from "../../../server/http/correlation-id";
import { probeResponse, safeErrorResponse } from "../../../server/http/responses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function createReadinessResponse(request: Request): Promise<Response> {
  const correlationId = resolveCorrelationId(request.headers);
  const status = await checkReadiness();

  return probeResponse(status, correlationId, request.method.toUpperCase() !== "HEAD");
}

function methodNotAllowed(request: Request): Response {
  const correlationId = resolveCorrelationId(request.headers);
  return safeErrorResponse(
    "METHOD_NOT_ALLOWED",
    correlationId,
    request.method.toUpperCase() !== "HEAD",
  );
}

export const GET = createReadinessResponse;
export const HEAD = createReadinessResponse;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
