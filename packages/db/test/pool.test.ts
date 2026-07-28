import { describe, expect, it, vi } from "vitest";
import type { PoolConfig } from "pg";

import {
  DatabaseDisabledError,
  createDatabasePoolFactory,
  createMigrationDatabasePoolFactory,
  createPgMigrationPoolConfiguration,
  createPgPoolConfiguration,
  createPgReadinessPoolConfiguration,
  createReadinessDatabasePoolFactory,
} from "../src/internal/pool";

const localConfiguration = {
  mode: "local-password",
  host: "127.0.0.1",
  port: 5432,
  database: "app",
  user: "local",
  password: "local-only",
  poolMax: 4,
  probeTimeoutMs: 1_000,
} as const;

describe("PostgreSQL pool configuration", () => {
  it("uses a static password only for explicit local mode", () => {
    const configuration = createPgPoolConfiguration(localConfiguration);

    expect(configuration).toMatchObject({
      password: "local-only",
      ssl: false,
      max: 4,
    });
  });

  it("injects a refreshable async password callback for Azure", async () => {
    const getPassword = vi.fn(() => Promise.resolve("azure-token"));
    const configuration = createPgPoolConfiguration(
      {
        mode: "azure-managed-identity",
        host: "database.invalid",
        port: 5432,
        database: "app",
        user: "application",
        managedIdentityClientId: "7af253a4-147b-48cf-b158-a5d79810b2a7",
        poolMax: 10,
        probeTimeoutMs: 2_000,
      },
      {
        tokenProviderFactory: () => ({ getPassword }),
      },
    );

    expect(configuration.ssl).toEqual({ rejectUnauthorized: true });
    expect(configuration.password).toBeTypeOf("function");
    if (typeof configuration.password !== "function") {
      throw new Error("Expected an asynchronous pg password callback.");
    }
    await expect(configuration.password()).resolves.toBe("azure-token");
  });

  it("separates runtime, readiness, and migration timeout profiles", () => {
    const runtime = createPgPoolConfiguration(localConfiguration);
    const readiness = createPgReadinessPoolConfiguration(localConfiguration);
    const migration = createPgMigrationPoolConfiguration(localConfiguration);

    expect(runtime).toMatchObject({
      application_name: "application-runtime",
      connectionTimeoutMillis: 10_000,
      max: 4,
    });
    expect(runtime).not.toHaveProperty("query_timeout");
    expect(runtime).not.toHaveProperty("statement_timeout");

    expect(readiness).toMatchObject({
      application_name: "application-readiness",
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      max: 1,
      query_timeout: 1_000,
      statement_timeout: 1_000,
    });

    expect(migration).toMatchObject({
      application_name: "database-migration",
      connectionTimeoutMillis: 30_000,
      max: 1,
    });
    expect(migration).not.toHaveProperty("query_timeout");
    expect(migration).not.toHaveProperty("statement_timeout");
  });

  it("preserves refreshable Azure authentication and TLS for migration pools", async () => {
    const getPassword = vi.fn(() => Promise.resolve("migration-token"));
    const configuration = createPgMigrationPoolConfiguration(
      {
        mode: "azure-managed-identity",
        host: "database.invalid",
        port: 5432,
        database: "app",
        user: "migration",
        managedIdentityClientId: "7af253a4-147b-48cf-b158-a5d79810b2a7",
        poolMax: 10,
        probeTimeoutMs: 2_000,
      },
      {
        tokenProviderFactory: () => ({ getPassword }),
      },
    );

    expect(configuration.ssl).toEqual({ rejectUnauthorized: true });
    expect(configuration.password).toBeTypeOf("function");
    if (typeof configuration.password !== "function") {
      throw new Error("Expected an asynchronous pg password callback.");
    }
    await expect(configuration.password()).resolves.toBe("migration-token");
  });

  it("rejects pool creation when database use is disabled", () => {
    expect(() => createPgPoolConfiguration({ mode: "disabled" })).toThrow(DatabaseDisabledError);
  });

  it("allows each pool constructor to be injected with its dedicated profile", () => {
    const poolFactory = vi.fn((configuration: PoolConfig) => ({ configuration }));
    const runtimePool = createDatabasePoolFactory(poolFactory)(localConfiguration);
    const readinessPool = createReadinessDatabasePoolFactory(poolFactory)(localConfiguration);
    const migrationPool = createMigrationDatabasePoolFactory(poolFactory)(localConfiguration);

    expect(poolFactory).toHaveBeenCalledTimes(3);
    expect(runtimePool.configuration).toMatchObject({ max: 4 });
    expect(readinessPool.configuration).toMatchObject({ max: 1, query_timeout: 1_000 });
    expect(migrationPool.configuration).toMatchObject({
      max: 1,
      application_name: "database-migration",
    });
  });
});
