import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const lockfilePath = fileURLToPath(new URL("../pnpm-lock.yaml", import.meta.url));
const lines = (await readFile(lockfilePath, "utf8")).split("\n");
const resolvedPrereleaseVersion = /@(?:npm:)?\d+\.\d+\.\d+-[0-9A-Za-z][0-9A-Za-z.-]*/u;
const prereleaseSemver = /\d+\.\d+\.\d+-[0-9A-Za-z][0-9A-Za-z.-]*/u;
const loosePrereleaseWord = /(?:alpha|beta|canary|preview|rc|next)/iu;
const resolvedPrereleases = new Set();
let section;
let metadataRangeMatches = 0;
let integrityMatches = 0;

for (const line of lines) {
  if (line === "packages:" || line === "snapshots:") {
    section = line.slice(0, -1);
    continue;
  }
  if (/^\S/u.test(line)) {
    section = undefined;
  }

  const key = line
    .match(/^ {2}(?:'([^']+)'|([^ :]+)):/u)
    ?.slice(1)
    .find(Boolean);
  if (
    key !== undefined &&
    (section === "packages" || section === "snapshots") &&
    resolvedPrereleaseVersion.test(key)
  ) {
    resolvedPrereleases.add(key);
    continue;
  }

  if (prereleaseSemver.test(line)) {
    metadataRangeMatches += 1;
  }
  if (line.includes("integrity:") && loosePrereleaseWord.test(line)) {
    integrityMatches += 1;
  }
}

if (resolvedPrereleases.size > 0) {
  throw new Error(
    `Resolved prerelease packages are prohibited:\n${[...resolvedPrereleases].sort().join("\n")}`,
  );
}

console.log("Lockfile audit passed: 0 resolved semver prerelease packages.");
console.log(
  `Ignored non-resolution matches: ${String(metadataRangeMatches)} dependency-range lines and ${String(integrityMatches)} integrity hashes.`,
);
