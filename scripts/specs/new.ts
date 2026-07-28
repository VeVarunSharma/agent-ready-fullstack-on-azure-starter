import { DATA_CLASSIFICATIONS, isDataClassification } from "./model.js";
import { scaffoldPrd, SpecGenerationError } from "./generator.js";

interface ParsedArguments {
  readonly values: ReadonlyMap<string, readonly string[]>;
  readonly flags: ReadonlySet<string>;
}

const VALUE_OPTIONS = new Set([
  "version",
  "name",
  "title",
  "summary",
  "owner",
  "classification",
  "lifecycle",
]);
const BOOLEAN_OPTIONS = new Set([
  "architecture-impact",
  "design-system-impact",
  "sensitive-data-impact",
  "persistence-impact",
  "help",
]);

function usage(): string {
  return [
    "Usage:",
    '  pnpm spec:new -- --version 1 --name NAME_IN_CAPS --title "Title" \\',
    '    --summary "Purpose" --owner "@owner" --classification Internal',
    "",
    `Classifications: ${DATA_CLASSIFICATIONS.join(", ")}`,
    "Optional: --lifecycle active|current and any documented impact flag.",
  ].join("\n");
}

function parseArguments(argumentsList: readonly string[]): ParsedArguments {
  const values = new Map<string, string[]>();
  const flags = new Set<string>();

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--") {
      continue;
    }
    if (!argument?.startsWith("--")) {
      throw new SpecGenerationError(`unexpected argument "${argument ?? ""}"`);
    }

    const option = argument.slice(2);
    if (BOOLEAN_OPTIONS.has(option)) {
      flags.add(option);
      continue;
    }
    if (!VALUE_OPTIONS.has(option)) {
      throw new SpecGenerationError(`unknown option --${option}`);
    }

    const value = argumentsList[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new SpecGenerationError(`--${option} requires a value`);
    }
    values.set(option, [...(values.get(option) ?? []), value]);
    index += 1;
  }

  return { values, flags };
}

function singleValue(argumentsMap: ReadonlyMap<string, readonly string[]>, key: string): string {
  const values = argumentsMap.get(key) ?? [];
  if (values.length !== 1) {
    throw new SpecGenerationError(`--${key} must be provided exactly once`);
  }
  const value = values[0];
  if (value === undefined || value.trim().length === 0) {
    throw new SpecGenerationError(`--${key} must not be empty`);
  }
  return value;
}

function main(): void {
  try {
    const parsed = parseArguments(process.argv.slice(2));
    if (parsed.flags.has("help")) {
      console.log(usage());
      return;
    }

    const classificationText = singleValue(parsed.values, "classification");
    if (!isDataClassification(classificationText)) {
      throw new SpecGenerationError(
        `--classification must be one of ${DATA_CLASSIFICATIONS.join(", ")}`,
      );
    }

    const lifecycleValues = parsed.values.get("lifecycle") ?? [];
    if (lifecycleValues.length > 1) {
      throw new SpecGenerationError("--lifecycle may be provided only once");
    }
    const lifecycleText = lifecycleValues[0] ?? "active";
    if (lifecycleText !== "active" && lifecycleText !== "current") {
      throw new SpecGenerationError("--lifecycle must be active or current for a new PRD");
    }

    const owners = parsed.values.get("owner") ?? [];
    if (owners.length === 0) {
      throw new SpecGenerationError("--owner must be provided at least once");
    }

    const generatedPath = scaffoldPrd({
      root: process.cwd(),
      version: singleValue(parsed.values, "version"),
      name: singleValue(parsed.values, "name"),
      title: singleValue(parsed.values, "title"),
      summary: singleValue(parsed.values, "summary"),
      owners,
      classification: classificationText,
      lifecycle: lifecycleText,
      architectureImpact: parsed.flags.has("architecture-impact"),
      designSystemImpact: parsed.flags.has("design-system-impact"),
      sensitiveDataImpact: parsed.flags.has("sensitive-data-impact"),
      persistenceImpact: parsed.flags.has("persistence-impact"),
    });

    console.log(`Created ${generatedPath}`);
    console.log("Replace every template marker, then run pnpm spec:validate.");
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown generation error";
    console.error(detail);
    console.error(usage());
    process.exitCode = 1;
  }
}

main();
