---
applyTo: "SECURITY.md,docs/security/**/*,docs/runbooks/**/*"
---

# Security and privacy

`CONSTITUTION.md` is binding. Read `SECURITY.md` and the data-classification, residency,
threat-model, and logging documents before changing this surface.

- Describe only controls that exist, and distinguish unresolved approval from implemented safety.
- Trace collection, processing, storage, telemetry, backup, support access, and deletion for every
  sensitive flow. Unknown customer data and destinations fail closed.
- Minimize data; validate trust boundaries; allowlist responses, errors, and telemetry properties.
- Never record secrets, credentials, bodies, authorization material, personal query data, uploaded
  content, prompts, completions, or unrestricted free text in telemetry.
- Update the threat model and residency matrix with the change that alters a sensitive flow.

Use the data-residency review prompt for a structured review and run the checks named by the
relevant PRD.
