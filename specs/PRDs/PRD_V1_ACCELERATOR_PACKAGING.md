---
id: "ACCELERATOR_PACKAGING"
version: "1"
path: "specs/PRDs/PRD_V1_ACCELERATOR_PACKAGING.md"
title: "Local foundation accelerator packaging"
summary: "Package local demo assets and verify CI without changing runtime behavior."
lifecycle: "current"
owners: ["@VeVarunSharma"]
created: "2026-10-18"
updated: "2026-10-18"
dataClassification: "Public"
supersededBy: null
architectureImpact: false
designSystemImpact: false
sensitiveDataImpact: false
persistenceImpact: false
---

# PRD V1: Local foundation accelerator packaging

## Overview

Package the existing product-neutral foundation for a local demonstration and platform-adoption
conversation. Catalog readiness remains conditional on independent reproduction, owner confirmation,
catalog-schema access, and release review. No runtime or deployment behavior changes.

## Motivation

An SE/CSA needs a self-contained story, script, assets, and evidence without implying a finished
customer solution, live agent, or deployed Azure environment.

## Scope

- README positioning, discovery, journey, timed scripts, reuse, troubleshooting, support, and gates.
- Draft `accelerator.yaml`, explicitly not consumed by runtime or deployment.
- Static local/target architecture diagrams, real local screenshots and available recording assets.
- Commit-bound verification evidence, including blocked or failed checks and external prerequisites.
- Restore specification validation on push events without changing PR or explicit-base behavior.

## Out of Scope

- Product behavior, roles, domain schema, seed data, AI capabilities, and new dependencies.
- Azure provisioning, workflow dispatch, external repository changes, and catalog submission.
- Invented ownership approval, certification, clean-machine reproduction, or successful checks.

## Feature Specifications

### FS-001: Truthful, reusable local demonstration package

Preserve existing quickstart and production warnings. Explain the customer outcome, implemented
local journey, demo/reset/fallback, reusable boundaries, and workshop CTA. Static diagrams must
label trust boundaries and disabled Azure targets. Media must contain only local/synthetic content.
Metadata and evidence must expose unresolved prerequisites rather than promote readiness. Recording
may be withheld if capture is unavailable; its status and reproducible capture steps must then be
explicit. No new testing or media dependencies are required.

### FS-002: Push-compatible specification validation

Treat an empty `GITHUB_BASE_REF` as absent so push events use the existing Git baseline fallback.
Preserve nonempty PR base references and precedence of `--base` over `SPEC_BASE_REF` over the PR
base.

## Affected Files

- `README.md` — self-contained adoption and presenter guide.
- `accelerator.yaml` — provisional catalog authoring metadata, not runtime configuration.
- `docs/accelerator/*` — static diagrams, screenshots, captions/recording when available, evidence.
- `specs/PRDs/index.json` — generated packaging specification catalog entry.
- `specs/PRDs/PRD_V1_ACCELERATOR_PACKAGING.md` — scope and acceptance evidence.
- `scripts/specs/validate.ts` and `scripts/specs/validate.test.ts` — CI baseline resolution and
  tests.

## Acceptance Criteria

- [x] **AC-001**: README includes story, journey, both timed demos, reset/fallback, reuse,
      engagement, support, troubleshooting, and a concrete readiness checklist.
- [x] **AC-002**: Metadata and diagrams distinguish local implementation from disabled Azure
      scaffolding; catalog-schema and owner approval are not asserted.
- [x] **AC-003**: Evidence identifies source commit, runtime/database mode, commands and outcomes;
      media is real local capture or explicitly marked unavailable.
- [x] **AC-004**: Specification validation handles absent, empty, and nonempty PR base references
      while preserving explicit-base precedence.

## Migration and Configuration

No migration, runtime configuration, dependencies, or provisioning changes. Demo configuration stays
in ignored local files. The specification is required because metadata and binary/static assets are
unknown paths under the repository's fail-closed path classification; it does not admit a product.

## Verification

| Criterion | Method    | Evidence                                                                                                                                |
| --------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| AC-001    | manual    | Read the README sections and follow its presenter preflight and reset.                                                                  |
| AC-002    | manual    | Compare `accelerator.yaml` and `docs/accelerator/*.svg` against `ARCHITECTURE.md`; verify catalog access and gate labels.               |
| AC-003    | manual    | Review `docs/accelerator/verification.json`, reproduce its commands, and inspect every linked media asset for local-only content.       |
| AC-004    | automated | `scripts/specs/validate.test.ts`; run `pnpm exec vitest run --config vitest.config.ts` and `GITHUB_BASE_REF='' pnpm spec:validate:all`. |

## Status

Lifecycle: **current**

Packaging work only. Completion of this PRD does not confer catalog acceptance or production
authorization. Outstanding external readiness gates remain in README and verification evidence.
