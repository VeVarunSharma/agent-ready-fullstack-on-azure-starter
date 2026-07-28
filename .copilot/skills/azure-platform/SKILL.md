---
name: azure-platform
description: "Change offline-validatable Azure IaC and fail-closed production preflight."
---

# Azure platform

## Use when

- Changing `azure.yaml`, Bicep modules/parameters, identities, networking, diagnostics, or
  preflight.
- Reviewing whether infrastructure matches approved architecture and residency constraints.

## Do not use when

- Making portal-only changes, guessing production inputs, or performing a cloud operation without
  separate explicit authorization.
- Adding a resource with no immediate approved consumer.

## Mandatory sources

- `CONSTITUTION.md`
- The relevant cataloged PRD and `ARCHITECTURE.md`
- Relevant records under `docs/adr/`
- `docs/security/DATA_RESIDENCY.md` and `docs/security/THREAT_MODEL.md`
- `docs/runbooks/deployment.md`
- `azure.yaml`, affected `infra/` modules, parameters, fixtures, and preflight tests

## Steps

1. Confirm declared architecture/sensitive-data impacts and approved topology inputs.
2. Recheck current official schemas; use stable GA APIs and pinned modules only.
3. Parameterize every environment decision. Make unknown regions, identities, DNS, SKUs, egress, and
   retention fail preflight.
4. Preserve subscription/resource-group scope boundaries, private data planes, managed identities,
   least-privilege RBAC, and disabled optional features.
5. Keep synthetic compile fixtures nondeployable and production parameter files incomplete.
6. Update architecture, threat, residency, and runbook records to match actual IaC status.
7. Format, compile, lint, and exercise allow/deny preflight cases entirely offline.

## Validation

```sh
pnpm infra:validate
pnpm format:check
pnpm test:unit
```

Cloud preflight, what-if, and deployment are separate authorized operations, not validation steps.

## Common failure modes

- Preview or floating resources, hidden defaults, or copied samples with stale APIs.
- Public data-plane access, broad ownership, static credentials, missing private DNS, or unsafe
  egress.
- Compile fixtures that contain deployable production-shaped values.
- Treating compilation, a disabled module, or an unverified region as deployment readiness.
