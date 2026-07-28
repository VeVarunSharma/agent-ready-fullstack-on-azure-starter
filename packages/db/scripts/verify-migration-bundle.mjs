import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const bundlePath = fileURLToPath(new URL("../dist/migrate-production.mjs", import.meta.url));
const result = spawnSync(process.execPath, [bundlePath], {
  encoding: "utf8",
  env: {
    DATABASE_MODE: "disabled",
    RUNTIME_MODE: "production",
  },
});

assert.equal(result.error, undefined);
assert.equal(result.status, 1);
assert.equal(result.signal, null);
assert.equal(result.stdout, "");
assert.equal(result.stderr, "Production PostgreSQL migration failed.\n");
