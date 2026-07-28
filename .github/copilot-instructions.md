# Repository instructions

## Purpose and current state

This repository is a product-neutral, production-shaped application foundation. It has one neutral
web boundary and shared platform packages, but **no product behavior, domain model, roles, branded
interface, or live Foundry capability exists**. Planned or disabled surfaces must not be described
as implemented or approved for production.

## Stable stack

- Node.js 24.18.0, pnpm 11.17.0, and Turborepo 2.10.7.
- Next.js 16.2.12 App Router, React 19.2.8, strict TypeScript 6.0.3, Tailwind CSS 4.3.3, and
  shadcn-generated primitives.
- Zod 4.4.3 and aligned oRPC v1.14.10 packages for contract-first JSON APIs. oRPC v1 replaces the
  original ts-rest direction; do not reintroduce the superseded stack or use the oRPC v2 beta.
- Drizzle ORM 0.45.2 with `pg` 8.22.0 for PostgreSQL 18.
- Bicep and Azure Developer CLI configuration for offline-validatable Azure Container Apps
  infrastructure; Foundry remains disabled.

Direct dependency versions are exact and stable. Keep internal edges on `workspace:*`.

## Commands

Run the narrowest relevant command, then the aggregate gate when the change is ready:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm spec:validate:all
pnpm check
```

Broader surface checks are separate: `pnpm test:integration`, `pnpm e2e`, `pnpm docker:build`, and
the offline `pnpm infra:validate`. Database work uses `pnpm db:generate`, `pnpm db:migrate:local`,
and `pnpm db:check`. Use `pnpm build` for a production application build. Do not treat an offline
infrastructure check as authorization to provision.

## Package boundaries

- `apps/web` owns Next.js routes, handlers, composition, and application runtime wiring.
- `packages/api-contracts` owns shared request, response, status, and error contracts.
- `packages/db` owns Drizzle schema, generated migrations, pools, and database credentials.
- `packages/env` is the only environment parsing boundary.
- `packages/ui` owns reusable primitives, helpers, and executable semantic tokens.
- `packages/eslint-config` and `packages/typescript-config` own shared tool configuration.
- `services/` stays empty except for `.gitkeep` until a cataloged PRD admits a service.

Import through explicit package exports. Do not use cross-package relative imports or root
TypeScript path aliases. Add a package or dependency only for an immediate documented consumer.

## Non-negotiable workflow and safety

Read [CONSTITUTION.md](../CONSTITUTION.md) rather than copying its rules. Functional work starts
with a cataloged PRD and stays within its scope; run `pnpm spec:validate` before implementation.
Keep PRD impact declarations, architecture, design, security/residency documents, schema,
migrations, and verification evidence aligned in the same change.

Treat unresolved data, region, identity, network, retention, and production inputs as blockers.
Never commit secrets or real production identifiers. Validate trust-boundary inputs, allowlist
outputs and telemetry fields, and keep credentials, bodies, prompts, completions, and personal data
out of logs. Use managed identity and least privilege in Azure-hosted code. Keep database, identity,
secret, and Azure SDK code server-only, and never run migrations during build or application
startup.

Use the path-scoped instructions and the matching runbook under
[`.copilot/skills/`](../.copilot/skills/) for the surface being changed.
