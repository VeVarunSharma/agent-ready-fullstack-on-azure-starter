import { afterEach, expect, test, vi } from "vitest";

import { loadGitContext } from "./model.js";

vi.mock("./model.js", () => ({
  loadGitContext: vi.fn(() => ({ context: null, issues: [] })),
  validateRepository: vi.fn(() => []),
}));

const originalArguments = process.argv;

afterEach(() => {
  process.argv = originalArguments;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.resetModules();
});

test.each([
  { githubBase: undefined, specBase: undefined, cliBase: undefined, expected: undefined },
  { githubBase: "", specBase: undefined, cliBase: undefined, expected: undefined },
  { githubBase: "main", specBase: undefined, cliBase: undefined, expected: "origin/main" },
  { githubBase: "", specBase: "custom", cliBase: undefined, expected: "custom" },
  { githubBase: "main", specBase: "custom", cliBase: undefined, expected: "custom" },
  { githubBase: "main", specBase: "custom", cliBase: "explicit", expected: "explicit" },
])(
  "resolves the Git baseline for $githubBase / $specBase / $cliBase",
  async ({ githubBase, specBase, cliBase, expected }) => {
    vi.stubEnv("GITHUB_BASE_REF", githubBase);
    vi.stubEnv("SPEC_BASE_REF", specBase);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    process.argv = ["node", "validate.ts", "--all"];
    if (cliBase !== undefined) {
      process.argv.push("--base", cliBase);
    }

    await import("./validate.js");

    expect(loadGitContext).toHaveBeenCalledExactlyOnceWith(process.cwd(), expected);
  },
);
