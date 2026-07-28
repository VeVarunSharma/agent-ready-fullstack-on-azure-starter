# Data residency

This matrix is the residency source of truth for the current foundation. Read it with
[data classification](DATA_CLASSIFICATION.md), the [threat model](THREAT_MODEL.md), and the
[architecture](../../ARCHITECTURE.md).

> **No residency claim is complete.** No Azure environment or workflow run exists, the production
> region/permitted geography is unknown, and provider/control-plane/support approvals are absent.
> Private endpoints and one configured region do not prove all-data residency.

Unclassified customer data is Restricted. Unknown processing, storage, replication, backup,
telemetry, support, or control-plane location blocks production use.

## Terms

- **Regional** means a configurable data-plane resource is intended for one approved Azure region.
  It says nothing about management, identity, support, safety, service-managed copies, or metadata.
- **Nonregional/multiregional** means location is not bound to the workload region or depends on a
  provider/tenant contract.
- **Implemented** means a local/repository behavior exists; it does not imply cloud deployment.
- **Scaffolded-disabled** means IaC represents the surface but no resource exists.
- Values such as `test-region-1`, 14-day database backup, or 30-day log retention are synthetic
  compile fixtures, not approvals.

## Implemented repository and local surfaces

| Surface / status                                                                 | Data and route                                                                                | Location                                                                                                                              | Retention / copies                                                                                                          | Required decision                                                                                                        |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Browser — **implemented**                                                        | Neutral UI and `ui-theme` preference only                                                     | User device; browser/profile sync may be multiregional                                                                                | Until local storage is cleared; vendor sync external                                                                        | Device/sync policy; future preference classification                                                                     |
| Developer workstation/pnpm store — **implemented local**                         | Source, synthetic tests, dependencies, builds, local environment                              | Developer/endpoint geography                                                                                                          | Endpoint/cache/backup policy external                                                                                       | Approved geography, encryption, cleanup; no production data                                                              |
| Local PostgreSQL — **implemented when running**                                  | Empty schema, Drizzle metadata, synthetic integration data over loopback                      | Developer/CI host                                                                                                                     | Named volume until `docker compose down --volumes`; no managed backup                                                       | Synthetic-only use and teardown                                                                                          |
| Next.js process — **implemented**                                                | Pages, probes, oRPC health, validated config, PII-safe JSON stdout                            | Developer/CI host                                                                                                                     | Memory/process lifetime; shell/CI logs per owner policy                                                                     | No production/customer data                                                                                              |
| Git/GitHub — **implemented dependency**                                          | Source, reviews, issues/PRs, security metadata                                                | GitHub nonregional/multiregional; contracted offering governs                                                                         | Organization/provider policy and copies unresolved                                                                          | Terms, geography, access, retention, private reporting; no secrets/customer data                                         |
| GitHub Actions — **workflow definitions implemented; external controls future**  | Source/tests/image metadata, protected config, review/evidence artifacts                      | Tokenless jobs may use GitHub-hosted regions; every Azure job requires operator-located VNet runner; GitHub control plane nonregional | Release artifacts request 7 days; plan/migration/rollout evidence 30 days; actual logs/caches/provider copies need approval | Environment/reviewers/default branch, configuration custody, runner location/isolation/patch/cleanup, provider retention |
| Four GitHub OIDC duties — **workflow contract implemented; federation external** | Claims for what-if, registry push, infrastructure deploy, and migration/runtime rollout/query | GitHub and Entra control planes are nonregional                                                                                       | FIC/identity/audit records per provider/tenant policy                                                                       | Exact issuer/audience/subjects, four distinct FICs, least-privilege RBAC, rotation/revocation and runner proof           |
| npm/Corepack/pnpm and OCI registries — **implemented dependencies**              | Public package/image requests, metadata, local caches                                         | External registry/CDN geography                                                                                                       | Provider and local cache lifecycle                                                                                          | Approved mirrors/terms, integrity/provenance, patching and cleanup                                                       |

No production data, secret, customer dataset, Azure resource, or approved production artifact is
present in these surfaces.

## Scaffolded-disabled regional Azure data planes

Nothing in this section is provisioned.

