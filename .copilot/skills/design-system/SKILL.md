---
name: design-system
description: "Evolve accessible neutral UI through semantic tokens and the design contract."
---

# Design system

## Use when

- Changing shared primitives, semantic tokens, themes, interaction states, or app UI.
- A PRD declares design-system impact.

## Do not use when

- The work is backend-only.
- Adding branding, domain semantics, or a token exception without an approved PRD.

## Mandatory sources

- `CONSTITUTION.md`
- The relevant cataloged PRD
- `specs/design/DESIGN.md`
- `packages/ui/package.json` and affected `packages/ui` sources
- Affected `apps/web` composition and styles
- `ARCHITECTURE.md` when the UI boundary or delivery model changes

## Steps

1. Confirm the PRD names the UI outcome and consumed or changed tokens.
2. Reuse an existing semantic token or primitive before adding one.
3. If extension is necessary, update design intent and executable light/dark mappings together.
4. Implement in `@repo/ui`; compose from its public exports in `apps/web`.
5. Verify semantics, keyboard use, focus, contrast, reduced motion, and all interaction states.
6. Add deterministic component and accessibility coverage without inventing product content.

## Validation

```sh
pnpm --filter @repo/ui lint
pnpm --filter @repo/ui typecheck
pnpm --filter @repo/web lint
pnpm test:unit
pnpm check
```

Run `pnpm e2e` when browser interaction or rendered accessibility changes.

## Common failure modes

- Hardcoded colors, duplicated app-local primitives, or raw palette names in component APIs.
- Token CSS and `DESIGN.md` drifting apart.
- Color-only states, hidden focus, inaccessible names, or motion without a reduced alternative.
- Branding or domain-specific navigation entering the neutral foundation.
