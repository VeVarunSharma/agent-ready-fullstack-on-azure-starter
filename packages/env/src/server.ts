import "server-only";

export {
  AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON,
  EnvironmentConfigurationError,
  getDatabaseConfiguration,
  getTelemetryConfiguration,
  loadServerEnvironment,
  parseServerEnvironment,
  readServerEnvironment,
} from "./runtime";

export type {
  AuthenticationMode,
  AzureMonitorTelemetryConfiguration,
  AzureManagedIdentityDatabaseConfiguration,
  DatabaseConfiguration,
  DatabaseMode,
  DisabledDatabaseConfiguration,
  DisabledTelemetryConfiguration,
  LocalAzureCredentialDatabaseConfiguration,
  LocalPasswordDatabaseConfiguration,
  LoggingMode,
  RuntimeMode,
  ServerEnvironment,
  TelemetryConfiguration,
  TelemetryMode,
} from "./runtime";
