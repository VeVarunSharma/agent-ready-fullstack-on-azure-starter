import { clientEnvironmentSchema, type ClientEnvironment } from "./schemas";

export { clientEnvironmentSchema, type ClientEnvironment } from "./schemas";

export function parseClientEnvironment(input: unknown): ClientEnvironment {
  return clientEnvironmentSchema.parse(input);
}

export function loadClientEnvironment(): ClientEnvironment {
  return parseClientEnvironment({
    NEXT_PUBLIC_RUNTIME_MODE: process.env.NEXT_PUBLIC_RUNTIME_MODE,
  });
}
