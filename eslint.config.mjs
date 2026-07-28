import globals from "globals";

import { nodeConfig } from "@repo/eslint-config/node";

export default [
  ...nodeConfig,
  {
    files: ["scripts/**/*.ts", "vitest.config.ts", "*.config.{js,mjs,ts}"],
    languageOptions: {
      globals: globals.node,
    },
  },
];
