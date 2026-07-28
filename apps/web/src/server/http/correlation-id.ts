import "server-only";

import { randomUUID } from "node:crypto";

import {
  CORRELATION_ID_HEADER,
  correlationIdSchema,
  type CorrelationId,
} from "@repo/api-contracts/correlation";

export function resolveCorrelationId(headers: Headers): CorrelationId {
  const candidate = headers.get(CORRELATION_ID_HEADER);
  const parsed = correlationIdSchema.safeParse(candidate);

  return parsed.success ? parsed.data : correlationIdSchema.parse(randomUUID());
}
