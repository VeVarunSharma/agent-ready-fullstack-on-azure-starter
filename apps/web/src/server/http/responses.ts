import "server-only";

import {
  safeErrorEnvelopeSchema,
  validationErrorEnvelopeSchema,
  type SafeErrorEnvelope,
  type ValidationErrorEnvelope,
} from "@repo/api-contracts/errors";
import type { CorrelationId } from "@repo/api-contracts/correlation";

const safeErrorDefinitions = {
  NOT_FOUND: {
    status: 404,
    message: "The requested API resource was not found.",
  },
  METHOD_NOT_ALLOWED: {
    status: 405,
    message: "The request method is not supported.",
  },
  INTERNAL_ERROR: {
    status: 500,
    message: "The request could not be completed.",
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    message: "The service is not ready.",
  },
} as const;

export type SafeErrorCode = keyof typeof safeErrorDefinitions;

function jsonResponse(
  body: SafeErrorEnvelope | ValidationErrorEnvelope | object,
  status: number,
  correlationId: CorrelationId,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-correlation-id": correlationId,
    },
  });
}

export function safeErrorResponse(
  code: SafeErrorCode,
  correlationId: CorrelationId,
  includeBody = true,
): Response {
  const definition = safeErrorDefinitions[code];
  const envelope = safeErrorEnvelopeSchema.parse({
    error: {
      code,
      message: definition.message,
      correlationId,
    },
  });
  const response = jsonResponse(envelope, definition.status, correlationId);

  return includeBody
    ? response
    : new Response(null, { status: response.status, headers: response.headers });
}

export function validationErrorResponse(
  correlationId: CorrelationId,
  includeBody = true,
): Response {
  const envelope = validationErrorEnvelopeSchema.parse({
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      correlationId,
      issues: [{ code: "invalid_request", path: [] }],
    },
  });
  const response = jsonResponse(envelope, 400, correlationId);

  return includeBody
    ? response
    : new Response(null, { status: response.status, headers: response.headers });
}

export function withSafeResponseHeaders(
  response: Response,
  correlationId: CorrelationId,
  includeBody = true,
): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-correlation-id", correlationId);

  return new Response(includeBody ? response.body : null, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function probeResponse(
  status: "live" | "ready" | "not_ready",
  correlationId: CorrelationId,
  includeBody = true,
): Response {
  const response = jsonResponse(
    { status, correlationId },
    status === "not_ready" ? 503 : 200,
    correlationId,
  );

  return includeBody
    ? response
    : new Response(null, { status: response.status, headers: response.headers });
}
