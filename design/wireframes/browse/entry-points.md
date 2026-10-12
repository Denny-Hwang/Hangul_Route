# Browse/Entry-points — where grown-ups open Browse (wireframe v1, annex)

Spec: `docs/specs/F-BROWSE-001-adult-content-browser.md` §4.3, §4.11, BD7, BD8
Audience: **parent or teacher** on their own surfaces (console, reports, grown-up route views, plan builder, roster) and **a grown-up past the PIN** in the learner app. Never shown on any learner screen, the paywall or the marketing site.
Code (planned): `apps/web/src/components/console/BrowseEntryButton.tsx`, `apps/web/src/lib/console/browse-link.ts`, `components/console/ui.tsx` (header), `components/console/PlanParts.tsx` (row link), `app/(console)/teach/space/page.tsx` (revisit chips), `apps/mobile/src/screens/parent/ParentDashboardScreen.tsx` (gate button); report chips and route rows are drawn by their own specs and only call `buildBrowseUrl` / `openBrowse`
Notation: as `browse/home.md`. Each panel shows only the added control in its host screen.

## Scenario (Given-When-Then)

Given: a grown-up is looking at their console, a report, a learner's route, a plan or the grown-up area of the app
When: they want to see the lesson behind what they are looking at, or all lessons
Then: one button or chip opens Browse at that lesson, in a tab that keeps their place, with nothing about the learner in the link

## Screen goal

"Open the lesson behind this." (each entry is one secondary control in its host)

## Box diagram

### 1. Console header (today's ConsoleShell; later the persona shell's adult navigation)

```
┌──────────────────────────────────────────────────────┐
│ [Back to site] [Home]  [Lessons] [Billing] [Sign out] │   [Lessons] -> Browse home (source nav)
└──────────────────────────────────────────────────────┘
  pop-up blocked:  "Allow pop-ups for this site to open lessons."  [ Open lessons ]  (plain link, no pass)
```

### 2. Report chips (progress-reports spec draws them)

```
│ Needs work                                   │
│ ( ~~ ㄴ ~~ n )  ( ~~ ㄹ ~~ r/l )             │   each chip -> Browse item that teaches it (char target)
│ Went well                                    │
│ ( ~~ ㄱ ~~ g )                               │
│ Lessons this week                            │
│  More letters                     [Preview]  │   -> Browse item (quest target)
```

### 3. Learning Route, grown-up views only (console strip R-9a, in-app read-only page R-9b)

```
│ (1)━━ Hangul                  [Preview lessons] │   -> Browse home, Journey, stage 1
│   Letters · Meet the Letters       [Preview]    │   -> Browse episode
```

### 4. Plan builder item row

```
│ [ ] Mon  More letters  note…  [Preview] [x]  │   -> Browse item (quest or episode target)
```

### 5. Roster revisit chips (class roll-up, up to three letters)

```
│ This week: 9 of 12 practiced                 │
│ Revisit together: ( ~~ ㄷ ~~ d ) ( ~~ ㅂ ~~ b )│   chip -> Browse item; no learner name attached
```

### 6. Learner app, grown-up area (after the PIN), web only

```
┌──────────────────────────────────┐
│ [<]  Family dashboard            │
│  … profile cards …               │
│ [ Browse all lessons ]           │   -> same tab: /browse#s=gate (one-time hand-off)
└──────────────────────────────────┘
```

## Interaction points

- Console entries (1-5) -> `openBrowse(target, source)`: named tab `hr-browse` (reused), then the `ready` -> `pass` hand-off
- Gate entry (6) -> writes `browse:handoff` (scope, gate expiry) and `location.assign('/browse#s=gate')`
- No entry shows a price, "Premium" or a lock; a sampler account sees the same controls

## Navigation graph

Enter from: the host screens listed above
Exit to: `browse/home` · `browse/episode` · `browse/item` · `browse/access` (no pass, e.g. a blocked pop-up's plain link)

## States

- **success**: the control is shown; Browse opens in the `hr-browse` tab.
- **pop-up blocked** (console): the inline line with a plain link (Browse then shows the Access screen's "open from your account" path).
- **not signed in** (console): entries are not rendered (the console requires sign-in).
- **native app** (6): the button is hidden off web.
- **error** (`GET /api/entitlements/browse` fails): the button still opens Browse; the console sends a `sampler` pass and shows "Could not check your plan. Showing free lessons." beside the button, with [ Try again ].

## Data needs

- reads (console): `GET /api/entitlements/browse` (scope, source; cached per page)
- reads (gate): the device's cached tier per profile (`effectiveTier`), the gate session end
- writes (gate only): `browse:handoff`
- links carry content ids and a source code only (`#t=…&s=…`), never a learner id, name, alias or summary value

## Open questions

- Should the console header show [Lessons] for a school admin who teaches no class? Default: yes (scope from the school's licence).
