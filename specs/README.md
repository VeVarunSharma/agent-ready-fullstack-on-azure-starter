# Specifications

The root [constitution](../CONSTITUTION.md) is binding. This directory documents the mechanics of
the PRD workflow without duplicating that policy.

## Catalog and filenames

`PRDs/index.json` is the complete catalog. A PRD filename must be:

```text
PRD_V{major}[.{minor}]_NAME_IN_CAPS.md
```

Major versions begin at 1. `NAME_IN_CAPS` is also the stable PRD `id`; later versions reuse the same
id. Catalog paths are repository-relative. A path and an `id`/`version` pair must each be unique.

Lifecycle values are `active`, `current`, `historical`, and `superseded`. A superseded entry names a
higher cataloged version in `supersededBy`; every other lifecycle uses `null`. Historical and
superseded records are immutable when a Git baseline is available.

## Create a PRD

```sh
pnpm spec:new -- \
  --version 1 \
  --name EXAMPLE_CAPABILITY \
  --title "Example capability" \
  --summary "Concise purpose and intended outcome." \
  --owner "@responsible-owner" \
  --classification Internal
```

Valid classifications are `Public`, `Internal`, `Confidential`, and `Restricted`. Optional impact
flags are:

- `--architecture-impact`
- `--design-system-impact`
- `--sensitive-data-impact`
- `--persistence-impact`

The generator writes the PRD and catalog entry atomically after validating existing catalog
identity. Generated content markers intentionally fail validation until the author supplies real
scope and evidence.

## Validate

```sh
pnpm spec:validate
pnpm spec:validate:all
```

Validation checks catalog shape, filename and version identity, complete aligned metadata, lifecycle
and supersession relationships, required sections, placeholder removal, and one-to-one
acceptance-criterion evidence. Git-aware checks also enforce immutable records, the post-bootstrap
PRD gate, and impact-driven same-change files. Use `--base <git-ref>` or `SPEC_BASE_REF` in CI to
compare the complete change with its base.

After a baseline contains the constitution, changed paths fail closed: anything other than an
explicitly recognized documentation file, governed PRD record, or harmless repository metadata
requires an active or current cataloged PRD document and catalog update in the same change. This
includes source, manifests, lockfiles, build/test/runtime configuration, containers, styles,
migrations, infrastructure, automation, workflows, and agent instructions. Rename comparisons retain
both paths so moving functional content into a documentation path does not bypass the gate.

The bootstrap exception applies only before the first commit, or to the one change that introduces
the constitution to an existing baseline. Once the baseline contains the constitution, changing it
cannot reopen the exception.

Acceptance criteria use `AC-001` identifiers. The Verification table must map every identifier
exactly once to `automated`, `CI`, or `manual` evidence with a reproducible path, command, check, or
procedure.
