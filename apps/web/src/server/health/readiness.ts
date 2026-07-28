import "server-only";

import {
  getDatabaseConfiguration,
  readServerEnvironment,
  type DatabaseConfiguration,
} from "@repo/env/server";

import { probeDatabase } from "./database-probe";

type EnabledDatabaseConfiguration = Exclude<DatabaseConfiguration, { readonly mode: "disabled" }>;

export interface ReadinessDependencies {
  readonly readEnvironment: typeof readServerEnvironment;
  readonly probe: (configuration: EnabledDatabaseConfiguration) => Promise<boolean>;
}

const defaultDependencies: ReadinessDependencies = {
  readEnvironment: readServerEnvironment,
  probe: probeDatabase,
};

export async function checkReadiness(
  dependencies: ReadinessDependencies = defaultDependencies,
): Promise<"ready" | "not_ready"> {
  const environment = dependencies.readEnvironment();
  if (!environment.success) {
    return "not_ready";
  }

  const database = getDatabaseConfiguration(environment.data);
  if (database.mode === "disabled") {
    return "ready";
  }

  return (await dependencies.probe(database)) ? "ready" : "not_ready";
}
