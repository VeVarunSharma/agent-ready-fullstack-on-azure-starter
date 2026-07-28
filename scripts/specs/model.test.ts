import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { scaffoldPrd } from "./generator.js";
import {
  type Catalog,
  type CatalogEntry,
  type ChangedFileClassification,
  type GitContext,
  classifyChangedFile,
  loadGitContext,
  parseFrontmatter,
  validateCatalog,
  validateGitPolicies,
  validatePrdDocument,
} from "./model.js";

const scratchRoot = path.join(process.cwd(), ".spec-test-work");
const functionalChangeMessage =
  "functional changes require a cataloged PRD document in the same change";

const validEntry: CatalogEntry = {
  id: "EXAMPLE_CAPABILITY",
  version: "1",
  path: "specs/PRDs/PRD_V1_EXAMPLE_CAPABILITY.md",
  title: "Example capability",
  summary: "Provide a deterministic example for validator tests.",
  lifecycle: "active",
  owners: ["@example-owner"],
  created: "2026-07-26",
  updated: "2026-07-26",
  dataClassification: "Internal",
  supersededBy: null,
  architectureImpact: false,
  designSystemImpact: false,
  sensitiveDataImpact: false,
  persistenceImpact: false,
};

function catalog(entries: readonly CatalogEntry[]): Catalog {
  return {
    $schema: "../catalog.schema.json",
    schemaVersion: 1,
    entries,
  };
}

function contextFor(
  changedFiles: readonly string[],
  overrides: Partial<GitContext> = {},
): GitContext {
  return {
    baselineCatalog: catalog([]),
    baselineHasConstitution: true,
    baselineRef: "main",
    changedFiles: new Set(changedFiles),
    ...overrides,
  };
}

function policyMessages(
  changedFiles: readonly string[],
  currentCatalog: Catalog = catalog([]),
  overrides: Partial<GitContext> = {},
): readonly string[] {
  return validateGitPolicies(currentCatalog, contextFor(changedFiles, overrides)).map(
    (item) => item.message,
  );
}

