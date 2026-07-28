---
name: orpc-contracts
description: "Build stable oRPC v1 contracts, handlers, clients, OpenAPI output, and safe errors."
---

# oRPC contracts

## Use when

- Adding or changing a first-party JSON request, response, status, error, or typed client.
- Evolving the versioned API handler or generated OpenAPI document.

## Do not use when

- Implementing health probes, streaming, callbacks, downloads, or webhooks that require a raw
  protocol route.
- No cataloged PRD defines the behavior.

## Mandatory sources

- `CONSTITUTION.md`
- The relevant cataloged PRD and `ARCHITECTURE.md`
- `packages/api-contracts/package.json` and affected contract/schema sources
- `apps/web/package.json` and affected handler/client sources
- `packages/env` exports for runtime configuration
- Relevant security, threat-model, and logging documents for exposed data

## Steps

1. Confirm approved scope, API versioning, authorization, and data classification.
2. Define Zod schemas and the oRPC contract first, including statuses and safe error envelopes.
3. Export the contract narrowly from `@repo/api-contracts`; never duplicate DTOs in a consumer.
4. Implement the server procedure and Fetch/OpenAPI handler in `apps/web`.
5. Enforce authorization server-side and allowlist errors, headers, and telemetry fields.
6. Exercise valid and invalid input, typed client behavior, correlation IDs, and OpenAPI output.
7. Use a raw JSON route only after an ADR demonstrates the protocol cannot be represented by oRPC.

## Validation

```sh
pnpm --filter @repo/api-contracts typecheck
pnpm --filter @repo/web typecheck
pnpm test:unit
pnpm build
pnpm check
```

## Common failure modes

- Contract, handler, client, and OpenAPI shapes diverging.
- Mixed oRPC versions, beta packages, duplicated DTOs, or imports that bypass package exports.
- Missing runtime validation or undocumented status/error behavior.
- Client-side-only authorization, leaked stack details, or sensitive request logging.
