# Product-neutral design contract

- **Contract version:** v0
- **Status:** Current foundation contract
- **Applies to:** `packages/ui` and every rendered interface

This document defines design intent. The executable mapping lives in
[`packages/ui/src/styles/globals.css`](../../packages/ui/src/styles/globals.css) and shared
component classes. Intent and executable mappings change together. The
[repository constitution](../../CONSTITUTION.md) is binding and is not repeated here.

The foundation has no branding, personas, domain navigation, or product/status semantics.

## Principles

1. Use semantic meaning, never a raw palette name, in component APIs and application composition.
2. Preserve understandable structure and state without relying on color, motion, or position alone.
3. Meet WCAG 2.2 AA across supported light, dark, system, keyboard, zoom, and reduced-motion modes.
4. Prefer a shared primitive or existing token before adding a variation.
5. Keep default behavior neutral. Branding and domain semantics require a cataloged PRD.

## Color

All rendered colors consume the following semantic CSS properties through Tailwind semantic
utilities. The current executable values are achromatic OKLCH mappings for light and dark modes.
Values remain canonical in CSS so contrast can be tested from actual output.

| Token                  | Intent                                                  | Typical consumers           |
| ---------------------- | ------------------------------------------------------- | --------------------------- |
| `background`           | Page/canvas background                                  | Root surfaces               |
| `foreground`           | Primary text/content on `background`                    | Body text and icons         |
| `surface`              | Raised or grouped neutral surface                       | Cards, badges, controls     |
| `surface-foreground`   | Content on `surface`                                    | Surface text and icons      |
| `muted`                | Low-emphasis interactive or grouped surface             | Secondary controls          |
| `muted-foreground`     | Secondary text with AA contrast on intended backgrounds | Supporting copy             |
| `border`               | Structural separation                                   | Rules, control borders      |
| `input`                | Input/control boundary                                  | Form controls               |
| `ring`                 | Keyboard focus indication                               | `focus-visible` rings       |
| `primary`              | Main neutral action/emphasis, not a brand color         | Primary action              |
| `primary-foreground`   | Content on `primary`                                    | Primary action label/icon   |
| `secondary`            | Secondary neutral action/emphasis                       | Secondary action            |
| `secondary-foreground` | Content on `secondary`                                  | Secondary action label/icon |

Rules:

- Components use classes such as `bg-background`, `text-foreground`, and `border-border`; raw hex,
  RGB, HSL, OKLCH, named colors, and Tailwind palette names are prohibited outside the token source.
- Every foreground/background and state pairing must pass automated contrast checks in both themes.
- Normal text targets at least 4.5:1; large text at least 3:1; meaningful non-text boundaries and
  focus indicators at least 3:1 against adjacent colors.
- `primary` means hierarchy only. It must not acquire organization, product, risk, success, warning,
  or error meaning.
- There are no status colors in v0. A future status system must use text/icon/ARIA semantics, define
  every theme and state, and enter through a design-impact PRD.

## Themes

The supported preference is `light`, `dark`, or `system`.

- `system` resolves from `prefers-color-scheme` and responds to browser preference changes.
- An explicit user choice is stored under the non-sensitive local key `ui-theme`.
- Both explicit classes and system fallback map the complete semantic color set.
- Components must not assume that dark mode is a simple inversion.
- Theme selection must be operable by keyboard and expose its current and next action in its
  accessible name.
- New tokens are incomplete until light, dark, forced-colors, contrast, and reduced-motion behavior
  are reviewed.

## Typography

The v0 family role is the platform UI sans-serif stack exposed as `font-sans`; no brand font is
claimed. Text remains selectable and respects browser font and zoom settings.

| Role       | Current executable mapping                                      | Use                              |
| ---------- | --------------------------------------------------------------- | -------------------------------- |
| Display    | `text-4xl sm:text-5xl font-semibold tracking-tight`             | One concise page-level statement |
| Heading    | `text-lg font-semibold` or a proportionate native heading level | Section hierarchy                |
| Body       | `text-base leading-7`                                           | Primary reading text             |
| Body large | `text-lg leading-7`                                             | Short supporting introduction    |
| Label      | `text-sm font-medium`                                           | Controls and compact labels      |
| Supporting | `text-sm leading-6 text-muted-foreground`                       | Secondary explanatory text       |
| Code       | Browser/system monospace stack when introduced                  | Technical values only            |

