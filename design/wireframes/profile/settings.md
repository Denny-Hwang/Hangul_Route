# Profile/Settings — who's playing, plan, sound, grown-ups (wireframe v1)

Spec: `docs/specs/F-SUB-001-subscription-entitlement.md` §3 (plan status on this screen) · `docs/specs/F-PROF-001-device-profiles.md` §3.4 (switch), §3.2 (add learner) · `docs/blueprints/10-app-map.md` §3.1 (A10), §4.1–4.2 (reserved exits)
Audience: **learner (P4/P5 child, 5–11)** for the top half · **parent** (and teacher role, future) for the bottom half — grown-up rows always sit below the child rows, never mixed
Code (back-filled): `apps/mobile/src/screens/profile/ProfileScreen.tsx` — route `Profile` (from the Home avatar corner)

## Scenario (Given-When-Then)

Given: a learner (or a parent holding the device) taps the avatar corner on Home
When: the page renders
Then: a child can switch to their own tiger tile or mute the sound in one tap; everything that costs money, deletes data or shows adult information sits behind a gate lower on the page

## Screen goal

"Switch profile or mute sound (child); reach the grown-up surfaces (adult)."

## Box diagram

```
+----------------------------------+
| [<- back]     Profiles           |
|  1 muted line "tap a Hoya to     |
|  switch"                         |
|  +----------+  +----------+      |
|  | [HOYA]   |  | [HOYA]   |      |  <- profile tiles, active one highlighted
|  |  Suni    |  |  Minho   |      |     + "playing now" pill; age group caption
|  +----------+  +----------+      |
|  [ + Add a profile ]             |  -> profiles/create-learner
|                                  |
|  Sound                [ on/off ] |  <- mute toggle (planned; not in code)
|                                  |
|  My stats                        |
|  +----------------------------+  |
|  | quests done . cards        |  |  <- 2 numbers (see open q on streak)
|  +----------------------------+  |
|                                  |
|  Plan                            |
|  +----------------------------+  |
|  | Free plan / Premium  [pill]|  |  <- F-SUB-001 sec.3; 1 line what it unlocks
|  | [ Unlock the journey ]     |  |  -> paywall/upgrade (FUTURE, parent-gated)
|  +----------------------------+  |
|                                  |
|  --- Grown-ups ------------------|  <- visual break; adult rows below
|  [ Grown-up zone ]      >        |  -> parent/gate (today) / profiles/pin-entry (target)
|  [ Save my progress ]   >        |  -> sync/save-progress (FUTURE)
|  [ Join a class or family ] >    |  -> sync/join-space (FUTURE)
|  [ Account ]            >        |  -> console/account (FUTURE, gated)
|  [ Projection mode ]    >        |  -> classroom/projection-mode (FUTURE, teacher role only)
+----------------------------------+
```

- Reserved rows render only when their feature exists (no dead rows in a child's hands). Order is fixed now so the page never reshuffles as features land.
- No "sign out": switching is the only exit (F-PROF-001 §3.6).

## Interaction points

- Profile tile tap → `setActive(profileId)`; stays on this page with the new tile highlighted (learner → learner needs no PIN, §3.4)
- [ + Add a profile ] → `profiles/create-learner` (`Onboarding/CreateProfile { firstRun: false }`); PIN-gated per §3.2 (15-min parent session) — **not gated in code**
- Sound toggle → `ui-store` mute flag (planned)
- [ Unlock the journey ] → `profiles/pin-entry` → `paywall/upgrade` (future, R)
- [ Grown-up zone ] → `parent/gate` → `parent/dashboard` (today); target: `profiles/pin-entry`
- [ Save my progress ] → `sync/save-progress` · [ Join a class or family ] → `sync/join-space` · [ Account ] → gate → `console/account` · [ Projection mode ] → `classroom/projection-mode` (all future; IDs per app-map §4.2)
- [<- back] → `home/todays-mission`

## Navigation graph

Enter from: `home/todays-mission` (avatar corner) · `profiles/switch-button` (component)
Exit to:    `profiles/create-learner` · `parent/gate` · `parent/dashboard` · future: `paywall/upgrade` · `sync/save-progress` · `sync/join-space` · `console/account` · `classroom/projection-mode`

## States

- **success**: ≥ 1 learner tile, plan card, grown-up rows.
- **empty** (only one profile, no progress): single tile + add button; stats show zeros without commentary; plan = Free.
- **error** (subscription unreadable): plan card shows Free with one muted "checking your plan" line (never block content on entitlement) · progress unreadable → stats card hidden, rest works.

## Data needs

- reads: `profiles[]`, `activeProfile` (profile-store) · `ProgressSnapshot` (quests done, cards) · `account-store.subscription` → `entitlementTier(subscription, now)` · role of the active adult (future: teacher rows)
- writes: `setActive`; mute flag (planned)
- telemetry: `profile.switched` (existing pattern), `settings.grownups_opened` (candidate)

## Open questions

- **Discrepancy**: app-map A10 lists a sound mute; no toggle exists in code (`ui-store` has no mute). Add with the next audio PR.
- **Discrepancy**: stats show a **Streak** number; streak framing is an explicit F-RVW-001 §4 anti-pattern. Drop it from the child-visible page (keep quests + cards)?
- **Discrepancy**: no back control and the page title is "Profiles" while app-map calls it settings. Rename in mid-fi.
- Add-profile is not PIN-gated in code (F-PROF-001 §3.2 says it is within a parent session). Fix in code or relax the spec?
