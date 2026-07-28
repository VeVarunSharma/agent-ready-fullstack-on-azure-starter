import "server-only";

import { Buffer } from "node:buffer";

import { z } from "zod";

export const CONTAINER_APPS_PRINCIPAL_HEADER = "x-ms-client-principal" as const;

const claimSchema = z
  .object({
    typ: z.string().trim().min(1).max(512),
    val: z.string().trim().min(1).max(2_048),
  })
  .strict();

const encodedPrincipalSchema = z
  .object({
    auth_typ: z.string().trim().min(1).max(128),
    claims: z.array(claimSchema).min(1).max(128),
    name_typ: z.string().trim().min(1).max(512),
    role_typ: z.string().trim().min(1).max(512),
  })
  .strict();

const issuerSchema = z.url().refine((value) => new URL(value).protocol === "https:", {
  message: "Identity issuers must use HTTPS.",
});
const base64Pattern = /^(?:[\d+/A-Za-z]{4})*(?:[\d+/A-Za-z]{2}==|[\d+/A-Za-z]{3}=)?$/u;

const requiredClaimTypes = {
  issuer: ["iss", "http://schemas.microsoft.com/identity/claims/issuer"],
  subject: ["sub", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/subject"],
  nameIdentifier: [
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    "nameidentifier",
  ],
} as const;

export interface ContainerAppsPrincipal {
  readonly authenticationType: string;
  readonly issuer: string;
  readonly subject: string;
  readonly nameIdentifier: string;
}

export type PrincipalNormalizationResult =
  | { readonly kind: "absent" }
  | {
      readonly kind: "malformed";
      readonly reason: "invalid_encoding" | "invalid_payload" | "missing_required_claim";
    }
  | { readonly kind: "valid"; readonly principal: ContainerAppsPrincipal };

function decodeBase64(value: string): string | undefined {
  if (value.length === 0 || value.length > 32_768 || !base64Pattern.test(value)) {
    return undefined;
  }

  const decoded = Buffer.from(value, "base64");
  const canonicalInput = value.replace(/=+$/u, "");
  const canonicalDecoded = decoded.toString("base64").replace(/=+$/u, "");
  if (canonicalInput !== canonicalDecoded) {
    return undefined;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(decoded);
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      return undefined;
    }
    throw error;
  }
}

function parsePayload(value: string): z.infer<typeof encodedPrincipalSchema> | undefined {
  try {
    return encodedPrincipalSchema.parse(JSON.parse(value));
  } catch (error: unknown) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return undefined;
    }
    throw error;
  }
}

function findUniqueClaim(
  claims: readonly z.infer<typeof claimSchema>[],
  allowedTypes: readonly string[],
): string | undefined {
  const matches = claims.filter((claim) => allowedTypes.includes(claim.typ));
  return matches.length === 1 ? matches[0]?.val : undefined;
}

export function normalizeContainerAppsPrincipal(headers: Headers): PrincipalNormalizationResult {
  const encoded = headers.get(CONTAINER_APPS_PRINCIPAL_HEADER);
  if (encoded === null) {
    return { kind: "absent" };
  }

  const decoded = decodeBase64(encoded);
  if (decoded === undefined) {
    return { kind: "malformed", reason: "invalid_encoding" };
  }

  const payload = parsePayload(decoded);
  if (payload === undefined) {
    return { kind: "malformed", reason: "invalid_payload" };
  }

  const issuer = findUniqueClaim(payload.claims, requiredClaimTypes.issuer);
  const subject = findUniqueClaim(payload.claims, requiredClaimTypes.subject);
  const nameIdentifier = findUniqueClaim(payload.claims, requiredClaimTypes.nameIdentifier);
  if (
    issuer === undefined ||
    subject === undefined ||
    nameIdentifier === undefined ||
    !issuerSchema.safeParse(issuer).success
  ) {
    return { kind: "malformed", reason: "missing_required_claim" };
  }

  return {
    kind: "valid",
    principal: {
      authenticationType: payload.auth_typ,
      issuer,
      subject,
      nameIdentifier,
    },
  };
}
