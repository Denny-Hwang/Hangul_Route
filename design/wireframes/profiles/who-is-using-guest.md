# Profiles / Who is using this? with the guest tiles: Try the first quest, the guest's own tile (wireframe v1)

Spec: `docs/specs/AMENDMENTS-GUEST-FIRST-LESSON.md` sections 6.1, 9, 10 (row GU-5) · extends `profiles/who-is-using.md` (`AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` section 6) with Panels L to O; every other panel of that file is unchanged · `profiles/people-on-device.md` gains Panel P's row
Audience: **anyone** arriving from the site's Start learning on a device that already has learner profiles (a family tablet, a classroom laptop); **grown-up** for Panel P
Route: learner app `WhoIsUsing` (OA-4a), trigger `try` (new) or any trigger while a guest lives
Web only; both `EXPO_PUBLIC_WHO_CHOOSER` and `EXPO_PUBLIC_GUEST_LESSON` on

## User scenario (Given-When-Then)

Given: a family tablet with two children's profiles, where a visiting friend opens hangulroute.com and presses Start learning
When: the app opens
Then: the chooser asks who is using it, as on any launch of a shared device, and offers one extra tile, **Try the first quest**, so the friend plays without a profile and without touching either child's history; nothing about the guest shows anyone's progress

## Screen goal

"Pick who you are, or try without a profile." The guest tile is a learner-side tile: one tap, no PIN.

## Box diagram

Panel L — opened by the site's Start learning (trigger `try`), no live guest

```
+--------------------------------+
|                        ( Aa )  |
| Who is using this?             |
| Learning                       |
| +-----------+ +-----------+    |
| | (Hoya)    | | (Hoya)    |    |
| | Mina      | | Jun       |    |
| +-----------+ +-----------+    |
| +- - - - - -+ +- - - - - -+    |
| |   [+]     | |   [>]     |    |  <- Add a learner (gated, as today) · Try the first quest (dashed)
| | Add a     | | Try the   |    |
| | learner   | | first     |    |
| |           | | quest     |    |
| |           | | No profile|    |  <- line under the label
| |           | | needed    |    |
| +- - - - - -+ +- - - - - -+    |
|--------------------------------|
| Grown-ups ...  (unchanged)     |
+--------------------------------+
  Try the first quest -> onboarding/guest-first-quest.md Panel A (G1: 3 taps: Start learning, this tile, Continue)
```

Panel M — a guest lives on the device (any trigger)

```
| +-----------+ +-----------+    |
| | (Hoya)    | | (Hoya)    |    |
| | Mina      | | Jun       |    |
| +-----------+ +-----------+    |
| +- - - - - -+ +-----------+    |
| |   [+]     | | (Hoya)    |    |  <- the guest's tile: default cub, idle pose
| | Add a     | | First     |    |
| | learner   | | quest     |    |
| |           | | Not saved |    |  <- caption; never stars, cards, a count or a time
| |           | | yet       |    |
| +- - - - - -+ +-----------+    |
  The guest's tile -> the guest run (quest 1, or the Not now card when it is done)
  The Try the first quest tile is not shown at the same time (one guest per device)
```

Panel N — opened by a held class code (trigger `join`): no guest tile of any kind

```
| Who is using this?             |
| Pick who is joining.           |
| [Mina]  [Jun]  [ + Add ]       |  <- joining needs a profile; no Try the first quest
```

Panel O — launch, resume or Switch without a live guest: no guest tile (as `who-is-using.md` Panel A)

Panel P — People on this device (Grown-up area), a guest lives

```
| People on this device          |
| (Mina row, Jun row, as OA-7a)  |
| First quest, not saved       > |  <- the guest's row, no name
|   [ Remove the first quest ]   |  -> fresh PIN (2 min) -> ConfirmSheet:
|                                |     "The card and stars of this quest are removed from this browser."
|                                |     -> the sweep (every per-profile key with the guest's id)
```

## Interaction points

- **Try the first quest** -> a new guest run (`who.picked { kind: 'try' }`, `guest.started { via: 'chooser', resumed: false }`); arrival at the chooser already closed any grown-up session (OA-D5).
- **The guest's tile** -> the guest run resumes (`who.picked { kind: 'guest' }`, `guest.started { via: 'chooser', resumed: true }`).
- Learner tiles, locked tiles, Add a learner and the grown-up rows: unchanged (`who-is-using.md`).
- Stop in a guest run on this device -> back here (trigger `manual`), where Panel M shows.
- **Remove the first quest** (Panel P) -> fresh PIN, ConfirmSheet, the sweep; never touches the server (there is nothing there).

## Entry and exit

Enter from: the site's Start learning on a device with profiles (`try=1`, trigger `try`) · every trigger of `who-is-using.md` while a guest lives · Stop in a guest run
Exit to: `onboarding/guest-first-quest.md` Panel A · the Not now card (`onboarding/guest-save.md` E) · learner Home · `profiles/pin-entry`

## States

- **success**: L, M.
- **join**: N (no guest tile).
- **no guest, ordinary trigger**: O (no guest tile).
- **switch off** (guest or chooser): `try=1` is ignored; the launch is the one of `who-is-using.md` or today's.
- **classroom device** (13 or more profiles): the guest tile sits after Add a learner at the end of the sorted grid.

## Accessibility

- Accessible names: "Try the first quest without a profile." and "First quest, not saved yet. Tap to keep going."
- The dashed outline is not the only cue: the tile has its own label and line.
- Reading order: learner tiles, Add a learner, the guest tile, the grown-ups section.

## Data needs

- Reads: `hr:guest` (live or not, quest done or not), the boot intent (`try`), plus everything `who-is-using.md` reads.
- Writes: `hr:guest` when Try the first quest starts a run (under the `hr:profiles` Web Lock, `hr-profiles` `changed`); nothing in `hr:profiles` or `hr:profiles:active`.

## Open questions

- OQ-G8 (show Try the first quest on every chooser): default no (spec section 21).
