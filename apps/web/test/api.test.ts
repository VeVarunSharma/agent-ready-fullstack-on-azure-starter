import { apiV1Contract } from "@repo/api-contracts/v1";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { describe, expect, it, vi } from "vitest";

import { createApiV1Client } from "../src/lib/api-client";
import { createApiV1RequestHandler, type ApiDispatch } from "../src/server/api/handler";
import { createServerLogger } from "../src/server/observability/logger";

const silentLogger = createServerLogger({ mode: "silent" });

describe("v1 OpenAPI handler", () => {
  it("generates an OpenAPI document from the shared contract", async () => {
    const generator = new OpenAPIGenerator({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    });
    const document = await generator.generate(apiV1Contract, {
      info: {
        title: "Application API",
        version: "1.0.0",
      },
    });

    expect(document.info).toEqual({
      title: "Application API",
      version: "1.0.0",
    });
    expect(document.paths?.["/health"]?.get).toMatchObject({
      summary: "Read the API process health",
    });
  });

  it("serves the contract implementation through the Fetch adapter", async () => {
    const handler = createApiV1RequestHandler({ logger: silentLogger });
    const response = await handler(
      new Request("http://localhost/api/v1/health", {
        headers: {
          "x-correlation-id": "2f0ef611-4e22-4104-85de-304d0024ee67",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      apiVersion: "v1",
      correlationId: "2f0ef611-4e22-4104-85de-304d0024ee67",
    });
  });

  it("drives a typed client from the shared contract", async () => {
    const handler = createApiV1RequestHandler({ logger: silentLogger });
    const client = createApiV1Client({
      baseUrl: "http://localhost",
      fetch: async (input, init) => handler(new Request(input, init)),
    });

    await expect(client.health()).resolves.toMatchObject({
      status: "ok",
      apiVersion: "v1",
    });
  });

  it("uses standard safe envelopes for unsupported methods", async () => {
    const handler = createApiV1RequestHandler({ logger: silentLogger });
    const response = await handler(
      new Request("http://localhost/api/v1/health", { method: "POST" }),
    );

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "The request method is not supported.",
      },
    });
  });

  it("normalizes validation failures without reflecting inputs", async () => {
    const handler = createApiV1RequestHandler({
      dispatch: () =>
        Promise.resolve(
          Response.json(
            {
              input: "private-input",
              issues: [{ message: "private validation detail" }],
            },
            { status: 400 },
          ),
        ),
      logger: silentLogger,
    });
    const response = await handler(
      new Request("http://localhost/api/v1/health?input=private-input"),
    );
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(400);
    expect(body).toContain("Request validation failed.");
    expect(body).not.toContain("private-input");
    expect(body).not.toContain("private validation detail");
  });

  it("never returns stack or infrastructure details from unexpected failures", async () => {
    const dispatch = vi.fn<ApiDispatch>(() =>
      Promise.reject(
        new Error("connect ECONNREFUSED database.internal with password super-secret"),
      ),
    );
    const handler = createApiV1RequestHandler({
      dispatch,
      logger: silentLogger,
    });
    const response = await handler(new Request("http://localhost/api/v1/health"));
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(body).toContain("The request could not be completed.");
    expect(body).not.toContain("database.internal");
    expect(body).not.toContain("super-secret");
    expect(body).not.toContain("stack");
  });
});
