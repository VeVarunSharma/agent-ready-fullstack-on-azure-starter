---
name: drizzle-azure-postgres
description: "Change Drizzle schema and PostgreSQL migrations safely."
---

# Drizzle and Azure PostgreSQL

## Use when

- A PRD declares persistence impact.
- Changing schema source, generated migrations, pools, credentials, or database integration tests.

## Do not use when

- No approved persistence scope exists.
- Running ad hoc production repair, inventing seed/domain data, or adding a second PostgreSQL
  driver.

## Mandatory sources

- `CONSTITUTION.md`
- The relevant cataloged PRD and `ARCHITECTURE.md`
- `packages/db/package.json`, Drizzle config, schema sources, and existing migrations
- `docs/runbooks/database-bootstrap.md`
- `docs/security/DATA_CLASSIFICATION.md`, `docs/security/DATA_RESIDENCY.md`, and
  `docs/security/THREAT_MODEL.md` for stored data
- Local environment and Compose configuration when testing migrations

## Steps

1. Confirm data classification, compatibility window, rollout order, and recovery evidence.
2. Design an expand/migrate/contract sequence; separate destructive contraction from expansion.
3. Change Drizzle schema source, then generate the migration with repository commands.
4. Review generated SQL for locks, defaults, backfills, idempotency assumptions, and data movement.
5. Keep `local-password` and `azure-managed-identity` modes explicit; preserve refreshable token
   injection.
6. Apply to a local disposable database and test both migrated behavior and compatibility.
7. Record the private migration-job sequence; never attach migration execution to build or startup.

## Validation

```sh
pnpm db:generate
pnpm db:check
pnpm --filter @repo/db typecheck
pnpm test:unit
pnpm db:migrate:local
pnpm test:integration
```

The final two commands require the documented local PostgreSQL environment.

## Common failure modes

- Schema source without a generated migration, or manually authored drift from generated SQL.
- Destructive one-step changes, unsafe table rewrites, or no recovery plan.
- Static production passwords, a production `DATABASE_URL`, stale access tokens, or broad grants.
- Migrations running during framework build, image build, or app startup.
