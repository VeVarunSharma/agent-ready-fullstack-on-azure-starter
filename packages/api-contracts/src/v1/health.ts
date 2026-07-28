import { oc } from "@orpc/contract";
import { z } from "zod";

import { correlationIdSchema } from "../correlation";
import { safeErrorEnvelopeSchema, validationErrorEnvelopeSchema } from "../errors";

export const healthResponseSchema = z
  .object({
    status: z.literal("ok"),
    apiVersion: z.literal("v1"),
    correlationId: correlationIdSchema,
  })
  .strict();

export const HEALTH_ROUTE = {
  method: "GET",
  path: "/health",
  summary: "Read the API process health",
  tags: ["Health"],
} as const;

const versionedContract = oc.errors({
  BAD_REQUEST: {
    status: 400,
    message: "Request validation failed.",
    data: validationErrorEnvelopeSchema,
  },
  INTERNAL_SERVER_ERROR: {
    status: 500,
    message: "The request could not be completed.",
    data: safeErrorEnvelopeSchema,
  },
});

export const healthContract = versionedContract.route(HEALTH_ROUTE).output(healthResponseSchema);

export type HealthResponse = z.infer<typeof healthResponseSchema>;
