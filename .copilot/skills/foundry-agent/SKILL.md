---
name: foundry-agent
description: "Gate future Foundry work on approved specifications and data controls."
---

# Foundry admission

## Use when

- Reviewing Foundry readiness or a future cataloged PRD that proposes agent capability.
- Changing a PRD-approved disabled Foundry boundary after all required reviews are recorded.

## Do not use when

- Selecting a model or agent, creating prompts/tools/datasets, making external calls, or enabling
  infrastructure during the product-neutral foundation.
- No cataloged PRD and explicit architecture, security, privacy, residency, retention, identity,
  networking, and operational approvals exist.

## Mandatory sources

- `CONSTITUTION.md` and the relevant approved PRD
- `ARCHITECTURE.md` and the Foundry-readiness document it links
- `docs/security/DATA_CLASSIFICATION.md`, `docs/security/DATA_RESIDENCY.md`,
  `docs/security/THREAT_MODEL.md`, and `docs/security/LOGGING_AND_TELEMETRY.md`
- `docs/runbooks/deployment.md`
- Affected disabled `infra/` modules and preflight tests
- Current official Microsoft Foundry guidance and the matching environment-provided Foundry skill

## Steps

1. Check the admission gate. If any PRD or approval is absent, stop at documented readiness gaps.
2. Load current Foundry guidance and verify supported APIs, setup type, regions, network
   limitations, identity roles, data stores, retention, deletion, and abuse/content controls.
3. Update the PRD and canonical architecture/security records before implementation.
4. Keep the infrastructure invocation disabled and inputs nullable until approved preflight passes.
5. Design private networking, controlled egress, managed identity, least privilege, and every
   prompt/completion/trace/evaluation storage path explicitly.
6. Add deterministic offline mocks and tests. Keep local and CI execution free of external model
   calls.
7. Leave model and agent selection to a later approved change; deployment requires separate explicit
   authorization.

## Validation

```sh
pnpm spec:validate:all
pnpm infra:validate
pnpm typecheck
pnpm test:unit
```

No live invocation, model deployment, agent creation, or cloud provisioning belongs in these checks.

## Common failure modes

- Treating schema availability, disabled IaC, or a successful compile as approval.
- Choosing a model/agent early or using live calls in local tests and CI.
- Missing region, deployment-type, retention, deletion, content-logging, or connected-store review.
- Public networking, uncontrolled egress, overbroad RBAC, or telemetry containing
  prompts/completions.
