import { describe, expect, it, vi } from "vitest";
import { serverEnvironmentSchema } from "@repo/env/schemas";

import { createLivenessResponse } from "../src/app/health/live/route";
import { checkReadiness, type ReadinessDependencies } from "../src/server/health/readiness";

const validDisabledEnvironment = {
  success: true,
  data: {
    RUNTIME_MODE: "test",
    DATABASE_MODE: "disabled",
    AUTH_MODE: "disabled",
    LOGGING_MODE: "silent",
    TELEMETRY_MODE: "disabled",
    DATABASE_PORT: 5432,
    DATABASE_POOL_MAX: 10,
    DATABASE_PROBE_TIMEOUT_MS: 2_000,
  },
} as const;

describe("liveness", () => {
  it("checks process response capability only", async () => {
    const response = createLivenessResponse(new Request("http://localhost/health/live"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "live" });
  });

  it("does not reflect an invalid caller correlation ID", () => {
    const response = createLivenessResponse(
      new Request("http://localhost/health/live", {
        headers: { "x-correlation-id": "email@example.test" },
      }),
    );

    expect(response.headers.get("x-correlation-id")).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[\d89ab][\da-f]{3}-[\da-f]{12}$/u,
    );
  });
});

describe("readiness", () => {
  it("fails closed when required runtime configuration is invalid", async () => {
    const probe = vi.fn(() => Promise.resolve(true));
    const dependencies = {
      readEnvironment: () => serverEnvironmentSchema.safeParse({}),
      probe,
    };

    await expect(checkReadiness(dependencies)).resolves.toBe("not_ready");
    expect(probe).not.toHaveBeenCalled();
  });

  it("skips the database probe only when database mode is explicitly disabled", async () => {
    const probe = vi.fn(() => Promise.resolve(true));
    const dependencies: ReadinessDependencies = {
      readEnvironment: () => validDisabledEnvironment,
      probe,
    };

    await expect(checkReadiness(dependencies)).resolves.toBe("ready");
    expect(probe).not.toHaveBeenCalled();
  });

  it("probes the database when use is explicitly enabled", async () => {
    const probe = vi.fn(() => Promise.resolve(true));
    const dependencies: ReadinessDependencies = {
      readEnvironment: () => ({
        success: true,
        data: {
          ...validDisabledEnvironment.data,
          RUNTIME_MODE: "local",
          DATABASE_MODE: "local-password",
          LOGGING_MODE: "json",
          DATABASE_HOST: "127.0.0.1",
          DATABASE_NAME: "app",
          DATABASE_USER: "local",
          DATABASE_PASSWORD: "local-only",
        },
      }),
      probe,
    };

    await expect(checkReadiness(dependencies)).resolves.toBe("ready");
    expect(probe).toHaveBeenCalledOnce();
  });

  it("reports not ready without exposing a probe failure", async () => {
    const dependencies: ReadinessDependencies = {
      readEnvironment: () => ({
        success: true,
        data: {
          ...validDisabledEnvironment.data,
          RUNTIME_MODE: "local",
          DATABASE_MODE: "local-password",
          LOGGING_MODE: "json",
          DATABASE_HOST: "127.0.0.1",
          DATABASE_NAME: "app",
          DATABASE_USER: "local",
          DATABASE_PASSWORD: "local-only",
        },
      }),
      probe: () => Promise.resolve(false),
    };

    await expect(checkReadiness(dependencies)).resolves.toBe("not_ready");
  });
});
