# Profiles/People-on-device — locks, removing a learner, and Who is joining? (wireframe v1)

Spec: `docs/specs/AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` sections 8.6, 10.3, 10.4, OA-D9 (rows OA-5, OA-7a, OA-7b, OA-9) · extends `profile/profile-split.md` Panel B (Grown-up area)
Audience: **grown-up** (behind the gate)
Routes: learner app `ParentDashboard` (Grown-up area, new section), `EditProfile` (lock switch), `JoinSpace` (Who is joining? step)
Mock: `design/screens/profiles/people-on-device.md` (Panels A to C2) and `who-is-joining.md` (Panels D, E) (row OA-0b)

## Scenario (Given-When-Then)

Given: a parent who also learns on the family tablet, two children, and a family join code from the console
When: the parent opens the Grown-up area
Then: they can lock their own profile, remove an old profile, turn on face or fingerprint, and add both children to the family in one go

## Box diagram

Panel A — Grown-up area, new top section

```
+--------------------------------+
| [< Back] Grown-up area  ( Aa ) |
| [ Switch user ]                |  -> Who is using this? (ends the grown-up session)
|--------------------------------|
| People on this device          |
| (Hoya) Mina                  > |
| (Hoya) Jun                   > |
| (Hoya) Sora      [L] locked  > |
|--------------------------------|
| Face or fingerprint for        |  <- native only, when the device supports strong biometrics
| grown-ups              [ off ] |
| Anyone whose face or           |
| fingerprint is saved on this   |
| device can use it.             |
|--------------------------------|
| Account pages (web)          > |  <- existing rows follow
| Progress backup ...            |
+--------------------------------+
```

Panel B — one person (after tapping Sora)

```
+--------------------------------+
| [< Back] Sora                  |
| Lock with the grown-up PIN [on]|
| Good for a grown-up's own      |
| profile, so nobody else plays  |
| on it.                         |
| (disabled with "Set a grown-up |
|  PIN first." when no PIN)      |
|--------------------------------|
| Edit profile                 > |  <- existing
| See report                   > |  <- existing
|--------------------------------|
| [ Remove from this device ]    |  <- secondary, not red; asks the PIN again when the last one is older than 2 min
+--------------------------------+
```

Panel C — Remove ConfirmSheet, progress not saved anywhere

```
+--------------------------------+
| Remove Jun from this device?   |
| Their progress is only on this |
| device. Save it first to keep  |
| it.                            |
| [[ Save progress first ]]      |  -> Save my progress (existing); the main action
| [ Cancel ]                     |
|   Remove anyway                |  <- quiet text button
+--------------------------------+
```

Panel C2 — Remove anyway, second step

```
+--------------------------------+
| Remove anyway? Their cards and |
| stars on this device will be   |
| gone.                          |
| [[ Keep ]]                     |
| [ Remove ]                     |  <- danger tone, used only for grown-up confirmations
+--------------------------------+
```

"Saved" means registered and nothing waiting to be pushed; before showing the sheet the app tries to sync ("Checking that their progress is saved...").

Saved variant: "Their progress is saved. Their Rescue Code brings it back on any device." and, when the learner is in a family or class, "Their place in a family or class stays. A grown-up can change it in the account pages." Buttons: [[ Remove ]] [ Cancel ].

Panel D — Join with a family code, device with 3 learner profiles: Who is joining?

```
+--------------------------------+
| [< Back] Join                  |
| Kim family                     |  <- the lookup result (existing)
| Who is joining?                |
| Pick each learner on this      |
| device who should join.        |
| [x] (Hoya) Mina   (active)     |
| [x] (Hoya) Jun                 |  <- picking anyone but the active learner asks the PIN first
| [ ] (Hoya) Sora   [L]          |  <- a locked (grown-up's own) profile starts unchecked
|     Takes a family place.      |
| [[ Next ]]                     |  -> name check per learner -> one consent naming each -> joins
+--------------------------------+
```

Panel E — results

```
| 2 of 3 joined.                 |
| Mina: joined                   |
| Jun: joined                    |
| Sora: this family already has  |
| 4 learners. Ask a grown-up in  |
| your family.                   |  <- the [SA] cap line, calm, never "error"
| [[ Done ]]                     |
```

## Interaction points

- Lock switch: `profile.lock_changed`; immediate; the chooser shows the glyph at once.
- Remove: `profile.removed { saved, wasActive }`; removing the active learner opens the chooser; removing the last learner opens Welcome.
- Face or fingerprint switch: turning on asks the system prompt once; any PIN change turns it off.
- Who is joining?: `space.join.batch { picked, joined, refused }`. Class codes skip this step (one learner, roster pick and relink as today). Learners linked for a class on this device are listed disabled. The joins stop at the first network error and offer Try again (a retry is safe).

## States

- People list: 1 to many (scrolls) · lock disabled without a PIN · biometric row hidden on web and on unsupported devices.
- Remove: saved / unsaved / active / last learner.
- Who is joining?: offline (disabled, "Needs the internet") · some refused at the cap · all already members.

## Accessibility

- Switches have their label as their name and announce on and off. The ConfirmSheet traps focus and returns it to Remove on Cancel. Check boxes are real check boxes with the learner's name.
