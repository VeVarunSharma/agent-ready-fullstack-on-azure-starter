import { describe, expect, it, vi } from "vitest";

import {
  ProductionMigrationConfigurationError,
  ProductionMigrationLockUnavailableError,
  loadProductionMigrationConfiguration,
  withProductionMigrationLock,
} from "../src/migrate-production";

const managedIdentityEnvironment = {
  RUNTIME_MODE: "production",
  DATABASE_MODE: "azure-managed-identity",
  AUTH_MODE: "container-apps",
  LOGGING_MODE: "json",
  TELEMETRY_MODE: "disabled",
  DATABASE_HOST: "database.invalid",
  DATABASE_PORT: "5432",
  DATABASE_NAME: "app",
  DATABASE_USER: "migration",
  DATABASE_POOL_MAX: "10",
  DATABASE_PROBE_TIMEOUT_MS: "2000",
  AZURE_CLIENT_ID: "7af253a4-147b-48cf-b158-a5d79810b2a7",
} as const;

describe("production migration configuration", () => {
  it("loads only the explicit production managed-identity contract", () => {
    expect(loadProductionMigrationConfiguration(managedIdentityEnvironment)).toEqual({
      mode: "azure-managed-identity",
      host: "database.invalid",
      port: 5432,
      database: "app",
      user: "migration",
      managedIdentityClientId: "7af253a4-147b-48cf-b158-a5d79810b2a7",
      poolMax: 10,
      probeTimeoutMs: 2_000,
    });
  });

  it.each([
    { RUNTIME_MODE: "local", DATABASE_MODE: "local-password" },
    { RUNTIME_MODE: "production", DATABASE_MODE: "disabled" },
    { RUNTIME_MODE: "local", DATABASE_MODE: "local-azure-credential" },
  ])("rejects non-production migration mode $DATABASE_MODE", (override) => {
    expect(() =>
      loadProductionMigrationConfiguration({
        ...managedIdentityEnvironment,
        ...override,
      }),
    ).toThrow(ProductionMigrationConfigurationError);
  });

  it.each([
    { DATABASE_PASSWORD: "static-password" },
    { DATABASE_URL: "postgresql://static:password@database.invalid/app" },
  ])("rejects static production database credentials", (override) => {
    expect(() =>
      loadProductionMigrationConfiguration({
        ...managedIdentityEnvironment,
        ...override,
      }),
    ).toThrow();
  });
});

describe("production migration advisory lock", () => {
  it("holds one dedicated PostgreSQL session lock for the full migration", async () => {
    const events: string[] = [];
    const query = vi.fn((sql: string, parameters: readonly number[]) => {
      expect(parameters).toHaveLength(2);
      if (sql.includes("pg_try_advisory_lock")) {
        events.push("lock");
        return Promise.resolve({ rows: [{ acquired: true }] });
      }

      events.push("unlock");
      return Promise.resolve({ rows: [] });
    });
    const client = { query };

    await withProductionMigrationLock(client, () => {
      events.push("migrate");
      return Promise.resolve();
    });

    expect(events).toEqual(["lock", "migrate", "unlock"]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain("pg_try_advisory_lock");
    expect(query.mock.calls[1]?.[0]).toContain("pg_advisory_unlock");
    expect(query.mock.calls[0]?.[1]).toEqual(query.mock.calls[1]?.[1]);
  });

  it("fails closed without running migrations when another runner holds the lock", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ acquired: false }] });
    const client = { query };
    const migration = vi.fn(() => Promise.resolve());

    await expect(withProductionMigrationLock(client, migration)).rejects.toThrow(
      ProductionMigrationLockUnavailableError,
    );
    expect(migration).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("releases the lock when migration execution fails", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [] });
    const client = { query };

    await expect(
      withProductionMigrationLock(client, () => Promise.reject(new Error("migration failed"))),
    ).rejects.toThrow("migration failed");
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain("pg_advisory_unlock");
  });
});
