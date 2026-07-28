import { serverEnvironmentSchema, type ServerEnvironment } from "./schemas";

export {
  AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON,
  authenticationModeSchema,
  databaseModeSchema,
  loggingModeSchema,
  runtimeModeSchema,
  serverEnvironmentSchema,
  telemetryModeSchema,
  type AuthenticationMode,
  type DatabaseMode,
  type LoggingMode,
  type RuntimeMode,
  type ServerEnvironment,
  type TelemetryMode,
} from "./schemas";

export interface DisabledDatabaseConfiguration {
  readonly mode: "disabled";
}

export interface LocalPasswordDatabaseConfiguration {
  readonly mode: "local-password";
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly poolMax: number;
  readonly probeTimeoutMs: number;
}

export interface AzureManagedIdentityDatabaseConfiguration {
  readonly mode: "azure-managed-identity";
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly managedIdentityClientId: string;
  readonly poolMax: number;
  readonly probeTimeoutMs: number;
}

export interface LocalAzureCredentialDatabaseConfiguration {
  readonly mode: "local-azure-credential";
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly poolMax: number;
  readonly probeTimeoutMs: number;
}

export type DatabaseConfiguration =
  | DisabledDatabaseConfiguration
  | LocalPasswordDatabaseConfiguration
  | AzureManagedIdentityDatabaseConfiguration
  | LocalAzureCredentialDatabaseConfiguration;

export interface DisabledTelemetryConfiguration {
  readonly mode: "disabled";
}

export interface AzureMonitorTelemetryConfiguration {
  readonly mode: "azure-monitor";
  readonly connectionString: string;
}

export type TelemetryConfiguration =
  DisabledTelemetryConfiguration | AzureMonitorTelemetryConfiguration;

export class EnvironmentConfigurationError extends Error {
  readonly fields: readonly string[];

  constructor(fields: readonly string[]) {
    super("Runtime configuration is invalid.");
    this.name = "EnvironmentConfigurationError";
    this.fields = fields;
  }
}

function requiredValue(value: string | undefined, fieldName: string): string {
  if (value === undefined) {
    throw new EnvironmentConfigurationError([fieldName]);
  }

  return value;
}

function databaseConnectionFields(environment: ServerEnvironment) {
  return {
    host: requiredValue(environment.DATABASE_HOST, "DATABASE_HOST"),
    port: environment.DATABASE_PORT,
    database: requiredValue(environment.DATABASE_NAME, "DATABASE_NAME"),
    user: requiredValue(environment.DATABASE_USER, "DATABASE_USER"),
    poolMax: environment.DATABASE_POOL_MAX,
    probeTimeoutMs: environment.DATABASE_PROBE_TIMEOUT_MS,
  };
}

export function getDatabaseConfiguration(environment: ServerEnvironment): DatabaseConfiguration {
  switch (environment.DATABASE_MODE) {
    case "disabled":
      return { mode: "disabled" };
    case "local-password":
      return {
        mode: "local-password",
        ...databaseConnectionFields(environment),
        password: requiredValue(environment.DATABASE_PASSWORD, "DATABASE_PASSWORD"),
      };
    case "azure-managed-identity":
      return {
        mode: "azure-managed-identity",
        ...databaseConnectionFields(environment),
        managedIdentityClientId: requiredValue(environment.AZURE_CLIENT_ID, "AZURE_CLIENT_ID"),
      };
    case "local-azure-credential":
      return {
        mode: "local-azure-credential",
        ...databaseConnectionFields(environment),
      };
  }
}

export function getTelemetryConfiguration(environment: ServerEnvironment): TelemetryConfiguration {
  switch (environment.TELEMETRY_MODE) {
    case "disabled":
      return { mode: "disabled" };
    case "azure-monitor":
      return {
        mode: "azure-monitor",
        connectionString: requiredValue(
          environment.APPLICATIONINSIGHTS_CONNECTION_STRING,
          "APPLICATIONINSIGHTS_CONNECTION_STRING",
        ),
      };
  }
}

export function parseServerEnvironment(input: unknown): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(input);

  if (!result.success) {
    const fields = [
      ...new Set(
        result.error.issues.flatMap((issue) => {
          const field = issue.path[0];
          return typeof field === "string" ? [field] : [];
        }),
      ),
    ].sort();
    throw new EnvironmentConfigurationError(fields);
  }

  return result.data;
}

export function readServerEnvironment() {
  return serverEnvironmentSchema.safeParse(process.env);
}

export function loadServerEnvironment(): ServerEnvironment {
  return parseServerEnvironment(process.env);
}

export function createLocalDatabaseUrl(configuration: LocalPasswordDatabaseConfiguration): string {
  const username = encodeURIComponent(configuration.user);
  const password = encodeURIComponent(configuration.password);
  const database = encodeURIComponent(configuration.database);

  return `postgresql://${username}:${password}@${configuration.host}:${String(configuration.port)}/${database}`;
}
