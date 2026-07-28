import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const LIFECYCLES = ["active", "current", "historical", "superseded"] as const;
export const DATA_CLASSIFICATIONS = ["Public", "Internal", "Confidential", "Restricted"] as const;

export type Lifecycle = (typeof LIFECYCLES)[number];
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

export function isDataClassification(value: string): value is DataClassification {
  return DATA_CLASSIFICATIONS.some((classification) => classification === value);
}

export interface CatalogEntry {
  readonly id: string;
  readonly version: string;
  readonly path: string;
  readonly title: string;
  readonly summary: string;
  readonly lifecycle: Lifecycle;
  readonly owners: readonly string[];
  readonly created: string;
  readonly updated: string;
  readonly dataClassification: DataClassification;
  readonly supersededBy: string | null;
  readonly architectureImpact: boolean;
  readonly designSystemImpact: boolean;
  readonly sensitiveDataImpact: boolean;
  readonly persistenceImpact: boolean;
}

export interface Catalog {
  readonly $schema: "../catalog.schema.json";
  readonly schemaVersion: 1;
  readonly entries: readonly CatalogEntry[];
}

export interface ValidationIssue {
  readonly location: string;
  readonly message: string;
}

export interface GitContext {
  readonly baselineCatalog: Catalog | null;
  readonly baselineHasConstitution: boolean;
  readonly baselineRef: string;
  readonly changedFiles: ReadonlySet<string>;
}

export interface GitContextResult {
  readonly context: GitContext | null;
  readonly issues: readonly ValidationIssue[];
}

export type ChangedFileClassification =
  "documentation" | "functional" | "harmless-metadata" | "prd-catalog" | "prd-document";

const ENTRY_KEYS = [
  "id",
  "version",
  "path",
  "title",
  "summary",
  "lifecycle",
  "owners",
  "created",
  "updated",
  "dataClassification",
  "supersededBy",
  "architectureImpact",
  "designSystemImpact",
  "sensitiveDataImpact",
  "persistenceImpact",
] as const;

const REQUIRED_SECTIONS = [
  "Overview",
  "Motivation",
  "Scope",
  "Out of Scope",
  "Feature Specifications",
  "Affected Files",
  "Acceptance Criteria",
  "Migration and Configuration",
  "Verification",
  "Status",
] as const;

const ID_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const VERSION_PATTERN = /^[1-9]\d*(?:\.\d+)?$/;
const PRD_PATH_PATTERN =
  /^specs\/PRDs\/PRD_V([1-9]\d*(?:\.\d+)?)_([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)\.md$/;
const PLACEHOLDER_PATTERN =
  /\bREPLACE_WITH_[A-Z0-9_]+\b|__[A-Z0-9_]+__|\{\{[A-Z0-9_]+\}\}|\b(?:TODO|TBD)\b|YYYY-MM-DD|@responsible-owner/;
const PRD_CATALOG_PATH = "specs/PRDs/index.json";
const ROOT_DOCUMENTATION_PATHS = new Set([
  "ARCHITECTURE.md",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONSTITUTION.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "LICENSE.md",
  "NOTICE",
  "NOTICE.md",
  "README.md",
  "SECURITY.md",
]);
const HARMLESS_METADATA_PATHS = new Set([
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  ".mailmap",
]);
const WORKSPACE_DOCUMENT_PATTERN =
  /^(?:apps|packages|services)\/[^/]+\/(?:CHANGELOG|CONTRIBUTING|README|SECURITY)\.md$/;
const DOCUMENTATION_PATH_PATTERN = /^docs\/.+\.mdx?$/;
const SPEC_DOCUMENTATION_PATH_PATTERN = /^specs\/(?:design|templates)\/.+\.mdx?$/;
const SCHEMA_SOURCE_PATH_PATTERN =
  /^packages\/db\/src\/schema\/.+\.(?:[cm]?[jt]sx?|graphql|json|prisma|sql)$/;
const MIGRATION_PATH_PATTERN = /^packages\/db\/migrations\/.+\.(?:json|sql)$/;

function issue(location: string, message: string): ValidationIssue {
  return { location, message };
}

export function classifyChangedFile(repositoryPath: string): ChangedFileClassification {
  const normalizedPath = repositoryPath;
  const segments = normalizedPath.split("/");

  if (
    normalizedPath.length === 0 ||
    normalizedPath.startsWith("/") ||
    normalizedPath.includes("\\") ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    return "functional";
  }

  if (PRD_PATH_PATTERN.test(normalizedPath)) {
    return "prd-document";
  }
  if (normalizedPath === PRD_CATALOG_PATH) {
    return "prd-catalog";
  }
  if (
    ROOT_DOCUMENTATION_PATHS.has(normalizedPath) ||
    DOCUMENTATION_PATH_PATTERN.test(normalizedPath) ||
    SPEC_DOCUMENTATION_PATH_PATTERN.test(normalizedPath) ||
    normalizedPath === "specs/README.md" ||
    WORKSPACE_DOCUMENT_PATTERN.test(normalizedPath)
  ) {
    return "documentation";
  }
  if (
    HARMLESS_METADATA_PATHS.has(normalizedPath) ||
    normalizedPath.endsWith("/.gitignore") ||
    normalizedPath === ".gitkeep" ||
    normalizedPath.endsWith("/.gitkeep")
  ) {
    return "harmless-metadata";
  }

  return "functional";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
): value is Values[number] {
  return typeof value === "string" && values.includes(value);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function hasMeaningfulText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !/[\r\n]/.test(value) &&
    !PLACEHOLDER_PATTERN.test(value)
  );
}

