---
applyTo: "azure.yaml,infra/**/*"
---

# Azure infrastructure

Read the relevant PRD, `ARCHITECTURE.md`, `docs/adr/`, `docs/security/DATA_RESIDENCY.md`,
`docs/security/THREAT_MODEL.md`, `docs/runbooks/deployment.md`, and
[the Azure runbook](../../.copilot/skills/azure-platform/SKILL.md).

- Use reviewed GA APIs and pinned modules only. Keep unknown production values explicit and rejected
  by preflight.
- Preserve private-by-default networking, managed identity, narrow RBAC scopes, immutable
  configuration, and disabled optional features.
- Synthetic compile fixtures must remain nondeployable; checked-in production inputs stay
  intentionally incomplete.
- Keep infrastructure status accurate in architecture and security/residency documents.
- Compile and test offline with `pnpm infra:validate`. Do not provision, run what-if, or query a
  subscription unless the task separately authorizes that cloud operation.