| Service / status                           | Intended data and path                                                                                               | Regionality qualification                                                                    | Retention / replication                                                                     | Required approval or gap                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Application Gateway WAF v2                 | Internet HTTPS, WAF inspection, gateway diagnostics; HTTPS to internal app                                           | Data plane in approved ingress region; Network/ARM/support planes separately reviewed        | Transient buffering; diagnostic/platform retention unknown; zones are availability only     | Region, DNS/CA/certificate, WAF schema, support, logs/retention                           |
| Internal Container Apps/web                | Requests, OIDC principal header, DB tokens, ephemeral runtime, JSON stdout                                           | Compute region; Microsoft.App/ARM/auth dependencies not wholly regional                      | Replica/revision/platform-log lifecycle unresolved; no app-state backup                     | Region/SKU/quota, egress, revision retention, diagnostics and support                     |
| Built-in authentication                    | OIDC redirects/tokens/claims/cookies; token store configured off                                                     | Runs with app but depends on nonregional identity provider/control plane                     | Cookie/provider/platform metadata retention unresolved                                      | Provider/tenant/audience/callback, claim minimization, terms and logs                     |
| Migration job — **entrypoint implemented** | Digest-pinned bundle applies schema via private PostgreSQL using migration identity and a same-session advisory lock | Same compute qualification as Container Apps                                                 | Ephemeral job/stdout; schema in PostgreSQL; no job backup                                   | SQL/grants, timeouts/backfill/compatibility, evidence retention and recovery              |
| PostgreSQL Flexible Server                 | Future records/schema/Entra authentication over private endpoint/TLS                                                 | Data plane in approved data region; ARM/support and service copies require review            | Production retention unresolved; synthetic 14 days is not approval; HA zones are not geo DR | Fields/purpose, backups/copies/deletion, restore/RPO/RTO, principals/grants               |
| Azure Container Registry                   | Private image layers/manifests; protected runner push and workload pull                                              | Registry in approved compute region; ACR control/support/recovery copies reviewed separately | Synthetic untagged period not approval; no geo-replica modeled                              | Digest/tag lifecycle, scanning/signing, restore/purge and private runner                  |
| Key Vault                                  | Versioned OIDC credential/certificate and access metadata                                                            | Regional endpoint with service-managed geography/resiliency; ARM nonregional                 | Synthetic 90-day soft delete; version/certificate lifecycle unresolved                      | Permitted paired geography, CA/rotation, recovery, support/break-glass                    |
| VNet/subnets/NSGs/routes/private endpoints | Packet routing and Azure configuration metadata                                                                      | Regional data path; Network/ARM/support planes service-defined                               | Resource/audit lifetime; no flow logs configured                                            | Address ownership, routes/DNS, endpoint approval, diagnostics/drift                       |
| Private DNS                                | Private FQDNs/records/VNet links                                                                                     | `global` resource/control plane                                                              | Resource lifetime; provider-managed availability                                            | Nonregional metadata, resolution/logging, recovery/deletion                               |
| Workload managed identities                | Identity/RBAC metadata and short-lived tokens                                                                        | Identity resource regional; Entra/token/RBAC planes nonregional                              | Identity/role/audit lifecycle; provider-set token lifetime                                  | Tenant geography, exact roles/SQL mapping, lifecycle and revoke                           |
| Azure Firewall — **reserved**              | Approved outbound destinations and network metadata                                                                  | Regional data plane; Network control/support nonregional                                     | Policy lifetime; log retention unresolved; zones not backup                                 | Required for Restricted production: region/SKU/zones, FQDNs/DNS, diagnostics/cost/support |

### Monitoring distinction

| Service / status                                                                    | Intended data and path                                                                                                                                                                | Regionality qualification                                                                                                          | Retention / copies                                                                     | Required approval or gap                                                                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Log Analytics — **scaffolded-disabled**                                             | PII-safe application JSON stdout and only approved Container Apps console/system/platform categories through Azure Monitor routing; migration/runtime identity performs rollout query | Workspace must be in approved primary region; ingestion/query/management/support still require review; intended AMPLS private path | Explicit production retention/quota absent; provider durability/export/archive unknown | Category field inspection, destination, retention/deletion, private FIC/RBAC/runner/DNS, support/query/export/cost |
| Workspace-based Application Insights — **scaffolded-disabled, no application flow** | Component metadata only if deployed; no trace/metric/dependency/request export                                                                                                        | Co-located component; Azure Monitor front doors/control plane may be nonregional                                                   | No application data flow; configured retention is not approval                         | A future compatible GA-only exporter/loader, schema, identity/path, retention/access/export and masking decision   |
| AMPLS — **scaffolded-disabled**                                                     | Private-link scope/routing metadata; no live telemetry path                                                                                                                           | Scope uses `global` control-plane location plus regional private endpoint                                                          | Resource/control-plane audit lifetime                                                  | Explicit nonregional exception, private DNS/runner verification, no public fallback                                |
| Application exporter/collector — **absent**                                         | No data or path; no connection string, DCE, DCR, OTLP endpoint, collector, or exporter package                                                                                        | Not applicable                                                                                                                     | Not applicable                                                                         | Preserve disabled posture until a GA-only compatible dependency/loader and all data controls are approved          |

