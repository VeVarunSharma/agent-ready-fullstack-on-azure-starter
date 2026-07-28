# Agent-ready full-stack on Azure starter

> **WARNING — NOT YET PRODUCTION CONFIGURED.** No Azure resource has been provisioned and no
> delivery workflow run is evidenced. Production regions, identity audience, DNS/TLS, SKUs, egress,
> monitoring posture, PostgreSQL principal bootstrap, private-runner controls, residency approvals,
> and recovery objectives are unresolved. Offline-valid Bicep and checked-in workflows are not
> deployment readiness.

> **SCOPE —** “Agent-ready” means architecture readiness for future agent work; no model or agent is
> included. Foundry is false-only and nondeployable, and Application Insights export is disabled.

This repository is a lean, production-shaped foundation for a future application. It has one
runnable Next.js TypeScript app, shared oRPC v1 contracts, accessible semantic UI tokens, an empty
Drizzle/PostgreSQL boundary, local tests/container tooling, governed specifications, and
scaffolded-disabled Azure infrastructure. It defines no product behavior, brand, role, permission,
user model, or Foundry agent.

## Use this repository as a template

After enabling **Template repository** under the GitHub repository's **Settings > General**, select
**Use this template > Create a new repository** to copy the complete tracked foundation without its
Git history.

In each repository created from the template:

1. Replace this README's title and description with the new product context.
2. Review the production blockers and governance records before adding product behavior.
3. Follow the local quickstart below and create a governed PRD for each functional change.

## Prerequisites

- Node.js `24.18.0`
- Corepack `0.35.0`
- pnpm `11.17.0`
- Git
- Docker with Compose v2 for local PostgreSQL/integration/image checks

## Local quickstart

From the repository root:

```sh
corepack enable
corepack prepare pnpm@11.17.0 --activate
pnpm install --frozen-lockfile

cat > apps/web/.env.local <<'EOF'
RUNTIME_MODE=local
DATABASE_MODE=local-password
AUTH_MODE=disabled
LOGGING_MODE=json
TELEMETRY_MODE=disabled
NEXT_PUBLIC_RUNTIME_MODE=local
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=foundation_local
DATABASE_USER=foundation_local
DATABASE_PASSWORD=local-only-do-not-use-in-production
DATABASE_POOL_MAX=4
DATABASE_PROBE_TIMEOUT_MS=2000
EOF

docker compose up -d --wait
pnpm db:migrate:local
pnpm dev
```

Open <http://localhost:3000>. The local credential above is intentionally obvious, bound to the
Compose-only database on `127.0.0.1`, and must never be reused.

Available protocol surfaces:

- `GET /health/live` — process liveness only
- `GET /health/ready` — validated configuration and database connectivity when enabled
- `GET /api/v1/health` — oRPC v1 contract/handler pipeline

`DATABASE_PROBE_TIMEOUT_MS` bounds only the readiness `select 1`. Readiness reuses a dedicated
single-connection pool and token provider, gives a cold connection up to 10 seconds, and discards
the pool after a connection or query failure. Runtime queries do not inherit the probe timeout.
Local and production migrations use a separate max-one pool with a 30-second connection budget and
no blanket query or statement duration limit.

Stop the app with `Ctrl-C`, then stop PostgreSQL:

```sh
docker compose down
```

To remove the local PostgreSQL volume as well:

```sh
docker compose down --volumes
rm -f apps/web/.env.local
```

The home page can run without Azure credentials. Authentication is disabled only in explicit local
configuration; this is not a production bypass.

Production does not use these local values. Its exact database mode is
`DATABASE_MODE=azure-managed-identity`; the image contains `migration/dist/migrate-production.mjs`
for the protected, manually triggered migration job. Do not invoke that entrypoint locally or as
part of application startup.

## Validation

Fast deterministic pull-request checks:

```sh
pnpm check
```

Individual commands:

| Command                             | Purpose                                                  |
| ----------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                          | Run persistent workspace development tasks               |
| `pnpm build`                        | Build packages and the standalone Next.js app            |
| `pnpm lint`                         | Run shared ESLint and hardcoded-color policy             |
| `pnpm deps:audit`                   | Reject ranges, lock drift, and resolved prereleases      |
| `pnpm typecheck`                    | Run strict TypeScript checks                             |
| `pnpm test` / `pnpm test:unit`      | Run deterministic unit/component tests                   |
| `pnpm format` / `pnpm format:check` | Write/check Prettier formatting                          |
| `pnpm spec:new -- <args>`           | Scaffold and catalog a governed PRD                      |
| `pnpm spec:validate`                | Validate the changed specification set                   |
| `pnpm spec:validate:all`            | Validate the full specification set                      |
| `pnpm db:generate`                  | Generate Drizzle migrations from the schema              |
| `pnpm db:migrate:local`             | Apply migrations to the explicit local database          |
| `pnpm db:check`                     | Check Drizzle migration consistency                      |
| `pnpm db:studio`                    | Open local Drizzle Studio                                |
| `pnpm infra:validate`               | Format/lint/compile Bicep and test preflight offline     |
| `pnpm docker:build`                 | Build the non-root standalone image from repository root |

