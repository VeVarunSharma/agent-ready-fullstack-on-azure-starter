import "server-only";

import {
  AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON,
  type AzureMonitorTelemetryConfiguration,
  type TelemetryConfiguration,
} from "@repo/env/server";

export interface TelemetryRegistration {
  register(
    options: AzureMonitorTelemetryConfiguration & {
      readonly serviceName: string;
    },
  ): Promise<void>;
}

export class TelemetryExportUnavailableError extends Error {
  constructor() {
    super(AZURE_MONITOR_EXPORT_UNAVAILABLE_REASON);
    this.name = "TelemetryExportUnavailableError";
  }
}

const defaultRegistration: TelemetryRegistration = {
  register() {
    return Promise.reject(new TelemetryExportUnavailableError());
  },
};

export async function initializeTelemetry(
  configuration: TelemetryConfiguration,
  registration: TelemetryRegistration = defaultRegistration,
): Promise<"disabled" | "registered"> {
  if (configuration.mode === "disabled") {
    return "disabled";
  }

  await registration.register({
    ...configuration,
    serviceName: "application-web",
  });
  return "registered";
}