function writeFixtureFile(repositoryPath: string, contents: string): void {
  const filePath = path.join(scratchRoot, repositoryPath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function git(argumentsList: readonly string[]): string {
  const result = spawnSync("git", argumentsList, {
    cwd: scratchRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `git ${argumentsList.join(" ")} failed: ${
        typeof result.stderr === "string" ? result.stderr : ""
      }`,
    );
  }
  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

function documentFor(entry: CatalogEntry): string {
  return `---
id: "${entry.id}"
version: "${entry.version}"
path: "${entry.path}"
title: "${entry.title}"
summary: "${entry.summary}"
lifecycle: "${entry.lifecycle}"
owners: ${JSON.stringify(entry.owners)}
created: "${entry.created}"
updated: "${entry.updated}"
dataClassification: "${entry.dataClassification}"
supersededBy: ${entry.supersededBy === null ? "null" : `"${entry.supersededBy}"`}
architectureImpact: ${String(entry.architectureImpact)}
designSystemImpact: ${String(entry.designSystemImpact)}
sensitiveDataImpact: ${String(entry.sensitiveDataImpact)}
persistenceImpact: ${String(entry.persistenceImpact)}
---

# PRD V${entry.version}: ${entry.title}

## Overview

Define a deterministic capability.

## Motivation

Prove the specification validator.

## Scope

- Validate one behavior.

## Out of Scope

- Product behavior remains excluded.

## Feature Specifications

### FS-001: Deterministic validation

The validator reports malformed records.

## Affected Files

- \`scripts/specs/model.ts\` — validate records.

## Acceptance Criteria

- [ ] **AC-001**: Invalid records produce a nonzero validation result.

## Migration and Configuration

None — the behavior has no migration or configuration effect.

## Verification

| Criterion | Method | Evidence |
| --- | --- | --- |
| AC-001 | automated | \`scripts/specs/model.test.ts\` |

## Status

Lifecycle: **${entry.lifecycle}**

Implementation is tracked by this lifecycle.
`;
}

afterEach(() => {
  rmSync(scratchRoot, { force: true, recursive: true });
});

describe("catalog validation", () => {
  test("accepts complete metadata with unique identity", () => {
    const result = validateCatalog(catalog([validEntry]));

    expect(result.issues).toEqual([]);
    expect(result.catalog?.entries).toHaveLength(1);
  });

  test("rejects duplicate version identity", () => {
    const duplicate = {
      ...validEntry,
      path: "specs/PRDs/PRD_V1_EXAMPLE_CAPABILITY.md",
    };
    const result = validateCatalog(catalog([validEntry, duplicate]));

    expect(result.issues.map((item) => item.message)).toContain("id/version duplicates entries[0]");
  });

  test("requires a higher cataloged successor", () => {
    const superseded: CatalogEntry = {
      ...validEntry,
      lifecycle: "superseded",
      supersededBy: "specs/PRDs/PRD_V2_EXAMPLE_CAPABILITY.md",
    };
    const result = validateCatalog(catalog([superseded]));

    expect(result.issues.map((item) => item.message)).toContain(
      "supersededBy must reference a cataloged PRD",
    );
  });
});

describe("document validation", () => {
  test("accepts aligned metadata, required sections, and mapped evidence", () => {
    expect(validatePrdDocument(validEntry, documentFor(validEntry))).toEqual([]);
  });

  test("rejects an acceptance criterion without verification", () => {
    const invalidDocument = documentFor(validEntry).replace(
      "| AC-001 | automated | `scripts/specs/model.test.ts` |",
      "| AC-002 | CI | `pnpm check` |",
    );
    const messages = validatePrdDocument(validEntry, invalidDocument).map((item) => item.message);

    expect(messages).toContain("AC-001 must have exactly one automated, CI, or manual mapping");
    expect(messages).toContain("AC-002 verification has no acceptance criterion");
  });

  test("rejects missing required sections and unresolved markers", () => {
    const invalidDocument = documentFor(validEntry)
      .replace("## Motivation", "## Context")
      .replace("Define a deterministic capability.", "{{OVERVIEW}}");
    const messages = validatePrdDocument(validEntry, invalidDocument).map((item) => item.message);

    expect(messages.some((message) => message.startsWith("required H2 sections"))).toBe(true);
    expect(messages).toContain("document contains an unresolved template marker");
  });
});

describe("Git-aware policy", () => {
  const functionalPaths = [
    ["application source", "apps/web/src/app/page.tsx"],
    ["application package manifest", "apps/web/package.json"],
    ["application build configuration", "apps/web/next.config.ts"],
    ["package source", "packages/feature/src/index.ts"],
    ["package manifest", "packages/feature/package.json"],
    ["service source", "services/api/src/server.go"],
    ["service manifest", "services/api/package.json"],
    ["root package manifest", "package.json"],
    ["workspace configuration", "pnpm-workspace.yaml"],
    ["package-manager configuration", ".npmrc"],
    ["Node version configuration", ".node-version"],
    ["alternate Node version configuration", ".nvmrc"],
    ["lockfile", "pnpm-lock.yaml"],
    ["build configuration", "turbo.json"],
    ["TypeScript configuration", "tsconfig.json"],
    ["lint configuration", "eslint.config.mjs"],
    ["format configuration", "prettier.config.mjs"],
    ["format ignore configuration", ".prettierignore"],
    ["unit-test configuration", "vitest.config.ts"],
    ["Dockerfile", "Dockerfile"],
    ["nested Dockerfile", "apps/web/Dockerfile"],
    ["Docker build context configuration", ".dockerignore"],
    ["Compose configuration", "compose.yaml"],
    ["alternate Compose configuration", "docker-compose.yml"],
    ["CSS", "apps/web/src/app/globals.css"],
    ["design tokens", "packages/ui/src/styles/tokens.css"],
    ["schema source", "packages/db/src/schema/account.ts"],
    ["SQL migration", "packages/db/migrations/0001_account.sql"],
    ["migration metadata", "packages/db/migrations/meta/_journal.json"],
    ["Bicep infrastructure", "infra/main.bicep"],
    ["Bicep parameters", "infra/environments/production.bicepparam"],
    ["Azure Developer CLI configuration", "azure.yaml"],
    ["infrastructure script", "infra/scripts/preflight.mjs"],
    ["root automation script", "scripts/audit-dependencies.mjs"],
    ["configuration directory", "config/production.yaml"],
    ["GitHub workflow", ".github/workflows/ci.yml"],
    ["Dependabot configuration", ".github/dependabot.yml"],
    ["Copilot instructions", ".github/copilot-instructions.md"],
    ["scoped Copilot instructions", ".github/instructions/security.instructions.md"],
    ["Copilot prompt", ".github/prompts/schema-change.prompt.md"],
    ["Copilot skill", ".copilot/skills/spec-driven-dev/SKILL.md"],
    ["agent runtime instructions", "AGENTS.md"],
    ["security scanner configuration", ".github/codeql/codeql-config.yml"],
    ["runtime environment example", ".env.example"],
    ["runtime configuration", "apps/web/appsettings.json"],
    ["unknown top-level Markdown", "NEW_POLICY.md"],
    ["unknown top-level type", "new-surface.wat"],
    ["unknown executable", "tools/release.py"],
    ["unknown configuration type", "feature-flags.toml"],
    ["executable under documentation", "docs/generate.ts"],
    ["configuration under documentation", "docs/security/policy.yaml"],
  ] as const;

  test.each(functionalPaths)("%s requires a PRD: %s", (_category, repositoryPath) => {
    expect(classifyChangedFile(repositoryPath)).toBe("functional");
    expect(policyMessages([repositoryPath])).toContain(functionalChangeMessage);
  });

  const allowedPaths: readonly [
    string,
    string,
    Exclude<ChangedFileClassification, "functional">,
  ][] = [
    ["root README", "README.md", "documentation"],
    ["architecture document", "ARCHITECTURE.md", "documentation"],
    ["constitution", "CONSTITUTION.md", "documentation"],
    ["contributor guide", "CONTRIBUTING.md", "documentation"],
    ["root security document", "SECURITY.md", "documentation"],
    ["runbook", "docs/runbooks/deployment.md", "documentation"],
    ["ADR", "docs/adr/0002-example.md", "documentation"],
    ["architecture detail", "docs/architecture/EXAMPLE.md", "documentation"],
    ["security document", "docs/security/THREAT_MODEL.md", "documentation"],
    ["MDX documentation", "docs/guides/example.mdx", "documentation"],
    ["specification guide", "specs/README.md", "documentation"],
    ["PRD template", "specs/templates/PRD_TEMPLATE.md", "documentation"],
    ["design contract", "specs/design/DESIGN.md", "documentation"],
    ["workspace README", "packages/ui/README.md", "documentation"],
    ["cataloged PRD path", validEntry.path, "prd-document"],
    ["PRD catalog", "specs/PRDs/index.json", "prd-catalog"],
    ["Git ignore metadata", ".gitignore", "harmless-metadata"],
    ["nested Git ignore metadata", "infra/.gitignore", "harmless-metadata"],
    ["empty-directory marker", "services/.gitkeep", "harmless-metadata"],
    ["editor metadata", ".editorconfig", "harmless-metadata"],
  ];

  test.each(allowedPaths)("%s remains nonfunctional: %s", (_category, repositoryPath, expected) => {
    expect(classifyChangedFile(repositoryPath)).toBe(expected);
    expect(policyMessages([repositoryPath])).not.toContain(functionalChangeMessage);
  });

  test("allows a mixed documentation-only and harmless-metadata change", () => {
    const changedFiles = allowedPaths
      .filter(([, , classification]) => classification !== "prd-document")
      .map(([, repositoryPath]) => repositoryPath);

    expect(policyMessages(changedFiles)).not.toContain(functionalChangeMessage);
  });

  test("rejects malformed and traversal-like repository paths", () => {
    for (const repositoryPath of [
      "",
      "/README.md",
      "docs/../apps/page.md",
      "docs//README.md",
      "docs\\README.md",
    ]) {
      expect(classifyChangedFile(repositoryPath)).toBe("functional");
    }
  });

  test("accepts an active cataloged PRD document and catalog with a functional change", () => {
    const messages = policyMessages(
      ["apps/web/src/app/page.tsx", "specs/PRDs/index.json", validEntry.path],
      catalog([validEntry]),
    );

    expect(messages).not.toContain(functionalChangeMessage);
  });

  test("does not accept an uncataloged, deleted, historical, or superseded PRD as the gate", () => {
    const changes = ["apps/web/src/app/page.tsx", "specs/PRDs/index.json", validEntry.path];
    const historical: CatalogEntry = { ...validEntry, lifecycle: "historical" };
    const superseded: CatalogEntry = {
      ...validEntry,
      lifecycle: "superseded",
      supersededBy: "specs/PRDs/PRD_V2_EXAMPLE_CAPABILITY.md",
    };

    expect(policyMessages(changes)).toContain(functionalChangeMessage);
    expect(
      policyMessages(changes, catalog([]), { baselineCatalog: catalog([validEntry]) }),
    ).toContain(functionalChangeMessage);
    expect(policyMessages(changes, catalog([historical]))).toContain(functionalChangeMessage);
    expect(policyMessages(changes, catalog([superseded]))).toContain(functionalChangeMessage);
  });

  test.each([
    ["historical", "document", ["specs/PRDs/index.json", validEntry.path]],
    ["historical", "metadata", ["specs/PRDs/index.json"]],
    ["historical", "removal", ["specs/PRDs/index.json", validEntry.path]],
    ["superseded", "document", ["specs/PRDs/index.json", validEntry.path]],
    ["superseded", "metadata", ["specs/PRDs/index.json"]],
    ["superseded", "removal", ["specs/PRDs/index.json", validEntry.path]],
  ] as const)("keeps %s PRDs immutable on %s changes", (lifecycle, mutation, changedFiles) => {
    const immutable: CatalogEntry = {
      ...validEntry,
      lifecycle,
      supersededBy: lifecycle === "superseded" ? "specs/PRDs/PRD_V2_EXAMPLE_CAPABILITY.md" : null,
    };
    const current =
      mutation === "removal"
        ? catalog([])
        : catalog([
            mutation === "metadata" ? { ...immutable, summary: "Rewritten history." } : immutable,
          ]);

    expect(
      policyMessages(changedFiles, current, { baselineCatalog: catalog([immutable]) }),
    ).toContain(`${lifecycle} PRD documents and metadata are immutable`);
  });

  test("requires catalog and PRD document changes to be paired", () => {
    expect(policyMessages([validEntry.path], catalog([validEntry]))).toContain(
      "catalog entry changes require specs/PRDs/index.json in the same change",
    );
    expect(policyMessages(["specs/PRDs/index.json"], catalog([validEntry]))).toContain(
      "catalog entry changes require the PRD document in the same change",
    );
    expect(
      policyMessages([validEntry.path], catalog([]), {
        baselineCatalog: catalog([validEntry]),
      }),
    ).toContain("catalog entry removal requires specs/PRDs/index.json in the same change");
    expect(
      policyMessages(["specs/PRDs/index.json"], catalog([]), {
        baselineCatalog: catalog([validEntry]),
      }),
    ).toContain("catalog entry removal requires the PRD document removal in the same change");
  });

  const impactCases = [
    {
      name: "architecture",
      entry: { ...validEntry, architectureImpact: true },
      requiredPaths: ["ARCHITECTURE.md"],
      expected: "architectureImpact requires ARCHITECTURE.md in the same change",
    },
    {
      name: "design system",
      entry: { ...validEntry, designSystemImpact: true },
      requiredPaths: ["specs/design/DESIGN.md"],
      expected: "designSystemImpact requires specs/design/DESIGN.md in the same change",
    },
    {
      name: "sensitive data",
      entry: { ...validEntry, sensitiveDataImpact: true },
      requiredPaths: ["docs/security/THREAT_MODEL.md", "docs/security/DATA_RESIDENCY.md"],
      expected: "sensitiveDataImpact requires docs/security/THREAT_MODEL.md in the same change",
    },
    {
      name: "persistence",
      entry: { ...validEntry, persistenceImpact: true },
      requiredPaths: [
        "packages/db/src/schema/account.ts",
        "packages/db/migrations/0001_account.sql",
      ],
      expected:
        "persistenceImpact requires schema and generated migration changes in the same change",
    },
  ] satisfies readonly {
    readonly name: string;
    readonly entry: CatalogEntry;
    readonly requiredPaths: readonly string[];
    readonly expected: string;
  }[];

  test.each(impactCases)("requires $name artifacts in the same change", (impactCase) => {
    const recordChanges = ["specs/PRDs/index.json", impactCase.entry.path];
    expect(policyMessages(recordChanges, catalog([impactCase.entry]))).toContain(
      impactCase.expected,
    );
    expect(
      policyMessages([...recordChanges, ...impactCase.requiredPaths], catalog([impactCase.entry])),
    ).not.toContain(impactCase.expected);
  });

  test("requires both sensitive-data documents", () => {
    const impacted = { ...validEntry, sensitiveDataImpact: true };
    const messages = policyMessages(
      ["specs/PRDs/index.json", impacted.path, "docs/security/THREAT_MODEL.md"],
      catalog([impacted]),
    );

    expect(messages).toContain(
      "sensitiveDataImpact requires docs/security/DATA_RESIDENCY.md in the same change",
    );
  });

  test("does not accept documentation placeholders as persistence artifacts", () => {
    const impacted = { ...validEntry, persistenceImpact: true };
    const messages = policyMessages(
      [
        "specs/PRDs/index.json",
        impacted.path,
        "packages/db/src/schema/README.md",
        "packages/db/migrations/README.md",
      ],
      catalog([impacted]),
    );

    expect(messages).toContain(
      "persistenceImpact requires schema and generated migration changes in the same change",
    );
  });

  test("allows only the constitution-introducing bootstrap change", () => {
    expect(
      policyMessages(["CONSTITUTION.md", "apps/web/src/app/page.tsx"], catalog([]), {
        baselineCatalog: null,
        baselineHasConstitution: false,
      }),
    ).not.toContain(functionalChangeMessage);
    expect(
      policyMessages(["apps/web/src/app/page.tsx"], catalog([]), {
        baselineCatalog: null,
        baselineHasConstitution: false,
      }),
    ).toContain(functionalChangeMessage);
    expect(policyMessages(["CONSTITUTION.md", "apps/web/src/app/page.tsx"])).toContain(
      functionalChangeMessage,
    );
  });

  test("loads no policy context before the first commit", () => {
    mkdirSync(scratchRoot, { recursive: true });
    git(["init", "--initial-branch=main"]);

    expect(loadGitContext(scratchRoot)).toEqual({ context: null, issues: [] });
  });

  test("preserves both sides of committed renames and functional deletions", () => {
    mkdirSync(scratchRoot, { recursive: true });
    git(["init", "--initial-branch=main"]);
    writeFixtureFile("CONSTITUTION.md", "# Constitution\n");
    writeFixtureFile("specs/PRDs/index.json", `${JSON.stringify(catalog([]), null, 2)}\n`);
    writeFixtureFile("apps/web/src/renamed.ts", "export const renamed = true;\n");
    writeFixtureFile("scripts/removed.mjs", "export const removed = true;\n");
    git(["add", "."]);
    git([
      "-c",
      "user.name=Spec Validator",
      "-c",
      "user.email=spec-validator@example.invalid",
      "commit",
      "-m",
      "baseline",
    ]);
    const baseline = git(["rev-parse", "HEAD"]);

    mkdirSync(path.join(scratchRoot, "docs"), { recursive: true });
    renameSync(
      path.join(scratchRoot, "apps/web/src/renamed.ts"),
      path.join(scratchRoot, "docs/renamed.md"),
    );
    rmSync(path.join(scratchRoot, "scripts/removed.mjs"));
    git(["add", "--all"]);
    git([
      "-c",
      "user.name=Spec Validator",
      "-c",
      "user.email=spec-validator@example.invalid",
      "commit",
      "-m",
      "rename and delete",
    ]);

    const loaded = loadGitContext(scratchRoot, baseline);
    expect(loaded.issues).toEqual([]);
    expect(loaded.context?.changedFiles).toEqual(
      new Set(["apps/web/src/renamed.ts", "docs/renamed.md", "scripts/removed.mjs"]),
    );
    if (loaded.context === null) {
      throw new Error("expected Git policy context");
    }
    expect(validateGitPolicies(catalog([]), loaded.context).map((item) => item.message)).toContain(
      functionalChangeMessage,
    );
  });

  test("classifies direct deletions and both directions of renames fail closed", () => {
    expect(policyMessages(["packages/env/src/runtime.ts"])).toContain(functionalChangeMessage);
    expect(policyMessages(["apps/web/src/old.ts", "docs/archive/old.md"])).toContain(
      functionalChangeMessage,
    );
    expect(policyMessages(["docs/archive/old.md", "config/runtime.yaml"])).toContain(
      functionalChangeMessage,
    );
    expect(policyMessages(["docs/archive/old.md", "docs/archive/new.md"])).not.toContain(
      functionalChangeMessage,
    );
  });
});

describe("PRD scaffolding", () => {
  test("creates a document and sorted catalog entry without product defaults", () => {
    mkdirSync(path.join(scratchRoot, "specs", "PRDs"), { recursive: true });
    mkdirSync(path.join(scratchRoot, "specs", "templates"), { recursive: true });
    writeFileSync(
      path.join(scratchRoot, "specs", "PRDs", "index.json"),
      `${JSON.stringify(catalog([]), null, 2)}\n`,
    );
    writeFileSync(
      path.join(scratchRoot, "specs", "templates", "PRD_TEMPLATE.md"),
      readFileSync(path.join(process.cwd(), "specs", "templates", "PRD_TEMPLATE.md"), "utf8"),
    );

    const generatedPath = scaffoldPrd({
      root: scratchRoot,
      version: "1",
      name: "GENERATED_CAPABILITY",
      title: 'Generated "quoted" capability',
      summary: "Prove deterministic scaffolding.",
      owners: ["@example-owner"],
      classification: "Internal",
      date: "2026-07-26",
    });
    const generatedCatalog = JSON.parse(
      readFileSync(path.join(scratchRoot, "specs", "PRDs", "index.json"), "utf8"),
    ) as Catalog;
    const generatedDocument = readFileSync(path.join(scratchRoot, generatedPath), "utf8");
    const frontmatter = parseFrontmatter(generatedDocument);

    expect(generatedPath).toBe("specs/PRDs/PRD_V1_GENERATED_CAPABILITY.md");
    expect(generatedCatalog.entries[0]?.id).toBe("GENERATED_CAPABILITY");
    expect(generatedDocument).toContain('id: "GENERATED_CAPABILITY"');
    expect(frontmatter.issues).toEqual([]);
    expect(frontmatter.metadata?.title).toBe('Generated "quoted" capability');
    expect(generatedDocument).toContain("REPLACE_WITH_OVERVIEW");
  });
});
