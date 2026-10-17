# ConfirmSheet: the app's one confirm (as built, owner request 2026-10-16 item 8)

Owner request 2026-10-16 (item 8, learner and grown-up UX): a learner leaving a quest saw the browser's own `confirm()` with OK / Cancel in the browser's language, and the app's words "Leave" / "Keep playing" never showed. `apps/mobile/src/platform/dialog.web.ts` (and the native `Alert` wrapper `dialog.ts`) are gone; every confirm in the learner app is this sheet.

Design pass: `design/components/ConfirmSheet/spec.md` and its mocks (`docs/specs/AMENDMENTS-DISPLAY-NAV.md` section 8, PR #730). This file is what this row built and where it is used.
Code: `packages/design-system/src/components/ConfirmSheet/` (`ConfirmSheet.tsx`, pure rules in `logic.ts`, `types.ts`) · tests `ConfirmSheet/__tests__/logic.test.ts` (order, tones, layout, keys), `apps/mobile/src/screens/quest/__tests__/ConfirmSheet.test.tsx` (en / es / ko labels, Keep first, one answer, Escape, Tab) · e2e `apps/mobile/e2e/web/learner-ux.spec.ts` ("quest X opens the app's own sheet", 360 x 640).
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
- **Focus stays in.** On the web, Tab and Shift+Tab cycle through the two buttons and a stray focus comes back to Keep; react-native-web's modal also returns the focus to the button that opened the sheet. The sheet is `role="alertdialog"`, `aria-modal`, named by its title and described by its line (`aria-describedby`, when there is a line).
- **One answer.** A choice is taken once per opening: the buttons, the scrim, Escape and the modal's own close (`onRequestClose`, after Escape's keydown or on the Android back button) all go through one guard, so a double tap or Escape plus the modal's close never answer twice.
- **Above the home indicator.** The bottom sheet adds the safe-area bottom inset (the nearest `SafeAreaInsetsContext`, as `Screen` reads it) to its bottom padding, so the second button never sits under a notched iPhone's home indicator or an iOS home-screen app's; the centred dialog needs none.
- **The app's words.** The design system holds no copy: the caller passes the title, the line and both labels from `packages/i18n` in the UI language.
- **Tokens only.** `surface.overlay` scrim, `surface.paper` sheet, `radii.xl` top corners (all four in the dialog), `spacing.xl` / `spacing.lg` padding, `shadows.modal`; the dialog's widest box is `touchTarget.min * 8` (512).

## Where it is used

| Surface | Title | Keep | Confirm |
|---|---|---|---|
| Quest player X (`QuestPlayerView`) | `learner.quest.leave.title` | `leave.keep.cta` Keep playing | `leave.confirm.cta` Leave |
| Classes and family, Leave (`SpacesCard`) | `caregiver.spaces.leave.confirmTitle(name)` | `leave.stay` | `leave.cta` |
| Save my progress, new code (`SaveProgressScreen`) | `caregiver.saveProgress.rotate.confirmTitle` | `rotate.keep.cta` | `rotate.cta` |

The web console does not use this component (it is not a React Native surface): its confirms are a `<dialog>` element with the same strings (`apps/web/src/components/console/ConfirmDialog.tsx`), on every console confirm (space, settings, plan, lecture, transfers, relink, the school invite and Update the plan). Cancel is first and focused; an answer closes it and gives the focus back to the control that opened it; the question is in rem, so it grows with the console text size. A browser with no `HTMLDialogElement.showModal` (Safari before 15.4: iOS 14 and the first iOS 15 iPads) asks with `window.confirm` instead, which always shows.

Native builds: the sheet is a React Native `Modal`, the pattern the app's other native sheets already ship with (the Speed Round's Stop sheet, the Stage review's Stay sheet, the placement report's sheet); the quest X closes the sheet and then leaves, as the Speed Round's Stop does.
