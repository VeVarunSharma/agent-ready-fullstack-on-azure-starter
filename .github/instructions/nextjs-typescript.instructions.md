---
applyTo: "apps/web/**/*.{ts,tsx}"
---

# Next.js and TypeScript

Read the relevant cataloged PRD, `ARCHITECTURE.md`, `apps/web/package.json`, and the shared package
exports before editing.

- Keep App Router code server-first; add a client boundary only for browser interaction.
- Read configuration through `@repo/env`. Keep database, identity, secret, and Azure SDK imports
  server-only and lazy.
- Preserve strict types. Do not use `any`, unsafe double casts, blanket suppression, or silent
  fallback behavior.
- Import shared contracts, data access, and UI only through `@repo/*` exports.
- Use oRPC for first-party JSON behavior. Raw handlers are limited to protocol surfaces such as
  health probes, callbacks, streams, downloads, or webhooks; a new raw JSON route needs an ADR.
- Do not add cross-replica in-memory state, ISR, or platform-specific hosting assumptions without an
  approved architecture change.

For API work, follow [the oRPC runbook](../../.copilot/skills/orpc-contracts/SKILL.md). Validate
with the web package lint/typecheck/tests and `pnpm build`.
