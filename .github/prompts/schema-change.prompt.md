---
name: schema-change
description: "Plan and implement a governed forward-compatible Drizzle migration."
agent: agent
argument-hint: "Persistence-impact PRD, schema intent, rollout compatibility, and recovery needs"
---

Read the persistence-impact PRD, `ARCHITECTURE.md`, database bootstrap runbook, security/data
documents, and `.copilot/skills/drizzle-azure-postgres/SKILL.md`. Stop if persistence scope or data
classification is missing.

Design an expand/migrate/contract sequence and recovery evidence before editing. Change Drizzle
schema source, generate the migration with repository commands, review the SQL, and add tests for
both migrated behavior and the compatibility window. Never add invented seed data, a production
password, or migration execution to build/startup.

Run database generation/checks, package typecheck/unit tests, and local migration/integration checks
when the documented PostgreSQL environment is available. Report rollout order, recovery, generated
artifacts, and exact results.