function validateEntryShape(value: unknown, location: string): ValidationIssue[] {
  if (!isRecord(value)) {
    return [issue(location, "entry must be an object")];
  }

  const issues: ValidationIssue[] = [];
  const allowedKeys = new Set<string>(ENTRY_KEYS);

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      issues.push(issue(location, `unknown metadata field "${key}"`));
    }
  }

  for (const key of ENTRY_KEYS) {
    if (!(key in value)) {
      issues.push(issue(location, `missing metadata field "${key}"`));
    }
  }

  if (typeof value.id !== "string" || !ID_PATTERN.test(value.id)) {
    issues.push(issue(location, "id must use NAME_IN_CAPS format"));
  }

  if (typeof value.version !== "string" || !VERSION_PATTERN.test(value.version)) {
    issues.push(issue(location, "version must be a major or major.minor value beginning at 1"));
  }

  if (typeof value.path !== "string" || !PRD_PATH_PATTERN.test(value.path)) {
    issues.push(
      issue(location, "path must match specs/PRDs/PRD_V{major}[.{minor}]_NAME_IN_CAPS.md"),
    );
  }

  if (!hasMeaningfulText(value.title)) {
    issues.push(issue(location, "title must be nonempty and contain no template marker"));
  }

  if (!hasMeaningfulText(value.summary)) {
    issues.push(issue(location, "summary must be nonempty and contain no template marker"));
  }

  if (!isOneOf(value.lifecycle, LIFECYCLES)) {
    issues.push(issue(location, `lifecycle must be one of ${LIFECYCLES.join(", ")}`));
  }

  if (
    !Array.isArray(value.owners) ||
    value.owners.length === 0 ||
    value.owners.some((owner) => !hasMeaningfulText(owner))
  ) {
    issues.push(issue(location, "owners must be a nonempty array of explicit owner identifiers"));
  } else if (new Set(value.owners).size !== value.owners.length) {
    issues.push(issue(location, "owners must not contain duplicates"));
  }

  for (const field of ["created", "updated"] as const) {
    const date = value[field];
    if (typeof date !== "string" || !isIsoDate(date)) {
      issues.push(issue(location, `${field} must be an ISO 8601 calendar date`));
    }
  }

  if (
    typeof value.created === "string" &&
    typeof value.updated === "string" &&
    isIsoDate(value.created) &&
    isIsoDate(value.updated) &&
    value.updated < value.created
  ) {
    issues.push(issue(location, "updated must not precede created"));
  }

  if (!isOneOf(value.dataClassification, DATA_CLASSIFICATIONS)) {
    issues.push(
      issue(location, `dataClassification must be one of ${DATA_CLASSIFICATIONS.join(", ")}`),
    );
  }

  if (value.supersededBy !== null && typeof value.supersededBy !== "string") {
    issues.push(issue(location, "supersededBy must be a PRD path or null"));
  }

  for (const field of [
    "architectureImpact",
    "designSystemImpact",
    "sensitiveDataImpact",
    "persistenceImpact",
  ] as const) {
    if (typeof value[field] !== "boolean") {
      issues.push(issue(location, `${field} must be boolean`));
    }
  }

  if (
    typeof value.path === "string" &&
    typeof value.id === "string" &&
    typeof value.version === "string"
  ) {
    const identity = parsePrdPath(value.path);
    if (identity !== null && (identity.id !== value.id || identity.version !== value.version)) {
      issues.push(issue(location, "path, id, and version identities must agree"));
    }
  }

  return issues;
}

