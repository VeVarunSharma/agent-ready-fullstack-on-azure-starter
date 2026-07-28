import "server-only";

import { createReadinessDatabasePool } from "@repo/db/pool";
import type { DatabaseConfiguration } from "@repo/env/server";

type EnabledDatabaseConfiguration = Exclude<DatabaseConfiguration, { readonly mode: "disabled" }>;

export interface DatabaseProbePool {
  query(queryText: string): Promise<unknown>;
  end(): Promise<void>;
}

export interface DatabaseProbeDependencies {
  readonly createPool: (configuration: EnabledDatabaseConfiguration) => DatabaseProbePool;
}

interface CachedPool {
  readonly configuration: EnabledDatabaseConfiguration;
  readonly pool: DatabaseProbePool;
  closePromise?: Promise<void>;
}

const defaultDependencies: DatabaseProbeDependencies = {
  createPool: createReadinessDatabasePool,
};

function hasSameConnection(
  first: EnabledDatabaseConfiguration,
  second: EnabledDatabaseConfiguration,
): boolean {
  return (
    first.host === second.host &&
    first.port === second.port &&
    first.database === second.database &&
    first.user === second.user &&
    first.poolMax === second.poolMax &&
    first.probeTimeoutMs === second.probeTimeoutMs
  );
}

function hasSameConfiguration(
  first: EnabledDatabaseConfiguration,
  second: EnabledDatabaseConfiguration,
): boolean {
  if (first.mode !== second.mode || !hasSameConnection(first, second)) {
    return false;
  }

  switch (first.mode) {
    case "local-password":
      return second.mode === "local-password" && first.password === second.password;
    case "azure-managed-identity":
      return (
        second.mode === "azure-managed-identity" &&
        first.managedIdentityClientId === second.managedIdentityClientId
      );
    case "local-azure-credential":
      return second.mode === "local-azure-credential";
  }
}

async function closePool(cachedPool: CachedPool): Promise<void> {
  cachedPool.closePromise ??= (async () => {
    try {
      await cachedPool.pool.end();
    } catch {
      // A failed pool is discarded even when its best-effort cleanup also fails.
    }
  })();

  await cachedPool.closePromise;
}

export function createDatabaseProbe(
  dependencies: DatabaseProbeDependencies = defaultDependencies,
): (configuration: EnabledDatabaseConfiguration) => Promise<boolean> {
  let cachedPool: CachedPool | undefined;

  return async (configuration) => {
    let currentPool = cachedPool;

    if (
      currentPool !== undefined &&
      !hasSameConfiguration(currentPool.configuration, configuration)
    ) {
      cachedPool = undefined;
      await closePool(currentPool);
      currentPool = undefined;
    }

    if (currentPool === undefined) {
      try {
        currentPool = {
          configuration,
          pool: dependencies.createPool(configuration),
        };
        cachedPool = currentPool;
      } catch {
        return false;
      }
    }

    try {
      await currentPool.pool.query("select 1");
      return true;
    } catch {
      if (cachedPool === currentPool) {
        cachedPool = undefined;
      }
      await closePool(currentPool);
      return false;
    }
  };
}

export const probeDatabase = createDatabaseProbe();
