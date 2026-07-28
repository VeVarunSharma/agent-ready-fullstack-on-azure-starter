# Microsoft Foundry readiness

- **Status:** Scaffolded-disabled, false-only, and nondeployable
- **Infrastructure resources:** None
- **Runtime behavior:** None
- **Model/agent:** None selected or deployed

> No Foundry account, project, capability host, store, subnet, private endpoint, DNS zone, RBAC
> assignment, requirement, model, agent, prompt, tool, dataset, trace, evaluation, or external model
> call exists. Successful compilation of the boundary is not eligibility, deployment approval,
> production readiness, or a residency claim.

## Current boundary

[`infra/modules/foundry.bicep`](../../infra/modules/foundry.bicep) deliberately exposes only
`enableFoundry=false`. Its compiled resource list is empty. The platform invokes the module only
behind the disabled feature gate, and production preflight rejects any configuration/parameter that
requests Foundry or declares a model.

The disabled repository configuration has:

- no `foundry` configuration object or Foundry location/name;
- no Foundry/BYO-store public-access, diagnostic, or retention requirements;
- no Foundry agent subnet, route, private DNS, endpoint, or firewall rule;
- no account/project/store identity or management/data-plane RBAC;
- no Storage, Cosmos DB, AI Search, model, or agent resource.

This is a gated architectural marker, not a partial Standard Agent Setup. Do not describe absent
resources as conditionally deployed or “ready when enabled.”

## Why the gate is false-only

The desired future posture would require an atomic, least-privilege, GA-only Standard Agent Setup.
That cannot currently be expressed safely:

1. Capability-host creation generates Blob container identifiers that do not exist before creation.
2. It also generates/depends on a native Cosmos DB data-plane scope whose final identifier is not
   available to the same pre-creation deployment.
3. Therefore the required container-scoped Blob and native Cosmos roles cannot be deterministically
   assigned to their final least-privilege scopes in one atomic deployment.

Broad account-level roles, preview APIs, embedded keys, portal steps, or an unreviewed second
mutation would weaken the contract rather than solve it. Until supported GA resource semantics
expose stable precomputable scopes or an approved transactional staging design exists, the only safe
encoded state is false with zero resources.

## Explicitly absent

- account, project, capability host, provider registration, quota, SKU, and regional eligibility;
- BYO or service-managed Storage, Cosmos DB, AI Search, thread/file/vector/memory state;
- model name/version/provider, deployment type, capacity, content filtering, or safety policy;
- agent, instructions, prompt, tool, connection, action authorization, or external API;
- tracing, evaluation, continuous evaluation, datasets, or application SDK/client;
- prompt/completion telemetry, live smoke invocation, and `services/` implementation.

No placeholder should be added to make this boundary appear complete.

## Admission gates for a future redesign

Every gate needs an owner, evidence, scope, approval date, and review/expiry event.

### Product, data, and safety

- [ ] A same-change active/current PRD defines the user outcome, exclusions, data inventory,
      authorization decisions, risks, and evidence.
- [ ] Prompts, files, completions, tool values/results, state, embeddings, indexes, traces,
      evaluations, safety signals, and operator views are classified.
- [ ] Collection, minimization, training/use, abuse monitoring, content logging, retention,
      deletion, legal hold, export, data-subject/customer requests, and support access are approved.
- [ ] The threat model covers direct/indirect prompt injection, poisoning, exfiltration, confused
      deputies, unsafe rendering/actions, denial/cost abuse, and human review.

### Platform and atomic automation

- [ ] Current official GA APIs and Standard Agent Setup requirements are revalidated.
- [ ] Generated Blob container and Cosmos native data-plane scopes can be assigned atomically at
      least privilege without preview APIs, keys, broad standing roles, or portal drift.
- [ ] The new Bicep design and preflight tests prove disabled state emits no resources and enabled
      state cannot partially succeed.
- [ ] Account/project/stores/model processing, safety systems, telemetry, backup, support, and
      control planes fit an approved geography and terms.
- [ ] Restricted data permits only a specifically approved regional deployment posture; Global or
      DataZone defaults are not inferred.

### Network, identity, state, and operations

- [ ] Private endpoints/DNS, public denial, injected networking, controlled egress, and all required
      platform endpoints are designed and tested.
- [ ] Human, deployment, account, project, hosted-agent, application, and tool identities are
      separated by duty with exact management/native data-plane roles.
- [ ] Every thread, message, file, vector, memory, index, cache, trace, evaluation, log, backup, and
      export has an approved store, region, access, retention, deletion, and recovery contract.
- [ ] Cost/token/tool limits, timeouts, cancellation, circuit breaking, rollout, disablement,
      incident containment, and deletion verification are defined.
- [ ] No “zero retention” claim is derived from one setting, deployment type, or model category.

## Deterministic local and CI contract

Foundation validation must not contact a model, Foundry endpoint, or remote evaluator. Any future
client must sit behind a typed adapter, use deterministic fixtures for results/errors/timeouts/tool
calls/safety/usage, avoid initialization at import/build time, and fail tests on unmocked network
access. Production prompts, completions, files, and traces are prohibited as fixtures.

Live evaluation or smoke invocation would require a separately authorized protected environment
after every admission gate passes; it cannot replace deterministic evidence.

## Enablement change

The first Foundry PRD must:

1. revalidate current official guidance, GA schemas, region/account eligibility, and Standard Agent
   Setup data-plane scope behavior;
2. replace—not relax—the false-only module with an atomic reviewed design;
3. update architecture, ADR, classification, residency, threat, logging, deployment, recovery, and
   deletion records before implementation;
4. add deterministic runtime contracts/mocks plus fail-closed compile/preflight tests;
5. keep model and agent selection inside approved scope rather than inferring it from
   infrastructure;
6. require a separately protected what-if/deployment authorization and environment evidence.

Until then, `enableFoundry=false`, `services/.gitkeep` remains the only service content, and all
Foundry resources and external model calls are prohibited.