export function parsePrdPath(
  repositoryPath: string,
): { readonly id: string; readonly version: string } | null {
  const match = PRD_PATH_PATTERN.exec(repositoryPath);
  const version = match?.[1];
  const id = match?.[2];
  return version === undefined || id === undefined ? null : { id, version };
}

function versionParts(version: string): readonly [number, number] {
  const [majorText, minorText] = version.split(".");
  return [Number(majorText), Number(minorText ?? "0")];
}

function compareVersions(left: string, right: string): number {
  const [leftMajor, leftMinor] = versionParts(left);
  const [rightMajor, rightMinor] = versionParts(right);
  return leftMajor === rightMajor ? leftMinor - rightMinor : leftMajor - rightMajor;
}

export function validateCatalog(input: unknown): {
  readonly catalog: Catalog | null;
  readonly issues: readonly ValidationIssue[];
} {
  if (!isRecord(input)) {
    return { catalog: null, issues: [issue("specs/PRDs/index.json", "catalog must be an object")] };
  }

  const issues: ValidationIssue[] = [];
  const allowedRootKeys = new Set(["$schema", "schemaVersion", "entries"]);

  for (const key of Object.keys(input)) {
    if (!allowedRootKeys.has(key)) {
      issues.push(issue("specs/PRDs/index.json", `unknown catalog field "${key}"`));
    }
  }

  if (input.$schema !== "../catalog.schema.json") {
    issues.push(issue("specs/PRDs/index.json", "$schema must be ../catalog.schema.json"));
  }

  if (input.schemaVersion !== 1) {
    issues.push(issue("specs/PRDs/index.json", "schemaVersion must be 1"));
  }

  if (!Array.isArray(input.entries)) {
    issues.push(issue("specs/PRDs/index.json", "entries must be an array"));
    return { catalog: null, issues };
  }

  input.entries.forEach((entry, index) => {
    issues.push(...validateEntryShape(entry, `specs/PRDs/index.json entries[${String(index)}]`));
  });

  if (issues.length > 0) {
    return { catalog: null, issues };
  }

  const catalog: Catalog = {
    $schema: "../catalog.schema.json",
    schemaVersion: 1,
    entries: input.entries.map((entry) => entry as CatalogEntry),
  };
  const paths = new Map<string, number>();
  const identities = new Map<string, number>();
  const lifecycleCounts = new Map<string, { active: number; current: number }>();

  catalog.entries.forEach((entry, index) => {
    const previousPathIndex = paths.get(entry.path);
    if (previousPathIndex !== undefined) {
      issues.push(
        issue(
          `specs/PRDs/index.json entries[${String(index)}]`,
          `path duplicates entries[${String(previousPathIndex)}]`,
        ),
      );
    }
    paths.set(entry.path, index);

    const identity = `${entry.id}@${entry.version}`;
    const previousIdentityIndex = identities.get(identity);
    if (previousIdentityIndex !== undefined) {
      issues.push(
        issue(
          `specs/PRDs/index.json entries[${String(index)}]`,
          `id/version duplicates entries[${String(previousIdentityIndex)}]`,
        ),
      );
    }
    identities.set(identity, index);

    const counts = lifecycleCounts.get(entry.id) ?? { active: 0, current: 0 };
    if (entry.lifecycle === "active") {
      counts.active += 1;
    }
    if (entry.lifecycle === "current") {
      counts.current += 1;
    }
    lifecycleCounts.set(entry.id, counts);
  });

  for (const [id, counts] of lifecycleCounts) {
    if (counts.active > 1) {
      issues.push(issue("specs/PRDs/index.json", `${id} has more than one active version`));
    }
    if (counts.current > 1) {
      issues.push(issue("specs/PRDs/index.json", `${id} has more than one current version`));
    }
  }

  for (const entry of catalog.entries) {
    if (entry.lifecycle !== "superseded") {
      if (entry.supersededBy !== null) {
        issues.push(issue(entry.path, "only superseded entries may set supersededBy"));
      }
      continue;
    }

    if (entry.supersededBy === null) {
      issues.push(issue(entry.path, "superseded entries must set supersededBy"));
      continue;
    }

    if (entry.supersededBy === entry.path) {
      issues.push(issue(entry.path, "supersededBy cannot reference the same document"));
      continue;
    }

    const successor = catalog.entries.find((candidate) => candidate.path === entry.supersededBy);
    if (successor === undefined) {
      issues.push(issue(entry.path, "supersededBy must reference a cataloged PRD"));
      continue;
    }

    if (successor.id !== entry.id) {
      issues.push(issue(entry.path, "supersededBy must reference the same PRD id"));
    }
    if (compareVersions(successor.version, entry.version) <= 0) {
      issues.push(issue(entry.path, "supersededBy must reference a higher version"));
    }
    if (successor.lifecycle === "historical" || successor.lifecycle === "superseded") {
      issues.push(issue(entry.path, "supersededBy must reference an active or current version"));
    }
  }

  return { catalog: issues.length === 0 ? catalog : null, issues };
}

