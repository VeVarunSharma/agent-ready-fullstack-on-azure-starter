# Deployment runbook

This runbook describes the checked-in staged delivery contract and its external gates. It is not an
authorization to deploy.

> **Deployment is blocked.** No Azure resource or workflow run is evidenced. The checked-in
> production configuration is intentionally rejected, `azure.yaml` declares no application service,
> and protected-environment, federation, RBAC, private-runner, production-value, database-bootstrap,
> monitoring, residency, and recovery evidence is absent.

Do not run `azd up`, dispatch `.github/workflows/deploy.yml`, mutate Azure, or invoke a live Foundry
operation unless a separate task authorizes the exact environment and operation.

## Status

- **Implemented:** deterministic validation, production preflight, migration bundle/lock, staged
  Bicep, and manual plan/deploy workflow definitions.
- **Scaffolded-disabled:** all Azure resources, regional private Log Analytics routing, Application
  Insights/AMPLS, built-in authentication, and private data planes.
- **Future/external:** an actual environment/run, production configuration and approvals, GitHub
  environment/FICs, Azure duty-scoped RBAC, private runner, SQL principal bootstrap, and operations.
- **Foundry:** false-only and nondeployable; zero resources, DNS, RBAC, requirements, model, or
  agent.

Repository implementation does not prove external controls or production readiness.

## Duties and identities

| Duty                                    | Identity / owner                           | Boundary                                                                                        |
| --------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Change and specification                | Author/reviewers                           | PRD, code/IaC/docs/tests, migration compatibility, deterministic evidence                       |
| Security/privacy/residency              | Named approvers                            | Data, geography, telemetry, backup, support, processors, expiry                                 |
| Same-run Azure planning                 | `AZURE_WHAT_IF_CLIENT_ID`                  | ARM read/what-if only; no registry push or deployment                                           |
| Private image publication               | `AZURE_REGISTRY_PUSH_CLIENT_ID`            | ACR push/import/read/immutability operations at the narrowest repository scope                  |
| Reviewed infrastructure mutation        | `AZURE_INFRA_DEPLOY_CLIENT_ID`             | Foundation, migration-job, and inactive-candidate IaC only                                      |
| Migration, traffic, rollback, log query | `AZURE_MIGRATION_RUNTIME_CLIENT_ID`        | Start/inspect job, app revision/ingress operations, workspace query; no infrastructure creation |
| SQL principal/grant bootstrap           | Entra database administrator group         | OID-bound PostgreSQL principals and reviewed grants; no application runtime                     |
| Database DDL                            | Migration user-assigned managed identity   | Token-based migration session only                                                              |
| Application runtime                     | Application user-assigned managed identity | Token-based runtime DML and approved Key Vault/ACR access only                                  |

The workflow requires four distinct delivery client UUIDs. The migration/runtime delivery identity
is not the migration workload identity or a PostgreSQL principal.

The repository does not create the GitHub protected environment or federated identity credentials.
Environment administrators must prove exact issuer/audience/subject restrictions, default-branch and
reviewer policy, separate least-privilege Azure roles, audit/rotation, and an isolated patched
VNet-connected runner. Labels and UUIDs are assertions, not evidence.

## Repository surfaces

- `infra/main.bicep` — subscription entry point with `foundation`, `migration`, and `application`
  stages.
- `infra/modules/*.bicep` — GA-schema regional topology; the Foundry module is false-only and empty.
- `infra/environments/compile.config.json` — synthetic compile fixture only.
- `infra/environments/production.config.json` — incomplete and deliberately nondeployable.
- `infra/scripts/preflight.mjs` — fail-closed configuration and monitoring posture gate.
- `infra/scripts/validate.mjs` — pinned offline format/lint/build and preflight tests.
- `azure.yaml` — preprovision preflight hook with `services: {}`; it cannot publish the app.
- `.github/workflows/infra-plan.yml` — protected plan-only workflow.
- `.github/workflows/deploy.yml` — protected staged release, migration-before-traffic, activation,
  and rollback workflow.

