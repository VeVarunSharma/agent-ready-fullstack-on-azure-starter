import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const supportedExtensions = new Set([".css", ".ts", ".tsx"]);
const colorPatterns = [
  {
    name: "color literal",
    pattern: /(?:#[\da-f]{3,8}\b|(?:rgb|hsl|oklch|lab|lch|color)\s*\()/giu,
  },
  {
    name: "palette utility",
    pattern:
      /\b(?:bg|text|border|ring|outline|fill|stroke)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/gu,
  },
] as const;

export interface ColorPolicyFinding {
  readonly column: number;
  readonly line: number;
  readonly match: string;
  readonly rule: string;
}

export function findHardcodedColors(source: string): readonly ColorPolicyFinding[] {
  const findings: ColorPolicyFinding[] = [];

  for (const { name, pattern } of colorPatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const index = match.index;
      const before = source.slice(0, index);
      const lines = before.split("\n");
      findings.push({
        rule: name,
        match: match[0],
        line: lines.length,
        column: (lines.at(-1)?.length ?? 0) + 1,
      });
    }
  }

  return findings;
}

async function collectFiles(root: string): Promise<readonly string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(entryPath);
      }
      return supportedExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
    }),
  );

  return nested.flat();
}

export async function checkColorPolicy(roots: readonly string[]): Promise<readonly string[]> {
  const approvedTokenFile = path.resolve("src/styles/globals.css");
  const files = (await Promise.all(roots.map((root) => collectFiles(root)))).flat();
  const failures: string[] = [];

  for (const file of files) {
    if (path.resolve(file) === approvedTokenFile) {
      continue;
    }
    const source = await readFile(file, "utf8");
    for (const finding of findHardcodedColors(source)) {
      failures.push(
        `${path.relative(process.cwd(), file)}:${String(finding.line)}:${String(finding.column)} ${finding.rule} ${finding.match}`,
      );
    }
  }

  return failures;
}

async function main(): Promise<void> {
  const roots =
    process.argv.length > 2
      ? process.argv.slice(2).map((root) => path.resolve(root))
      : [path.resolve("src"), path.resolve("../../apps/web/src")];
  const failures = await checkColorPolicy(roots);

  if (failures.length > 0) {
    throw new Error(`Hardcoded colors must use semantic tokens:\n${failures.join("\n")}`);
  }
}

const entryPath = process.argv[1];
if (entryPath !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryPath)) {
  await main();
}
