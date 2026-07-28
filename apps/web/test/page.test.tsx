// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import Home from "../src/app/page";

beforeEach(() => {
  window.localStorage.clear();
});

describe("foundation home page", () => {
  it("states readiness without inventing product behavior", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Ready for a product specification.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No product behavior has been defined\./u)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Liveness endpoint" })).toHaveAttribute(
      "href",
      "/health/live",
    );
  });
});
