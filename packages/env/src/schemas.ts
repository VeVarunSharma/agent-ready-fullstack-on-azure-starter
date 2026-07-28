import { z } from "zod";

const blankToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalNonemptyString = z.preprocess(blankToUndefined, z.string().trim().min(1).optional());
const optionalUuid = z.preprocess(blankToUndefined, z.uuid().optional());
const databasePort = z
  .preprocess(blankToUndefined, z.coerce.number().int().min(1).max(65_535).optional())
  .transform((value) => value ?? 5432);
const poolSize = z
  .preprocess(blankToUndefined, z.coerce.number().int().min(1).max(100).optional())
  .transform((value) => value ?? 10);
const timeoutMilliseconds = z
  .preprocess(blankToUndefined, z.coerce.number().int().min(100).max(30_000).optional())
  .transform((value) => value ?? 2_000);

export const runtimeModeSchema = z.enum(["local", "test", "production"]);
export const databaseModeSchema = z.enum([
  "disabled",
  "local-password",
  "azure-managed-identity",
  "local-azure-credential",
]);
export const authenticationModeSchema = z.enum(["disabled", "container-apps"]);
export const loggingModeSchema = z.enum(["json", "silent"]);
export const telemetryModeSchema = z.enum(["disabled", "azure-monitor"]);

export const AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON =
  "Azure Monitor export is unavailable: stable @azure/monitor-opentelemetry@1.18.2 supports Node.js 24, but it resolves prerelease @azure/monitor-opentelemetry-exporter@1.0.0-beta.43 and its ESM auto-instrumentation requires a Node --import hook before the Next.js 16 server entry point. Both violate the current stable-dependency and startup contracts.";

const databaseFieldNames = ["DATABASE_HOST", "DATABASE_NAME", "DATABASE_USER"] as const;
const unsupportedRuntimeFieldNames = [
  "DATABASE_URL",
  "DATABASE_SSL_MODE",
  "AUTH_ALLOWED_IDENTITIES_JSON",
] as const;

export const serverEnvironmentSchema = z
  .object({
    RUNTIME_MODE: runtimeModeSchema,
    DATABASE_MODE: databaseModeSchema,
    AUTH_MODE: authenticationModeSchema,
    LOGGING_MODE: loggingModeSchema,
    TELEMETRY_MODE: telemetryModeSchema,
    DATABASE_HOST: optionalNonemptyString,
    DATABASE_PORT: databasePort,
    DATABASE_NAME: optionalNonemptyString,
    DATABASE_USER: optionalNonemptyString,
    DATABASE_PASSWORD: optionalNonemptyString,
    DATABASE_URL: optionalNonemptyString,
    DATABASE_SSL_MODE: optionalNonemptyString,
    DATABASE_POOL_MAX: poolSize,
    DATABASE_PROBE_TIMEOUT_MS: timeoutMilliseconds,
    AZURE_CLIENT_ID: optionalUuid,
    AUTH_ALLOWED_IDENTITIES_JSON: optionalNonemptyString,
    APPLICATIONINSIGHTS_CONNECTION_STRING: optionalNonemptyString,
  })
  .superRefine((environment, context) => {
    for (const fieldName of unsupportedRuntimeFieldNames) {
      if (environment[fieldName] !== undefined) {
        context.addIssue({
          code: "custom",
          message: `${fieldName} is not part of the runtime contract.`,
          path: [fieldName],
        });
      }
    }

    if (environment.DATABASE_MODE !== "disabled") {
      for (const fieldName of databaseFieldNames) {
        if (environment[fieldName] === undefined) {
          context.addIssue({
            code: "custom",
            message: `${fieldName} is required when the database is enabled.`,
            path: [fieldName],
          });
        }
      }
    }

    if (
      environment.DATABASE_MODE === "local-password" &&
      environment.DATABASE_PASSWORD === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "DATABASE_PASSWORD is required for local password authentication.",
        path: ["DATABASE_PASSWORD"],
      });
    }

    if (
      environment.DATABASE_MODE !== "local-password" &&
      environment.DATABASE_PASSWORD !== undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "DATABASE_PASSWORD is restricted to explicit local password mode.",
        path: ["DATABASE_PASSWORD"],
      });
    }

    if (
      environment.DATABASE_MODE === "azure-managed-identity" &&
      environment.AZURE_CLIENT_ID === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "AZURE_CLIENT_ID is required for managed identity authentication.",
        path: ["AZURE_CLIENT_ID"],
      });
    }

    if (
      environment.DATABASE_MODE === "local-azure-credential" &&
      environment.RUNTIME_MODE !== "local"
    ) {
      context.addIssue({
        code: "custom",
        message: "Default Azure credentials are restricted to explicit local mode.",
        path: ["DATABASE_MODE"],
      });
    }

    if (
      environment.RUNTIME_MODE === "production" &&
      environment.DATABASE_MODE === "local-password"
    ) {
      context.addIssue({
        code: "custom",
        message: "Password database authentication is not permitted in production.",
        path: ["DATABASE_MODE"],
      });
    }

    if (environment.RUNTIME_MODE === "production" && environment.AUTH_MODE !== "container-apps") {
      context.addIssue({
        code: "custom",
        message: "Container Apps authentication is required in production.",
        path: ["AUTH_MODE"],
      });
    }

    if (environment.RUNTIME_MODE === "production" && environment.LOGGING_MODE !== "json") {
      context.addIssue({
        code: "custom",
        message: "Structured JSON logging is required in production.",
        path: ["LOGGING_MODE"],
      });
    }

    if (environment.TELEMETRY_MODE === "azure-monitor") {
      if (environment.APPLICATIONINSIGHTS_CONNECTION_STRING === undefined) {
        context.addIssue({
          code: "custom",
          message:
            "An Application Insights connection string is required for Azure Monitor export.",
          path: ["APPLICATIONINSIGHTS_CONNECTION_STRING"],
        });
      }

      context.addIssue({
        code: "custom",
        message: AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON,
        path: ["TELEMETRY_MODE"],
      });
    }

    if (
      environment.TELEMETRY_MODE === "disabled" &&
      environment.APPLICATIONINSIGHTS_CONNECTION_STRING !== undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Azure Monitor configuration is prohibited when telemetry export is disabled.",
        path: ["APPLICATIONINSIGHTS_CONNECTION_STRING"],
      });
    }
  });

export const clientEnvironmentSchema = z
  .object({
    NEXT_PUBLIC_RUNTIME_MODE: runtimeModeSchema,
  })
  .strict();

export type AuthenticationMode = z.infer<typeof authenticationModeSchema>;
export type ClientEnvironment = z.infer<typeof clientEnvironmentSchema>;
export type DatabaseMode = z.infer<typeof databaseModeSchema>;
export type LoggingMode = z.infer<typeof loggingModeSchema>;
export type RuntimeMode = z.infer<typeof runtimeModeSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type TelemetryMode = z.infer<typeof telemetryModeSchema>;