No workflow presence or successful local compile is cloud evidence.

## Production blockers

Before even a live what-if, record owners and evidence for:

- exact subscription/resource group, primary and approved regions, names, tags, provider
  registrations, policy, locks, quota, SKUs, and zones;
- public DNS/CA, versioned Key Vault certificate, identity provider/tenant/audience/client,
  callbacks/logout/allowlists, and any versioned OIDC credential;
- VNet ranges, private DNS/endpoints, Azure Firewall mode/routes/FQDNs, platform egress, and public
  data-plane denial;
- private runner location, ownership, patching, isolation, cleanup, artifact/cache policy, egress,
  and label protection;
- four environment-bound FICs and exact management/native data-plane RBAC with separation-of-duty
  tests;
- PostgreSQL region/HA/backup/restore/RPO/RTO, Entra administrator, app/migration object IDs and
  principal names, grants, and private bootstrap owner;
- regional Log Analytics purpose/categories, retention/quota/access, migration/runtime query role,
  AMPLS global-control-plane exception, private ingestion/query DNS, and explicit disabled
  application-export posture;
- certificate/secret and PostgreSQL-principal bootstrap timing between foundation and migration;
- classification, residency, threat, incident/on-call, rollback compatibility, and recovery
  approval.

Foundry remains false. A placeholder, test/example domain, synthetic marker, low-entropy UUID/SHA,
zero/unresolved SKU or retention, public access, missing monitoring approval, wrong migration
command, or compile fixture value is not a temporary production default: preflight rejects it.

## Offline validation

Use the exact pinned toolchain:

```sh
corepack enable
corepack prepare pnpm@11.17.0 --activate
pnpm install --frozen-lockfile
pnpm deps:audit
pnpm format:check
pnpm lint
pnpm --filter @repo/ui check:colors
pnpm typecheck
pnpm test:unit
pnpm spec:validate:all
pnpm build
pnpm infra:validate
pnpm docker:build
```

Run PostgreSQL integration and browser acceptance in their declared environments:

```sh
pnpm test:integration
pnpm e2e
```

`pnpm deps:audit` must continue to find zero resolved semver prereleases. ESLint `9.39.5` is the
deliberate newest stable peer-compatible line rather than incompatible ESLint 10. shadcn-generated
configuration/components remain without an installed shadcn CLI dependency. Neither is an unresolved
failure.

These commands do not require or authorize Azure. `pnpm infra:validate` uses the pinned local Bicep
CLI, rejects preview APIs, compiles all templates/parameters, tests allow/deny cases, proves Foundry
emits no resources, and proves checked-in production input fails.

## Protected configuration and preflight

Never convert the synthetic fixture into production input or commit real identifiers. Materialize
the candidate through the approved protected mechanism, record its lowercase SHA-256 separately, and
run:

```sh
node infra/scripts/preflight.mjs --config "<approved-production-config-path>"
```

The file contains references and identifiers, not secret/certificate values. It needs bounded
retention and access. Preflight must run before review and again before any OIDC login. Stop on
every error; never weaken validation or enable a public path to pass.

Preflight returns a machine-readable monitoring posture and requires explicit reviewed regional
destination, retention/quota, approved diagnostic categories, private ingestion/query, query
identity/RBAC, AMPLS exception, and external private-path controls. It preserves
`TELEMETRY_MODE=disabled` and rejects an Application Insights connection string, DCE/DCR, OTLP
endpoint, or unsupported exporter posture.

## Plan-only workflow

`.github/workflows/infra-plan.yml` is a separate read-only aid:

1. exact default branch, `PLAN PRODUCTION`, configuration digest, source/toolchain, and four
   delivery IDs are checked without an OIDC token;
2. preflight runs before Azure login;
3. the what-if identity logs in only on the protected VNet runner;
4. unsafe change types, public access, and foundation-stage workload resources fail closed;
5. a sanitized digest-bound review artifact is uploaded.