Heading rank follows document structure; visual role does not determine HTML rank. Body copy must
remain readable at 200% browser zoom and under text-spacing overrides. Avoid all-caps paragraphs,
font-weight-only state, and truncated critical instructions.

## Spacing and layout

Tailwind's rem-based spacing scale is the executable v0 mapping. Use the smallest shared value that
preserves comprehension and touch/keyboard operation.

| Role            | Preferred scale             | Intent                                 |
| --------------- | --------------------------- | -------------------------------------- |
| Inline compact  | `gap-2` / `px-3`            | Icon-label and compact control spacing |
| Inline standard | `gap-3` / `px-4`            | Related actions and normal controls    |
| Stack compact   | `gap-3` / `mt-2`            | Closely related label/help content     |
| Stack standard  | `gap-5` / `mt-6`            | Sections within one concept            |
| Section         | `py-8`, `py-16`, `sm:py-24` | Major content separation               |
| Page gutter     | `px-6`, `sm:px-10`          | Responsive page edge protection        |
| Reading width   | `max-w-2xl` or `max-w-3xl`  | Legible prose line length              |
| App frame       | `max-w-5xl`                 | Neutral foundation shell width         |

Do not use spacing to imply hidden hierarchy without headings or landmarks. Layout must reflow
without two-dimensional scrolling at 320 CSS px except for intrinsically two-dimensional data.

## Radius

The base property is `--radius: 0.625rem`. Executable roles are:

| Token       | Mapping               | Use                    |
| ----------- | --------------------- | ---------------------- |
| `radius-sm` | Base minus `0.25rem`  | Compact nested details |
| `radius-md` | Base minus `0.125rem` | Standard controls      |
| `radius-lg` | Base                  | Grouped surfaces       |
| `radius-xl` | Base plus `0.25rem`   | Large neutral surfaces |

Shape is not a status or brand signal. A component uses one stable radius across interaction states.

## Elevation

Elevation communicates stacking, not importance or status:

| Role    | Current mapping                                       | Use                                                          |
| ------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| Flat    | No shadow; `border-border` where separation is needed | Page and grouped content                                     |
| Control | `shadow-xs`                                           | Bordered interactive control                                 |
| Raised  | `shadow-sm`                                           | Primary action or small raised surface                       |
| Overlay | Not admitted in v0                                    | Requires focus management, dismissal, and executable mapping |

Do not use shadow as the only boundary. High-contrast/forced-color modes need a structural border.

## Motion

- Color transitions are intentionally absent from the current controls. Theme changes apply the
  complete semantic token set atomically so an animated cross-theme intermediate cannot create a
  transient contrast failure.
- Motion must explain continuity or state; decorative motion is not a default.
- No essential information may depend on animation completion.
- Avoid autoplay, parallax, flashing, and repeated nonessential animation.
- Under `prefers-reduced-motion: reduce`, executable CSS sets scrolling to immediate and collapses
  animation/transition duration to `0.01ms` with one iteration.
- A new duration, easing, transform, or animated primitive requires a named role in this document
  and the executable mapping in the same change.

## Breakpoints

Use content-driven reflow through the Tailwind defaults:

| Token | Minimum width |
| ----- | ------------- |
| `sm`  | `40rem`       |
| `md`  | `48rem`       |
| `lg`  | `64rem`       |
| `xl`  | `80rem`       |
| `2xl` | `96rem`       |

Start with the single-column/base layout. Add a breakpoint only where content ceases to be usable,
not for a named device or persona. Input modality must not be inferred from viewport width.

## Focus and input

- Native focus is replaced only by `focus-visible` with a two-unit `ring` and two-unit background
  offset, as implemented by the shared button.
- Focus must remain visible, unobscured, and at least as prominent as the WCAG 2.2 focus appearance
  requirement.
- DOM and visual focus order follow reading/task order. Do not use positive `tabindex`.
- All actions are keyboard operable and have an accessible name. Icon-only actions require a
  programmatic label.
- Current controls use a minimum 2.5rem dimension; no target may fall below the WCAG 2.2 AA minimum
  without a documented exception.
- Forms must associate labels, descriptions, requirements, and errors programmatically. Placeholder
  text is not a label.
