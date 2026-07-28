import "server-only";

import { OpenAPIHandler } from "@orpc/openapi/fetch";

import { apiV1Router, type ApiContext } from "./router";

const openApiHandler = new OpenAPIHandler(apiV1Router);

export async function dispatchOpenApiRequest(
  request: Request,
  context: ApiContext,
): Promise<Response | undefined> {
  const { response } = await openApiHandler.handle(request, {
    prefix: "/api/v1",
    context,
  });

  return response;
}
