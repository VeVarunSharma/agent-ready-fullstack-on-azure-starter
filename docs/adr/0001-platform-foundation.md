# ADR-0001: Platform foundation

- **Status:** Accepted for the repository foundation; not production approval
- **Date:** 2026-07-26
- **Decision owners:** Repository maintainers
- **Scope:** Product-neutral bootstrap

## Context

The repository needs one lean application boundary that can run locally before a product, audience,
jurisdiction, or first product PRD exists. It must remain suitable for future sensitive data without
guessing production values or provisioning Azure.

The foundation needs reproducible workspace tooling, self-hosted SSR/API capability, regional
private-by-default Azure topology, typed PostgreSQL access, infrastructure as code, and workload
identity. It must keep identity-audience and Foundry behavior undecided until their consumers and
data flows are known.

The [constitution](../../CONSTITUTION.md) is the binding policy source. This record explains the
choices; it does not waive production preflight or approvals.

## Decision

### pnpm workspaces and Turborepo

Use exactly pinned pnpm with workspace globs `apps/*`, `packages/*`, and `services/*`. Use Turborepo
to express task dependencies and caching boundaries. Internal edges use `workspace:*` and explicit
package exports.

This keeps one lockfile and a small task graph without creating packages or services speculatively.
Remote caching remains off until storage and access are reviewed.

### Stable peer-compatible tooling

Use ESLint `9.39.5`, the newest stable line compatible with the selected workspace peer ranges.
ESLint 10 was evaluated but rejected as an incompatible baseline, not left as an unresolved upgrade.
Retain shadcn-generated `components.json` files and generated component conventions as source
without installing the unused shadcn CLI dependency. Dependency audit must continue to find zero
resolved semantic-version prereleases.

### Fail-closed specification coverage

Require a same-change active/current cataloged PRD for functional source, manifest, lockfile,
configuration, style, IaC, workflow, Copilot instruction/skill, deletion, rename, and unknown-path
changes. Validate both sides of renames and deleted paths; exempt only narrowly recognized
documentation and harmless metadata. The constitution-introduction exception applies only to initial
bootstrap.

### Next.js on Azure Container Apps

Use one strict TypeScript Next.js App Router application, built as a standalone Node.js image, as
the SSR and API boundary. The target host is an internal workload-profile Azure Container Apps
environment. The process is stateless: no in-memory sessions, cross-replica cache contract, ISR
assumption, or Vercel-only runtime.

First-party JSON contracts use stable oRPC v1 with Zod. Raw routes are limited to protocol surfaces.
The initial product requirement for ts-rest was replaced after its stable Next.js peer range failed
the compatibility gate; prerelease adapters were not accepted.

### Regional Application Gateway WAF ingress

Use regional Application Gateway WAF v2 as the only planned public request-processing edge. It
terminates public TLS, applies WAF prevention rules, rewrites trusted public-origin headers, clears
client-supplied platform identity headers, and re-encrypts to internal Container Apps ingress.

Do not add Azure Front Door by default. A nonregional edge requires a later ADR and residency
approval.

### Azure Database for PostgreSQL Flexible Server

Use PostgreSQL Flexible Server as the future relational store and PostgreSQL 18 locally. Use Drizzle
with the `node-postgres` adapter; do not add a second driver. The initial schema is empty.

Azure access is Entra-only through distinct application and migration managed identities and a
refreshable token for `https://ossrdbms-aad.database.windows.net/.default`. The exact hosted mode is
`DATABASE_MODE=azure-managed-identity`; local passwords are local-only.

Build the production migration source into `dist/migrate-production.mjs`, copy it and the generated
migrations into the standalone image, and invoke it only from the manual private job. One dedicated
PostgreSQL `PoolClient` obtains a nonblocking advisory lock, runs Drizzle on that same session,
unlocks in `finally`, and closes the pool. Contention and errors fail closed. Migrations follow
expand/migrate/contract and never run during install, build, image creation, or app startup.

### Bicep and Azure Developer CLI

Use modular, GA-schema Bicep with a subscription-scope entry point and azd configuration. Offline
validation compiles templates and tests fail-closed production preflight without Azure credentials.
Synthetic compile values are nondeployable and checked-in production values remain incomplete.

Successful compile is not what-if, provisioning, or operational readiness. Delivery IaC exposes
separate foundation, migration, and application stages. The manual workflow binds tokenless source,
configuration, template, and image evidence; reviews and rechecks same-run Azure what-if state
before each mutation; promotes only the proven ACR digest; runs migrations before candidate traffic;
and verifies rollback. Portal-only production drift is prohibited.

### Managed identity and least privilege

Use user-assigned managed identities where supported for the app, migration job, and Application
Gateway. GitHub delivery uses four distinct workload-federated client identities for what-if,
registry push, infrastructure deployment, and migration/runtime rollout plus monitoring query. Use
Key Vault references for any required application OIDC credential and TLS certificate. Do not use
static production database passwords, ACR admin credentials, long-lived CI client secrets, or broad
Owner grants.

