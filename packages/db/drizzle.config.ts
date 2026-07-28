import { createLocalDatabaseUrl } from "@repo/env/tooling";
import { defineConfig } from "drizzle-kit";

import { loadLocalDatabaseConfiguration } from "./src/local-database";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/internal/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: createLocalDatabaseUrl(loadLocalDatabaseConfiguration()),
  },
  strict: true,
  verbose: true,
});
