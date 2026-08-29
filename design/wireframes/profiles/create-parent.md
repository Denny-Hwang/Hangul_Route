# Profiles/Create-Parent — first-run parent onboarding (wireframe v1)

Spec: `docs/specs/F-PROF-001-device-profiles.md` §3.2
Audience: **parent** (adult surface — child never sees this on a set-up device)

## Scenario (Given-When-Then)

Given: a fresh install with zero profiles
When: the app launches for the first time
Then: the parent creates the parent profile (name + 4-digit PIN) before any learner profile exists

## Screen goal

"Create the one parent profile: name + PIN, nothing else."

## Box diagram

```
Step 1 of 2 — name                    Step 2 of 2 — PIN
┌──────────────────────────────┐      ┌──────────────────────────────┐
│ [← back*]        step 1 / 2  │      │ [← back]         step 2 / 2  │
│                              │      │                              │
│  [Hoya waving, small]        │      │  "Choose a 4-digit PIN"      │
│  "Grown-up sets up first"    │      │  (placeholder, 1 line)       │
│  (placeholder, 1 line)       │      │                              │
│                              │      │        ● ● ○ ○               │  ← dots only, never digits
│  Your name                   │      │                              │
│  [ text field, 1–12 chars ]  │      │   [1] [2] [3]                │
│                              │      │   [4] [5] [6]                │
│                              │      │   [7] [8] [9]                │
│                              │      │   [⌫]  [0]                   │
│  [[ NEXT ]]                  │      │                              │
│                              │      │  [[ CONFIRM PIN ]]           │  ← enabled after re-entry match
└──────────────────────────────┘      └──────────────────────────────┘
* back on step 1 exits to nothing (root of first-run) — hidden on true first run
```

- PIN step repeats once for confirmation ("enter it again" placeholder); mismatch shakes dots + short retry line, no shame copy.
- Keypad targets ≥ 64 dp (adult surface but same accessibility floor).

## Interaction points

- Name field: free text 1–12 chars, no emoji, no Korean/Chinese (UI = English); inline length counter
- [[ NEXT ]] → step 2 (disabled until name valid)
- Keypad taps fill dots; 4th digit auto-advances to confirm pass
- [[ CONFIRM PIN ]] → hash (bcrypt cost 10) → save parent profile → `profiles/create-learner` (forced next — a parent profile alone can't finish onboarding)

## Navigation graph

Enter from: splash (first run, zero profiles) · migration prompt (v1.0 upgrade path, F-PROF-001 §7)
Exit to:    `profiles/create-learner` (only forward path) · no skip, no other exits

## States

- **success**: flow above.
- **empty**: n/a (this flow *is* the empty state of the app).
- **error** (storage write fails): stay on step, "short retry line" + [[ TRY AGAIN ]]; PIN kept in memory so parent doesn't re-enter.

## Data needs

- writes: parent `Profile` (role: parent) via `profile-store.createProfile` · `parent.<profileId>.pin_hash` (bcrypt) via `platform/storage`
- reads: none (fresh install)
- session: successful creation opens the 15-min parent session window (so "add learner" needs no immediate re-PIN)

## Open questions

- Migration path (existing v1.0 data → wrap in "Default" learner): shown before or after parent creation? (spec §7 says on first run after upgrade — wireframe as a pre-step interstitial, separate file when scheduled)
- Offer PIN "show once" toggle for adults? Spec §3.5 says never echo digits — keeping dots-only unless beta shows lockouts
