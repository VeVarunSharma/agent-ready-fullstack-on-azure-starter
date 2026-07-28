# Data classification

The [repository constitution](../../CONSTITUTION.md) is binding. This record defines the
classification vocabulary and handling decisions used by PRDs, architecture, threat modeling,
residency, tests, and operations.

> Unclassified customer data is **Restricted**. Unknown sensitivity, ownership, purpose, or
> destination fails closed.

## Levels

| Level            | Definition                                                                                                                             | Neutral examples                                                                                                                                       | Baseline handling                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public**       | Explicitly approved for unrestricted release. Disclosure creates no confidentiality harm, but integrity and availability still matter. | Published documentation, approved open-source source, public package metadata                                                                          | Approval before publication; integrity review; no secret or personal data mixed in                                                                                   |
| **Internal**     | Nonpublic operational or engineering information intended for authorized workforce access.                                             | Draft architecture, routine CI results, non-sensitive build metadata                                                                                   | Authenticated access, least privilege, approved collaboration/storage, bounded retention                                                                             |
| **Confidential** | Information whose disclosure could materially harm a person or organization or reveal sensitive operations.                            | Nonpublic security findings, support records, business-sensitive configuration, pseudonymous personal data                                             | Need-to-know access, encryption, approved regional/retention path, access review, no public logs                                                                     |
| **Restricted**   | Highest-impact, regulated, credential, customer-content, or otherwise unapproved data. Includes unknown customer data.                 | Tokens/secrets, authentication material, customer records/content, regulated identifiers, production database data, prompts/completions until approved | Deny by default, explicit purpose/minimization, private approved paths, managed identity, field-level logging prohibition, retention/deletion and residency approval |

Classification describes confidentiality impact. Integrity, availability, legal hold, safety, and
regulatory obligations are recorded separately and may require stronger controls.

## Current repository data

| Data                                                                         | Classification                                                               | Current location/use                                   |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| Source and public-facing foundation documentation                            | Internal until publication is approved; then Public copy only                | Git/GitHub                                             |
| Security findings and threat analysis                                        | Confidential                                                                 | Private review/reporting channels                      |
| CI/build logs and test results                                               | Internal unless they contain a finding, identifier, or accidental secret     | GitHub/runner according to workflow settings           |
| Synthetic fixtures and local test records                                    | Internal                                                                     | Developer/CI environment; never copied from production |
| UI theme token vocabulary                                                    | Public                                                                       | Source/CSS                                             |
| A person's selected UI theme                                                 | Restricted until a product PRD classifies it; synthetic local value Internal | Browser localStorage only; not sent to the server      |
| Correlation, trace, and span IDs                                             | Internal; Confidential when linkable to a person/incident                    | Runtime logs/telemetry only                            |
| Tenant, client, object, subscription, resource, DNS, and network identifiers | Confidential unless explicitly approved otherwise                            | Environment configuration and control planes           |
| Tokens, cookies, passwords, certificates, authorization headers              | Restricted                                                                   | Memory/approved secret stores only; never telemetry    |
| Future customer data, uploads, prompts, completions, evaluations, threads    | Restricted until a PRD classifies fields and approvals permit processing     | No current flow                                        |

The repository contains no approved product/customer dataset or production secret.

## Classification procedure

Every PRD and material data flow must record:

1. field/data-set owner and purpose;
2. source, subject, and expected volume;
3. classification for each field or the highest class applied to the whole record;
4. collection and derived/inferred values;
5. processors, stores, indexes, caches, telemetry, backups, exports, and support access;
6. region, replication, retention, deletion, restoration, and legal-hold behavior;
7. identities and least-privilege readers/writers;
8. evidence and the owner who approves any exception.

Mixed data inherits the highest classification unless fields are demonstrably separated end to end.
Hashing, tokenization, encryption, or pseudonymization does not automatically lower classification.
Derived data may be equally or more sensitive than its source.

## Handling matrix

| Control            | Public                                    | Internal                 | Confidential                               | Restricted                                                           |
| ------------------ | ----------------------------------------- | ------------------------ | ------------------------------------------ | -------------------------------------------------------------------- |
| Collection         | Approved publication purpose              | Documented work purpose  | Explicit necessity and minimization        | PRD necessity, field inventory, deny-by-default                      |
| Access             | Public after approval                     | Authenticated workforce  | Need-to-know group/identity                | Named workload/human duties; frequent review                         |
| Transit            | HTTPS for repository/runtime distribution | Encrypted                | Encrypted over approved path               | Encrypted, private path where supported, controlled egress           |
| At rest            | Integrity-protected                       | Approved managed store   | Encryption and approved store              | Approved regional store, encryption, no local/shared-key fallback    |
| Secrets            | Never applicable as Public                | Must not be embedded     | Secret manager when credential-like        | Key Vault/ephemeral token only                                       |
| Logs               | Public event only if intentional          | Allowlisted metadata     | Minimized/pseudonymous fields              | Payload and credential fields prohibited                             |
| Nonproduction      | May use approved public data              | Synthetic preferred      | Synthetic/de-identified only with approval | Production copies prohibited without explicit governed process       |
| External processor | Publication approval                      | Recorded processor       | Security/privacy/residency review          | Explicit terms, region, retention, deletion, and support approval    |
| Retention          | Publication lifecycle                     | Named operational period | Minimum approved period                    | Field/store-specific period and verified deletion                    |
| Disposal           | Remove stale copy                         | Controlled deletion      | Verified deletion/access removal           | Verified primary, replica, cache, backup, and derived-data treatment |

## Logging rule

Classification does not authorize logging. Request/response bodies, tokens, cookies, authorization
headers, query-string personal data, uploads, prompts, completions, and unrestricted free text are
prohibited from telemetry at every level. See [Logging and telemetry](LOGGING_AND_TELEMETRY.md).

## Reclassification

Lowering a classification requires the data owner, security/privacy review, evidence that every copy
and derivative qualifies, and same-change updates to the PRD, residency matrix, threat model,
access, retention, and tests. Raising classification takes effect immediately and blocks
noncompliant flows until repaired.
