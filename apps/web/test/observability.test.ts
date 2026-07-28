import { afterEach, describe, expect, it, vi } from "vitest";

import {
  initializeRuntimeTelemetry,
  register as registerInstrumentation,
} from "../src/instrumentation";
import { createServerLogger, sanitizeLogFields } from "../src/server/observability/logger";
import {
  TelemetryExportUnavailableError,
  initializeTelemetry,
} from "../src/server/observability/telemetry";

describe("structured logging", () => {
  it("allowlists structured fields and removes every prohibited content family", () => {
    const fields = sanitizeLogFields({
      correlationId: "0a82cc10-69d4-4266-8f86-4b1d88e82d38",
      statusCode: 200,
      outcome: "success",
      authorization: "Bearer secret",
      cookie: "session=secret",
      token: "secret-token",
      body: { customer: "sensitive" },
      queryString: "email=person@example.test",
      prompt: "sensitive prompt",
      completion: "sensitive completion",
      upload: "document contents",
      freeText: "arbitrary user text",
      connectionString: "InstrumentationKey=secret",
    });

    expect(fields).toEqual({
      correlationId: "0a82cc10-69d4-4266-8f86-4b1d88e82d38",
      statusCode: 200,
      outcome: "success",
    });
  });

  it("emits JSON without messages, credentials, bodies, or query data", () => {
    const lines: string[] = [];
    const logger = createServerLogger({
      mode: "json",
      destination: {
        write(message) {
          lines.push(message);
        },
      },
    });

    logger.info("api.request.completed", {
      component: "api",
      statusCode: 200,
      outcome: "success",
      authorizationHeader: "secret",
      requestBody: "secret",
      query: "secret",
    });

    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0] ?? "{}") as object;
    expect(record).toMatchObject({
      event: "api.request.completed",
      component: "api",
      statusCode: 200,
      outcome: "success",
    });
    expect(lines[0]).not.toContain("secret");
    expect(lines[0]).not.toContain("authorization");
    expect(lines[0]).not.toContain("requestBody");
    expect(lines[0]).not.toContain("query");
    expect(lines[0]).not.toContain('"msg"');
  });
});

describe("telemetry adapter", () => {
  it("keeps export disabled without initializing a client", async () => {
    const register = vi.fn(() => Promise.resolve());

    await expect(initializeTelemetry({ mode: "disabled" }, { register })).resolves.toBe("disabled");
    expect(register).not.toHaveBeenCalled();
  });

  it("fails closed when the unsupported Azure Monitor path is requested", async () => {
    await expect(
      initializeTelemetry({
        mode: "azure-monitor",
        connectionString: "InstrumentationKey=00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toBeInstanceOf(TelemetryExportUnavailableError);
  });

  it("preserves a small typed registration seam for a future compliant exporter", async () => {
    const register = vi.fn(() => Promise.resolve());

    await expect(
      initializeTelemetry(
        {
          mode: "azure-monitor",
          connectionString: "InstrumentationKey=00000000-0000-0000-0000-000000000000",
        },
        { register },
      ),
    ).resolves.toBe("registered");
    expect(register).toHaveBeenCalledWith({
      mode: "azure-monitor",
      connectionString: "InstrumentationKey=00000000-0000-0000-0000-000000000000",
      serviceName: "application-web",
    });
  });

  it("emits a safe initialization event when export is explicitly disabled", async () => {
    const lines: string[] = [];
    const logger = createServerLogger({
      mode: "json",
      destination: {
        write(message) {
          lines.push(message);
        },
      },
    });

    await expect(
      initializeRuntimeTelemetry(
        {
          RUNTIME_MODE: "production",
          DATABASE_MODE: "disabled",
          AUTH_MODE: "container-apps",
          LOGGING_MODE: "json",
          TELEMETRY_MODE: "disabled",
          DATABASE_PORT: 5432,
          DATABASE_POOL_MAX: 10,
          DATABASE_PROBE_TIMEOUT_MS: 2_000,
        },
        logger,
      ),
    ).resolves.toBe("disabled");

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
      event: "telemetry.initialized",
      component: "telemetry",
      outcome: "skipped",
      telemetryMode: "disabled",
    });
    expect(lines[0]).not.toContain('"msg"');
  });

  describe("runtime instrumentation configuration", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("fails startup when production telemetry mode is not explicit", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("RUNTIME_MODE", "production");
      vi.stubEnv("DATABASE_MODE", "disabled");
      vi.stubEnv("AUTH_MODE", "container-apps");
      vi.stubEnv("LOGGING_MODE", "json");
      vi.stubEnv("TELEMETRY_MODE", "");

      await expect(registerInstrumentation()).rejects.toThrow("Runtime configuration is invalid.");
    });

    it("fails framework production when the application runtime mode is absent", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("RUNTIME_MODE", "");
      vi.stubEnv("DATABASE_MODE", "disabled");
      vi.stubEnv("AUTH_MODE", "container-apps");
      vi.stubEnv("LOGGING_MODE", "json");
      vi.stubEnv("TELEMETRY_MODE", "disabled");

      await expect(registerInstrumentation()).rejects.toThrow("Runtime configuration is invalid.");
    });

    it("does not require Azure configuration for an incomplete local startup", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("RUNTIME_MODE", "local");
      vi.stubEnv("DATABASE_MODE", "");
      vi.stubEnv("AUTH_MODE", "");
      vi.stubEnv("LOGGING_MODE", "");
      vi.stubEnv("TELEMETRY_MODE", "");

      await expect(registerInstrumentation()).resolves.toBeUndefined();
    });
  });
});
