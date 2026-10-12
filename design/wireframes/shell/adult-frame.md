# Shell/Adult-frame — the frame around every grown-up page: persona, navigation, back to learning (wireframe v2)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.8, §3.10, §3.16 · replaces the header of `console/home.md` and every console page (`ConsoleShell`)
Audience: **parent or caregiver (persona "Family"), teacher, school admin**
Component target: `apps/web/src/components/console/AdultFrame.tsx`, navigation registry `lib/console/shell-nav.ts` (A-5a)

## Scenario (Given-When-Then)

Given: a signed-in grown-up on any page under `/parent`, `/teach` or `/account`
When: they want another section, the other persona, or to hand the device back for learning
Then: one consistent frame offers exactly those three moves, in the same place on every page and every width

## Screen goal

"Move between this persona's sections, switch persona, or go back to learning." (it is a frame, not a screen: no content of its own)

## Box diagram

Panel A — wide (laptop), account with both personas, Family selected, every sibling flag on

```
+-----------------------------------------------------------------------------------+
| Hangul Route   ( Family | Teacher )        [Language v] [Back to learning] [Sign out] |
|-----------------------------------------------------------------------------------|
|  Home   Reports   Notes   Lessons   Billing                                       |  <- nav row from ADULT_NAV
|-----------------------------------------------------------------------------------|
|                                                                                   |
|                              [ page content ]                                     |
|                                                                                   |
|-----------------------------------------------------------------------------------|
|  About Hangul Route  ·  Privacy  ·  Terms                                         |  <- site links (hangulroute.com)
+-----------------------------------------------------------------------------------+
```

Panel B — phone (375), teacher only (no switch), reports and lessons flags off

```
+-----------------------------------+
| Hangul Route · Teacher  [Back to learning] |  <- ONE header row
|-----------------------------------|
| Classes | Billing                  |  <- tab row (scrolls sideways inside itself only)
|-----------------------------------|
|        [ page content ]            |
|-----------------------------------|
| About · Privacy · Terms            |
| [Language v]   [Sign out]          |  <- moved to the footer below 720 px
+-----------------------------------+
```

Panel C — teacher's laptop with no learner profile on this browser

```
| Hangul Route · Teacher   [Open the learner app] |   <- label changes; same action
```

Nav registry (this spec registers every item; hidden when its predicate is off — never shown disabled):

| Item | Persona | Shown when |
|---|---|---|
| Home | Family | always |
| Reports | Family | `reportsEnabled()` |
| Notes | Family | `notesEnabled()` |
| Classes | Teacher | always |
| Lessons | both | `browseEntryEnabled()` (a button: opens the lesson browser window) |
| Billing | both | always |

- The persona switch is a two-option segmented control ("Family", "Teacher"); with one persona it is plain text.
- On a `/teach/space…` or `/parent/space…` page the active persona and the highlighted item come from the space's kind (family → Family; class or school → Teacher), not from the path.
- The way back is always visible: inside an installed learner PWA window there is no address bar.

## Interaction points

- ( Family | Teacher ) → writes last persona (shell store), opens the other home (`shell/parent-home` / `shell/teacher-home`)
- Home / Classes / Notes / Billing → their pages (ids in `?id=` only; never a name)
- Reports → the learner report when the account has one family with one learner; otherwise the family home (its cards are the index)
- Lessons → F-BROWSE-001 `openBrowse({ source: 'nav' })` (named window; pass by `postMessage`)
- [Back to learning] / [Open the learner app] → clears the grown-up unlock and the console session, opens the learner app (`/` on the app host; `https://app.hangulroute.com/` when the console is still served on hangulroute.com)
- [Sign out] → Clerk sign-out, clears the unlock and the console session → `shell/signin`
- [Language v] → console locale (existing select)
- Footer links → hangulroute.com About / Privacy / Terms (same tab)
- "Hangul Route" name → current persona home

## Navigation graph

Enter from: every grown-up page renders inside it
Exit to:    `shell/parent-home` · `shell/teacher-home` · `/account/billing` · report, notes and Learning Route pages (sibling specs) · lesson browser `/browse` (new window) · learner app `/` · `shell/signin` · hangulroute.com

## States

- **success**: as drawn.
- **empty**: account with no persona never sees the frame (router sends it to `/start`).
- **error**: spaces fetch failed → frame shows name, the way back and Sign out only; the page shows its own Try again. While `shell/grown-up-lock` decides, the frame shows without nav and without content. Space kind still loading → persona as text, no highlighted item.

## Data needs

- reads: `GET /api/spaces` (personas, counts, the current space's kind), one roster when the account has exactly one family with one learner (Reports target, in memory per tab), `ADULT_NAV` registry and the four predicates, current path, console locale, device marker and `hr:profiles` presence (label of the way back)
- writes: shell store (`hr-shell` / `kv`) `lastPersona` when a persona home renders; `sessionStorage` `hr:grownup:unlock` `seen` refresh (at most once a minute); removal of the unlock and `hr:console:session` on the way back / Sign out

## Open questions

- Tab row on phones vs. a bottom bar: default the tab row under the header (works in a browser tab and an installed window alike). Revisit after the design pass.
- First-screen budget: at 375 x 667 the frame plus the first learner card of `/parent` fit without scrolling (e2e asserts it).
