import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/specs/**/*.test.ts"],
    passWithNoTests: false,
  },
});
