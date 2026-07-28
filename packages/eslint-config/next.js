import next from "@next/eslint-plugin-next";
import eslintConfigPrettier from "eslint-config-prettier/flat";

import { reactConfig } from "./react.js";

const sourceFiles = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];

export const nextConfig = [
  ...reactConfig,
  {
    ...next.configs["core-web-vitals"],
    name: "@repo/next/core-web-vitals",
    files: sourceFiles,
    settings: {
      next: {
        rootDir: ".",
      },
    },
  },
  eslintConfigPrettier,
];

export default nextConfig;
