# Browse/Entry-points — where grown-ups open All lessons (wireframe v2, annex)

Spec: `docs/specs/F-BROWSE-001-adult-content-browser.md` §4.3, §4.11, BD7, BD8, BD10
Audience: **parent or teacher** on their own surfaces on app.hangulroute.com (adult navigation, reports, the Learning Route summary page, plan builder, roster) and **a grown-up past the PIN** in the learner app. Never shown on any learner screen, the paywall or Plan screen, or the marketing site.
Code (planned): `apps/web/src/lib/console/shell-nav.ts` (the **Lessons** item, F-APP-001 `ADULT_NAV`), `apps/web/src/lib/console/browse-link.ts`, `lib/console/config.ts` (`browseEnabled()`), `components/console/PlanParts.tsx` (row link), `app/(console)/teach/space/page.tsx` (revisit chips), the Learning Route summary page (LR-8) and the report action slot (F-REPORT-001 RP-7a) call `openBrowse`; `apps/mobile/src/screens/parent/ParentDashboardScreen.tsx` and `platform/browse-handoff.web.ts` (gate button)
Notation: as `browse/home.md`. Each panel shows only the added control in its host screen.

v2 (review of 2026-10-11): every console entry opens All lessons in the **same tab** on the same origin (no pop-up, no named window, no cross-origin message); entries show only behind `browseEnabled()` and only when the console runs on app.hangulroute.com; Learning Route rows sit on the adult summary page; the report entry is the report's action slot.

## Scenario (Given-When-Then)

Given: a grown-up is on their home, a report, a learner's Learning Route, a plan or the grown-up area of the app
When: they want to see the lesson behind what they are looking at, or all lessons
Then: one control opens All lessons at that lesson in the same tab, [ Close ] brings them back, and nothing about the learner is in the link

## Screen goal

"Open the lesson behind this." (each entry is one secondary control in its host)

## Box diagram

### 1. Adult navigation (F-APP-001 adult frame; both personas)

```
┌──────────────────────────────────────────────────────────────┐
│ Hangul Route  Parent | Teacher   [Home] [Lessons] [Billing]  │   [Lessons] -> All lessons home
│                                  [Back to learning] [Sign out]│   (source nav), same tab
└──────────────────────────────────────────────────────────────┘
  plan check failed:  "Could not check your plan."  [ Try again ]  [ Open free lessons ]
```

### 2. Report (F-REPORT-001 draws the page; this spec adds the action)

```
│ Practice next                                │
│  Letters to revisit: ( ~~ ㄴ ~~ n ) ( ~~ ㄹ ~~ r/l )  │   each chip -> item that teaches it (char target)
│                           [ Plan ] [Preview] │   action slot: Preview -> item (quest target)
```

### 3. Learning Route summary page (adult shell, LR-8) and in-app read-only page (R-9b, behind the PIN)

```
│ (1)── Hangul · Mina is here   [Preview lessons] │   -> All lessons, Journey, stage 1
│ (2)── Words · A taste         [Preview lessons] │   (stage target; no learner id in the link)
```

### 4. Plan builder item row

```
│ [ ] Mon  More letters  note…  [Preview] [x]  │   -> item (quest or episode target)
```

### 5. Roster revisit chips (class roll-up, up to three letters)

```
│ This week: 9 of 12 practiced                 │
│ Revisit together: ( ~~ ㄷ ~~ d ) ( ~~ ㅂ ~~ b )│   chip -> item; no learner name attached
```

### 6. Learner app, grown-up area (after the PIN), web only

```
┌──────────────────────────────────┐
│ [<]  Family dashboard            │
│  [ Grown-up home  Open ]         │   F-APP-001 card
│  … profile cards …               │
│ [ Open all lessons ]             │   -> same tab: gate pass, /browse#s=gate
└──────────────────────────────────┘
```

## Interaction points

- Console entries (1-5) -> `openBrowse(target, source)`: read the account scope (cached), write the tab's pass, `location.assign('/browse#t=…&s=…')` in the same tab
- Scope check failed -> no navigation; [ Try again ] re-checks; [ Open free lessons ] opens with a 1-hour free-lessons pass
- Browser storage blocked -> no navigation; one line "Your browser blocked this page's storage, so lessons cannot open here."
- Gate entry (6) -> writes the gate pass (15 idle minutes) and `location.assign('/browse#s=gate')`
- No entry shows a price, "Premium" or a lock; a free account sees the same controls

## Navigation graph

Enter from: the host screens listed above
Exit to: `browse/home` · `browse/episode` · `browse/item` · back to the host via [ Close ]

## States

- **success**: the control is shown; All lessons opens in the same tab.
- **flag off** (`browseEnabled()` false) or console not on the app host: console controls are not rendered (no disabled buttons).
- **not signed in**: console entries are not rendered (the console requires sign-in).
- **native app** (6): the button is hidden off web.
- **check failed**: the inline line with Try again and Open free lessons.

## Data needs

- reads (console): `GET /api/entitlements/browse` (`{ scope }`, cached per page)
- reads (gate): the device's cached access tier per profile, read in the learner app only
- writes: the tab's `sessionStorage` pass (`hr:browse:pass`); nothing else
- links carry content ids and a source code only (`#t=…&s=…`), never a learner id, name, alias or summary value

## Open questions

- None blocking. A school admin who teaches no class sees **Lessons** too (scope from the school's licence).