It does not deploy and is not a reusable authorization for a later run. The deployment workflow
creates its own same-run evidence for every mutable stage.

## Staged deployment workflow

The manual workflow is restricted to the reviewed default-branch commit and requires exact
`DEPLOY PRODUCTION`, `RUN PRODUCTION MIGRATIONS`, and protected-configuration SHA-256 inputs.
Concurrency is serialized. Tokenless preparation uses no `id-token: write`; every Azure job runs on
the protected VNet-connected pool.

### 1. Tokenless release acceptance

- Install exact Node/pnpm dependencies with strict peers and run dependency, format, lint/color,
  type, unit, specification, build, IaC, PostgreSQL integration/migration, Playwright/axe, and image
  smoke checks.
- Confirm tests/builds left the reviewed checkout unchanged.
- Verify the image contains `migration/dist/migrate-production.mjs` and migration files.
- Run production preflight, compile Bicep, and seal commit, config, Bicep/template, image ID, Azure
  target, and all four client IDs into checksummed artifacts.
- Build and archive the image without cloud credentials.

### 2. Foundation plan, review, and mutation

- The what-if identity rematerializes exact foundation parameters and produces a sanitized review
  plus a digest of canonical raw Azure state.
- A protected reviewer inspects that same-run artifact before the infrastructure job is allowed.
- The infrastructure identity verifies every source/config/identity/parameter digest, reruns
  what-if, and requires the fresh canonical state digest to equal the reviewed digest.
- Only then may the foundation stage create prerequisites; policy rejects web or migration workload
  resources in this stage.

Certificate/secret lifecycle and SQL principals are external bootstrap duties. Required reviewers
must not release a dependent stage until those prerequisites are proven.

### 3. Private image publication and digest proof

- The registry identity loads the tokenless artifact and reaches ACR only through private DNS.
- The full commit SHA tag is a source/provenance alias. Existing different content fails closed.
- A staged publication is pulled back and matched to the reviewed local image ID.
- The commit tag and manifest are made write/delete-disabled and re-read for proof.
- Evidence records `${registry}/${repository}@sha256:<64-hex>`.

Every Bicep stage, migration execution, candidate revision, and rollout record uses that digest
reference. Promotion is digest-only; no mutable or commit tag is used as the deployment reference.

### 4. Migration infrastructure and execution

- The what-if/infrastructure pair repeats the same-run review, fresh-state equality, and protected
  gate for `deploymentStage=migration`; policy rejects web-app mutation.
- IaC deploys only the digest-pinned manually triggered job.
- The migration/runtime identity verifies the deployed digest, exact command
  `node migration/dist/migrate-production.mjs`, `DATABASE_MODE=azure-managed-identity`, remaining
  runtime environment, one migration managed identity, and absence of passwords/connection
  strings/export endpoints.
- It refuses active or ambiguous executions, starts one job, requires terminal `Succeeded`, rechecks
  digest/command, and uploads evidence.

Inside the bundle, Drizzle and `pg_try_advisory_lock` use the same dedicated PostgreSQL session; the
lock is released in `finally`. Lock contention fails closed. Workflow serialization and the database
lock are complementary. No application planning begins without successful migration evidence.

### 5. Application plan and inactive candidate

- The plan requires the complete source → digest → successful-migration chain.
- Current app/revision state must be either exactly one serving revision at 100% through Application
  Gateway restrictions or a recognized first-bootstrap deny-all posture.
- A deterministic candidate name and digest-only parameters are reviewed.
- Before mutation, the infrastructure identity proves prior traffic/exposure are unchanged and fresh
  what-if state equals the reviewed state.
- Existing environments retain the prior revision at 100% while the candidate has 0%. First
  bootstrap creates an externally disabled, deny-all candidate so it cannot serve traffic before
  acceptance.

### 6. Activation and acceptance

The migration/runtime identity proves the full evidence chain, then:

