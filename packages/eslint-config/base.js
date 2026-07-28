import js from "@eslint/js";
import { globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

const typescriptFiles = ["**/*.{ts,tsx,mts,cts}"];

const forTypeScript = (configs) =>
  configs.map((config) => ({
    ...config,
    files: typescriptFiles,
  }));

export const baseConfig = [
  globalIgnores([
    "**/.next/**",
    "**/.turbo/**",
    "**/build/**",
    "**/coverage/**",
    "**/dist/**",
    "**/node_modules/**",
    "**/out/**",
    "**/next-env.d.ts",
  ]),
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  js.configs.recommended,
  ...forTypeScript(tseslint.configs.strictTypeChecked),
  ...forTypeScript(tseslint.configs.stylisticTypeChecked),
  {
    files: typescriptFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "inline-type-imports",
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-restricted-types": [
        "error",
        {
          types: {
            "Record<string, never>": {
              message: "Use a purpose-specific object type instead.",
            },
          },
        },
      ],
    },
  },
  eslintConfigPrettier,
];

export default baseConfig;
