import { describe, expect, it } from "vitest";

import { parseClientEnvironment } from "../src/client";
import { serverEnvironmentSchema } from "../src/schemas";
import { createLocalDatabaseUrl } from "../src/tooling";
import {
  AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON,
  EnvironmentConfigurationError,
  getDatabaseConfiguration,
  getTelemetryConfiguration,
  parseServerEnvironment,
} from "../src/server";

const disabledEnvironment = {
  RUNTIME_MODE: "test",
  DATABASE_MODE: "disabled",
  AUTH_MODE: "disabled",
  LOGGING_MODE: "silent",
  TELEMETRY_MODE: "disabled",
} as const;

describe("server environment", () => {
  it("requires every runtime mode explicitly", () => {
    expect(() => parseServerEnvironment({})).toThrow(EnvironmentConfigurationError);
  });

  it("requires production telemetry mode to be explicit", () => {
    expect(() =>
      parseServerEnvironment({
        RUNTIME_MODE: "production",
        DATABASE_MODE: "disabled",
        AUTH_MODE: "container-apps",
        LOGGING_MODE: "json",
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it("permits explicitly disabled telemetry in production without Azure configuration", () => {
    const environment = parseServerEnvironment({
      ...disabledEnvironment,
      RUNTIME_MODE: "production",
      AUTH_MODE: "container-apps",
      LOGGING_MODE: "json",
    });

    expect(environment).toMatchObject({
      RUNTIME_MODE: "production",
      TELEMETRY_MODE: "disabled",
    });
    expect(getTelemetryConfiguration(environment)).toEqual({ mode: "disabled" });
  });

  it("accepts an explicitly database-disabled test runtime", () => {
    const environment = parseServerEnvironment(disabledEnvironment);

    expect(getDatabaseConfiguration(environment)).toEqual({ mode: "disabled" });
  });

  it("builds a local-only password configuration without exposing an unvalidated URL", () => {
    const environment = parseServerEnvironment({
      ...disabledEnvironment,
      RUNTIME_MODE: "local",
      DATABASE_MODE: "local-password",
      LOGGING_MODE: "json",
      DATABASE_HOST: "127.0.0.1",
      DATABASE_PORT: "5432",
      DATABASE_NAME: "app",
      DATABASE_USER: "local user",
      DATABASE_PASSWORD: "local/password",
    });
    const configuration = getDatabaseConfiguration(environment);

    expect(configuration).toMatchObject({
      mode: "local-password",
      host: "127.0.0.1",
      port: 5432,
    });
    if (configuration.mode !== "local-password") {
      throw new Error("Expected local password mode.");
    }
    expect(createLocalDatabaseUrl(configuration)).toBe(
      "postgresql://local%20user:local%2Fpassword@127.0.0.1:5432/app",
    );
  });

  it("requires explicit managed identity configuration", () => {
    expect(() =>
      parseServerEnvironment({
        ...disabledEnvironment,
        RUNTIME_MODE: "production",
        DATABASE_MODE: "azure-managed-identity",
        AUTH_MODE: "container-apps",
        LOGGING_MODE: "json",
        DATABASE_HOST: "database.invalid",
        DATABASE_NAME: "app",
        DATABASE_USER: "application",
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it("rejects password material outside explicit local password mode", () => {
    expect(() =>
      parseServerEnvironment({
        ...disabledEnvironment,
        RUNTIME_MODE: "production",
        DATABASE_MODE: "azure-managed-identity",
        AUTH_MODE: "container-apps",
        LOGGING_MODE: "json",
        DATABASE_HOST: "database.invalid",
        DATABASE_NAME: "app",
        DATABASE_USER: "application",
        DATABASE_PASSWORD: "must-not-be-used",
        AZURE_CLIENT_ID: "7af253a4-147b-48cf-b158-a5d79810b2a7",
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it("rejects local password mode in production even with complete local credentials", () => {
    expect(() =>
      parseServerEnvironment({
        ...disabledEnvironment,
        RUNTIME_MODE: "production",
        DATABASE_MODE: "local-password",
        AUTH_MODE: "container-apps",
        LOGGING_MODE: "json",
        DATABASE_HOST: "database.invalid",
        DATABASE_NAME: "app",
        DATABASE_USER: "application",
        DATABASE_PASSWORD: "must-not-be-used",
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it.each(["DATABASE_URL", "DATABASE_SSL_MODE", "AUTH_ALLOWED_IDENTITIES_JSON"] as const)(
    "rejects unsupported or misleading production field %s",
    (fieldName) => {
      expect(() =>
        parseServerEnvironment({
          ...disabledEnvironment,
          RUNTIME_MODE: "production",
          DATABASE_MODE: "azure-managed-identity",
          AUTH_MODE: "container-apps",
          LOGGING_MODE: "json",
          DATABASE_HOST: "database.invalid",
          DATABASE_NAME: "app",
          DATABASE_USER: "application",
          AZURE_CLIENT_ID: "7af253a4-147b-48cf-b158-a5d79810b2a7",
          [fieldName]: "must-not-be-used",
        }),
      ).toThrow(EnvironmentConfigurationError);
    },
  );

  it("rejects every production authentication bypass", () => {
    expect(() =>
      parseServerEnvironment({
        ...disabledEnvironment,
        RUNTIME_MODE: "production",
        LOGGING_MODE: "json",
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it("restricts DefaultAzureCredential mode to local runtimes", () => {
    expect(() =>
      parseServerEnvironment({
        ...disabledEnvironment,
        RUNTIME_MODE: "test",
        DATABASE_MODE: "local-azure-credential",
        DATABASE_HOST: "database.invalid",
        DATABASE_NAME: "app",
        DATABASE_USER: "developer",
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it("rejects the removed OTLP telemetry mode", () => {
    expect(() =>
      parseServerEnvironment({
        ...disabledEnvironment,
        TELEMETRY_MODE: "otlp",
      }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it("fails Azure Monitor export closed with the exact stable-package limitation", () => {
    const result = serverEnvironmentSchema.safeParse({
      ...disabledEnvironment,
      TELEMETRY_MODE: "azure-monitor",
      APPLICATIONINSIGHTS_CONNECTION_STRING:
        "InstrumentationKey=00000000-0000-0000-0000-000000000000",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected Azure Monitor export configuration to be rejected.");
    }
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        message: AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON,
        path: ["TELEMETRY_MODE"],
      }),
    );
  });

  it("rejects dormant Azure Monitor credentials while telemetry is disabled", () => {
    expect(() =>
      parseServerEnvironment({
        ...disabledEnvironment,
        APPLICATIONINSIGHTS_CONNECTION_STRING:
          "InstrumentationKey=00000000-0000-0000-0000-000000000000",
      }),
    ).toThrow(EnvironmentConfigurationError);
  });
});

describe("client environment", () => {
  it("contains only an explicitly public runtime field", () => {
    const environment = parseClientEnvironment({
      NEXT_PUBLIC_RUNTIME_MODE: "local",
    });

    expect(environment).toEqual({ NEXT_PUBLIC_RUNTIME_MODE: "local" });
  });

  it.each(["DATABASE_PASSWORD", "APPLICATIONINSIGHTS_CONNECTION_STRING"] as const)(
    "rejects server value %s at the browser boundary",
    (fieldName) => {
      expect(() =>
        parseClientEnvironment({
          NEXT_PUBLIC_RUNTIME_MODE: "local",
          [fieldName]: "must-not-cross-the-boundary",
        }),
      ).toThrow();
    },
  );
});
