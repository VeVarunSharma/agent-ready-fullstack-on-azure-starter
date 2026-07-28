import { z } from "zod";

export const CORRELATION_ID_HEADER = "x-correlation-id" as const;

export const correlationIdSchema = z.uuid().transform((value) => value.toLowerCase());

export type CorrelationId = z.infer<typeof correlationIdSchema>;
