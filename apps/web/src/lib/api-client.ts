import type { ContractRouterClient } from "@orpc/contract";
import { createORPCClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { apiV1Contract } from "@repo/api-contracts/v1";

export type ApiV1Client = ContractRouterClient<typeof apiV1Contract>;

export interface CreateApiV1ClientOptions {
  readonly baseUrl: string | URL;
  readonly fetch?: (request: Request, init: RequestInit) => Promise<Response>;
}

export function createApiV1Client({ baseUrl, fetch }: CreateApiV1ClientOptions): ApiV1Client {
  const origin = new URL(baseUrl);
  if (
    (origin.protocol !== "http:" && origin.protocol !== "https:") ||
    origin.username.length > 0 ||
    origin.password.length > 0
  ) {
    throw new Error("The API base URL must be an HTTP(S) URL without credentials.");
  }

  const url = new URL("/api/v1", origin).toString();
  const link = new OpenAPILink(apiV1Contract, fetch === undefined ? { url } : { url, fetch });

  return createORPCClient(link);
}
