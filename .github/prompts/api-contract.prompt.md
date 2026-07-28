---
name: api-contract
description:
  "Design and implement a governed oRPC v1 API contract through handler and typed client."
agent: agent
argument-hint: "Cataloged PRD, operation, inputs, outputs, statuses, authorization, and errors"
---

Read the relevant cataloged PRD, `ARCHITECTURE.md`, security/data documents, and
`.copilot/skills/orpc-contracts/SKILL.md`. Stop if the requested behavior is not in a valid PRD.

Define the versioned Zod schemas and oRPC contract in `@repo/api-contracts` before changing the
server. Then implement the `apps/web` procedure/handler and a contract-importing typed client. Cover
valid and invalid input, statuses, safe errors, correlation, authorization, and OpenAPI output. Do
not create a raw JSON route unless an ADR establishes a protocol need.

Run the skill's validation commands and the PRD evidence commands. Report changed contract surfaces,
compatibility considerations, and exact results.
