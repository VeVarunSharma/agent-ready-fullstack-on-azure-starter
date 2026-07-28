import { describe, expect, it, vi } from "vitest";

import { createDatabaseProbe, type DatabaseProbePool } from "../src/server/health/database-probe";

const configuration = {
  mode: "local-password",
  host: "127.0.0.1",
  port: 5432,
  database: "app",
  user: "local",
  password: "local-only",
  poolMax: 4,
  probeTimeoutMs: 2_000,
} as const;

function poolWith(
  query: DatabaseProbePool["query"],
  end: DatabaseProbePool["end"] = vi.fn(() => Promise.resolve()),
): DatabaseProbePool {
  return { query, end };
}

describe("database readiness probe", () => {
  it("reuses one readiness pool across equivalent probes", async () => {
    const query = vi.fn(() => Promise.resolve());
    const end = vi.fn(() => Promise.resolve());
    const createPool = vi.fn(() => poolWith(query, end));
    const probe = createDatabaseProbe({ createPool });

    await expect(probe(configuration)).resolves.toBe(true);
    await expect(probe({ ...configuration })).resolves.toBe(true);

    expect(createPool).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledTimes(2);
    expect(end).not.toHaveBeenCalled();
  });

  it("invalidates a failed pool and reconnects on the next probe", async () => {
    const failedEnd = vi.fn(() => Promise.resolve());
    const failedPool = poolWith(
      vi.fn(() => Promise.reject(new Error("connection failed"))),
      failedEnd,
    );
    const replacementQuery = vi.fn(() => Promise.resolve());
    const replacementPool = poolWith(replacementQuery);
    const createPool = vi
      .fn<() => DatabaseProbePool>()
      .mockReturnValueOnce(failedPool)
      .mockReturnValueOnce(replacementPool);
    const probe = createDatabaseProbe({ createPool });

    await expect(probe(configuration)).resolves.toBe(false);
    await expect(probe(configuration)).resolves.toBe(true);

    expect(failedEnd).toHaveBeenCalledOnce();
    expect(createPool).toHaveBeenCalledTimes(2);
    expect(replacementQuery).toHaveBeenCalledOnce();
  });

  it("keeps a later successful probe healthy when failed-pool cleanup throws", async () => {
    const failedPool = poolWith(
      vi.fn(() => Promise.reject(new Error("query failed"))),
      vi.fn(() => Promise.reject(new Error("cleanup failed"))),
    );
    const replacementPool = poolWith(vi.fn(() => Promise.resolve()));
    const createPool = vi
      .fn<() => DatabaseProbePool>()
      .mockReturnValueOnce(failedPool)
      .mockReturnValueOnce(replacementPool);
    const probe = createDatabaseProbe({ createPool });

    await expect(probe(configuration)).resolves.toBe(false);
    await expect(probe(configuration)).resolves.toBe(true);
  });

  it("closes and replaces the cached pool when configuration changes", async () => {
    const firstEnd = vi.fn(() => Promise.resolve());
    const firstPool = poolWith(
      vi.fn(() => Promise.resolve()),
      firstEnd,
    );
    const secondPool = poolWith(vi.fn(() => Promise.resolve()));
    const createPool = vi
      .fn<() => DatabaseProbePool>()
      .mockReturnValueOnce(firstPool)
      .mockReturnValueOnce(secondPool);
    const probe = createDatabaseProbe({ createPool });

    await expect(probe(configuration)).resolves.toBe(true);
    await expect(probe({ ...configuration, probeTimeoutMs: 3_000 })).resolves.toBe(true);

    expect(firstEnd).toHaveBeenCalledOnce();
    expect(createPool).toHaveBeenCalledTimes(2);
  });
});
