import { describe, expect, it } from "vitest";

import { loadLocalDatabaseConfiguration, localDatabaseDefaults } from "../src/local-database";

describe("local PostgreSQL tooling configuration", () => {
  it("uses only the documented local Compose defaults when no overrides are present", () => {
    expect(loadLocalDatabaseConfiguration({})).toMatchObject({
      mode: "local-password",
      host: localDatabaseDefaults.host,
      port: localDatabaseDefaults.port,
      database: localDatabaseDefaults.database,
      user: localDatabaseDefaults.user,
      password: localDatabaseDefaults.password,
    });
  });

  it("accepts explicit CI connection overrides while retaining local password mode", () => {
    expect(
      loadLocalDatabaseConfiguration({
        DATABASE_HOST: "postgres",
        DATABASE_PORT: "55432",
        DATABASE_PASSWORD: "ci-local-only",
      }),
    ).toMatchObject({
      mode: "local-password",
      host: "postgres",
      port: 55_432,
      password: "ci-local-only",
    });
  });

  it("rejects non-local database authentication modes", () => {
    expect(() =>
      loadLocalDatabaseConfiguration({
        DATABASE_MODE: "disabled",
      }),
    ).toThrow("Local database tooling requires explicit local password mode.");
  });
});
