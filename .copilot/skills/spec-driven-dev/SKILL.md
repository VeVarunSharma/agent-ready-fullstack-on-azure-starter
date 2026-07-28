---
name: spec-driven-dev
description: "Govern cataloged PRDs and align scope, impacts, implementation, and evidence."
---

# Spec-driven development

## Use when

- A change alters behavior, contracts, persistence, runtime configuration, deployment, or controls.
- Creating, superseding, validating, or implementing a PRD.

## Do not use when

- The change is demonstrably nonfunctional documentation or formatting only.
- Trying to justify code already written or rewrite an immutable historical record.

## Mandatory sources

- `CONSTITUTION.md`
- `specs/README.md`, `specs/PRDs/index.json`, and `specs/templates/PRD_TEMPLATE.md`
- The relevant cataloged PRD, if one exists
- `ARCHITECTURE.md` and each canonical document selected by the PRD impact flags

## Steps

1. Classify the change using the constitution; stop functional work if no valid PRD exists.
2. Inspect the catalog, then scaffold with `pnpm spec:new -- <arguments>` rather than copying a PRD.
3. Replace every marker; define scope, exclusions, affected files, impacts, and testable criteria.
4. Map each acceptance criterion exactly once to automated, CI, or reproducible manual evidence.
5. Run spec validation before implementation.
6. Implement only the recorded scope. Update the PRD first when discovery changes that scope.
7. Update all impact-selected documents and artifacts in the same change, then collect evidence.

## Validation

```sh
pnpm spec:validate
pnpm spec:validate:all
pnpm check
```

Also run every command named in the PRD verification table.

## Common failure modes

- Handwritten catalog identity, stale frontmatter, placeholders, or duplicate acceptance mappings.
- An implementation that exceeds scope or precedes its PRD.
- Editing historical/superseded records instead of creating a new version.
- Declaring an impact without updating its architecture, design, security, or persistence artifacts.
