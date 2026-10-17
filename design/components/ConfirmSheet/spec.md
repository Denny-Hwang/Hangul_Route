# ConfirmSheet (component spec v1, DN-0)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` section 8 · rows **DN-2** (learner, design-system), **DN-4** (`platform/dialog.web.ts`), **DN-6** (console, `components/console/ConfirmSheet.tsx` and `useConfirm()`)
Mock: `mock/confirm-sheet.html` (learner: leaving a quest), `mock/confirm-sheet-console.html` (console: a new join code) · shots `shots/confirm-sheet-375.png`, `-320-text200.png`, `confirm-sheet-console-1280.png`, `-375.png`
Rules: `design/screens/app-shell/mock/display-nav.css` (`.sheet-backdrop`, `.sheet`, `.confirm`)

## What it is

The one confirm step of the web builds, replacing the browser's `confirm()`: its title, message and buttons are in the UI language, its safe choice comes first and takes focus, and it works in an installed iOS app. Native builds keep the platform `Alert`.

## Props (both implementations)

| Prop | Type | Notes |
|---|---|---|
| `title` | `string` | the question, h2 (`aria-labelledby`) |
| `message` | `string?` | one line under it (`aria-describedby`), `text.secondary` |
| `cancelLabel` | `string` | the safe choice: first, focused; learner callers pass their own ("Keep playing"), console callers `common.buttons.cancel` |
| `confirmLabel` | `string` | a verb, never "OK": learner callers' own ("Leave"), console `console.confirm.*` ("Make a new code", "Remove", "Archive", "Copy anyway", "Replace the outline", "Discard changes", "Make a code", "Update the plan"; the site-by-site table is AMENDMENTS-DISPLAY-NAV section 8) |
| `destructive` | `boolean?` | wording only; no red (anti-shame applies to the tone of grown-up pages too) |
| returns | `Promise<boolean>` | true only on confirm; `Esc` and the backdrop resolve false, and in the learner web build the browser or phone back too |

## Anatomy and tokens

- Below 600 px: a bottom sheet (`surface.paper`, `radii.lg` top corners) over `surface.overlay`; from 600 px: a centred dialog, `layout.maxWidth.reading` at most.
- `role="alertdialog"`, `aria-modal="true"`, focus trapped, returned to the control that opened it.
- Buttons in one row that wraps (each `flex: 1 1 12rem`, at least `touchTarget.min`): cancel (secondary: paper, `border.strong`) then confirm (primary: `brand.primary`, `text.onPrimary`). On a phone they stack full width (`confirm-sheet-375.png`).
- **Learner web build**: while open, the history bridge holds one entry, so the browser or phone back cancels; Cancel, Esc and the backdrop take that entry back. **Console**: there is no history bridge (the Next.js App Router owns the history), so the back is not caught there: it leaves the page as it does today, nothing is confirmed, and the sheet goes with the page. Esc and the backdrop cancel.
