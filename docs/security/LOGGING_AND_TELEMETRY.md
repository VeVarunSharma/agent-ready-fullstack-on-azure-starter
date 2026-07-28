# Logging and telemetry

This is the canonical observability data boundary. The [constitution](../../CONSTITUTION.md) remains
binding.

> No Azure telemetry destination is deployed or approved. The PII-safe JSON stdout logger is
> implemented. Bicep models approval-gated routing to regional private Log Analytics; Application
> Insights/AMPLS and application trace export remain scaffolded-disabled.

## Objectives

Collect the minimum structured evidence needed to determine health, reliability, security-relevant
state, and deployment outcomes without recording business/customer content. Telemetry must never be
an alternate data store.

## Implemented runtime contract

[`apps/web/src/server/observability/logger.ts`](../../apps/web/src/server/observability/logger.ts)
accepts only these event names:

- `api.request.completed`
- `api.request.failed`
- `auth.principal.malformed`
- `database.probe.completed`
- `runtime.configuration.invalid`
- `telemetry.initialized`

Only these properties survive schema parsing:

| Property          | Constraint                                        | Purpose                                   |
| ----------------- | ------------------------------------------------- | ----------------------------------------- |
| `correlationId`   | UUID                                              | Correlate one HTTP exchange; not identity |
| `traceId`         | 32 lowercase hex characters                       | Distributed trace correlation             |
| `spanId`          | 16 lowercase hex characters                       | Span correlation                          |
| `durationMs`      | `0..300000`                                       | Bounded operation duration                |
| `statusCode`      | HTTP `100..599`                                   | Outcome class                             |
| `outcome`         | `success`, `failure`, `skipped`                   | Low-cardinality result                    |
| `component`       | `api`, `auth`, `database`, `runtime`, `telemetry` | Low-cardinality owner                     |
| `databaseEnabled` | Boolean                                           | Configuration state                       |
| `authState`       | `absent`, `malformed`, `valid`                    | Shape state, never identity/claim         |
| `telemetryMode`   | `disabled`, `azure-monitor`                       | Export configuration state                |

Unknown properties are stripped. Pino also redacts prohibited field names as defense in depth. No
logger call may rely on redaction to make an unsafe payload acceptable.

The current API logs completion/failure metadata only. It does not log path, URL, request/response
body, headers, error object, stack, or principal. A client-supplied valid correlation UUID remains
untrusted metadata and must never authorize, index a customer, or become a durable user identifier.
The prohibited Vercel instrumentation package was removed; no Vercel telemetry dependency
initializes or exports this logger output.

## Prohibited content

Never emit, attach, sample, or capture:

- request or response bodies, form fields, GraphQL/oRPC payloads, or validation values;
- authorization headers, access/refresh/identity/database tokens, API keys, passwords, certificates,
  cookies, session values, or raw Container Apps principal headers/claims;
- complete URLs, query strings, fragments, referrers containing parameters, or user-entered search;
- uploaded files, extracted text, documents, images, audio, or derived embeddings;
- prompts, completions, agent messages, tool arguments/results, evaluations, traces containing model
  content, or safety-review content;
- email, names, addresses, device identifiers, IP addresses, tenant/object IDs, or other personal
  identifiers unless a later PRD proves a narrowly allowlisted operational need;
- SQL text/parameters, database rows, schema samples, connection strings, or credential errors;
- exception messages/stacks from external libraries or unrestricted free text;
- environment dumps, deployment parameter documents, Key Vault references containing version IDs, or
  GitHub/Azure OIDC claims.

This prohibition applies to app logs, traces, metrics dimensions, browser telemetry, WAF/diagnostic
settings, CI output, migration output, CSP reports, crash dumps, and future Foundry observability.

## Redaction boundary

1. Call sites construct an approved event and low-cardinality fields only.
2. The Zod field schema strips everything else.
3. Pino path redaction protects known dangerous names if a future nested object reaches the logger.
4. Exporters/processors must apply an independent allowlist before network export.
5. Destination queries, alerts, dashboards, and exports must not reconstruct prohibited content.

Do not add a generic `message`, `attributes`, `metadata`, `context`, `labels`, `error`, or free-form
map. A new property requires:

- a cataloged PRD and classification;
- cardinality and re-identification analysis;
- threat/residency/retention updates;
- implementation at every allowlist boundary;
- positive and negative redaction tests.

## Application trace export

Production requires `TELEMETRY_MODE=disabled` and prohibits an Application Insights connection
string. `TELEMETRY_MODE=azure-monitor` is a reserved, fail-closed schema value and is currently
always rejected. The evaluated stable package, `@azure/monitor-opentelemetry@1.18.2`, resolves
prerelease `@azure/monitor-opentelemetry-exporter@1.0.0-beta.43`; its ESM auto-instrumentation also
requires a Node `--import` hook incompatible with the Next.js standalone entrypoint. The stable
top-level label therefore did not satisfy the GA-only dependency and loader contracts.

