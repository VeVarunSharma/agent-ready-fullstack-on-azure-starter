---
name: architecture-review
description: "Review a change against the repository's implemented boundaries and governed impacts."
agent: agent
argument-hint: "Change, diff, PRD, or architecture decision to review"
---

Review the requested change against `CONSTITUTION.md`, its cataloged PRD, `ARCHITECTURE.md`,
relevant ADRs, and the canonical design/security/residency documents.

Trace changes to components, package boundaries, stores, trust boundaries, identities, network
paths, integrations, deployment surfaces, observability, and failure assumptions. Verify that each
surface is accurately labeled implemented, scaffolded-disabled, or future and that PRD impact flags
select all required same-change artifacts. Do not infer controls from plans or compile success.

Return high-confidence findings ordered by severity with file/line evidence, the required canonical
update, and any blocking unknowns. If no finding exists, state the reviewed scope and remaining
verification limits.
