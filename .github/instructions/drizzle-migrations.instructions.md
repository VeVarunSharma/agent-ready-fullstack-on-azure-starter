---
applyTo: "packages/db/**/*"
---

# Drizzle and PostgreSQL

Read the persistence-impact PRD, `ARCHITECTURE.md`, `docs/runbooks/database-bootstrap.md`, and
[the database runbook](../../.copilot/skills/drizzle-azure-postgres/SKILL.md).

- Use only Drizzle's `node-postgres` adapter and the existing `pg` pool boundary.
- Change schema source and generated migration artifacts together. Use expand/migrate/contract and
  record compatibility plus recovery.
- Never invent domain tables, enums, seed data, or repair SQL outside approved scope.
- Local password mode is local-only. Azure-hosted access uses an explicit managed identity and a
  refreshable PostgreSQL token.
- Never run migrations from Next.js build, image build, or application startup.

Run `pnpm db:generate`, `pnpm db:check`, package typecheck/tests, and the separate integration suite
when PostgreSQL behavior changes.
