# Browse/Access — no pass yet, expired, or waiting for one (wireframe v1)

Spec: `docs/specs/F-BROWSE-001-adult-content-browser.md` §4.2, §4.3 (Access screen), §8
Audience: whoever reached `app.hangulroute.com/browse` without a valid pass: a grown-up who opened a plain link, a grown-up whose gate session ended, or a learner on a shared device. It must show **no lesson, title or card**.
Code (planned): `apps/mobile/src/screens/browse/BrowseAccessScreen.tsx`
Notation: as `browse/home.md`.

## Scenario (Given-When-Then)

Given: Browse opened without a pass from the console, a kept pass or a gate hand-off (or the pass expired)
When: the 3-second wait for a pass ends
Then: the visitor learns that Browse is for grown-up accounts and how to open it, and sees nothing else

## Screen goal

"Open Browse the right way." (one action: sign in)

## Box diagram

### A. No pass (reason `none`)

```
┌──────────────────────────────────┐
│ [< Back to the app]              │   -> learner app root (/)
│                                  │
│            (Hoya waving)         │
│                                  │
│  Browse lessons is for grown-up  │
│  accounts.                       │
│                                  │
│  [[        Sign in         ]]    │   -> adult sign-in (persona shell; until then console /teach)
│                                  │
│  On a family tablet, open it     │   plain text, no link (the grown-up area needs the PIN)
│  from the grown-up area of the   │
│  app.                            │
└──────────────────────────────────┘
```

### B. Expired (reason `expired`)

```
│  Your preview time ended.        │
│  Open Browse again from your     │
│  account or the grown-up area.   │
│  [[        Sign in         ]]    │
```

### C. Waiting (reason `waiting`, between 1 s and 3 s)

```
│  Getting your lessons ready…     │   no spinner loop longer than 3 s; then A
```

## Interaction points

- [[ Sign in ]] -> adult sign-in URL (new tab when opened from a script, same tab otherwise)
- [< Back to the app] -> `/` (the learner app; no PIN bypass, it simply reloads the learner root)
- A pass arriving while this screen shows -> replaces it with `browse/home` (or the resolved deep-link target)

## Navigation graph

Enter from: browse root boot with no pass · a gate pass that expired · any navigation after expiry
Exit to: `browse/home` (pass arrives) · adult sign-in · learner app

## States

- **none / expired / waiting**: A / B / C.
- **offline with no kept pass**: A, plus one line "Connect to the internet to sign in."
- **error**: none possible beyond the learner `OopsScreen`; the screen has no data.

## Data needs

- reads: the pass state only
- writes: none (an expired `browse:pass` is removed by the pass logic before this screen renders)
- telemetry: `browse.opened { scope: 'none', passFrom: 'none' }` (sent by the root, not this screen)

## Open questions

- None. OD-3 records the alternative (a sampler for signed-out visitors); the default shows nothing.