Stable `@azure/monitor-opentelemetry@1.18.2` was rejected because it resolves beta exporter
`1.0.0-beta.43` and requires a Node `--import` loader incompatible with the standalone Next.js
entrypoint. The prohibited Vercel instrumentation package is removed. The activation workflow's
future Log Analytics query would prove only that the allowlisted `telemetry.initialized` JSON record
for `TELEMETRY_MODE=disabled` arrived; it would not prove Application Insights export or residency.

## Foundry false-only boundary

[`infra/modules/foundry.bicep`](../../infra/modules/foundry.bicep) accepts only
`enableFoundry=false` and compiles to zero resources. There is no disabled account, project,
capability host, Storage, Cosmos DB, AI Search, subnet, endpoint, DNS, RBAC, diagnostic,
requirement, model, or agent to place in a residency matrix. It has no processing, storage, network,
retention, backup, or encryption flow.

A future PRD must add every selected service before implementation and cannot infer region or zero
retention from a model/deployment label. The present blocker is that capability-host creation
generates Blob container identifiers and a native Cosmos DB data-plane scope too late for an atomic
least-privilege GA-only Standard Agent Setup. Broad roles, preview APIs, keys, or portal follow-up
are not approved substitutes.

## Nonregional and external production dependencies

| Dependency                                     | Data/location qualification                                                                      | Required approval                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Microsoft Entra / selected OIDC provider       | Users/workloads, claims, registrations, sign-in/audit; global/nonregional control plane          | Tenant geography, audience, MFA/conditional access, logs/support/deletion and terms |
| Azure Resource Manager/Policy/RBAC             | IaC, resource IDs, deployments/what-if/activity metadata; nonregional management plane           | Subscription/tenant, least privilege, history retention/export, policy/support      |
| Azure service management/support/commerce      | Configuration, operations, quota, billing, incident/support records; service-defined/nonregional | Terms/subprocessors, metadata minimization, support location/access/retention       |
| Public DNS/registrar and certificate authority | Global DNS/registration/validation and public certificate-transparency metadata                  | Provider/account security, DNSSEC, query logs, CA/key lifecycle, support/recovery   |
| Resolver/time/OS/package endpoints             | Queries and operational metadata through platform/global/CDN paths                               | Complete egress inventory, DNS design, logging/retention and outage behavior        |
| GitHub security services                       | Dependency/source analysis and findings in GitHub control plane                                  | Contracted geography, source visibility, alert access/retention                     |

Never upload Restricted payloads to support or external processors without explicit approval.

## Approval record required before production

The production owner must record approver, evidence, scope, date, and expiry/review event for:

1. permitted jurisdiction/geography and exact primary/approved locations;
2. every classified field, processor, store, index, cache, telemetry table, backup, export, and
   support path;
3. same-region zones versus cross-region/service-managed copies;
4. retention, deletion, legal hold, backup location, restore behavior, RPO/RTO, and regional
   failure;
5. Entra/OIDC, GitHub, Azure management/support, private DNS, AMPLS, DNS/CA, and registry
   nonregional treatment;
6. approved private network, controlled egress, four delivery identities/FICs/RBAC,
   human/break-glass access, audit retention, and runner controls;
7. telemetry categories/destinations/access/export and explicit disabled application-export posture;
8. contractual terms, subprocessors, incident access, and customer/data-subject deletion duties.

“Azure is compliant,” “private endpoint,” “regional resource,” and “zero retention” are not
evidence.

## Preflight relationship

[`infra/scripts/preflight.mjs`](../../infra/scripts/preflight.mjs) rejects missing/unapproved
locations, production placeholders, low-entropy identities/digests, unapproved copies/global edges,
incomplete auth, public data planes, unresolved egress/private runner, incomplete monitoring/AMPLS/
query-RBAC posture, wrong migration command, and every Foundry enablement/model declaration.

Preflight cannot verify provider contracts, actual resource state, support access, service-managed
copies, FIC/RBAC/runner configuration, or deletion. Those require separately authorized evidence.

## Update rule

Any change to collection, processing, storage, telemetry, backup, replication, export, identity,
support, network, provider, retention, deletion, or control-plane behavior updates this matrix and
the [threat model](THREAT_MODEL.md) in the same change. Unknown is a blocker, not a default.
