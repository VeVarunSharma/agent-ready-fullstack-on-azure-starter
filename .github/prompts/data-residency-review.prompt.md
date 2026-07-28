---
name: data-residency-review
description:
  "Review end-to-end data locations, transfers, retention, and unresolved residency gates."
agent: agent
argument-hint: "PRD, data flow, infrastructure change, or deployment configuration to review"
---

Read `CONSTITUTION.md`, `SECURITY.md`, the relevant PRD, `ARCHITECTURE.md`,
`docs/security/DATA_CLASSIFICATION.md`, `docs/security/DATA_RESIDENCY.md`,
`docs/security/THREAT_MODEL.md`, and `docs/security/LOGGING_AND_TELEMETRY.md`.

For each data class, trace collection, processing, storage, telemetry, backups, replication,
support/operations access, control planes, exports, and deletion. Check region allowlists, network
paths, encryption, identities, retention, subprocessors, and every regional or nonregional
dependency. Treat unknown locations and unclassified customer data as blockers; do not claim
residency from a primary region alone.

Return a flow-by-flow matrix of evidence, gaps, required approvals, and fail-closed preflight
checks. Do not query or change cloud resources unless separately authorized.
