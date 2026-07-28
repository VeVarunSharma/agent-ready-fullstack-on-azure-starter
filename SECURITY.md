# Security

> **Not yet production configured.** This repository contains a tested local foundation and
> offline-compiled Azure scaffolding. It represents no deployed Azure environment, approved identity
> audience, production data, completed residency review, or production authorization.

The [repository constitution](CONSTITUTION.md) is binding. This document points to operational
security sources instead of reproducing it.

## Report a vulnerability

Do not disclose a suspected vulnerability in a public issue, discussion, pull request, log, or test
artifact.

Use the repository host's private vulnerability-reporting feature when it is configured. Until a
private reporting route and response SLA are published, contact the repository owners through an
approved private organizational channel. Include:

- the affected path/version and prerequisite access;
- a minimal reproduction without real customer data or credentials;
- observed and expected behavior;
- likely impact and suggested containment;
- a secure way to coordinate follow-up.

Do not test against or provision Azure resources without explicit authorization.

## Current security posture

### Implemented locally

- Strict environment schemas reject invalid production modes and static production database
  passwords.
- oRPC v1/Zod contracts, safe error envelopes, opaque correlation IDs, and no-store response headers
  protect the implemented health API boundary.
- A server-only Container Apps principal parser rejects malformed encoding, payloads, issuers, and
  required claims. It does not grant authorization.
- PostgreSQL access has explicit local-password and `azure-managed-identity` modes. Hosted mode uses
  `ManagedIdentityCredential` and refreshable tokens. The production migration bundle takes a
  same-session PostgreSQL advisory lock before Drizzle runs and fails closed on contention.
- Structured logging uses fixed event names and allowlisted fields; sensitive request data is not
  accepted by the logger. The prohibited Vercel instrumentation package is absent.
- The UI has semantic light/dark tokens, visible focus, reduced-motion handling, and hardcoded-color
  enforcement.
- Next.js applies security headers. CSP is report-only pending nonce and safe-reporting work
  described in [Architecture](ARCHITECTURE.md#content-security-policy-strategy).
- Dependency versions and the lockfile are exact; deterministic checks prove no resolved
  semver-prerelease packages. ESLint 9 is the deliberate newest peer-compatible stable line, and
  shadcn-generated files are retained without a shadcn CLI dependency.
- Specification validation fails closed for functional source/configuration/IaC/workflow/Copilot
  changes, including deletions and both rename paths, unless the same change has an active/current
  cataloged PRD.
- The manual delivery definition seals source/config/image evidence, promotes only a proven ACR
  digest, reviews and rechecks same-run what-if state, requires migration success before candidate
  traffic, and verifies rollback posture. This is repository logic, not evidence of a cloud run.
- Production preflight rejects synthetic/placeholder identifiers and domains, unresolved monitoring,
  public data planes, an incorrect migration command, and Foundry enablement.

### Scaffolded-disabled

- Regional Application Gateway WAF v2, internal Container Apps, private endpoints/DNS, Entra-only
  PostgreSQL, private ACR/Key Vault, regional Log Analytics, Application Insights/AMPLS, managed
  identities, and narrow Azure RBAC are modeled in Bicep.
- Container Apps built-in authentication is parameterized but has no approved provider values.
- Container Apps JSON stdout/diagnostic routing targets private regional Log Analytics when
  explicitly approved. Application Insights/AMPLS remain scaffolded-disabled; no connection string,
  DCE, DCR, or application trace export is admitted.
- Foundry is a false-only, nondeployable boundary. It declares no disabled resources, DNS, RBAC,
  data-plane requirements, model, or agent.
- Checked-in production configuration is deliberately rejected by offline preflight.
- Manual delivery definitions separate what-if, registry push, infrastructure deployment, and
  migration/runtime rollout OIDC identities. The protected environment, four federated credentials,
  least-privilege Azure RBAC, and private-runner controls are external and unproved.

Compiled infrastructure is not an active control.

### Not defined

There is no product behavior, authorization policy, user model, production database schema,
production deployment, on-call/SLA, disaster recovery objective, Foundry model/agent, or approved
customer-data flow.

## Canonical security records

- [Data classification](docs/security/DATA_CLASSIFICATION.md)
- [Data residency](docs/security/DATA_RESIDENCY.md)
- [Threat model](docs/security/THREAT_MODEL.md)
- [Logging and telemetry](docs/security/LOGGING_AND_TELEMETRY.md)
- [Identity bootstrap](docs/runbooks/identity-bootstrap.md)
- [Database bootstrap](docs/runbooks/database-bootstrap.md)
- [Deployment](docs/runbooks/deployment.md)
- [Foundry readiness](docs/architecture/FOUNDRY_READINESS.md)

Unknown customer data is Restricted. Unknown region, retention, replication, support, identity, or
network behavior blocks production use.

## Security requirements for change

Before implementation, a functional change needs an active/current cataloged PRD in the same change.
The validator covers source, manifests, lockfiles, configuration, styles, IaC, workflows, Copilot
instructions/skills, unknown paths, deletions, and both sides of renames. The same change must:

1. classify new data and minimize collection;
2. validate each new trust-boundary input and allowlist output/errors;
3. define authentication and server-side, deny-by-default authorization separately;
4. record processing, storage, telemetry, backup, deletion, support, and control-plane locations;
5. use managed identity and least privilege where supported;
6. keep credentials and Azure SDKs server-only and secrets out of source/settings;
7. update architecture, threat, residency, logging, migration, and runbook records selected by
   impact;
8. add deterministic evidence and any separately authorized environment verification.

Security controls may not be replaced by a document, WAF rule, UI condition, or successful compile.

## Secrets and credentials

- Never commit a token, password, private key, certificate, connection string, real tenant/client
  identifier, or secret-shaped placeholder.
- Production database passwords and production `DATABASE_URL` values are prohibited.
- A required OIDC client credential must be a versioned Key Vault reference. Application Gateway
  certificate material also remains in Key Vault.
- GitHub-to-Azure delivery uses OIDC/workload identity federation, not a client secret.
- Local credentials are clearly local, live outside tracked files, and must never be reused.
- Suspected exposure requires immediate private reporting, revocation/rotation, log and artifact
  review, and documented follow-up.

## Supported versions

There is no released product or production service. Security fixes apply to the current repository
state only; no support window is promised until releases and owners are defined.