Environment-dependent checks stay separate:

```sh
docker compose up -d --wait
pnpm db:migrate:local
pnpm test:integration

pnpm --filter @repo/web exec playwright install chromium
pnpm e2e
pnpm docker:build
```

`pnpm e2e` builds and starts the standalone app with the database disabled, then runs neutral smoke,
axe WCAG, and post-switch light/dark/system contrast checks. Theme colors change without a
transition so no animated intermediate can create a transient contrast failure. It makes no Azure or
external model call.

## Repository map

| Path                                                        | Owner                                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`apps/web`](apps/web/)                                     | Next.js routes, oRPC handlers/client, health, auth parsing, runtime wiring |
| [`packages/api-contracts`](packages/api-contracts/)         | Versioned oRPC v1/Zod contracts and safe envelopes                         |
| [`packages/db`](packages/db/)                               | Empty Drizzle schema, migrations, `pg` pools, Entra token adapter          |
| [`packages/env`](packages/env/)                             | Only environment parsing boundary                                          |
| [`packages/ui`](packages/ui/)                               | Shared primitives and executable semantic light/dark tokens                |
| [`packages/eslint-config`](packages/eslint-config/)         | Shared flat ESLint rules                                                   |
| [`packages/typescript-config`](packages/typescript-config/) | Shared strict TypeScript configurations                                    |
| [`services`](services/)                                     | Reserved; `.gitkeep` only until an approved PRD admits a service           |
| [`infra`](infra/)                                           | Offline-compiled Bicep, synthetic/incomplete inputs, fail-closed preflight |
| [`.github/workflows`](.github/workflows/)                   | Deterministic CI plus guarded, unexecuted Azure plan/deploy candidates     |
| [`.copilot/skills`](.copilot/skills/)                       | Repository-local agent skills                                              |
| [`specs`](specs/)                                           | Empty product PRD catalog, templates/tooling, design contract              |
| [`docs`](docs/)                                             | ADRs, security/residency records, readiness and operator runbooks          |
| [`Dockerfile`](Dockerfile)                                  | Root-context standalone non-root production-shaped image                   |
| [`compose.yaml`](compose.yaml)                              | Local-only PostgreSQL 18 service and persistent development volume         |

Workspace imports use explicit `@repo/*` package exports. First-party JSON APIs use stable **oRPC
v1.14.10**, not the superseded ts-rest direction or the oRPC v2 beta. ESLint `9.39.5` is the newest
stable peer-compatible line for this workspace; the incompatible ESLint 10 baseline was deliberately
not selected. shadcn-generated configuration and component patterns are retained without installing
the shadcn CLI. The dependency audit confirms zero resolved semantic-version prereleases. These are
resolved tooling choices, not open failures.

## Architecture and governance

- [Constitution](CONSTITUTION.md) — binding repository rules
- [Architecture](ARCHITECTURE.md) — implemented, scaffolded-disabled, and future system shape
- [Security](SECURITY.md) — security posture and canonical records
- [Design contract](specs/design/DESIGN.md) — semantic UI/accessibility contract
- [Contributing](CONTRIBUTING.md) — PRD-first workflow and commands
- [ADR-0001](docs/adr/0001-platform-foundation.md) — platform foundation decisions
- [Deployment runbook](docs/runbooks/deployment.md) — explicit production blockers and sequencing
- [Foundry readiness](docs/architecture/FOUNDRY_READINESS.md) — closed admission gate

The Azure target is a regional Application Gateway WAF in front of an internal Container Apps
environment, with private ACR, Key Vault, PostgreSQL Flexible Server, a separate migration job,
regional private Log Analytics routing, managed identities, private DNS/endpoints, and controlled
egress. Application Insights and AMPLS are scaffolded-disabled and no application connection string
or trace exporter is wired. Foundry is a false-only, nondeployable boundary that emits no resources,
DNS, RBAC, requirements, model, or agent. All Azure surfaces remain undeployed.

## Before product work

After the bootstrap merges, every functional change requires a same-change active/current cataloged
PRD. Validation fails closed for source, manifests, lockfiles, configuration, styles, IaC,
workflows, Copilot instructions/skills, unknown paths, deletions, and both sides of renames; only
narrowly recognized documentation and harmless metadata are exempt. Boundary changes update
architecture in the same change; design, sensitive-data, and persistence impacts update their
canonical artifacts. Unknown customer data is Restricted, and unresolved region/identity/retention
decisions fail closed.

Do not run `azd up`, dispatch the production workflow, provision Azure, enable Foundry, or use a
live model as part of ordinary setup or validation. The workflow definitions require four distinct
OIDC client identities, but their protected environment, federated credentials, Azure RBAC, and
isolated VNet-connected runner are external controls that this repository does not create or prove.
