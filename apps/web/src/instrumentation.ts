import {
  getTelemetryConfiguration,
  loadServerEnvironment,
  readServerEnvironment,
  type ServerEnvironment,
} from "@repo/env/server";

import { createServerLogger, type ServerLogger } from "./server/observability/logger";
import { initializeTelemetry } from "./server/observability/telemetry";

export async function initializeRuntimeTelemetry(
  environment: ServerEnvironment,
  logger: ServerLogger = createServerLogger({ mode: environment.LOGGING_MODE }),
): Promise<"disabled" | "registered"> {
  const state = await initializeTelemetry(getTelemetryConfiguration(environment));
  logger.info("telemetry.initialized", {
    component: "telemetry",
    outcome: state === "disabled" ? "skipped" : "success",
    telemetryMode: environment.TELEMETRY_MODE,
  });
  return state;
}

export async function register(): Promise<void> {
  if (process.env.NODE_ENV === "production" || process.env.RUNTIME_MODE === "production") {
    const environment = loadServerEnvironment();
    await initializeRuntimeTelemetry(environment);
    return;
  }

  const environment = readServerEnvironment();
  if (!environment.success) {
    return;
  }

  await initializeRuntimeTelemetry(environment.data);
}
