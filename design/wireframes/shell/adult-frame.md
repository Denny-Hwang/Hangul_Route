# Shell/Adult-frame — the frame around every grown-up page: persona, navigation, back to learning (wireframe v1)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.8, §3.10, §3.16 · replaces the header of `console/home.md` and every console page (`ConsoleShell`)
Audience: **parent or caregiver, teacher, school admin**
Component target: `apps/web/src/components/console/AdultFrame.tsx`, navigation registry `lib/console/shell-nav.ts` (A-5a)

## Scenario (Given-When-Then)

Given: a signed-in grown-up on any page under `/parent`, `/teach` or `/account`
When: they want another section, the other persona, or to hand the device back for learning
Then: one consistent frame offers exactly those three moves, in the same place on every page and every width

## Screen goal

"Move between this persona's sections, switch persona, or go back to learning." (it is a frame, not a screen: no content of its own)

## Box diagram

Panel A — wide (laptop), account with both personas, parent selected

```
+-------------------------------------------------------------------------+
| Hangul Route   ( Parent | Teacher )        [Language v] [Back to learning] [Sign out] |
|-------------------------------------------------------------------------|
|  Home   Reports*   Messages*   Browse lessons*   Billing                 |  <- nav row; * = added by sibling specs
|-------------------------------------------------------------------------|
|                                                                         |
|                         [ page content ]                                |
|                                                                         |
|-------------------------------------------------------------------------|
|  About Hangul Route  ·  Privacy  ·  Terms                               |  <- site links (hangulroute.com)
+-------------------------------------------------------------------------+
```

Panel B — phone (375), teacher only (no switch)

```
+-----------------------------------+
| Hangul Route · Teacher   [Sign out]|
| [Back to learning]   [Language v]  |
|-----------------------------------|
| Classes | Reports* | Billing  ->   |  <- tab row, scrolls sideways inside itself only
|-----------------------------------|
|        [ page content ]            |
|-----------------------------------|
| About · Privacy · Terms            |
+-----------------------------------+
```

- The persona switch is a two-option segmented control; with one persona it is plain text.
- Only built sections appear. No disabled "coming soon" items (the old disabled Account button is gone).
- "Back to learning" is always visible: inside an installed learner PWA window there is no address bar.

## Interaction points

- ( Parent | Teacher ) → writes last persona, opens the other home (`shell/parent-home` / `shell/teacher-home`)
- Nav items → their pages (ids in `?id=` only; never a name)
- [Back to learning] → clears the grown-up unlock, opens learner app `/`
- [Sign out] → Clerk sign-out, clears the unlock → `shell/signin`
- [Language v] → console locale (existing select)
- Footer links → hangulroute.com About / Privacy / Terms (new tab not required; same tab)
- "Hangul Route" name → current persona home

## Navigation graph

Enter from: every grown-up page renders inside it
Exit to:    `shell/parent-home` · `shell/teacher-home` · `/account/billing` · sibling pages · learner app `/` · `shell/signin` · hangulroute.com

## States

- **success**: as drawn.
- **empty**: account with no persona never sees the frame (router sends it to `/start`).
- **error**: spaces fetch failed → frame shows name, Back to learning and Sign out only; the page shows its own Try again. While `shell/grown-up-lock` decides, the frame shows without nav and without content.

## Data needs

- reads: `GET /api/spaces` (personas), `ADULT_NAV` registry, current path, console locale
- writes: IndexedDB `hr:shell:lastPersona` when a persona home renders; `sessionStorage` `hr:grownup:unlock` `seen` refresh (at most once a minute); removal of the unlock on Back to learning / Sign out

## Open questions

- Tab row on phones vs. a bottom bar: default the tab row under the header (works in a browser tab and an installed window alike). Revisit after the design pass.
