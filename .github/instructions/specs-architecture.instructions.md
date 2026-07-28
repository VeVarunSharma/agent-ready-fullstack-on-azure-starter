---
applyTo: "CONSTITUTION.md,ARCHITECTURE.md,specs/**/*,docs/adr/**/*,docs/architecture/**/*"
---

# Specifications and architecture

Read `CONSTITUTION.md`, `specs/README.md`, the catalog, template, relevant PRD, and
`ARCHITECTURE.md`. For PRD work, follow
[the SDD runbook](../../.copilot/skills/spec-driven-dev/SKILL.md).

- Use `pnpm spec:new`; do not create catalog records by copying a prior PRD.
- Keep frontmatter, filename, catalog identity, lifecycle, impact flags, and verification mapping
  aligned. Do not rewrite historical or superseded records.
- Update the PRD before implementation when scope changes.
- Architecture text must label behavior as implemented, scaffolded-disabled, or future based on the
  repository, not intent.
- Boundary changes update architecture in the same change; declared design, sensitive-data, and
  persistence impacts update their canonical artifacts too.

Run `pnpm spec:validate:all` and the acceptance-evidence commands named by the PRD.
