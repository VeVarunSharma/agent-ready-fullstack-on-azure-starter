import {
  getDatabaseConfiguration,
  parseServerEnvironment,
  type LocalPasswordDatabaseConfiguration,
} from "@repo/env/tooling";

export const localDatabaseDefaults = {
  database: "foundation_local",
  host: "127.0.0.1",
  password: "local-only-do-not-use-in-production",
  port: 5432,
  user: "foundation_local",
} as const;

export function loadLocalDatabaseConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): LocalPasswordDatabaseConfiguration {
  if (environment.DATABASE_MODE !== undefined && environment.DATABASE_MODE !== "local-password") {
    throw new Error("Local database tooling requires explicit local password mode.");
  }

  const parsedEnvironment = parseServerEnvironment({
    ...environment,
    AUTH_MODE: environment.AUTH_MODE ?? "disabled",
    DATABASE_HOST: environment.DATABASE_HOST ?? localDatabaseDefaults.host,
    DATABASE_MODE: environment.DATABASE_MODE ?? "local-password",
    DATABASE_NAME: environment.DATABASE_NAME ?? localDatabaseDefaults.database,
    DATABASE_PASSWORD: environment.DATABASE_PASSWORD ?? localDatabaseDefaults.password,
    DATABASE_POOL_MAX: environment.DATABASE_POOL_MAX ?? "4",
    DATABASE_PORT: environment.DATABASE_PORT ?? String(localDatabaseDefaults.port),
    DATABASE_PROBE_TIMEOUT_MS: environment.DATABASE_PROBE_TIMEOUT_MS ?? "2000",
    DATABASE_USER: environment.DATABASE_USER ?? localDatabaseDefaults.user,
    LOGGING_MODE: environment.LOGGING_MODE ?? "json",
    RUNTIME_MODE: environment.RUNTIME_MODE ?? "local",
    TELEMETRY_MODE: environment.TELEMETRY_MODE ?? "disabled",
  });
  const configuration = getDatabaseConfiguration(parsedEnvironment);

  if (configuration.mode !== "local-password") {
    throw new Error("Local database tooling requires explicit local password mode.");
  }

  return configuration;
}
