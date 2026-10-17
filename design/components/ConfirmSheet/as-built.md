# ConfirmSheet: the app's one confirm (as built, owner request 2026-10-16 item 8)

Owner request 2026-10-16 (item 8, learner and grown-up UX): a learner leaving a quest saw the browser's own `confirm()` with OK / Cancel in the browser's language, and the app's words "Leave" / "Keep playing" never showed. `apps/mobile/src/platform/dialog.web.ts` (and the native `Alert` wrapper `dialog.ts`) are gone; every confirm in the learner app is this sheet.

Design pass: `design/components/ConfirmSheet/spec.md` and its mocks (`docs/specs/AMENDMENTS-DISPLAY-NAV.md` section 8, PR #730). This file is what this row built and where it is used.
Code: `packages/design-system/src/components/ConfirmSheet/` (`ConfirmSheet.tsx`, pure rules in `logic.ts`, `types.ts`) · tests `ConfirmSheet/__tests__/logic.test.ts` (order, tones, layout, keys), `apps/mobile/src/screens/quest/__tests__/ConfirmSheet.test.tsx` (en / es / ko labels, Keep first, one answer, Escape, Tab) · e2e `apps/mobile/e2e/web/confirm-sheet.spec.ts` (360 x 640).
Precedents it generalizes: the presenter's Exit confirm (`design/screens/presenter/overlays.md` "Exit") and the preview's Leave sheet (`design/screens/browse/preview-player.md` C).

## Wireframe

```
Phone (compact class): a bottom sheet         Regular and wide: a centred dialog, at most 32rem
+--------------------------------+            +------------------------------------------+
|  (screen under the scrim)      |            |                                          |
|                                |            |    +------------------------------+      |
|                                |            |    | Leave this quest?            |      |
+--------------------------------+            |    | Stars from this try will not |      |
| Leave this quest?              |            |    | be saved.                    |      |
| Stars from this try will not   |            |    | [      Keep playing        ] |      |
| be saved.                      |            |    | (          Leave           ) |      |
| [        Keep playing        ] |            |    +------------------------------+      |
| (           Leave            ) |            |                                          |
+--------------------------------+            +------------------------------------------+
[ ] filled (primary)   ( ) outline (ghost)
```

## Rules

- **Keep first.** The safe choice ("Keep playing", "Stay", "Keep this code") is first in reading, tab and focus order, the one filled button (`primary`, `lg`), and it has the focus when the sheet opens. Escape, the Android back button (`onRequestClose`) and a tap on the scrim all keep.
- **Confirm second, never red.** The other choice ("Leave") is an outline button (`ghost`, `md`) under Keep. No tone of the sheet is `colors.feedback.danger`: leaving loses nothing earned, so it is not a warning (CLAUDE.md section 1).
- **Focus stays in.** On the web, Tab and Shift+Tab cycle through the two buttons and a stray focus comes back to Keep; react-native-web's modal also returns the focus to the button that opened the sheet. The sheet is `role="alertdialog"`, `aria-modal`, named by its title.
- **One answer.** A choice is taken once per opening (a double tap, or Escape's keydown and the modal's keyup, never answer twice).
- **The app's words.** The design system holds no copy: the caller passes the title, the line and both labels from `packages/i18n` in the UI language.
- **Tokens only.** `surface.overlay` scrim, `surface.paper` sheet, `radii.xl` top corners (all four in the dialog), `spacing.xl` / `spacing.lg` padding, `shadows.modal`; the dialog's widest box is `touchTarget.min * 8` (512).

## Where it is used

| Surface | Title | Keep | Confirm |
|---|---|---|---|
| Quest player X (`QuestPlayerView`) | `learner.quest.leave.title` | `leave.keep.cta` Keep playing | `leave.confirm.cta` Leave |
| Classes and family, Leave (`SpacesCard`) | `caregiver.spaces.leave.confirmTitle(name)` | `leave.stay` | `leave.cta` |
| Save my progress, new code (`SaveProgressScreen`) | `caregiver.saveProgress.rotate.confirmTitle` | `rotate.keep.cta` | `rotate.cta` |

The web console does not use this component (it is not a React Native surface): its confirms are a `<dialog>` element with the same strings (`apps/web/src/components/console/ConfirmDialog.tsx`).
