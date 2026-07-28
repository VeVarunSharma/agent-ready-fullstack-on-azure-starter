import { describe, expect, it } from "vitest";

import { findHardcodedColors } from "../scripts/check-hardcoded-colors";

describe("hardcoded color policy", () => {
  it("rejects CSS literals and Tailwind palette utilities", () => {
    const findings = findHardcodedColors(
      '.literal { color: #fff; } <div className="bg-blue-500" />',
    );

    expect(findings.map((finding) => finding.rule)).toEqual(["color literal", "palette utility"]);
  });

  it("allows semantic token utilities", () => {
    expect(
      findHardcodedColors('<div className="bg-background text-foreground border-border" />'),
    ).toEqual([]);
  });
});
