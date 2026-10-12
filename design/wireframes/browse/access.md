# Browse/Access — no pass, or the pass ended (wireframe v2)

Spec: `docs/specs/F-BROWSE-001-adult-content-browser.md` §4.3 (Access screen), §8
Audience: whoever reached `app.hangulroute.com/browse` without an active pass: a grown-up whose tab or time ended, a family that uses only the learner app, or a learner on a shared device. It must show **no lesson, title or card**.
Code (planned): `apps/mobile/src/screens/browse/BrowseAccessScreen.tsx`
Notation: as `browse/home.md`.

v2 (review of 2026-10-11): the primary action follows how the visitor arrived (grown-up area, account, or unknown); no "waiting" state (the pass is read at once from the tab); every account link goes to a grown-up page that sits behind sign-in and the grown-up lock.

## Scenario (Given-When-Then)

Given: All lessons opened without an active pass (none in this tab, none kept, or the gate pass idled out)
When: the root resolves the pass
Then: the visitor learns that the page is for parents and teachers and gets the one action that brings them back, and sees nothing else

## Screen goal

"Get back in the right way." (one primary action, chosen by source)

## Box diagram

### A. Gate source (the grown-up area pass ended)

```
┌──────────────────────────────────┐
│            (Hoya waving)         │
│                                  │
│  This page is for parents and    │
│  teachers.                       │
│  Your time in the grown-up area  │
│  ended.                          │
│                                  │
│ [[ Back to the grown-up area ]]  │   -> /?gate=browse : PIN, then a fresh gate pass
│ [ Back to the app ]              │   -> / (learner app)
└──────────────────────────────────┘
```

### B. Account source (expired account pass, or this browser remembers a parent / teacher persona)

```
│  This page is for parents and    │
│  teachers.                       │
│  Open lessons again from your    │
│  account.                        │
│ [[ Open lessons from my account ]]│  -> /parent or /teach/home (by the remembered persona)
│ [ Sign in ]                      │   -> /signin (grown-up sign-in, F-APP-001)
```

### C. Unknown source (a typed URL, a new tab)

```
│  This page is for parents and    │
│  teachers.                       │
│  On a family device, open them   │
│  from the grown-up area. Parents │
│  and teachers can also open them │
│  from their account.             │
│ [[ Back to the grown-up area ]]  │   -> /?gate=browse
│ [ Sign in ]                      │   -> /signin
```

## Interaction points

- [[ Back to the grown-up area ]] -> learner app boot intent `gate=browse`: PIN entry over the start screen; correct PIN -> a fresh gate pass -> `browse/home`; cancel -> learner home, nothing written. Until BR-12b ships: [[ Back to the app ]] with "Go back to the app, then open the grown-up area again."
- [[ Open lessons from my account ]] -> the persona home; Clerk sign-in and F-APP-001's grown-up lock (PIN or fresh sign-in on a device with learner profiles) apply there, so a child cannot reach billing or account pages through this screen
- [ Sign in ] -> `/signin`; a signed-in visitor is routed to their persona home, which carries **Lessons**
- [ Back to the app ] -> `/`

## Navigation graph

Enter from: browse root boot with no active pass · any navigation after a gate pass idles out
Exit to: learner app (PIN, then `browse/home`) · persona home · grown-up sign-in · learner app root

## States

- **gate / account / unknown**: A / B / C.
- **offline**: the same panels; account actions add "Grown-up pages need the internet." (the PIN path works offline up to the PIN).
- **error**: none possible beyond the learner `OopsScreen`; the screen has no data.

## Data needs

- reads: the pass state (an expired pass's source) and `shell:lastPersona` (a persona code, never a name)
- writes: none (an expired or corrupt pass is removed by the pass logic before this screen renders)
- telemetry: `browse.opened { scope: 'none', passFrom: 'none' }` (sent by the root, not this screen)

## Open questions

- None. OD-3 records the alternative (a sampler for visitors without a pass); the default shows nothing.