1. verifies candidate health, digest, `LOGGING_MODE=json`, `TELEMETRY_MODE=disabled`, and no
   Application Insights/OTLP setting;
2. verifies built-in-auth provider/audiences/allowlists/callback posture;
3. proves prior traffic and ingress remained unchanged and, when present, prior service health/auth;
4. shifts/opens exactly 100% to the candidate;
5. verifies public live/ready probes, unauthenticated redirect, forged-header equivalence, and
   direct revision endpoint denial;
6. queries approved regional Log Analytics through the private path for the allowlisted
   `telemetry.initialized` event whose outcome is `skipped` and mode is `disabled`;
7. rechecks exact active traffic and Application-Gateway-only ingress before sealing evidence.

This query proves safe JSON stdout ingestion and the deliberately disabled application exporter. It
does not prove traces, a connection string, Application Insights export, full telemetry approval, or
all-data residency.

## Rollback and recovery verification

### Application traffic

On any post-shift acceptance failure, the workflow:

- patches the exact prior revision to 100% with Application-Gateway-only ingress, or restores
  first-bootstrap external=false/deny-all posture;
- deactivates the candidate when a prior revision exists;
- repeatedly reads revisions/app configuration until traffic, exposure, and IP restrictions exactly
  match the safe posture;
- for a prior service, rechecks live/ready plus unauthenticated and forged-header authentication
  behavior.

If recovery cannot be verified, the workflow fails with immediate-operator-action status. Even a
verified traffic rollback does not undo reviewed nontraffic infrastructure mutation; operators must
inspect and reconcile it.

### Database

- Never run generated “down” DDL or drop newly used structures as an emergency default.
- Preserve expand/migrate/contract compatibility, stop rollout, and repair forward.
- A restore requires a separately approved backup/point-in-time plan, residency/RPO validation, and
  reconciliation of application writes. No restore procedure is currently approved.

### Infrastructure

- Use a new reviewed what-if and Bicep change to return to a known state; no undocumented portal
  repair.
- Deletion/replacement, DNS/certificate/identity rotation, data-store restore, or cross-region
  failover needs a specific authorized recovery plan.

## Failure stops

Stop without bypass when:

- config/source/template/image/identity/evidence digests disagree or fresh what-if differs from the
  reviewed same-run state;
- a delete/ignored/unsupported change, public data plane, global request edge, geo-copy, Foundry
  resource, or workload in the wrong stage appears;
- any production placeholder, unresolved monitoring control, unapproved diagnostic field, or
  prohibited exporter/connection setting appears;
- the private runner, DNS, ACR proof/immutability, certificate, workload identity, SQL
  principal/grant, migration lock/execution, candidate digest, auth, direct-denial, probe, Log
  Analytics query, or rollback verification fails;
- provider/API/SKU/zone/quota, contract, support, retention, residency, RPO/RTO, or owner is
  unresolved.

## No drift

Production resources, auth, network, identities, RBAC, diagnostics, retention, backup, and feature
flags remain in reviewed Bicep/configuration or explicitly approved FIC/identity/SQL automation.
Read-only inspection may gather authorized evidence. Emergency mutation needs an incident, exact
change, approver, expiry, least privilege, and immediate reconciliation.

## Completion record

A future production record must name:

- PRD/ADRs, commit, tokenless image ID, ACR manifest digest, and immutable evidence checksums;
- environment, production configuration digest, regions, and external
  protected-environment/FIC/RBAC/private-runner evidence;
- foundation/migration/application reviewed and fresh what-if results and approvers;
- certificate/secret versions by reference only and PostgreSQL principal/grant verification;
- migration execution, same-session lock contract, prior/candidate traffic, probes,
  auth/header/direct denial, telemetry initialization, rollback posture, and recovery compatibility;
- monitoring destination/categories/retention/access/private path, residency and external-service
  approvals, timestamps, owners, expiry, and unresolved follow-up.

The record must contain no token, secret, customer payload, raw production configuration, or
unsanitized Azure response.
