# Agent router

Use this file as a map, not as policy.

## Read first

- [CONSTITUTION.md](CONSTITUTION.md) — binding repository governance.
- [ARCHITECTURE.md](ARCHITECTURE.md) — implemented, disabled, and future system boundaries.
- [CONTRIBUTING.md](CONTRIBUTING.md) — change workflow and root commands.
- [SECURITY.md](SECURITY.md) and [`docs/security/`](docs/security/) — security, privacy, and
  residency sources.
- [`specs/README.md`](specs/README.md) — PRD catalog mechanics.
- [`specs/design/DESIGN.md`](specs/design/DESIGN.md) — design-system contract.

## Select the matching runbook

| Work                                 | Skill                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------- |
| PRDs and governed functional changes | [`spec-driven-dev`](.copilot/skills/spec-driven-dev/SKILL.md)               |
| UI and semantic tokens               | [`design-system`](.copilot/skills/design-system/SKILL.md)                   |
| First-party JSON contracts           | [`orpc-contracts`](.copilot/skills/orpc-contracts/SKILL.md)                 |
| PostgreSQL schema and migrations     | [`drizzle-azure-postgres`](.copilot/skills/drizzle-azure-postgres/SKILL.md) |
| Azure IaC and preflight              | [`azure-platform`](.copilot/skills/azure-platform/SKILL.md)                 |
| Future Foundry work                  | [`foundry-agent`](.copilot/skills/foundry-agent/SKILL.md)                   |

Path-specific rules under [`.github/instructions/`](.github/instructions/) apply automatically. The
repository currently contains a product-neutral foundation, not product behavior.