- Pointer, keyboard, speech, zoom, and touch use the same action semantics.

## Component states

Every interactive component accounts for:

| State            | Contract                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Rest             | Purpose and affordance are understandable without hover.                                                                          |
| Hover            | Enhances pointer feedback only; does not reveal essential content.                                                                |
| Focus-visible    | Uses the semantic focus ring and remains unobscured.                                                                              |
| Active/pressed   | Gives immediate non-motion-dependent feedback.                                                                                    |
| Disabled         | Uses native disabled semantics where possible, blocks interaction, and is not indicated by opacity alone in explanatory contexts. |
| Read-only        | Remains focusable when useful and is distinct from disabled.                                                                      |
| Loading          | Announces status when asynchronous, prevents duplicate activation, and preserves layout.                                          |
| Empty            | Explains the absence and next available action without inventing product content.                                                 |
| Invalid/error    | Associates concise text with the affected control and summary; never relies on color.                                             |
| Selected/current | Uses native state such as `aria-selected`, `aria-pressed`, or `aria-current` as appropriate.                                      |

Only rest, hover, focus, active, and disabled button states are currently implemented. Other states
must be implemented and tested with the first approved consumer rather than added speculatively.

## Accessibility acceptance

UI changes target WCAG 2.2 AA and must verify, as applicable:

- semantic landmarks, headings, lists, labels, and control roles;
- complete keyboard operation, logical focus order, visible focus, and no focus trap;
- text/non-text contrast in light and dark themes, including after every explicit and system theme
  transition;
- target size, pointer cancellation, drag alternatives, and consistent help/identification;
- 200% zoom, 320 CSS px reflow, text-spacing overrides, and orientation;
- accessible names, status announcements, errors, and recovery instructions;
- no color-only, sound-only, position-only, or motion-only meaning;
- system and explicit themes, forced colors, and reduced motion;
- Playwright/axe checks plus manual checks for behavior automation cannot determine.

Automated axe results are necessary but not sufficient evidence.

## UI PRD requirements

A PRD that changes rendered UI must:

1. set design-system impact and link this contract;
2. name every consumed semantic token and shared primitive;
3. list each token/primitive added, changed, deprecated, or exceptionally bypassed;
4. define content hierarchy and all applicable component states;
5. include light, dark, keyboard, zoom/reflow, contrast, and reduced-motion criteria;
6. map every criterion to automated, CI, or reproducible manual evidence;
7. avoid brand, persona, status, and domain semantics unless explicitly in approved scope.

“Use the design system” is not a sufficient token declaration.

## Extension

Before adding a token or primitive:

1. prove no existing semantic role meets the need;
2. name it for intent, not a visual value, product, or component;
3. define valid consumers and prohibited use;
4. add complete light/dark and interaction mappings to executable source;
5. verify contrast, forced colors, reduced motion, and composition;
6. update this contract, implementation, tests, and PRD in the same change.

Aliases that preserve an old visual name without semantics are not extensions.

## Deprecation

A deprecation record names the replacement, affected exports/tokens, migration procedure, owner, and
removal milestone. During migration:

- the old role may alias the replacement only when semantics are equivalent;
- warnings/checks must prevent new consumers;
- both themes and accessibility behavior remain supported;
- removal occurs only after repository search and tests prove no consumer remains.

Breaking token meaning in place is prohibited.

## Synchronization and enforcement

`DESIGN.md` defines intent; executable truth is:

- semantic color/radius/font mappings in
  [`packages/ui/src/styles/globals.css`](../../packages/ui/src/styles/globals.css);
- interaction mappings in shared components under
  [`packages/ui/src/components/`](../../packages/ui/src/components/);
- shadcn routing in [`apps/web/components.json`](../../apps/web/components.json) and
  [`packages/ui/components.json`](../../packages/ui/components.json);
- the hardcoded-color check in
  [`packages/ui/scripts/check-hardcoded-colors.ts`](../../packages/ui/scripts/check-hardcoded-colors.ts).

A change is incomplete if the contract, CSS/classes, public exports, tests, and consumer evidence
disagree. Run:

```sh
pnpm --filter @repo/ui lint
pnpm --filter @repo/ui typecheck
pnpm --filter @repo/web lint
pnpm test:unit
pnpm e2e
```
