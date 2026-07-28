---
applyTo: "services/**/*,infra/**/*foundry*,docs/**/*foundry*,docs/**/*FOUNDRY*"
---

# Future Foundry work

Follow [the Foundry admission runbook](../../.copilot/skills/foundry-agent/SKILL.md). The current
repository has no approved Foundry behavior: `services/` remains `.gitkeep`-only, infrastructure is
disabled, and no model or agent is selected.

- Stop live implementation unless a cataloged PRD and its architecture, security, privacy,
  residency, retention, networking, identity, and operational approvals are present.
- Load the current Microsoft Foundry guidance before design or IaC work; do not rely on remembered
  APIs or copy preview examples.
- Do not create prompts, tools, datasets, evaluations, model deployments, agents, or external model
  calls during foundation work.
- Keep local and CI tests deterministic and offline.
- Never describe disabled infrastructure or an unverified regional dependency as active or
  residency-approved.
