# Contributing

Read the binding [repository constitution](CONSTITUTION.md) before making changes. This guide
describes the workflow; it does not replace or restate the constitution.

## Prerequisites

- Node.js `24.18.0`
- Corepack `0.35.0`
- pnpm `11.17.0`
- Git

Use `.nvmrc` or `.node-version` to select Node, then activate the package manager:

```sh
corepack enable
corepack prepare pnpm@11.17.0 --activate
pnpm install --frozen-lockfile
```

Do not regenerate the lockfile with a different Node or pnpm version.

## Change workflow

1. Classify the change as documentation/tooling-only or functional using the definition in the
   constitution.
2. For functional work, create the PRD before implementation:

   ```sh
   pnpm spec:new -- \
     --version 1 \
     --name EXAMPLE_CAPABILITY \
     --title "Example capability" \
     --summary "Concise purpose and intended outcome." \
     --owner "@responsible-owner" \
     --classification Internal
   ```

3. Replace every generated template marker. Keep the catalog metadata and document frontmatter
   aligned.
4. Run `pnpm spec:validate` before writing functional code.
5. Implement only the cataloged scope through explicit workspace exports.
6. Update the documents and generated artifacts selected by the PRD impact fields.
7. Run `pnpm check`. Run integration, browser, image, or infrastructure checks separately when the
   changed surface requires them.

New product work starts at V1. Do not create a PRD by copying an older file; use the generator so
identity and catalog checks run before files are written.

## Workspace boundaries

The only workspace globs are `apps/*`, `packages/*`, and `services/*`. Every workspace has a
manifest and narrow exports. Internal dependencies use `workspace:*`; source must not reach across a
package with relative imports or TypeScript path aliases.

`services/` is reserved and contains only `.gitkeep` until a PRD justifies a service. New packages
need an immediate consumer and a documented reason.

## Commands

| Command                  | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `pnpm dev`               | Run persistent development tasks                                  |
| `pnpm build`             | Build workspaces in dependency order                              |
| `pnpm lint`              | Run shared flat ESLint rules                                      |
| `pnpm typecheck`         | Run strict TypeScript checks                                      |
| `pnpm test:unit`         | Run deterministic unit tests                                      |
| `pnpm test:integration`  | Run environment-dependent integration tests                       |
| `pnpm e2e`               | Run browser tests                                                 |
| `pnpm format`            | Apply Prettier                                                    |
| `pnpm format:check`      | Check formatting without writes                                   |
| `pnpm spec:new`          | Scaffold and catalog a PRD                                        |
| `pnpm spec:validate`     | Validate the catalog, documents, and available Git policy context |
| `pnpm spec:validate:all` | Validate the complete specification set                           |
| `pnpm check`             | Run fast deterministic pull-request checks                        |

Database, infrastructure, and image command names are reserved at the root. Their workspace
implementations are added only in the phase that owns those surfaces.

## Pull-request expectations

Keep changes narrowly scoped. Describe the linked PRD, user-visible and operational effects,
security and residency impact, verification evidence, and intentionally deferred work. Never include
secrets, real production identifiers, or guessed production configuration.

Reviewers should be able to trace each acceptance criterion to its evidence and each changed
boundary to the corresponding canonical document. A passing check does not make an undocumented
scope expansion acceptable.
