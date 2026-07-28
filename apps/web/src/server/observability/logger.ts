import "server-only";

import { trace } from "@opentelemetry/api";
import { pino, stdTimeFunctions, type DestinationStream, type Logger as PinoLogger } from "pino";
import { z } from "zod";

const logEventSchema = z.enum([
  "api.request.completed",
  "api.request.failed",
  "auth.principal.malformed",
  "database.probe.completed",
  "runtime.configuration.invalid",
  "telemetry.initialized",
]);

const logFieldSchema = z
  .object({
    correlationId: z.uuid().optional(),
    traceId: z
      .string()
      .regex(/^[\da-f]{32}$/u)
      .optional(),
    spanId: z
      .string()
      .regex(/^[\da-f]{16}$/u)
      .optional(),
    durationMs: z.number().nonnegative().max(300_000).optional(),
    statusCode: z.number().int().min(100).max(599).optional(),
    outcome: z.enum(["success", "failure", "skipped"]).optional(),
    component: z.enum(["api", "auth", "database", "runtime", "telemetry"]).optional(),
    databaseEnabled: z.boolean().optional(),
    authState: z.enum(["absent", "malformed", "valid"]).optional(),
    telemetryMode: z.enum(["disabled", "azure-monitor"]).optional(),
  })
  .strip();

export type LogEvent = z.infer<typeof logEventSchema>;
export type SafeLogFields = z.infer<typeof logFieldSchema>;

export interface ServerLogger {
  info(event: LogEvent, fields?: unknown): void;
  warn(event: LogEvent, fields?: unknown): void;
  error(event: LogEvent, fields?: unknown): void;
}

export interface CreateServerLoggerOptions {
  readonly mode: "json" | "silent";
  readonly destination?: DestinationStream;
}

const prohibitedFieldNames = [
  "authorization",
  "authorizationHeader",
  "authHeader",
  "headers",
  "requestHeaders",
  "responseHeaders",
  "cookie",
  "cookies",
  "token",
  "accessToken",
  "refreshToken",
  "connectionString",
  "applicationInsightsConnectionString",
  "instrumentationKey",
  "body",
  "requestBody",
  "responseBody",
  "query",
  "queryString",
  "url",
  "prompt",
  "completion",
  "upload",
  "freeText",
] as const;
const prohibitedPaths = prohibitedFieldNames.flatMap((fieldName) => [fieldName, `*.${fieldName}`]);

export function sanitizeLogFields(fields: unknown): SafeLogFields {
  const parsed = logFieldSchema.safeParse(fields);
  return parsed.success ? parsed.data : {};
}

function activeTraceFields(): SafeLogFields {
  const context = trace.getActiveSpan()?.spanContext();
  if (!context?.traceId || !context.spanId) {
    return {};
  }

  return sanitizeLogFields({
    traceId: context.traceId,
    spanId: context.spanId,
  });
}

function writeLog(
  logger: PinoLogger,
  level: "info" | "warn" | "error",
  event: LogEvent,
  fields: unknown,
): void {
  const record = {
    event: logEventSchema.parse(event),
    ...activeTraceFields(),
    ...sanitizeLogFields(fields),
  };
  logger[level](record);
}

export function createServerLogger({ mode, destination }: CreateServerLoggerOptions): ServerLogger {
  const logger = pino(
    {
      level: mode === "silent" ? "silent" : "info",
      base: null,
      timestamp: stdTimeFunctions.isoTime,
      redact: {
        paths: [...prohibitedPaths],
        censor: "[REDACTED]",
      },
    },
    destination,
  );

  return {
    info: (event, fields) => {
      writeLog(logger, "info", event, fields);
    },
    warn: (event, fields) => {
      writeLog(logger, "warn", event, fields);
    },
    error: (event, fields) => {
      writeLog(logger, "error", event, fields);
    },
  };
}
