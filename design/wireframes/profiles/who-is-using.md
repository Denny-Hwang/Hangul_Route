# Profiles/Who-is-using — one chooser for every learner and grown-up use of a device (wireframe v1)

Spec: `docs/specs/AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` sections 5, 6, 7.3, 9, 14 (rows OA-4a, OA-4b, OA-5) · supersedes `profiles/picker.md` · keeps `profiles/switch-button.md` (the Home corner button now opens this screen)
Audience: **learner** first (any age; many are children), **grown-up** second (parent, teacher, school admin on the same account)
Route: learner app `WhoIsUsing` (root stack, above `Main`; no Back)
Mock: `design/screens/profiles/who-is-using.md` (row OA-0b)
Guest tiles [GU]: Panels L to O (and P for People on this device, Q for the PIN setup) are in `profiles/who-is-using-guest.md` (`AMENDMENTS-GUEST-FIRST-LESSON.md`, row GU-5)

## Scenario (Given-When-Then)

Given: a family tablet with two children's profiles and the parent's own "Me" profile (locked), where the parent has signed in to an account that holds a family and a class
When: the app opens after the night, or the parent leaves the console with **Learner app**
Then: each child finds their own tile and starts with one tap; the parent's own profile and the Family and Teacher uses ask the grown-up PIN; nothing on the screen compares anyone

## Screen goal

"Pick who you are." One tap for a learner. Grown-up uses are visibly secondary and always behind the PIN.

## Box diagram

Panel A — phone 360 x 740, web, shared family device, account uses known (Family, Teacher)

```
+--------------------------------+
|                        ( Aa )  |  <- ScreenHeader: Display only; no Back
| Who is using this?             |  <- title (focus starts here)
|                                |
| Learning                       |  <- section label
| +-----------+ +-----------+    |
| | (Hoya)    | | (Hoya)    |    |  <- tiles >= touchTarget.hero, avatar idle pose
| | Mina      | | Jun       |    |     name only: no stars, cards, level, streak, space
| +-----------+ +-----------+    |
| +-----------+ +- - - - - -+    |
| | (Hoya)[L] | |   [+]     |    |  <- [L] lock glyph + caption on a locked tile
| | Sora      | | Add a     |    |  <- dashed tile; gated as today
| | A grown-up| | learner   |    |
| | opens this| +- - - - - -+    |
| +-----------+                  |
|--------------------------------|
| Grown-ups                      |  <- section label, body size, smaller than tiles
| [L] Family                   > |  <- PIN (verify only) -> /parent
| [L] Teacher                  > |  <- PIN (verify only) -> /teach
| [L] Grown-up area            > |  <- PIN as today -> local Grown-up area
+--------------------------------+
```

Panel B — tablet landscape, classroom device, 26 learner profiles (13+ -> sorted by name)

```
+------------------------------------------------------------------+
| Who is using this?                                        ( Aa ) |
| Learning                                                         |
| [Ana] [Ben] [Chloe] [Dami] [Eli] [Farah]                          |  <- 6 per row at this width
| [Gus] [Hana] [Ivan] ...                                           |  <- grid scrolls; arrow keys rove (web)
| ...                                          [ + Add a learner ]  |
|------------------------------------------------------------------|
| Grown-ups:  [L] Teacher >   [L] School >   [L] Grown-up area >    |  <- School: account owns or administers a school
+------------------------------------------------------------------+
```

Panel C — native build (no sign-in until F-AUTH-004): only the device's Grown-up area; Family, Teacher and School are web-only

```
| Grown-ups                      |
| [L] Grown-up area            > |
```

Panel D — web, no use known on this device (never signed in here, or the record is older than 30 days)

```
| Grown-ups                      |
| [L] Sign in as a grown-up    > |  <- PIN (if the device has one) -> /signin
| [L] Grown-up area            > |
```

Panel E — offline (web)

```
| Grown-ups                      |
| [L] Family          (disabled) |
|     Needs the internet         |
| [L] Teacher         (disabled) |
|     Needs the internet         |
| [L] Grown-up area            > |  <- works offline
```

Panel F — profile locks could not be read (two tries), the device has a PIN

```
| Who is using this?             |
| Tap a name, then a grown-up    |  <- calm line, not an error
| enters the PIN.                |
| [Mina][L] [Jun][L] [Sora][L]   |  <- every tile treated as locked until a read succeeds
```

