import { describe, expect, it } from "vitest";

import { correlationIdSchema } from "../src/correlation";
import { safeErrorEnvelopeSchema, validationErrorEnvelopeSchema } from "../src/errors";
import { apiV1Contract, healthResponseSchema } from "../src/v1/index";

const correlationId = "3f5c0f29-7ced-4b97-a942-4f812f49b588";

describe("correlation IDs", () => {
  it("accepts opaque UUIDs and normalizes their casing", () => {
    expect(correlationIdSchema.parse(correlationId.toUpperCase())).toBe(correlationId);
  });

  it("rejects user-controlled descriptive identifiers", () => {
    expect(correlationIdSchema.safeParse("customer-email@example.test").success).toBe(false);
  });
});

describe("standard envelopes", () => {
  it("validates the versioned health response", () => {
    expect(
      healthResponseSchema.parse({
        status: "ok",
        apiVersion: "v1",
        correlationId,
      }),
    ).toEqual({
      status: "ok",
      apiVersion: "v1",
      correlationId,
    });
  });

  it("keeps validation issues free of input values and free text", () => {
    const envelope = validationErrorEnvelopeSchema.parse({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        correlationId,
        issues: [{ code: "invalid_type", path: ["query", "limit"] }],
      },
    });

    expect(envelope.error.issues).toEqual([{ code: "invalid_type", path: ["query", "limit"] }]);
  });

  it("rejects stack traces and arbitrary error messages", () => {
    expect(
      safeErrorEnvelopeSchema.safeParse({
        error: {
          code: "INTERNAL_ERROR",
          message: "connection refused at database.internal",
          correlationId,
          stack: "secret stack",
        },
      }).success,
    ).toBe(false);
  });
});

describe("v1 health contract", () => {
  it("pins a stable REST route and method", () => {
    expect(apiV1Contract.health["~orpc"].route).toMatchObject({
      method: "GET",
      path: "/health",
    });
  });
});
