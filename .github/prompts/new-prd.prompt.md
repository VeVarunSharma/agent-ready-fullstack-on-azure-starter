---
name: new-prd
description: "Scaffold and complete a governed PRD without implementing product behavior."
agent: agent
argument-hint: "Capability, outcome, owner, classification, scope, exclusions, and known impacts"
---

Create only the PRD and catalog changes for the requested capability.

Read `CONSTITUTION.md`, `specs/README.md`, `specs/PRDs/index.json`, the PRD template, and
`.copilot/skills/spec-driven-dev/SKILL.md`. Resolve the version, stable uppercase identifier, title,
summary, owner, classification, scope, exclusions, and impact flags without guessing missing
approvals.

Use `pnpm spec:new -- <arguments>`, replace every generated marker, and write testable acceptance
criteria with one-to-one verification evidence. Keep catalog metadata and frontmatter aligned. Run
`pnpm spec:validate` and `pnpm spec:validate:all`.

Do not implement the capability. Finish with changed paths, lifecycle, validation results, and
unresolved decisions.
