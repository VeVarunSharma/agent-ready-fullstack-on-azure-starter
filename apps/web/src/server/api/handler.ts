import "server-only";

import { HEALTH_ROUTE } from "@repo/api-contracts/v1";
import { readServerEnvironment } from "@repo/env/server";

import { resolveCorrelationId } from "../http/correlation-id";
import {
  safeErrorResponse,
  validationErrorResponse,
  withSafeResponseHeaders,
} from "../http/responses";
import { createServerLogger, type ServerLogger } from "../observability/logger";
import { dispatchOpenApiRequest } from "./openapi-dispatch";
import type { ApiContext } from "./router";

export type ApiDispatch = (request: Request, context: ApiContext) => Promise<Response | undefined>;

export interface ApiRequestHandlerDependencies {
  readonly dispatch?: ApiDispatch;
  readonly logger?: ServerLogger;
  readonly now?: () => number;
}

function createRuntimeLogger(): ServerLogger {
  const environment = readServerEnvironment();
  return createServerLogger({
    mode: environment.success ? environment.data.LOGGING_MODE : "silent",
  });
}

function normalizeErrorResponse(
  response: Response,
  correlationId: ApiContext["correlationId"],
  includeBody: boolean,
): Response {
  if (response.status === 400 || response.status === 422) {
    return validationErrorResponse(correlationId, includeBody);
  }
  if (response.status === 404) {
    return safeErrorResponse("NOT_FOUND", correlationId, includeBody);
  }
  if (response.status === 405) {
    return safeErrorResponse("METHOD_NOT_ALLOWED", correlationId, includeBody);
  }

  return safeErrorResponse("INTERNAL_ERROR", correlationId, includeBody);
}

function isKnownApiPath(request: Request): boolean {
  return new URL(request.url).pathname === `/api/v1${HEALTH_ROUTE.path}`;
}

export function createApiV1RequestHandler(dependencies: ApiRequestHandlerDependencies = {}) {
  const dispatch = dependencies.dispatch ?? dispatchOpenApiRequest;
  const logger = dependencies.logger ?? createRuntimeLogger();
  const now = dependencies.now ?? performance.now.bind(performance);

  return async (request: Request): Promise<Response> => {
    const startedAt = now();
    const correlationId = resolveCorrelationId(request.headers);
    const context = { correlationId };
    const includeBody = request.method.toUpperCase() !== "HEAD";

    try {
      const response = await dispatch(request, context);
      const normalized =
        response === undefined
          ? safeErrorResponse(
              isKnownApiPath(request) ? "METHOD_NOT_ALLOWED" : "NOT_FOUND",
              correlationId,
              includeBody,
            )
          : response.ok
            ? withSafeResponseHeaders(response, correlationId, includeBody)
            : normalizeErrorResponse(response, correlationId, includeBody);

      logger.info("api.request.completed", {
        component: "api",
        correlationId,
        durationMs: Math.max(0, now() - startedAt),
        outcome: normalized.ok ? "success" : "failure",
        statusCode: normalized.status,
      });

      return normalized;
    } catch {
      logger.error("api.request.failed", {
        component: "api",
        correlationId,
        durationMs: Math.max(0, now() - startedAt),
        outcome: "failure",
        statusCode: 500,
      });
      return safeErrorResponse("INTERNAL_ERROR", correlationId, includeBody);
    }
  };
}

export const handleApiV1Request = createApiV1RequestHandler();
