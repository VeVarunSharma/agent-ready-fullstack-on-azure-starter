import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { loadLocalDatabaseConfiguration } from "../src/local-database";
import {
  createDatabasePoolFactory,
  createMigrationDatabasePoolFactory,
  createReadinessDatabasePoolFactory,
} from "../src/internal/pool";

const createInjectedPool = createDatabasePoolFactory((configuration) => new Pool(configuration));
const createInjectedMigrationPool = createMigrationDatabasePoolFactory(
  (configuration) => new Pool(configuration),
);
const createInjectedReadinessPool = createReadinessDatabasePoolFactory(
  (configuration) => new Pool(configuration),
);

describe("PostgreSQL connectivity", () => {
  it("connects through the injected pool and executes SELECT 1", async () => {
    const pool = createInjectedPool(loadLocalDatabaseConfiguration());

    try {
      const result = await pool.query<{ value: number }>("SELECT 1 AS value");

      expect(result.rows).toEqual([{ value: 1 }]);
    } finally {
      await pool.end();
    }
  });

  it("allows migration work beyond two seconds while bounding readiness queries", async () => {
    const configuration = loadLocalDatabaseConfiguration({
      ...process.env,
      DATABASE_PROBE_TIMEOUT_MS: "250",
    });
    const migrationPool = createInjectedMigrationPool(configuration);
    const readinessPool = createInjectedReadinessPool(configuration);

    try {
      const migrationStartedAt = performance.now();
      await migrationPool.query("SELECT pg_sleep(2.1)");
      expect(performance.now() - migrationStartedAt).toBeGreaterThanOrEqual(2_000);

      const readinessStartedAt = performance.now();
      await expect(readinessPool.query("SELECT pg_sleep(5)")).rejects.toThrow();
      expect(performance.now() - readinessStartedAt).toBeLessThan(2_000);
    } finally {
      await Promise.allSettled([migrationPool.end(), readinessPool.end()]);
    }
  });
});
