---
applyTo: "packages/ui/**/*,apps/web/src/**/*.css,apps/web/src/**/*.tsx"
---

# UI and design tokens

Read the relevant PRD, `specs/design/DESIGN.md`, and
[the design-system runbook](../../.copilot/skills/design-system/SKILL.md).

- Consume semantic tokens from `@repo/ui`; do not add hardcoded presentation colors or duplicate
  primitives in the app.
- Keep design intent and executable token mappings synchronized in the same change.
- Preserve keyboard operation, visible focus, semantic markup, contrast, reduced motion, and
  understandable loading, empty, and error states.
- Keep the foundation neutral. Branding, domain navigation, status semantics, and product-specific
  components require an approved PRD and design-contract update.

Run UI and web lint/typecheck/tests, then `pnpm check`.
