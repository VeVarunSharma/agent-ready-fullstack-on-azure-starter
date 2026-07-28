import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const EXPECTED_BICEP_VERSION = "0.45.15";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const infraRoot = path.join(repositoryRoot, "infra");

async function isExecutable(filePath) {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return !result.error && result.status === 0;
}

async function resolveBicepCli() {
  if (process.env.BICEP_CLI) {
    const configuredPath = path.resolve(repositoryRoot, process.env.BICEP_CLI);
    if (!(await isExecutable(configuredPath))) {
      throw new Error(`BICEP_CLI is not executable: ${configuredPath}`);
    }
    return configuredPath;
  }

  if (commandExists("bicep")) {
    return "bicep";
  }

  const localPath = path.join(infraRoot, ".tools", "bicep");
  if (await isExecutable(localPath)) {
    return localPath;
  }

  throw new Error(
    "Bicep CLI 0.45.15 is required. Install the official standalone CLI or set BICEP_CLI; Azure login is not used.",
  );
}

async function collectFiles(directory, extensions) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === ".tools") {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath, extensions)));
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(entryPath);
    }
  }

  return files;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed${details ? `:\n${details}` : "."}`);
  }
  if (options.rejectWarnings && /\bwarning\b/i.test(`${result.stdout}\n${result.stderr}`)) {
    throw new Error(
      `${command} ${args.join(" ")} produced a warning:\n${result.stdout}${result.stderr}`,
    );
  }

  return result.stdout;
}

function assertNoPreviewApiVersions(value, source, pathSegments = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoPreviewApiVersions(item, source, [...pathSegments, String(index)]),
    );
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = [...pathSegments, key];
    if (key === "apiVersion" && typeof child === "string" && /preview|beta|alpha|rc/i.test(child)) {
      throw new Error(
        `${source} contains prohibited prerelease API version ${child} at ${childPath.join(".")}.`,
      );
    }
    assertNoPreviewApiVersions(child, source, childPath);
  }
}

function collectResourceTypes(value, resourceTypes = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectResourceTypes(item, resourceTypes));
    return resourceTypes;
  }
  if (!value || typeof value !== "object") {
    return resourceTypes;
  }

  if (typeof value.type === "string" && typeof value.apiVersion === "string") {
    resourceTypes.push(value.type.toLowerCase());
  }
  Object.values(value).forEach((child) => collectResourceTypes(child, resourceTypes));
  return resourceTypes;
}

async function verifyFormatting(bicepCli, files) {
  for (const file of files) {
    const formatted = run(bicepCli, [
      "format",
      file,
      "--stdout",
      "--newline-kind",
      "LF",
      "--indent-kind",
      "Space",
      "--indent-size",
      "2",
      "--insert-final-newline",
    ]);
    const current = await readFile(file, "utf8");
    if (formatted !== current) {
      throw new Error(
        `${path.relative(repositoryRoot, file)} is not Bicep-formatted. Run the pinned Bicep formatter.`,
      );
    }
  }
}

async function main() {
  const bicepCli = await resolveBicepCli();
  const versionOutput = run(bicepCli, ["--version"]).trim();
  if (!versionOutput.includes(`version ${EXPECTED_BICEP_VERSION}`)) {
    throw new Error(
      `Expected Bicep ${EXPECTED_BICEP_VERSION}, received: ${versionOutput || "unknown"}`,
    );
  }

  const bicepFiles = await collectFiles(infraRoot, [".bicep"]);
  const parameterFiles = await collectFiles(infraRoot, [".bicepparam"]);
  if (bicepFiles.length === 0) {
    throw new Error("No Bicep templates were found.");
  }

  await verifyFormatting(bicepCli, [...bicepFiles, ...parameterFiles]);

  const emittedResourceTypes = [];
  for (const file of bicepFiles) {
    run(bicepCli, ["lint", file, "--no-restore"], { rejectWarnings: true });
    const compiledText = run(bicepCli, ["build", file, "--stdout", "--no-restore"], {
      rejectWarnings: true,
    });
    const compiled = JSON.parse(compiledText);
    const relativePath = path.relative(repositoryRoot, file);
    assertNoPreviewApiVersions(compiled, relativePath);
    emittedResourceTypes.push(...collectResourceTypes(compiled));
  }

  for (const file of parameterFiles) {
    const compiledText = run(bicepCli, ["build-params", file, "--stdout", "--no-restore"], {
      rejectWarnings: true,
    });
    assertNoPreviewApiVersions(JSON.parse(compiledText), path.relative(repositoryRoot, file));
  }

  const prohibitedFoundryTypes = emittedResourceTypes.filter(
    (resourceType) =>
      resourceType.includes("microsoft.cognitiveservices/accounts/deployments") ||
      resourceType.includes("/agents"),
  );
  if (prohibitedFoundryTypes.length > 0) {
    throw new Error(
      `Foundry templates must not declare models or agents: ${prohibitedFoundryTypes.join(", ")}`,
    );
  }

  run(process.execPath, ["--test", "infra/tests/preflight.test.mjs"]);
  run(process.execPath, [
    "infra/scripts/preflight.mjs",
    "--config",
    "infra/environments/production.config.json",
    "--expect-failure",
    "--quiet",
  ]);

  console.log(
    `Infrastructure validation passed: Bicep ${EXPECTED_BICEP_VERSION}, ${bicepFiles.length} templates, ${parameterFiles.length} parameter files, and offline preflight tests.`,
  );
}

try {
  await main();
} catch (error) {
  console.error(`Infrastructure validation failed: ${error.message}`);
  process.exitCode = 1;
}
