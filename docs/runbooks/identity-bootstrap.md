# Identity bootstrap

This runbook defines the unresolved identity decisions and verification required before the
scaffolded Container Apps authentication boundary can be used.

> No identity provider, audience, tenant, application registration, secret, callback domain, allowed
> identity, or Azure resource is configured. Do not execute cloud steps without separate
> authorization.

## Responsibility split

| Layer                                  | Responsibility                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Application Gateway                    | Public TLS/WAF, approved public host/scheme forwarding, removal of inbound platform identity headers, private backend path |
| Container Apps built-in authentication | OIDC redirect, token validation, nonce/cookie handling, admitted identity policy, trusted principal-header injection       |
| Application principal normalizer       | Strictly decode and validate header shape, HTTPS issuer, subject, and name identifier                                      |
| Application authorization              | Decide each permitted action server-side and deny absent/malformed/unknown/insufficient principals                         |
| OIDC/Entra tenant                      | Identity lifecycle, credential/app registration, MFA/conditional access, sign-in/audit, token issuance                     |

The implemented normalizer is not authentication by itself and no application authorization policy
exists.

## Delivery identity separation

Application/provider identity, Azure workload managed identities, and GitHub delivery identities are
different trust domains. The manual workflows require four distinct UUID-shaped client IDs:

| Protected variable                  | Narrow delivery duty                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `AZURE_WHAT_IF_CLIENT_ID`           | ARM read/what-if and sanitized plan evidence for foundation, migration, and application stages              |
| `AZURE_REGISTRY_PUSH_CLIENT_ID`     | Private ACR publication, digest proof, and tag/manifest immutability operations only                        |
| `AZURE_INFRA_DEPLOY_CLIENT_ID`      | Create/update only the reviewed foundation, migration-job, and inactive-application IaC stages              |
| `AZURE_MIGRATION_RUNTIME_CLIENT_ID` | Start/inspect migration execution; inspect/shift/restore revisions and ingress; query rollout Log Analytics |

The workflow rejects reused client IDs and binds all four IDs, tenant, subscription, source,
configuration, template, image digest, and same-run what-if evidence through the artifact chain. The
monitoring query client ID in production configuration must equal the migration/runtime client ID.
That delivery identity never becomes the PostgreSQL principal; the Container Apps Job obtains its
database token through the separately assigned migration managed identity.

These workflows do **not** create the GitHub protected `production` environment, federated identity
credentials, identity objects, or all role grants. Environment administrators must separately prove:

1. required reviewers and default-branch protection for the exact environment/workflow trust;
2. one narrowly matched FIC per client identity, with the intended GitHub issuer/audience/subject
   and no pull-request or fork trust;
3. least-privilege ARM and native data-plane roles at the smallest scope for each duty, with
   explicit denial of the other three duties;
4. an isolated, patched, ephemeral/cleaned `production-vnet-runners` pool whose labels are protected
   and whose private DNS/routes reach only approved Azure paths;
5. audit, rotation/revocation, incident, and break-glass ownership.

Tokenless acceptance can use the pinned GitHub-hosted runner, but it has no `id-token: write`. Every
job that logs into Azure, including what-if and monitoring query, requires the protected
VNet-connected runner. A label, workflow file, or UUID alone is not evidence of any external
control.

## Admission prerequisites

- A cataloged PRD identifies the user audience and data classification.
- The decision chooses workforce Microsoft Entra, Entra External ID, or another custom OIDC
  provider.
- Identity/security/privacy owners approve tenant/provider geography, terms, claims, support access,
  logs, retention, and deletion.
- The public DNS host and certificate lifecycle are approved.
- Application Gateway is the only reachable app ingress.
- Identity tenant objects are represented by reviewed automation or an approved immutable
  configuration source. Portal-only creation or edits are prohibited.
- Production preflight, protected OIDC workflow, private delivery path, and operator duties are
  approved.

## Resolve configuration

Record these values without committing production identifiers:

| Configuration                         | Decision                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `auth.provider`                       | `microsoftEntra` or `customOidc`                                                           |
| `auth.issuer`                         | Exact HTTPS issuer; tenant-specific for Entra                                              |
| `auth.audience`                       | Token audience accepted by this application only                                           |
| `auth.tenantId`                       | Approved tenant UUID                                                                       |
| `auth.clientId`                       | OIDC application/client UUID                                                               |
| `auth.clientSecretKeyVaultUrl`        | Versioned Key Vault secret URL when a confidential client credential is required           |
| `auth.allowedIdentities`              | Explicitly admitted object/subject identifiers; at least one required by current preflight |
| `auth.allowedClientApplications`      | Explicit client allowlist or reviewed empty-set semantics                                  |
| `auth.allowedGroups`                  | Explicit group allowlist or reviewed empty-set semantics                                   |
| `auth.callbackUrls`                   | HTTPS callbacks/allowed redirects on the public host only                                  |
| `dns.publicHost` / `dns.callbackHost` | Same approved Application Gateway host                                                     |
| `auth.forwardedHostTrustApproved`     | Approval evidence after the forwarding design is verified                                  |
| Cookie/nonce/scopes/name claim        | Minimum values for the selected provider and audience                                      |

Do not use a multitenant/common issuer unless an approved architecture and authorization design
constrains tenants and issuers explicitly.

## Callback and logout contract

Use only the external HTTPS origin:

- Entra callback/reply URL: `https://<public-host>/.auth/login/aad/callback`
- Custom OIDC callback/reply URL:
  `https://<public-host>/.auth/login/<custom-provider-name>/callback`
