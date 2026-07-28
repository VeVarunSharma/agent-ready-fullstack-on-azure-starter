import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    hookTimeout: 10_000,
    include: ["integration/**/*.integration.test.ts"],
    passWithNoTests: false,
    testTimeout: 10_000,
  },
});
