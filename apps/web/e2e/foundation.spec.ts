import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoAccessibilityViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  const details = results.violations
    .map((violation) => `${violation.id}: ${violation.help}`)
    .join("\n");

  expect(results.violations, details).toEqual([]);
}

test("renders the neutral foundation home page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Agent-ready full-stack on Azure starter");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Ready for a product specification.",
    }),
  ).toBeVisible();
  await expect(page.getByText("No product behavior has been defined.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Liveness endpoint" })).toHaveAttribute(
    "href",
    "/health/live",
  );
});

test("serves live and ready protocol endpoints without Azure credentials", async ({ request }) => {
  const liveness = await request.get("/health/live");
  const readiness = await request.get("/health/ready");

  expect(liveness.status()).toBe(200);
  await expect(liveness.json()).resolves.toMatchObject({ status: "live" });
  expect(readiness.status()).toBe(200);
  await expect(readiness.json()).resolves.toMatchObject({ status: "ready" });
});

test("applies and persists explicit theme choices", async ({ page }) => {
  await page.goto("/");

  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme", "system");

  await page.getByRole("button", { name: "System theme. Activate to use light theme." }).click();
  await expect(root).toHaveClass(/light/u);
  await expect(root).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Light theme. Activate to use dark theme." }).click();
  await expect(root).toHaveClass(/dark/u);
  await expect(root).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(root).toHaveClass(/dark/u);
  await expect(root).toHaveAttribute("data-theme", "dark");
});

test("has no automated WCAG 2.2 AA violations in light or dark themes", async ({ page }) => {
  await page.goto("/");
  await expectNoAccessibilityViolations(page);

  await page.getByRole("button", { name: "System theme. Activate to use light theme." }).click();
  await page.getByRole("button", { name: "Light theme. Activate to use dark theme." }).click();
  await expect(page.locator("html")).toHaveClass(/dark/u);
  await expectNoAccessibilityViolations(page);
});

test("keeps accessible contrast while switching between themes", async ({ page }) => {
  await page.goto("/");

  const root = page.locator("html");
  await page.getByRole("button", { name: "System theme. Activate to use light theme." }).click();
  await expect(root).toHaveClass(/light/u);
  await expectNoAccessibilityViolations(page);

  await page.getByRole("button", { name: "Light theme. Activate to use dark theme." }).click();
  await expect(root).toHaveClass(/dark/u);
  await expectNoAccessibilityViolations(page);

  await page.getByRole("button", { name: "Dark theme. Activate to use system theme." }).click();
  await expect(root).toHaveClass(/light/u);
  await expectNoAccessibilityViolations(page);
});