There is no OTLP mode, exporter package, connection string, collector, DCE, or DCR in the admitted
runtime path. A future exporter requires a compatible GA-only dependency and loader contract plus
approval of its schema, identity, network/DNS path, region, retention, access, deletion, and failure
behavior. Export failure must not make the product unavailable or trigger unsafe fallback logging.

## Azure platform telemetry

The intended platform path is:

```text
allowlisted application event
  → Pino JSON stdout
  → Container Apps Azure Monitor log routing / approved diagnostics
  → regional Log Analytics workspace
  → private AMPLS query from the protected rollout runner
```

Bicep models a regional Log Analytics workspace with local authentication and public ingestion/query
disabled; Container Apps `azure-monitor` routing; approved
`ContainerAppConsoleLogs`/`ContainerAppSystemLogs` diagnostic settings; explicit retention/quota;
and workspace-scoped `Log Analytics Data Reader` for the migration/runtime federated service
principal. The activation workflow queries for only the new revision's allowlisted
`telemetry.initialized` record with `outcome=skipped` and `telemetryMode=disabled`.

Application Insights and AMPLS are **scaffolded-disabled** resources, not evidence of a live
application exporter. No Application Insights connection string is passed to a workload, and there
is no exporter package, DCE, DCR, OTLP endpoint, or collector. AMPLS models future private
ingestion/query and a regional private endpoint, but its control-plane resource is `global` and its
DNS/network path has not been verified.

All Azure resources remain approval-gated and undeployed. Production preflight requires an explicit
reviewed monitoring posture: regional co-location/destination, private ingestion/query, retention
and quota, exact diagnostic-category schemas, the disabled-exporter exception, query
client/principal and workspace RBAC, AMPLS nonregional approval, and external
FIC/protected-environment/private-runner/DNS controls. It rejects placeholder or unresolved values
and emits the posture in machine-readable form. None of those repository checks proves the external
controls or actual ingestion.

Platform diagnostic categories may contain source IPs, host names, user agents, request paths, query
material, resource identifiers, or firewall details even when application logging is safe. The
approver must inspect each category's current schema and disable or transform fields that violate
this contract. Category names in a compile fixture are not approval.

## CSP reports

CSP is report-only and no collector is configured. Before collection:

- accept a strict bounded JSON schema and content type;
- rate-limit and authenticate administration of the endpoint;
- discard full `document-uri`, `blocked-uri`, referrer, query, fragment, source sample, and script
  sample values;
- retain only an allowlisted directive, disposition, coarse origin category, status, and opaque
  correlation when safe;
- treat unexpected report content as Restricted and do not echo it;
- document regional destination, access, retention, deletion, and abuse protection.

Raw browser CSP reports must never be forwarded directly to logs or a third party.

## Metrics, traces, and alerts

- The current application emits no spans or application traces; its production telemetry mode is
  disabled.
- Dimensions remain bounded and low cardinality; no user/customer/tenant ID dimension.
- Trace spans use approved operation names, not raw route values or SQL/model content.
- Sampling never makes prohibited data acceptable.
- Alerts contain opaque resource/trace references and link authorized operators to the approved
  store; notification bodies contain no customer content.
- Health endpoints expose only `live`, `ready`, or `not_ready` plus an opaque correlation ID.

## Retention, access, and export

No default retention is claimed. The synthetic fixture uses 30 days for Log Analytics and
Application Insights, but it is not a production decision.

Production must record:

- owner and operational purpose for each table/category/metric;
- classification, region, ingestion/query path, and service-managed copies;
- exact retention and deletion behavior, including archives/exports;
- least-privilege reader, query, alert, and purge roles;
- approved support access and incident exceptions;
- export destinations and cross-region behavior;
- cost cap and high-volume/cardinality safeguards.

Access is audited and periodically reviewed. Ad hoc downloads and unrestricted workspace exports are
prohibited.

## CI and local behavior

- Local structured logs contain synthetic/test metadata only.
- Tests assert unknown and prohibited properties do not survive.
- CI output must not print complete environments, OIDC tokens/claims, Azure responses containing
  secrets, production configs, database URLs, or browser artifacts with customer content.
- Failed tests upload artifacts only when the workflow explicitly configures approved retention and
  the data is synthetic.
- Future Foundry tests use deterministic mocks and make no external model call.

## Change checklist

- [ ] PRD and classification identify every new event/property.
- [ ] Logger and exporter allowlists changed together.
- [ ] Negative tests cover secrets, headers, bodies, URLs/query strings, free text, and model
      content.
- [ ] Threat model and residency matrix include every destination and control plane.
- [ ] Retention, access, export, backup, deletion, cost, and support approvals are recorded.
- [ ] Local/CI and failure paths do not enable verbose unsafe logging.