The provisioning identity may require Contributor plus User Access Administrator at the narrowest
reviewed scope to create role assignments. PostgreSQL SQL principals/grants are a distinct bootstrap
step and are not created by Azure RBAC.

The protected GitHub environment, exact federated identity credentials, Azure assignments for each
duty, and isolated/maintained VNet-connected runner are external controls. Repository validation can
require and bind their IDs but cannot create or prove those controls.

### Minimal telemetry boundary

Emit only schema-allowlisted, PII-safe JSON to stdout. The prohibited Vercel instrumentation package
is removed. The target Container Apps Azure Monitor route sends approved console/system categories
to an explicitly reviewed regional private Log Analytics workspace. Workspace retention, categories,
query role, private DNS, and network path remain approval gates.

Keep `TELEMETRY_MODE=azure-monitor` reserved and fail-closed. Stable
`@azure/monitor-opentelemetry@1.18.2` resolves a beta exporter and requires a Node `--import` loader
that is incompatible with the standalone Next.js entrypoint. Application Insights and AMPLS remain
scaffolded-disabled with no connection string, DCE/DCR, application exporter, or live trace flow.

### Deferred identity audience

Do not choose workforce Entra, Entra External ID, or another OIDC audience before the application
audience is known. Container Apps built-in authentication is the planned platform authentication
boundary; application authorization remains server-owned and deny-by-default.

Issuer, audience, tenant, client, callbacks, logout behavior, and admitted identities remain
production blockers.

### False-only Foundry boundary

Keep `infra/modules/foundry.bicep` as a false-only, nondeployable gate. It declares no account,
project, capability host, store, subnet, private endpoint, DNS zone, RBAC assignment, requirement,
model, or agent. Current configuration has no disabled Foundry data-plane inputs, and preflight
rejects every enablement or model declaration.

Standard Agent Setup cannot yet be encoded as one least-privilege GA-only deployment:
capability-host creation generates Blob container identifiers and a native Cosmos DB data-plane
scope that are not known beforehand. Broad scopes, preview APIs, or unreviewed follow-up mutation
are not acceptable substitutes for atomic automation. A later PRD and the
[Foundry readiness gate](../architecture/FOUNDRY_READINESS.md) must create and review a new
deployable design before selecting any model, deployment, agent, prompt, tool, dataset, or behavior.

## Consequences

### Positive

- Local development and deterministic validation do not require Azure.
- Shared contracts, environment parsing, UI tokens, and database access have explicit owners.
- The target network keeps request processing regional by default and reserves the controlled-egress
  boundary without creating a speculative Foundry subnet.
- Production unknowns fail closed instead of becoming guessed defaults.
- Workload and migration duties can remain separate.
- Staged same-run evidence prevents migration or traffic activation from outrunning the reviewed
  digest and Azure state.

### Costs and constraints

- Application Gateway, private endpoints, workload-profile Container Apps, AMPLS, and optional Azure
  Firewall add cost and operational complexity.
- Private ACR cannot be delivered from an ordinary GitHub-hosted runner; an approved VNet-connected
  path is required.
- Four delivery identities and their external federation/RBAC controls increase bootstrap work but
  prevent one credential from silently accumulating duties.
- Key Vault, private DNS, Entra, ARM, GitHub, and Azure Monitor control planes still require
  explicit nonregional treatment.
- Built-in authentication does not provide application authorization.
- PostgreSQL principal creation and grants require a post-provision SQL bootstrap.
- Single-region deployment has no disaster-recovery promise.

### Current limitations

No Azure resource or workflow run has been evidenced. The Bicep topology is scaffolded-disabled,
production input fails preflight, and azd declares no application service. The repository-side
runtime/IaC migration and staged rollout contracts are aligned, but production values, certificate
and PostgreSQL-principal bootstrap, protected environment/FIC/RBAC/private-runner controls, provider
readiness, monitoring approval, residency, and recovery evidence remain incomplete.

## Alternatives considered

- **npm/yarn or independent repositories:** rejected for this bootstrap because one exact lockfile
  and explicit workspace task graph are simpler.
- **Azure Static Web Apps or Vercel:** rejected because the chosen SSR/API and private network
  target is a standalone Container Apps workload.
- **Azure Front Door:** deferred because it introduces nonregional edge processing that has not been
  approved.
- **Kubernetes:** rejected as unnecessary operational surface for one application.
- **Public Container Apps ingress:** rejected for the conservative target; Application Gateway is
  the planned public boundary.
- **Static PostgreSQL credentials or a second driver:** rejected in favor of Entra tokens and one
  `pg` adapter.
- **Terraform or portal configuration:** not selected; Bicep/azd aligns with the Azure-first,
  compile-offline requirement, and portal drift is prohibited.
- **Immediate Foundry/model selection:** rejected because no product behavior, data flow, or
  approval exists.

## Validation

The decision is represented by repository code, offline infrastructure compilation, and preflight
tests. Before any production use, follow the [deployment runbook](../runbooks/deployment.md) and
record a new ADR for any material reversal.