function parseFrontmatterValue(rawValue: string): unknown {
  const trimmed = rawValue.trim();

  if (trimmed === "null") {
    return null;
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }

  if (trimmed.startsWith('"') || trimmed.startsWith("[")) {
    return JSON.parse(trimmed) as unknown;
  }

  return trimmed;
}

export function parseFrontmatter(markdown: string): {
  readonly body: string;
  readonly metadata: Record<string, unknown> | null;
  readonly issues: readonly ValidationIssue[];
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(markdown);
  if (match === null) {
    return {
      body: markdown,
      metadata: null,
      issues: [issue("frontmatter", "document must begin with delimited metadata")],
    };
  }

  const frontmatterText = match[1];
  if (frontmatterText === undefined) {
    return {
      body: markdown,
      metadata: null,
      issues: [issue("frontmatter", "frontmatter is empty")],
    };
  }

  const metadata: Record<string, unknown> = {};
  const issues: ValidationIssue[] = [];

  frontmatterText.split(/\r?\n/).forEach((line, lineIndex) => {
    if (line.trim().length === 0) {
      return;
    }

    const fieldMatch = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(line);
    const key = fieldMatch?.[1];
    const rawValue = fieldMatch?.[2];
    if (key === undefined || rawValue === undefined) {
      issues.push(
        issue("frontmatter", `line ${String(lineIndex + 1)} is not a supported key/value field`),
      );
      return;
    }
    if (key in metadata) {
      issues.push(issue("frontmatter", `field "${key}" is duplicated`));
      return;
    }

    try {
      metadata[key] = parseFrontmatterValue(rawValue);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : "unknown parse error";
      issues.push(
        issue("frontmatter", `field "${key}" is invalid JSON-compatible YAML: ${detail}`),
      );
    }
  });

  return {
    body: markdown.slice(match[0].length),
    metadata,
    issues,
  };
}

