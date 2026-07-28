import "server-only";

import { apiV1Contract, type HealthResponse } from "@repo/api-contracts/v1";
import type { CorrelationId } from "@repo/api-contracts/correlation";
import { implement } from "@orpc/server";

export interface ApiContext {
  readonly correlationId: CorrelationId;
}

const implementation = implement(apiV1Contract).$context<ApiContext>();

const health = implementation.health.handler(({ context }): HealthResponse => ({
  status: "ok",
  apiVersion: "v1",
  correlationId: context.correlationId,
}));

export const apiV1Router = implementation.router({ health });
