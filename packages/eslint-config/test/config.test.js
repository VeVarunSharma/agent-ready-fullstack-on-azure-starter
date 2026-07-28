import assert from "node:assert/strict";
import test from "node:test";

import { baseConfig } from "../base.js";
import { nextConfig } from "../next.js";
import { reactConfig } from "../react.js";

function namedConfig(configs, name) {
  const config = configs.find((candidate) => candidate.name === name);
  assert.ok(config, `Expected config ${name}.`);
  assert.equal(Array.isArray(config.plugins), false, `${name} must use flat-config plugins.`);
  return config;
}

function assertRule(configs, name, expectedSeverity) {
  const rule = configs.find((config) => config.rules?.[name] !== undefined)?.rules?.[name];
  assert.notEqual(rule, undefined, `Expected rule ${name}.`);
  const severity = Array.isArray(rule) ? rule[0] : rule;
  assert.equal(severity, expectedSeverity);
}

test("base config keeps type-aware TypeScript safety", () => {
  assertRule(baseConfig, "@typescript-eslint/no-floating-promises", "error");
  assertRule(baseConfig, "@typescript-eslint/no-unsafe-assignment", "error");
  assertRule(baseConfig, "@typescript-eslint/consistent-type-imports", "error");
});

test("React config keeps strict component, hook, accessibility, and import coverage", () => {
  const react = namedConfig(reactConfig, "@repo/react/strict-typescript");
  const hooks = namedConfig(reactConfig, "@repo/react-hooks/recommended");
  const accessibility = namedConfig(reactConfig, "@repo/jsx-a11y/strict");
  const imports = namedConfig(reactConfig, "@repo/import/recommended");

  assert.ok(Object.keys(react.rules ?? {}).length >= 75);
  assert.ok(Object.keys(accessibility.rules ?? {}).length >= 33);
  assertRule([react], "@eslint-react/immutability", "error");
  assertRule([react], "@eslint-react/refs", "error");
  assertRule([react], "@eslint-react/use-memo", "error");
  assertRule([hooks], "react-hooks/rules-of-hooks", "error");
  assertRule([hooks], "react-hooks/exhaustive-deps", "warn");
  assertRule([accessibility], "jsx-a11y/alt-text", "error");
  assertRule([accessibility], "jsx-a11y/interactive-supports-focus", "error");
  assertRule([imports], "import-x/no-unresolved", "error");
  assertRule([imports], "import-x/no-anonymous-default-export", "warn");
});

test("Next config keeps the full core-web-vitals rule set", () => {
  const next = namedConfig(nextConfig, "@repo/next/core-web-vitals");

  assert.equal(Object.keys(next.rules ?? {}).length, 21);
  assertRule([next], "@next/next/no-html-link-for-pages", "error");
  assertRule([next], "@next/next/no-sync-scripts", "error");
  assert.ok(nextConfig.some((config) => config.name === "@repo/react/strict-typescript"));
});
