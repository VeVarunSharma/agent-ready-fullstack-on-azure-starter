import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  CONTAINER_APPS_PRINCIPAL_HEADER,
  normalizeContainerAppsPrincipal,
} from "../src/server/auth/container-apps-principal";

function encodePrincipal(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

const validPayload = {
  auth_typ: "aad",
  name_typ: "name",
  role_typ: "roles",
  claims: [
    { typ: "iss", val: "https://issuer.example.test/" },
    { typ: "sub", val: "opaque-subject" },
    {
      typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
      val: "opaque-name-identifier",
    },
    { typ: "roles", val: "ignored-role" },
  ],
};

describe("Container Apps principal normalization", () => {
  it("distinguishes an absent platform principal", () => {
    expect(normalizeContainerAppsPrincipal(new Headers())).toEqual({
      kind: "absent",
    });
  });

  it.each([
    ["invalid base64", "not base64"],
    ["invalid JSON", Buffer.from("{", "utf8").toString("base64")],
    [
      "missing claims",
      encodePrincipal({
        ...validPayload,
        claims: [{ typ: "iss", val: "https://issuer.example.test/" }],
      }),
    ],
    [
      "duplicate required claims",
      encodePrincipal({
        ...validPayload,
        claims: [...validPayload.claims, { typ: "sub", val: "second-subject" }],
      }),
    ],
    [
      "non-HTTPS issuer",
      encodePrincipal({
        ...validPayload,
        claims: validPayload.claims.map((claim) =>
          claim.typ === "iss" ? { ...claim, val: "http://issuer.example.test/" } : claim,
        ),
      }),
    ],
  ])("rejects %s", (_name, encoded) => {
    const headers = new Headers({
      [CONTAINER_APPS_PRINCIPAL_HEADER]: encoded,
    });

    expect(normalizeContainerAppsPrincipal(headers).kind).toBe("malformed");
  });

  it("returns only identity claims and never platform roles", () => {
    const headers = new Headers({
      [CONTAINER_APPS_PRINCIPAL_HEADER]: encodePrincipal(validPayload),
    });

    expect(normalizeContainerAppsPrincipal(headers)).toEqual({
      kind: "valid",
      principal: {
        authenticationType: "aad",
        issuer: "https://issuer.example.test/",
        subject: "opaque-subject",
        nameIdentifier: "opaque-name-identifier",
      },
    });
  });
});
