import { defineConfig } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${String(port)}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL,
    browserName: "chromium",
    colorScheme: "light",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: "pnpm start",
    env: {
      AUTH_MODE: "container-apps",
      DATABASE_MODE: "disabled",
      HOSTNAME: "127.0.0.1",
      LOGGING_MODE: "json",
      NEXT_PUBLIC_RUNTIME_MODE: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: String(port),
      RUNTIME_MODE: "production",
      TELEMETRY_MODE: "disabled",
    },
    gracefulShutdown: {
      signal: "SIGTERM",
      timeout: 5_000,
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: `${baseURL}/health/live`,
  },
});