function sectionContents(body: string): Map<string, string> {
  const headings = [...body.matchAll(/^## (.+)$/gm)];
  const sections = new Map<string, string>();

  headings.forEach((heading, index) => {
    const name = heading[1];
    if (name === undefined) {
      return;
    }

    const contentStart = heading.index + heading[0].length;
    const nextHeading = headings[index + 1];
    const contentEnd = nextHeading?.index ?? body.length;
    sections.set(name, body.slice(contentStart, contentEnd).trim());
  });

  return sections;
}

function equivalent(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validatePrdDocument(
  entry: CatalogEntry,
  markdown: string,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parsed = parseFrontmatter(markdown);
  issues.push(...parsed.issues.map((item) => issue(entry.path, item.message)));

  if (parsed.metadata !== null) {
    const metadataIssues = validateEntryShape(parsed.metadata, entry.path);
    issues.push(...metadataIssues);

    if (metadataIssues.length === 0) {
      for (const key of ENTRY_KEYS) {
        if (!equivalent(parsed.metadata[key], entry[key])) {
          issues.push(issue(entry.path, `frontmatter "${key}" must match the catalog`));
        }
      }
    }
  }

  const firstContentLine = parsed.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  const expectedTitle = `# PRD V${entry.version}: ${entry.title}`;
  if (firstContentLine !== expectedTitle) {
    issues.push(issue(entry.path, `first heading must be "${expectedTitle}"`));
  }

  const headings = [...parsed.body.matchAll(/^## (.+)$/gm)]
    .map((match) => match[1])
    .filter((heading): heading is string => heading !== undefined);

  if (!equivalent(headings, REQUIRED_SECTIONS)) {
    issues.push(
      issue(
        entry.path,
        `required H2 sections must appear once and in order: ${REQUIRED_SECTIONS.join(", ")}`,
      ),
    );
  }

  const sections = sectionContents(parsed.body);
  for (const sectionName of REQUIRED_SECTIONS) {
    const content = sections.get(sectionName);
    if (content === undefined || content.trim().length === 0) {
      issues.push(issue(entry.path, `section "${sectionName}" must not be empty`));
    }
  }

  if (PLACEHOLDER_PATTERN.test(parsed.body)) {
    issues.push(issue(entry.path, "document contains an unresolved template marker"));
  }

  for (const sectionName of ["Scope", "Out of Scope"] as const) {
    const content = sections.get(sectionName) ?? "";
    if (!/^- .+/m.test(content)) {
      issues.push(issue(entry.path, `${sectionName} must contain at least one list item`));
    }
  }

  const featureContent = sections.get("Feature Specifications") ?? "";
  const featureIds = [...featureContent.matchAll(/^### (FS-\d{3}): .+$/gm)]
    .map((match) => match[1])
    .filter((identifier): identifier is string => identifier !== undefined);
  if (featureIds.length === 0) {
    issues.push(issue(entry.path, "Feature Specifications must contain at least one FS-### item"));
  } else if (new Set(featureIds).size !== featureIds.length) {
    issues.push(issue(entry.path, "feature identifiers must be unique"));
  }

  const affectedFiles = sections.get("Affected Files") ?? "";
  if (!/^- (?:`[^`]+`|None\b).+/m.test(affectedFiles)) {
    issues.push(
      issue(
        entry.path,
        "Affected Files must list repository-relative paths or a reasoned None entry",
      ),
    );
  }

  const acceptanceContent = sections.get("Acceptance Criteria") ?? "";
  const acceptanceIds = [...acceptanceContent.matchAll(/^- \[[ xX]\] \*\*(AC-\d{3})\*\*: .+$/gm)]
    .map((match) => match[1])
    .filter((identifier): identifier is string => identifier !== undefined);

  if (acceptanceIds.length === 0) {
    issues.push(issue(entry.path, "Acceptance Criteria must contain at least one AC-### item"));
  } else if (new Set(acceptanceIds).size !== acceptanceIds.length) {
    issues.push(issue(entry.path, "acceptance criterion identifiers must be unique"));
  }

  const verificationContent = sections.get("Verification") ?? "";
  const verificationRows = [
    ...verificationContent.matchAll(
      /^\|\s*(AC-\d{3})\s*\|\s*(automated|CI|manual)\s*\|\s*(.+?)\s*\|$/gm,
    ),
  ];
  const verificationById = new Map<string, number>();

  for (const row of verificationRows) {
    const identifier = row[1];
    const evidence = row[3];
    if (identifier === undefined || evidence === undefined) {
      continue;
    }

    verificationById.set(identifier, (verificationById.get(identifier) ?? 0) + 1);
    if (!hasMeaningfulText(evidence) || evidence === "-") {
      issues.push(issue(entry.path, `${identifier} verification evidence must be reproducible`));
    }
  }

  for (const identifier of acceptanceIds) {
    const mappingCount = verificationById.get(identifier) ?? 0;
    if (mappingCount !== 1) {
      issues.push(
        issue(entry.path, `${identifier} must have exactly one automated, CI, or manual mapping`),
      );
    }
  }

  for (const [identifier] of verificationById) {
    if (!acceptanceIds.includes(identifier)) {
      issues.push(issue(entry.path, `${identifier} verification has no acceptance criterion`));
    }
  }

  const statusContent = sections.get("Status") ?? "";
  if (!statusContent.includes(`Lifecycle: **${entry.lifecycle}**`)) {
    issues.push(issue(entry.path, "Status must state the catalog lifecycle"));
  }

  return issues;
}

function readJsonFile(filePath: string): {
  readonly value: unknown;
  readonly issues: readonly ValidationIssue[];
} {
  try {
    return { value: JSON.parse(readFileSync(filePath, "utf8")) as unknown, issues: [] };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown read error";
    return { value: null, issues: [issue(path.basename(filePath), detail)] };
  }
}

export function loadCatalog(root: string): {
  readonly catalog: Catalog | null;
  readonly issues: readonly ValidationIssue[];
} {
  const catalogPath = path.join(root, "specs", "PRDs", "index.json");
  const loaded = readJsonFile(catalogPath);
  if (loaded.issues.length > 0) {
    return { catalog: null, issues: loaded.issues };
  }
  return validateCatalog(loaded.value);
}

export function validateRepository(
  root: string,
  gitContext: GitContext | null = null,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const loaded = loadCatalog(root);
  issues.push(...loaded.issues);

  if (!existsSync(path.join(root, "specs", "catalog.schema.json"))) {
    issues.push(issue("specs/catalog.schema.json", "catalog schema is missing"));
  }

  if (loaded.catalog === null) {
    return issues;
  }

  const prdDirectory = path.join(root, "specs", "PRDs");
  const catalogPaths = new Set(loaded.catalog.entries.map((entry) => entry.path));
  const directoryEntries = readdirSync(prdDirectory, { withFileTypes: true });

  for (const directoryEntry of directoryEntries) {
    if (directoryEntry.name === "index.json") {
      continue;
    }

    const repositoryPath = `specs/PRDs/${directoryEntry.name}`;
    if (!directoryEntry.isFile() || !catalogPaths.has(repositoryPath)) {
      issues.push(issue(repositoryPath, "uncataloged content is not allowed in specs/PRDs"));
    }
  }

  for (const entry of loaded.catalog.entries) {
    const documentPath = path.join(root, entry.path);
    if (!existsSync(documentPath)) {
      issues.push(issue(entry.path, "cataloged document does not exist"));
      continue;
    }

    issues.push(...validatePrdDocument(entry, readFileSync(documentPath, "utf8")));
  }

  if (gitContext !== null) {
    issues.push(...validateGitPolicies(loaded.catalog, gitContext));
  }

  return issues;
}

function normalizedPaths(output: string): readonly string[] {
  return output.split("\0").filter((repositoryPath) => repositoryPath.length > 0);
}

function runGit(
  root: string,
  argumentsList: readonly string[],
): { readonly ok: boolean; readonly output: string } {
  const result = spawnSync("git", argumentsList, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  return {
    ok: result.status === 0,
    output: typeof result.stdout === "string" ? result.stdout : "",
  };
}

function readCatalogAtRef(
  root: string,
  reference: string,
): {
  readonly catalog: Catalog | null;
  readonly issues: readonly ValidationIssue[];
} {
  const result = runGit(root, ["show", `${reference}:specs/PRDs/index.json`]);
  if (!result.ok) {
    return { catalog: null, issues: [] };
  }

  try {
    return validateCatalog(JSON.parse(result.output) as unknown);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown JSON error";
    return {
      catalog: null,
      issues: [issue("specs/PRDs/index.json", `baseline catalog is invalid: ${detail}`)],
    };
  }
}

export function loadGitContext(root: string, requestedBase?: string): GitContextResult {
  if (!runGit(root, ["rev-parse", "--is-inside-work-tree"]).ok) {
    return { context: null, issues: [] };
  }

  const hasHead = runGit(root, ["rev-parse", "--verify", "HEAD"]).ok;
  if (!hasHead) {
    return { context: null, issues: [] };
  }

  const baselineRef = requestedBase ?? "HEAD";
  if (!runGit(root, ["rev-parse", "--verify", `${baselineRef}^{commit}`]).ok) {
    return {
      context: null,
      issues: [issue("git", `base reference "${baselineRef}" is not a commit`)],
    };
  }

  const changedFiles = new Set<string>();
  if (baselineRef !== "HEAD") {
    const committed = runGit(root, [
      "diff",
      "--no-ext-diff",
      "--no-renames",
      "--name-only",
      "--diff-filter=ACDMRTUXB",
      "-z",
      `${baselineRef}...HEAD`,
    ]);
    if (!committed.ok) {
      return {
        context: null,
        issues: [issue("git", `could not compare ${baselineRef}...HEAD`)],
      };
    }
    normalizedPaths(committed.output).forEach((file) => changedFiles.add(file));
  }

  const working = runGit(root, [
    "diff",
    "--no-ext-diff",
    "--no-renames",
    "--name-only",
    "--diff-filter=ACDMRTUXB",
    "-z",
    "HEAD",
  ]);
  if (!working.ok) {
    return {
      context: null,
      issues: [issue("git", "could not inspect working-tree changes against HEAD")],
    };
  }
  normalizedPaths(working.output).forEach((file) => changedFiles.add(file));

  const untracked = runGit(root, ["ls-files", "--others", "--exclude-standard", "-z"]);
  if (!untracked.ok) {
    return {
      context: null,
      issues: [issue("git", "could not inspect untracked files")],
    };
  }
  normalizedPaths(untracked.output).forEach((file) => changedFiles.add(file));

  const baseline = readCatalogAtRef(root, baselineRef);
  if (baseline.issues.length > 0) {
    return { context: null, issues: baseline.issues };
  }

  const baselineHasConstitution = runGit(root, [
    "cat-file",
    "-e",
    `${baselineRef}:CONSTITUTION.md`,
  ]).ok;

  return {
    context: {
      baselineCatalog: baseline.catalog,
      baselineHasConstitution,
      baselineRef,
      changedFiles,
    },
    issues: [],
  };
}

function sameEntry(left: CatalogEntry, right: CatalogEntry): boolean {
  return equivalent(left, right);
}

function includesChangedFile(
  changedFiles: ReadonlySet<string>,
  predicate: (file: string) => boolean,
): boolean {
  return [...changedFiles].some(predicate);
}

export function validateGitPolicies(
  currentCatalog: Catalog,
  context: GitContext,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const baselineEntries = new Map(
    (context.baselineCatalog?.entries ?? []).map((entry) => [entry.path, entry]),
  );
  const currentEntries = new Map(currentCatalog.entries.map((entry) => [entry.path, entry]));

  for (const baselineEntry of baselineEntries.values()) {
    if (baselineEntry.lifecycle !== "historical" && baselineEntry.lifecycle !== "superseded") {
      continue;
    }

    const currentEntry = currentEntries.get(baselineEntry.path);
    if (
      context.changedFiles.has(baselineEntry.path) ||
      currentEntry === undefined ||
      !sameEntry(baselineEntry, currentEntry)
    ) {
      issues.push(
        issue(
          baselineEntry.path,
          `${baselineEntry.lifecycle} PRD documents and metadata are immutable`,
        ),
      );
    }
  }

  const catalogChanged = context.changedFiles.has(PRD_CATALOG_PATH);
  const changedCatalogedDocuments = currentCatalog.entries.filter((entry) =>
    context.changedFiles.has(entry.path),
  );

  for (const entry of currentCatalog.entries) {
    const baselineEntry = baselineEntries.get(entry.path);
    const metadataChanged = baselineEntry === undefined || !sameEntry(entry, baselineEntry);

    if (metadataChanged && !catalogChanged) {
      issues.push(
        issue(entry.path, `catalog entry changes require ${PRD_CATALOG_PATH} in the same change`),
      );
    }
    if (metadataChanged && !context.changedFiles.has(entry.path)) {
      issues.push(
        issue(entry.path, "catalog entry changes require the PRD document in the same change"),
      );
    }
    if (context.changedFiles.has(entry.path) && !catalogChanged) {
      issues.push(
        issue(
          entry.path,
          `cataloged PRD document changes require ${PRD_CATALOG_PATH} in the same change`,
        ),
      );
    }
  }

  for (const baselineEntry of baselineEntries.values()) {
    if (
      currentEntries.has(baselineEntry.path) ||
      baselineEntry.lifecycle === "historical" ||
      baselineEntry.lifecycle === "superseded"
    ) {
      continue;
    }
    if (!catalogChanged) {
      issues.push(
        issue(
          baselineEntry.path,
          `catalog entry removal requires ${PRD_CATALOG_PATH} in the same change`,
        ),
      );
    }
    if (!context.changedFiles.has(baselineEntry.path)) {
      issues.push(
        issue(
          baselineEntry.path,
          "catalog entry removal requires the PRD document removal in the same change",
        ),
      );
    }
  }

  const initialBootstrap =
    !context.baselineHasConstitution && context.changedFiles.has("CONSTITUTION.md");

  if (!initialBootstrap) {
    const functionalChange = includesChangedFile(
      context.changedFiles,
      (file) => classifyChangedFile(file) === "functional",
    );
    const changedPrd =
      catalogChanged &&
      changedCatalogedDocuments.some(
        (entry) => entry.lifecycle === "active" || entry.lifecycle === "current",
      );

    if (functionalChange && !changedPrd) {
      issues.push(
        issue("git", "functional changes require a cataloged PRD document in the same change"),
      );
    }
  }

  for (const entry of currentCatalog.entries) {
    const baselineEntry = baselineEntries.get(entry.path);
    const entryChanged =
      context.changedFiles.has(entry.path) ||
      baselineEntry === undefined ||
      !sameEntry(entry, baselineEntry);

    if (!entryChanged) {
      continue;
    }

    if (entry.architectureImpact && !context.changedFiles.has("ARCHITECTURE.md")) {
      issues.push(
        issue(entry.path, "architectureImpact requires ARCHITECTURE.md in the same change"),
      );
    }

    if (entry.designSystemImpact && !context.changedFiles.has("specs/design/DESIGN.md")) {
      issues.push(
        issue(entry.path, "designSystemImpact requires specs/design/DESIGN.md in the same change"),
      );
    }

    if (entry.sensitiveDataImpact) {
      for (const requiredPath of [
        "docs/security/THREAT_MODEL.md",
        "docs/security/DATA_RESIDENCY.md",
      ]) {
        if (!context.changedFiles.has(requiredPath)) {
          issues.push(
            issue(entry.path, `sensitiveDataImpact requires ${requiredPath} in the same change`),
          );
        }
      }
    }

    if (entry.persistenceImpact) {
      const hasSchema = includesChangedFile(context.changedFiles, (file) =>
        SCHEMA_SOURCE_PATH_PATTERN.test(file),
      );
      const hasMigration = includesChangedFile(context.changedFiles, (file) =>
        MIGRATION_PATH_PATTERN.test(file),
      );
      if (!hasSchema || !hasMigration) {
        issues.push(
          issue(
            entry.path,
            "persistenceImpact requires schema and generated migration changes in the same change",
          ),
        );
      }
    }
  }

  return issues;
}
