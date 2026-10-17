# ConfirmSheet: as built (DN-4, DN-6 and OR-UX)

Design pass: `design/components/ConfirmSheet/spec.md` and its mocks (`docs/specs/AMENDMENTS-DISPLAY-NAV.md` section 8, PR #730). This file is what was built and where it is used.

Owner request 2026-10-16 (item 8, learner and grown-up UX): a learner leaving a quest saw the browser's own `confirm()` with OK / Cancel in the browser's language, and the app's words "Leave" / "Keep playing" never showed. DN-4 (#736) and DN-6 (#737) built the sheet of section 8 for the learner web build and the console; OR-UX (#734) had built its own sheet and a console `<dialog>` first, and they were folded into DN-4's and DN-6's when OR-UX was brought up to date with main, so there is one confirm per surface (AMENDMENTS-DISPLAY-NAV section 9.8, the ConfirmSheet row).

## Learner app (design-system `ConfirmSheet`)

Code: `packages/design-system/src/components/ConfirmSheet/` (`ConfirmSheet.tsx`, pure styles in `style.ts`, `types.ts`), drawn by `apps/mobile/src/components/ConfirmHost.tsx` for `platform/dialog.web.ts`'s `confirm()` · tests `ConfirmSheet/__tests__/ConfirmSheet.test.tsx`, `apps/mobile/src/screens/__tests__/confirm-host.test.tsx` · e2e `apps/mobile/e2e/web/back.spec.ts` (the quest leave in Spanish, the browser back as Cancel) and `apps/mobile/e2e/web/learner-ux.spec.ts` (the quest leave in en, es and ko at 360 x 640).

- **Cancel first.** The safe choice ("Keep playing", "Stay", "Keep this code") is first in reading and focus order and has the focus when the sheet opens; the confirm ("Leave") is the primary button after it. No tone is `colors.feedback.danger`: leaving loses nothing earned, so it is not a warning (CLAUDE.md section 1).
- **Ways out.** Escape (answered once, on keydown), the backdrop and, in the web build, the browser or phone back (the history bridge holds one entry while it is open) all cancel. Focus goes back to the control that opened it.
- **One answer per question.** `ConfirmHost` binds the sheet's handlers to the question they were drawn for, so a double tap, or Escape and then the modal's own close, never answers twice or answers the question waiting behind it (OR-UX review fix).
- **Above the home indicator.** The bottom sheet adds the safe-area bottom inset (the nearest `SafeAreaInsetsContext`, as `Screen` reads it) to its bottom padding, so its last button never sits under a notched iPhone's home indicator or an iOS home-screen app's; the centred dialog needs none (OR-UX review fix).
- **The app's words.** The design system holds no copy: the caller passes the title, the line and both labels from `packages/i18n` in the UI language. Native builds keep the platform `Alert` with the same labels.

| Surface | Title | Cancel | Confirm |
|---|---|---|---|
| Quest player Close (`QuestPlayerView`) | `learner.quest.leave.title` | `leave.keep.cta` Keep playing | `leave.confirm.cta` Leave |
| Classes and family, Leave (`SpacesCard`) | `caregiver.spaces.leave.confirmTitle(name)` | `leave.stay` | `leave.cta` |
| Save my progress, new code (`SaveProgressScreen`) | `caregiver.saveProgress.rotate.confirmTitle` | `rotate.keep.cta` | `rotate.cta` |
| Edit profile, unsaved changes (`EditProfileScreen`, DN-4) | `learner.editProfile.leave.title` | `leave.keep.cta` | `leave.confirm.cta` |

## Console (`apps/web/src/components/console/ConfirmSheet.tsx`)

The web console is not a React Native surface: `useConfirm()` draws its own ConfirmSheet on all 13 sites of section 8, each with its verb (`console.confirm.*`) and Cancel first (DN-6; tests `apps/web/src/components/console/__tests__/confirm-sheet.test.tsx`, `apps/web/src/app/__tests__/confirm-sites.test.tsx`; e2e `apps/web/e2e/page-back.spec.ts`).
