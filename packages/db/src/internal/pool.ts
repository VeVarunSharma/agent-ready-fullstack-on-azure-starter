import type {
  AzureManagedIdentityDatabaseConfiguration,
  DatabaseConfiguration,
  LocalAzureCredentialDatabaseConfiguration,
} from "@repo/env/server";
import { Pool, type PoolConfig } from "pg";

import {
  createAzureTokenProvider,
  type AzureDatabaseConfiguration,
  type DatabasePasswordProvider,
} from "./token-provider";

type EnabledDatabaseConfiguration = Exclude<DatabaseConfiguration, { readonly mode: "disabled" }>;

const RUNTIME_CONNECTION_TIMEOUT_MS = 10_000;
const READINESS_CONNECTION_TIMEOUT_MS = 10_000;
const READINESS_IDLE_TIMEOUT_MS = 30_000;
const MIGRATION_CONNECTION_TIMEOUT_MS = 30_000;

export type TokenProviderFactory = (
  configuration:
    AzureManagedIdentityDatabaseConfiguration | LocalAzureCredentialDatabaseConfiguration,
) => DatabasePasswordProvider;

export interface PoolConfigurationDependencies {
  readonly tokenProviderFactory?: TokenProviderFactory;
}

export class DatabaseDisabledError extends Error {
  constructor() {
    super("The database is explicitly disabled.");
    this.name = "DatabaseDisabledError";
  }
}

interface PoolProfile {
  readonly applicationName: string;
  readonly connectionTimeoutMs: number;
  readonly idleTimeoutMs?: number;
  readonly max: number;
  readonly queryTimeoutMs?: number;
}

function commonPoolConfiguration(
  configuration: EnabledDatabaseConfiguration,
  profile: PoolProfile,
): PoolConfig {
  return {
    host: configuration.host,
    port: configuration.port,
    database: configuration.database,
    user: configuration.user,
    max: profile.max,
    connectionTimeoutMillis: profile.connectionTimeoutMs,
    ...(profile.idleTimeoutMs === undefined ? {} : { idleTimeoutMillis: profile.idleTimeoutMs }),
    ...(profile.queryTimeoutMs === undefined
      ? {}
      : {
          query_timeout: profile.queryTimeoutMs,
          statement_timeout: profile.queryTimeoutMs,
        }),
    keepAlive: true,
    allowExitOnIdle: true,
    application_name: profile.applicationName,
  };
}

function azurePoolConfiguration(
  configuration: AzureDatabaseConfiguration,
  profile: PoolProfile,
  dependencies: PoolConfigurationDependencies,
): PoolConfig {
  const tokenProvider =
    dependencies.tokenProviderFactory?.(configuration) ?? createAzureTokenProvider(configuration);

  return {
    ...commonPoolConfiguration(configuration, profile),
    password: () => tokenProvider.getPassword(),
    ssl: {
      rejectUnauthorized: true,
    },
  };
}

function createProfiledPgPoolConfiguration(
  configuration: DatabaseConfiguration,
  profile: (configuration: EnabledDatabaseConfiguration) => PoolProfile,
  dependencies: PoolConfigurationDependencies = {},
): PoolConfig {
  switch (configuration.mode) {
    case "disabled":
      throw new DatabaseDisabledError();
    case "local-password":
      return {
        ...commonPoolConfiguration(configuration, profile(configuration)),
        password: configuration.password,
        ssl: false,
      };
    case "azure-managed-identity":
    case "local-azure-credential":
      return azurePoolConfiguration(configuration, profile(configuration), dependencies);
  }
}

export function createPgPoolConfiguration(
  configuration: DatabaseConfiguration,
  dependencies: PoolConfigurationDependencies = {},
): PoolConfig {
  return createProfiledPgPoolConfiguration(
    configuration,
    (enabledConfiguration) => ({
      applicationName: "application-runtime",
      connectionTimeoutMs: RUNTIME_CONNECTION_TIMEOUT_MS,
      max: enabledConfiguration.poolMax,
    }),
    dependencies,
  );
}

export function createPgReadinessPoolConfiguration(
  configuration: DatabaseConfiguration,
  dependencies: PoolConfigurationDependencies = {},
): PoolConfig {
  return createProfiledPgPoolConfiguration(
    configuration,
    (enabledConfiguration) => ({
      applicationName: "application-readiness",
      connectionTimeoutMs: READINESS_CONNECTION_TIMEOUT_MS,
      idleTimeoutMs: READINESS_IDLE_TIMEOUT_MS,
      max: 1,
      queryTimeoutMs: enabledConfiguration.probeTimeoutMs,
    }),
    dependencies,
  );
}

export function createPgMigrationPoolConfiguration(
  configuration: DatabaseConfiguration,
  dependencies: PoolConfigurationDependencies = {},
): PoolConfig {
  return createProfiledPgPoolConfiguration(
    configuration,
    () => ({
      applicationName: "database-migration",
      connectionTimeoutMs: MIGRATION_CONNECTION_TIMEOUT_MS,
      max: 1,
    }),
    dependencies,
  );
}

type PgPoolConfigurationFactory = (
  configuration: DatabaseConfiguration,
  dependencies?: PoolConfigurationDependencies,
) => PoolConfig;

function createProfiledDatabasePoolFactory<TPool>(
  poolFactory: (configuration: PoolConfig) => TPool,
  configurationFactory: PgPoolConfigurationFactory,
  dependencies: PoolConfigurationDependencies,
) {
  return (configuration: DatabaseConfiguration): TPool =>
    poolFactory(configurationFactory(configuration, dependencies));
}

export function createDatabasePoolFactory<TPool>(
  poolFactory: (configuration: PoolConfig) => TPool,
  dependencies: PoolConfigurationDependencies = {},
) {
  return createProfiledDatabasePoolFactory(poolFactory, createPgPoolConfiguration, dependencies);
}

export function createReadinessDatabasePoolFactory<TPool>(
  poolFactory: (configuration: PoolConfig) => TPool,
  dependencies: PoolConfigurationDependencies = {},
) {
  return createProfiledDatabasePoolFactory(
    poolFactory,
    createPgReadinessPoolConfiguration,
    dependencies,
  );
}

export function createMigrationDatabasePoolFactory<TPool>(
  poolFactory: (configuration: PoolConfig) => TPool,
  dependencies: PoolConfigurationDependencies = {},
) {
  return createProfiledDatabasePoolFactory(
    poolFactory,
    createPgMigrationPoolConfiguration,
    dependencies,
  );
}

export const createDatabasePool = createDatabasePoolFactory(
  (configuration) => new Pool(configuration),
);

export const createReadinessDatabasePool = createReadinessDatabasePoolFactory(
  (configuration) => new Pool(configuration),
);

export const createMigrationDatabasePool = createMigrationDatabasePoolFactory(
  (configuration) => new Pool(configuration),
);
