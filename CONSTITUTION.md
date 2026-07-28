# Repository Constitution

**Version:** 1.0.0  
**Effective:** 2026-07-26  
**Status:** Binding

## 1. Authority and scope

This constitution is the canonical governance source for this repository. It binds code,
configuration, infrastructure, specifications, documentation, automation, and generated artifacts.
When another repository document conflicts with it, this document prevails. Supporting documents
must link here rather than reproduce its policy text.

“Must,” “must not,” “required,” and “prohibited” are normative. A functional change is any change
that alters observable application behavior, a public or internal contract, data processing,
persistence, authorization, runtime configuration, deployment behavior, or an operational control.

## 2. Binding principles

### Principle 1: Specification precedes functional code

Every functional change must be described by a cataloged PRD in the same pull request before its
implementation is accepted. The PRD must identify scope, exclusions, affected files, risk-bearing
impacts, and verifiable acceptance criteria. Implementation must not silently exceed the approved
scope. Discovered scope changes require the PRD to change first.

There is one exception: the initial repository-foundation bootstrap may establish governance,
tooling, neutral package boundaries, and validation before the first product PRD exists. That
exception ends when the bootstrap change is merged and cannot authorize product behavior.

### Principle 2: Security, privacy, and data minimization are defaults

Designs must begin deny-by-default and collect, process, retain, expose, and replicate only the
minimum data required by an approved specification. Secrets and credentials must never be committed.
Inputs crossing trust boundaries must be validated. Outputs and errors must be allowlisted and must
not disclose internals. Security or privacy controls may not be deferred merely for convenience.

### Principle 3: Data classification and residency are explicit

Every new data flow must classify its data and identify where processing, storage, telemetry,
backup, support access, and control-plane activity occur. Unclassified customer data is treated as
Restricted. Unknown jurisdictions, regions, replication paths, retention behavior, or identity
audiences fail closed. No document or implementation may claim residency until every relevant
regional and nonregional dependency is recorded and approved.

### Principle 4: Contracts are typed and TypeScript remains strict

Shared contracts are the source of truth for request, response, status, and error shapes. Clients
import contracts rather than duplicate data-transfer types. Runtime input validation is required at
external boundaries. TypeScript strictness, including unchecked-index and optional-property safety,
must not be weakened locally. `any`, unsafe double casts, broad error suppression, unvalidated
environment reads, and package-boundary path aliases are prohibited.

### Principle 5: Production infrastructure is reproducible as code

Production infrastructure and material configuration must be represented in reviewed, compile-valid
infrastructure as code. Portal-only drift is prohibited. Unknown production inputs remain explicit
parameters and deployment preflight must reject them. Infrastructure validation may run offline;
provisioning requires separate authorization and may never be implied by successful compilation.

### Principle 6: Managed identity and least privilege govern access

Azure service-to-service access uses managed identity where supported. Human, workload, migration,
and automation identities must be distinct when their duties differ. Permissions are granted at the
narrowest practical scope, broad ownership is prohibited, and authorization remains application
owned and deny-by-default. Static production database passwords and long-lived CI credentials are
prohibited.

### Principle 7: The design system and accessibility are contracts

User-interface changes must consume semantic design tokens and comply with the repository design
contract. New tokens or exceptions require a same-change design update. Interfaces must target WCAG
2.2 AA, keyboard operation, visible focus, understandable states, sufficient contrast, reduced
motion, and appropriate semantics. Branding and domain-specific design may be introduced only by an
approved PRD.

### Principle 8: Acceptance criteria are tested

Every PRD acceptance criterion must map one-to-one to an automated test, a deterministic CI check,
or an explicit manual verification step with reproducible evidence. “Looks good,” unrecorded ad hoc
testing, and aspirational criteria are not verification. Fast deterministic checks must gate every
pull request; environment-dependent suites remain separate but mandatory for the changes they cover.

### Principle 9: Database changes are safe and forward-only

Persistence changes require reviewed schema source and generated migrations in the same change.
Migrations must follow expand/migrate/contract practices, preserve compatibility during rollout, and
have an explicit recovery plan. Application startup, image builds, and framework builds must never
run migrations. Destructive rollback assumptions, invented seed data, and unreviewed production data
repair are prohibited.

### Principle 10: Observability is structured and PII-safe

Telemetry uses structured event names, opaque identifiers, severity, and trace correlation with an
allowlist of properties. Request or response bodies, tokens, cookies, authorization headers,
query-string PII, uploaded content, prompts, completions, and unrestricted free text must not be
logged. Retention, access, export, and regional destinations require explicit approval appropriate
to the data classification.

### Principle 11: Architecture changes update architecture documentation

A change to a component, package boundary, data store, trust boundary, integration, network path,
identity responsibility, deployment surface, or failure assumption must update `ARCHITECTURE.md` in
the same pull request. Sensitive-data-flow changes also update the threat model and residency
matrix. Documentation must distinguish implemented, scaffolded-disabled, and future behavior and
must never describe a planned control as active.

### Principle 12: Dependencies and packages stay lean

A dependency, workspace, service, or tool is added only for an immediate, documented consumer and
after built-in or existing options are considered. Direct dependency versions are exact and stable;
prerelease packages, floating tags, peer overrides, duplicate platform clients, and speculative
packages are prohibited. Internal imports use explicit package exports and `workspace:*` edges.
Removal is preferred when a dependency no longer has a justified consumer.

## 3. Specification governance

The catalog at `specs/PRDs/index.json` is the inventory of product specifications. A catalog entry
and its document are one governed record.

- `active` means approved work is in progress.
- `current` means the version is the authoritative implemented behavior.
- `historical` means the record is retained for context and is no longer operative.
- `superseded` means a later cataloged version replaces it; `supersededBy` is mandatory.

Historical and superseded documents and their catalog metadata are immutable. Corrections require a
new version that explains the prior record; history must not be rewritten. PRD filenames, versions,
metadata, sections, and verification mappings are enforced by repository tooling.

Impact declarations in a PRD are binding:

- Architecture impact requires a same-pull-request `ARCHITECTURE.md` update.
- Design-system impact requires a same-pull-request `specs/design/DESIGN.md` update.
- Sensitive-data impact requires same-pull-request threat-model and residency updates.
- Persistence impact requires same-pull-request schema and generated migration changes.

## 4. Review and enforcement

Authors are responsible for running the root checks documented in `CONTRIBUTING.md`. Reviewers must
evaluate the specification before implementation details and reject changes that evade package,
security, residency, accessibility, migration, or documentation boundaries. Automated checks are
enforcement, not substitutes for review.

An implementation defect does not justify weakening a rule or test. Fix the defect, narrow the
change, or amend governance transparently. Material risk acceptance must identify an owner,
rationale, compensating control, and expiry in the relevant PRD and architecture decision; it cannot
waive legal, privacy, or security obligations.

## 5. Amendments

Constitution amendments require a dedicated, reviewable change that:

1. states the problem and affected principles;
2. describes migration or enforcement consequences;
3. updates dependent tooling and concise guidance in the same change;
4. increments this document’s semantic version; and
5. records the approval date.

Removing or weakening a binding safeguard is a major version change. Adding a compatible principle
or material requirement is minor. Clarifying wording without changing obligations is patch.

## 6. Compliance statement

Merge approval asserts that the change complies with the current constitution, its cataloged PRD
when required, and all applicable verification gates. Compliance with this repository constitution
does not by itself establish production authorization, regulatory approval, or deployment readiness.
