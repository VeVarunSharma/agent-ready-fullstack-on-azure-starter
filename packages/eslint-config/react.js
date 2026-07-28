import react from "@eslint-react/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";

import { baseConfig } from "./base.js";

const sourceFiles = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];
const javaScriptFiles = ["**/*.{js,jsx,mjs,cjs}"];
const typeScriptFiles = ["**/*.{ts,tsx,mts,cts}"];
const jsxFiles = ["**/*.{jsx,tsx}"];
const importResolver = createTypeScriptImportResolver({
  alwaysTryTypes: true,
});
const importTypeScriptSettings = Object.fromEntries(
  Object.entries(importX.flatConfigs.typescript.settings).filter(
    ([name]) => name !== "import-x/resolver",
  ),
);

const reactCompilerRules = {
  "@eslint-react/globals": "error",
  "@eslint-react/immutability": "error",
  "@eslint-react/refs": "error",
};

function scopeReactConfig(config, files, name) {
  return {
    ...config,
    name,
    files,
    rules: {
      ...config.rules,
      ...reactCompilerRules,
      "@eslint-react/exhaustive-deps": "off",
      "@eslint-react/rules-of-hooks": "off",
    },
  };
}

export const reactConfig = [
  ...baseConfig,
  {
    ...importX.flatConfigs.recommended,
    name: "@repo/import/recommended",
    files: sourceFiles,
    settings: {
      ...importX.flatConfigs.recommended.settings,
      "import-x/resolver-next": [importResolver],
    },
    rules: {
      ...importX.flatConfigs.recommended.rules,
      "import-x/no-anonymous-default-export": [
        "warn",
        {
          allowArray: true,
          allowCallExpression: true,
          allowObject: true,
        },
      ],
    },
  },
  {
    ...importX.flatConfigs.typescript,
    name: "@repo/import/typescript",
    files: typeScriptFiles,
    settings: {
      ...importTypeScriptSettings,
      "import-x/resolver-next": [importResolver],
    },
  },
  scopeReactConfig(react.configs.strict, javaScriptFiles, "@repo/react/strict-javascript"),
  scopeReactConfig(
    react.configs["strict-type-checked"],
    typeScriptFiles,
    "@repo/react/strict-typescript",
  ),
  {
    ...reactHooks.configs["recommended-latest"],
    name: "@repo/react-hooks/recommended",
    files: sourceFiles,
  },
  {
    ...jsxA11y.flatConfigs.strict,
    name: "@repo/jsx-a11y/strict",
    files: jsxFiles,
  },
  eslintConfigPrettier,
];

export default reactConfig;
