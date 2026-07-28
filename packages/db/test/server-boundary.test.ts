import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const serverOnlyError = /cannot be imported from a Client Component/u;
const require = createRequire(import.meta.url);

describe("database server-only boundary", () => {
  it("poisons the public pool module outside a server component graph", async () => {
    await expect(import("../src/pool")).rejects.toThrow(serverOnlyError);
  });

  it("poisons the public token module outside a server component graph", async () => {
    await expect(import("../src/token-provider")).rejects.toThrow(serverOnlyError);
  });

  it("poisons the public schema module outside a server component graph", async () => {
    await expect(import("../src/schema/index")).rejects.toThrow(serverOnlyError);
  });

  it("does not export the Node-safe implementation modules", () => {
    expect(() => require.resolve("@repo/db/internal/pool")).toThrow("Package subpath");
    expect(() => require.resolve("@repo/db/internal/token-provider")).toThrow("Package subpath");
  });
});
