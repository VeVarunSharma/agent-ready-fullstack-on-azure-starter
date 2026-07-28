import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createMigrationDatabasePool } from "./internal/pool";
import { loadLocalDatabaseConfiguration } from "./local-database";

const configuration = loadLocalDatabaseConfiguration();
const pool = createMigrationDatabasePool(configuration);

try {
  const database = drizzle({ client: pool });
  const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
  await migrate(database, { migrationsFolder });
  console.log("Local PostgreSQL migrations are current.");
} finally {
  await pool.end();
}