Panel G — opened over a quest after 30 minutes in the background (any pick other than Mina, grown-up rows included, saves the quest first; coming back from a grown-up use lands on this chooser, not the quest)

```
+--------------------------------+
| (quest screen dimmed under)    |
| Who is using this?             |
| [Mina]  [Jun]  [Sora][L]       |  <- Mina (who was playing) -> the quest continues where it was
| Grown-ups ...                  |  <- anyone else -> the quest is saved first, then the switch
+--------------------------------+
```

Panel H — a Forgot PIN wait is running (OA-D21)

```
|--------------------------------|
| Grown-ups                      |
| A new grown-up PIN can be set  |  <- calm line, no names, no count of tries
| after 6:40 PM. Enter the PIN   |
| to cancel.                     |
| [ Cancel the wait ]            |  -> PinEntry verify only (CancelReset) -> back here
| [L] Family                   > |
| [L] Grown-up area            > |
```

Panel I — opened by the class join link or a held join code on a shared device (OA-D20)

```
| Who is using this?             |
| Pick who is joining.           |  <- caption; the code is held in memory, not in the URL
| [Mina]  [Jun]  [Sora][L]       |  -> Join, prefilled for the learner picked
```

Panel J — device with child profiles and no PIN yet (marker `nopin`)

```
| Grown-ups                      |
| [L] Grown-up area            > |
|     A grown-up sets a PIN here.|  <- caption so a grown-up, not a child, does the setup
```

Panel K — two profiles with the same avatar

```
| +-----------+ +-----------+    |
| | (Hoya)    | | (Hoya)    |    |  <- same avatar: each tile gets a distinct colors.theme tint
| | Mina  t1  | | Jun   t2  |    |     (never a ranking or feedback colour); Create and Edit profile
| +-----------+ +-----------+    |     offer an unused avatar first
```

## Interaction points

- Learner tile -> that learner's Home within 300 ms; `profile.switch { via: 'chooser' }`, `who.picked`.
- Locked tile -> `profiles/pin-entry` verify only (`LockedProfile`), Cancel -> back here; never opens a grown-up session.
- Family / Teacher / School row -> `profiles/pin-entry` verify only (`GrownUpUse`), then the hand-off to the console; Cancel -> back here.
- Grown-up area row -> `profiles/pin-entry` as today (setup when the device has no PIN).
- Add a learner -> gate -> create profile (F-LEARN-001), then back here.
- Arriving here always ends the grown-up session, clears the console unlock of the tab and tells other tabs to lock (`hr-grownup`).
- A learner switch from anywhere else (Profile tiles, a locked-tile unlock, removal) also ends the grown-up session; so does leaving the Grown-up area for a learner screen.
- Android hardware back: does nothing here.

## Entry and exit

Enter from: cold launch (shared device, or a locked active profile) · the class join link or a held join code on a shared device · `who=1` boot intent (console **Learner app** exit, Open the app on this device) · resume after 30 min in the background (shared device; 5 min when the active profile is locked) · Home **Switch** · Profile **Who is using this?** row · Grown-up area **Switch user**
Exit to: learner Home · `profiles/pin-entry` (locked tile, any grown-up row, Add a learner)

## States

- **success**: Panels A to E, H to K.
- **locks unreadable**: Panel F.
- **store unreadable** (`hr:profiles`): full-screen Hoya, a short reassurance line and **Try again**; never wipes data.
- **empty** (no profile): never renders; Welcome and onboarding as today.
- **single learner, no grown-up use, no lock**: not shown at launch (straight to Home); still reachable from Profile and the Grown-up area.

## Accessibility

- Reading order: title, learners, Add a learner, grown-ups. Tile names: "Mina. Tap to start learning."; locked: "Sora, locked. A grown-up PIN opens it."; rows: "Family, for grown-ups, needs the PIN".
- The lock is a glyph and a caption, never colour alone. Text sizes up to Largest: tiles drop to one column before a name truncates.
- Web keyboard: the grid is one tab stop with arrow keys, Home and End; rows are buttons.

## Data needs

- `hr:profiles` (names, avatars), `hr:profiles:locks`, `hr-shell` / `kv` `deviceUses` (web, read-only), the device gate marker (lock glyph or not), `navigator.onLine`.
- Writes: `hr:profiles:active` on a learner pick; nothing else.

## Owner decisions (spec section 23, decided 2026-10-21)

- OQ-1 launch condition, OQ-2 resume time, OQ-10 School row, OQ-11 tile order: the defaults above are decided.
