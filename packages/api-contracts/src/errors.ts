import { z } from "zod";

import { correlationIdSchema } from "./correlation";

export const validationIssueCodeSchema = z.enum([
  "invalid_type",
  "required",
  "unrecognized_key",
  "invalid_value",
  "invalid_request",
]);

export const validationIssueSchema = z
  .object({
    code: validationIssueCodeSchema,
    path: z.array(z.union([z.string().max(64), z.number().int().nonnegative()])).max(8),
  })
  .strict();

export const validationErrorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.literal("VALIDATION_ERROR"),
        message: z.literal("Request validation failed."),
        correlationId: correlationIdSchema,
        issues: z.array(validationIssueSchema).max(32),
      })
      .strict(),
  })
  .strict();

export const safeErrorCodeSchema = z.enum([
  "NOT_FOUND",
  "METHOD_NOT_ALLOWED",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
]);

export const safeErrorMessageSchema = z.enum([
  "The requested API resource was not found.",
  "The request method is not supported.",
  "The request could not be completed.",
  "The service is not ready.",
]);

export const safeErrorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: safeErrorCodeSchema,
        message: safeErrorMessageSchema,
        correlationId: correlationIdSchema,
      })
      .strict(),
  })
  .strict();

export type SafeErrorEnvelope = z.infer<typeof safeErrorEnvelopeSchema>;
export type ValidationErrorEnvelope = z.infer<typeof validationErrorEnvelopeSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