- Container Apps logout endpoint: `https://<public-host>/.auth/logout`
- Any provider post-logout or `post_logout_redirect_uri` value must also be an explicitly registered
  HTTPS URL on `<public-host>`.

Verify the exact provider-specific callback emitted by Container Apps against current Microsoft
documentation and the deployed auth configuration. `auth.callbackUrls` in Bicep also feeds allowed
external redirects; do not treat that property alone as proof that the provider registration is
correct. Wildcard, HTTP, internal Container Apps FQDN, and unapproved alternate-host callbacks are
prohibited.

## Application Gateway trust contract

The current Bicep intends to:

1. listen only on the approved public host over HTTPS;
2. connect to the internal Container App FQDN over HTTPS with certificate-chain, expiry, and SNI
   validation;
3. overwrite `X-Forwarded-Host` with `<public-host>`;
4. overwrite `X-Forwarded-Proto` with `https`;
5. clear inbound `X-MS-CLIENT-PRINCIPAL`, `X-MS-CLIENT-PRINCIPAL-ID`, and
   `X-MS-CLIENT-PRINCIPAL-NAME`;
6. restrict app ingress to the Application Gateway subnet;
7. let Container Apps authentication inject its own trusted principal header after gateway
   processing.

Container Apps auth uses the `Standard` forward-proxy convention. Never trust a forwarded or
platform identity header on a route reachable outside this chain. Do not weaken the app IP
restriction or expose a second direct host for troubleshooting.

## Key Vault credential reference

If the selected OIDC client requires a secret:

1. generate it through approved identity-tenant automation;
2. place it directly in the deployment Key Vault through an approved bootstrap path;
3. pass only a versioned URL of the form `https://<vault>.vault.azure.net/secrets/<name>/<version>`;
4. grant the app managed identity only Key Vault Secrets User at the vault/currently narrower
   practical scope;
5. record owner, expiry, overlap rotation, revocation, and recovery;
6. confirm the value never appears in Git, workflow inputs/output, ARM deployment history, Container
   Apps plain settings, or logs.

Prefer certificate/federated client authentication when the selected provider and Container Apps
feature support it and a later review approves the lifecycle. “Passwordless production” does not
mean an OIDC confidential client can omit a provider-required credential.

## Offline validation

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm infra:validate
node infra/scripts/preflight.mjs \
  --config infra/environments/production.config.json \
  --expect-failure
```

The checked-in production fixture must fail. For a real candidate, use the approved external
configuration path and run the same script without `--expect-failure`. Never replace the checked-in
fixture with production identifiers.

Preflight verifies shape and fail-closed decisions; it cannot verify tenant ownership, redirect
registration, token claims, header ordering, or actual ingress isolation.

## Manual OIDC what-if

After offline approval:

1. Use only the protected manual infrastructure-plan workflow.
2. Authenticate to Azure with GitHub workload identity federation; no client secret.
3. Bind the federated subject to the exact repository, workflow/ref, and protected environment.
4. Run preflight before login/what-if and review every auth config, Key Vault reference, role
   assignment, ingress rule, DNS/TLS value, and public-access property.
5. Save the reviewed what-if evidence in the approved system without tokens or secret values.
6. Stop on replacement, public exposure, unexpected tenant/resource, or ignored change.

What-if is read-only planning, not permission to deploy.

## Post-deployment verification

Run only in an authorized nonproduction environment before production acceptance.

1. Query the resource/auth configuration read-only and compare it to Bicep and approved inputs.
2. Confirm public access reaches Application Gateway and the Container App is not directly
   reachable.
3. Send an arbitrary forged `X-MS-CLIENT-PRINCIPAL` header to the public host. It must not
   authenticate or reach the app as a trusted principal.
4. Request `/` without authentication and confirm the selected provider redirect uses the exact
   public HTTPS host and expected issuer/client.
5. Complete login with each allowed identity class and confirm Container Apps injects a header the
   normalizer accepts.
6. Test an unlisted identity, wrong tenant/issuer/audience, malformed token/header, replay/expired
   token, and direct backend request; all must fail closed.
7. Confirm health routes expose no identity detail and the platform exclusion is intentional.
8. Exercise logout and post-logout redirect; confirm cookies are cleared and no alternate host is
   accepted.
9. Inspect only allowlisted telemetry. Tokens, cookies, claims, full URLs/query strings, and
   principal headers must be absent.
10. Record issuer/audience/claim evidence without copying token values.

There is no product-protected route yet. The first product PRD must add authorization tests that
prove authenticated-but-unapproved principals are denied.

## Runtime/IaC contract verification

The current IaC and runtime agree on `RUNTIME_MODE=production`,
`DATABASE_MODE=azure-managed-identity`, `AUTH_MODE=container-apps`, `LOGGING_MODE=json`, and
`TELEMETRY_MODE=disabled`, plus the required database host/port/name/user and assigned
`AZURE_CLIENT_ID`. The staged workflow reads the deployed candidate/job and rejects a mismatch,
`DATABASE_PASSWORD`, `APPLICATIONINSIGHTS_CONNECTION_STRING`, or OTLP endpoint before migration or
traffic.

Continue comparing every Container Apps value with
[`packages/env/src/schemas.ts`](../../packages/env/src/schemas.ts) in the same governed change. Do
not loosen validation or introduce a second spelling/default to work around readiness.

## No portal drift

- Do not create/edit app registrations, redirect URIs, secrets, auth config, role assignments, or
  ingress settings only in a portal.
- Emergency changes need an incident record, named approver, expiry, and immediate reconciliation in
  reviewed automation/IaC before normal operation resumes.
- Read-only portal/API inspection may collect evidence after separate authorization; it is not a
  configuration source.
