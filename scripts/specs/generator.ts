import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  type Catalog,
  type CatalogEntry,
  type DataClassification,
  loadCatalog,
  parsePrdPath,
  validateCatalog,
} from "./model.js";

export interface NewPrdOptions {
  readonly root: string;
  readonly version: string;
  readonly name: string;
  readonly title: string;
  readonly summary: string;
  readonly owners: readonly string[];
  readonly classification: DataClassification;
  readonly lifecycle?: "active" | "current";
  readonly architectureImpact?: boolean;
  readonly designSystemImpact?: boolean;
  readonly sensitiveDataImpact?: boolean;
  readonly persistenceImpact?: boolean;
  readonly date?: string;
}

export class SpecGenerationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SpecGenerationError";
  }
}

function formatIssues(
  messages: readonly { readonly location: string; readonly message: string }[],
) {
  return messages.map((item) => `${item.location}: ${item.message}`).join("\n");
}

function replaceToken(source: string, token: string, value: string): string {
  return source.replaceAll(`REPLACE_WITH_${token}`, value);
}

function compareEntries(left: CatalogEntry, right: CatalogEntry): number {
  const idOrder = left.id.localeCompare(right.id);
  if (idOrder !== 0) {
    return idOrder;
  }

  const [leftMajorText, leftMinorText] = left.version.split(".");
  const [rightMajorText, rightMinorText] = right.version.split(".");
  const majorOrder = Number(leftMajorText) - Number(rightMajorText);
  return majorOrder === 0
    ? Number(leftMinorText ?? "0") - Number(rightMinorText ?? "0")
    : majorOrder;
}

function currentDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function scaffoldPrd(options: NewPrdOptions): string {
  const loaded = loadCatalog(options.root);
  if (loaded.catalog === null) {
    throw new SpecGenerationError(formatIssues(loaded.issues));
  }

  const repositoryPath = `specs/PRDs/PRD_V${options.version}_${options.name}.md`;
  const identity = parsePrdPath(repositoryPath);
  if (identity === null) {
    throw new SpecGenerationError(
      "name and version must produce PRD_V{major}[.{minor}]_NAME_IN_CAPS.md",
    );
  }
  if (identity.id !== options.name || identity.version !== options.version) {
    throw new SpecGenerationError(
      "name and version must produce PRD_V{major}[.{minor}]_NAME_IN_CAPS.md",
    );
  }

  const date = options.date ?? currentDate();
  const entry: CatalogEntry = {
    id: options.name,
    version: options.version,
    path: repositoryPath,
    title: options.title.trim(),
    summary: options.summary.trim(),
    lifecycle: options.lifecycle ?? "active",
    owners: options.owners.map((owner) => owner.trim()),
    created: date,
    updated: date,
    dataClassification: options.classification,
    supersededBy: null,
    architectureImpact: options.architectureImpact ?? false,
    designSystemImpact: options.designSystemImpact ?? false,
    sensitiveDataImpact: options.sensitiveDataImpact ?? false,
    persistenceImpact: options.persistenceImpact ?? false,
  };

  const nextCatalog: Catalog = {
    $schema: "../catalog.schema.json",
    schemaVersion: 1,
    entries: [...loaded.catalog.entries, entry].sort(compareEntries),
  };
  const validation = validateCatalog(nextCatalog);
  if (validation.catalog === null) {
    throw new SpecGenerationError(formatIssues(validation.issues));
  }

  const documentPath = path.join(options.root, repositoryPath);
  if (existsSync(documentPath)) {
    throw new SpecGenerationError(`${repositoryPath} already exists`);
  }

  const templatePath = path.join(options.root, "specs", "templates", "PRD_TEMPLATE.md");
  if (!existsSync(templatePath)) {
    throw new SpecGenerationError("specs/templates/PRD_TEMPLATE.md is missing");
  }

  const replacements: Readonly<Record<string, string>> = {
    ID: entry.id,
    VERSION: entry.version,
    PATH: entry.path,
    TITLE: entry.title,
    TITLE_JSON: JSON.stringify(entry.title),
    SUMMARY: entry.summary,
    SUMMARY_JSON: JSON.stringify(entry.summary),
    LIFECYCLE: entry.lifecycle,
    OWNERS: JSON.stringify(entry.owners),
    CREATED: entry.created,
    UPDATED: entry.updated,
    DATA_CLASSIFICATION: entry.dataClassification,
    ARCHITECTURE_IMPACT: String(entry.architectureImpact),
    DESIGN_SYSTEM_IMPACT: String(entry.designSystemImpact),
    SENSITIVE_DATA_IMPACT: String(entry.sensitiveDataImpact),
    PERSISTENCE_IMPACT: String(entry.persistenceImpact),
  };

  let document = readFileSync(templatePath, "utf8");
  const orderedReplacements = Object.entries(replacements).toSorted(
    ([leftToken], [rightToken]) => rightToken.length - leftToken.length,
  );
  for (const [token, value] of orderedReplacements) {
    document = replaceToken(document, token, value);
  }

  const catalogPath = path.join(options.root, "specs", "PRDs", "index.json");
  const processSuffix = `${String(process.pid)}-${String(Date.now())}`;
  const temporaryDocumentPath = `${documentPath}.${processSuffix}.tmp`;
  const temporaryCatalogPath = `${catalogPath}.${processSuffix}.tmp`;

  mkdirSync(path.dirname(documentPath), { recursive: true });

  try {
    writeFileSync(temporaryDocumentPath, document, { encoding: "utf8", flag: "wx" });
    writeFileSync(temporaryCatalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    renameSync(temporaryDocumentPath, documentPath);
    try {
      renameSync(temporaryCatalogPath, catalogPath);
    } catch (error: unknown) {
      rmSync(documentPath, { force: true });
      throw error;
    }
  } catch (error: unknown) {
    rmSync(temporaryDocumentPath, { force: true });
    rmSync(temporaryCatalogPath, { force: true });
    if (error instanceof SpecGenerationError) {
      throw error;
    }
    const detail = error instanceof Error ? error.message : "unknown file error";
    throw new SpecGenerationError(`could not write PRD atomically: ${detail}`);
  }

  return repositoryPath;
}
