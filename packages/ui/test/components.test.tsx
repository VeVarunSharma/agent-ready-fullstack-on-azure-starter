import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "../src/components/button";
import { ThemeProvider, ThemeToggle } from "../src/components/theme";

const matchMedia = vi.fn((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: matchMedia,
  });
});

describe("Button", () => {
  it("preserves native disabled behavior and an accessible name", () => {
    render(<Button disabled>Unavailable action</Button>);

    expect(screen.getByRole("button", { name: "Unavailable action" })).toBeDisabled();
  });

  it("preserves link semantics when composed as a child", () => {
    render(
      <Button asChild variant="outline">
        <a href="/health/live">Liveness endpoint</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Liveness endpoint" });
    expect(link).toHaveAttribute("href", "/health/live");
    expect(link).toHaveAttribute("data-slot", "button");
  });
});

describe("theme behavior", () => {
  it("honors system preference until the user makes an explicit selection", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement.dataset.theme).toBe("system");
  });

  it("honors a dark system preference", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => ({
        ...matchMedia(query),
        matches: true,
      })),
    });

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.dataset.theme).toBe("system");
  });

  it("cycles through light, dark, and system choices", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await user.click(
      screen.getByRole("button", {
        name: "System theme. Activate to use light theme.",
      }),
    );
    expect(document.documentElement).toHaveClass("light");
    expect(window.localStorage.getItem("ui-theme")).toBe("light");

    await user.click(
      screen.getByRole("button", {
        name: "Light theme. Activate to use dark theme.",
      }),
    );
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("ui-theme")).toBe("dark");

    await user.click(
      screen.getByRole("button", {
        name: "Dark theme. Activate to use system theme.",
      }),
    );
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement.dataset.theme).toBe("system");
    expect(window.localStorage.getItem("ui-theme")).toBe("system");
  });
});
