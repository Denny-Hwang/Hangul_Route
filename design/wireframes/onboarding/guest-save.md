# Onboarding / Guest save: Results, the gate, the name, Privacy, Not now (wireframe v1)

Spec: `docs/specs/AMENDMENTS-GUEST-FIRST-LESSON.md` sections 5.4, 7.1, 8, 10, 14 (rows GU-4, GU-0b) · reuses `results/celebrate.md` (the card and stars), `onboarding/setup-steps.md` (panels C to E: the agreement cards, the under-13 latch), `profiles/pin-entry-v2.md` (the PIN pad)
Audience: the person who just finished quest 1 as a guest: a learner of any age, or a grown-up who takes over to save it for someone they look after
Route: `Guest/Results` (guest variant) -> `PinEntry { next: 'SaveGuest' }` (gated device only) -> `CreateProfile { firstRun, from: 'guest' }` (two steps) -> `Main/Home`; `Guest/GuestLater` for Not now

Panels:

- A. Results, guest variant (card earned / no card / a device with profiles and no PIN)
- B. The gate on a device with a PIN (verify only)
- C. Step 1 of 2, the name
- D. Step 2 of 2, Privacy: who is learning, then the card, with Add an email closed and open
- E. Not now (`GuestLater`)
- F. The first Home
- G. States

Copy in boxes is the English the spec fixes in section 16; everything else is a placeholder.

## User scenario (Given-When-Then)

Given: a guest who just finished quest 1 (and, with 2 stars or more, earned its Heritage card)
When: Results shows
Then: they can keep it all with one primary action, give a name, say who is learning and agree on one Privacy step, and land on their own Home with the card already in the Library; or they can say Not now and come back later without losing anything

## Screen goal

"Keep what you just earned." One primary action per screen; the agreement stays its own clear step.

## Box diagram

Panel A — Results, guest variant

```
A1: card earned (2 or 3 stars)       A2: no card (0 or 1 star)
+--------------------------------+   +--------------------------------+
|         [HOYA cheering]        |   |         [HOYA thinking]        |
|      (tier word, as today)     |   |      (tier word, as today)     |
|            * * o               |   |            * o o               |
| +----------------------------+ |   |                                |
| | New card for your library! | |   |                                |
| | [art]  (card name, ko, rom)| |   |                                |
| | [ See my card ]            | |  -> CardDetail (Close returns here)
| +----------------------------+ |   |                                |
| ( Add a name so Hoya can keep  |   | ( Add a name so Hoya can keep  |
|   your card and stars. )       |   |   your first quest. )          |
| [[    KEEP MY PROGRESS    ]]   |   | [[    KEEP MY PROGRESS    ]]   |  <- the ONE primary -> B (a PIN is set) or C
| A grown-up on this device adds |   |                                |  <- caption, only when a PIN is set (case verify)
| you with the PIN.              |   |                                |
|          [ Not now ]           |   |          [ Not now ]           |  <- quiet text button -> E
+--------------------------------+   +--------------------------------+
  Not drawn: next-quest teaser, Episode page, Back to Journey, stage prize, practice, the profile's name row,
  the locked-quest Paywall / PinEntry hand-off
  The save card's first line (Hoya's line) is its heading; first focus stays on the tier word.

A3: case owner (learner profiles on the device, no PIN)
+--------------------------------+
|  (Hoya, stars, card as A1/A2)  |
| ( The person who uses this     |  <- askOwner; no Keep my progress, no PIN pad (CS-G10)
|   device can add you. )        |
| [[        NOT NOW         ]]   |  <- the one button -> E
+--------------------------------+
  The owner keeps it later: Grown-up area > People on this device > First quest, not saved >
  Keep as a learner -> C (inside their own grown-up session), see profiles/who-is-using-guest.md Panel P
```

Panel B — the gate (a PIN is stored on the device; never PIN setup)

```
+--------------------------------+
| [x Close]               ( Aa ) |
|  (PIN pad of pin-entry-v2:     |  <- verify only; PinEntry refuses SaveGuest when no PIN is stored
|   dots, keys, pause line)      |
|  (no Forgot PIN?)              |  <- hidden, as for GrownUpUse
+--------------------------------+
  PIN ok -> C (no grown-up session: verifyForLockedProfile)    Close / Cancel -> A
  Asked even if a grown-up session were open (guestSaveGate ignores sessionOpen; none is open in a guest run)
```

Panel C — step 1 of 2

```
+--------------------------------+
| [< Back]                ( Aa ) |  -> A
| Step 1 of 2                    |
| Keep your progress             |  <- heading (focus here)
|                                |
| Name                           |
| [ Type a name              ]   |  <- validateDisplayName, NAME_MAX, today's hints
| You can pick a Hoya and a      |
| reading level later in         |
| Profile.                       |
|                                |
| [[        CONTINUE        ]]   |  -> D
| Type a name                    |  <- calm caption while disabled
+--------------------------------+
```

Panel D — step 2 of 2, Privacy

```
D1: before an answer                 D2: "Me", Add an email closed      D3: Add an email open
+--------------------------------+   +--------------------------------+  +--------------------------------+
| [< Back]                ( Aa ) |   | [< Back]                ( Aa ) |  | ...                            |
| Step 2 of 2                    |   | Step 2 of 2                    |  | | Before you start         |   |
| Privacy                        |   | Privacy                        |  | | (body)                   |   |
| Who is learning?               |   | Who is learning?               |  | | [x] Add an email (opt.)  |   |  <- expanded; closing clears it
| ( ) Me                         |   | (o) Me                         |  | | Email (optional)         |   |
|     I'm setting this up for    |   | ( ) Someone I look after (a    |  | | (caption, as today)      |   |
|     myself.                    |   |     child or a student)        |  | | [ name@email.com     ]   |   |
| ( ) Someone I look after (a    |   | +----------------------------+ |  | | [ ] I'm 13 or older and  |   |
|     child or a student)        |   | | Before you start           | |  | |     I agree to the ...   |   |
|     I'm a parent, guardian or  |   | | (body)                     | |  | +--------------------------+   |
|     teacher, setting it up...  |   | | [+] Add an email (optional)| |  <- collapsed row, button with state
| This doesn't change the        |   | | [ ] I'm 13 or older and I  | |  |                                |
| lessons.                       |   | |     agree to the Privacy   | |  |                                |  <- D1 line: always lessons.plain (no level check follows)
|                                |   | |     Policy.                | |  |                                |
| [[   CONTINUE (disabled)  ]]   |   | | Read the Privacy Policy    | |  -> privacyUrl() (fallback line)
| Choose who is learning         |   | | [+] Protect settings with  | |
+--------------------------------+   | |     a PIN (optional)       | |
                                     | +----------------------------+ |
                                     | [ I'm under 13 ]               |  -> the grown-up card, latch (setup-steps D)
                                     | Agreeing doesn't change the    |
                                     | lessons.                       |
                                     | +----------------------------+ |
                                     | | (Hoya) Ready to go!        | |  <- readyLine
                                     | +----------------------------+ |
                                     | [[        CONTINUE        ]]   |  -> promoteGuest -> F
                                     +--------------------------------+

D4: "Someone I look after": the grown-up card of setup-steps E (PIN twice when the device has none),
    with the same collapsed [+] Add an email (optional) row in place of the email field.
D5: the device already holds the consent this answer needs (and a PIN for a child):
    the who cards, then the Ready to go! card, then Continue (no agreement card).
```

Panel E — Not now (`GuestLater`)

```
+--------------------------------+
|          [HOYA idle]           |
| Hoya can keep your quest in    |  <- heading, first focus; {days} = 30, or 7 on a
| this browser for up to 30 days |     device with learner profiles
| without play.                  |
| It isn't backed up yet. Add a  |
| name to back it up and keep    |
| going.                         |
| [[      ADD MY NAME       ]]   |  -> B (a PIN is set) or C; case owner: the askOwner line instead
|          [ Close ]             |  -> Welcome (no profile) or the chooser (device with profiles)
+--------------------------------+
```

Panel F — the first Home of the new profile

```
+--------------------------------+
| (Hoya) Hi, Sam!   ( Aa )(Profile)|  <- the learner's Home as for any new profile
| ( Sam, your card is in your    |  <- one bubble on the first render (no card: "Sam, your first
|   Library. )                   |     quest is saved.")
| (next-lesson hero, as today)   |  <- quest 2 next; quest 1 shows done on Journey
| (level-check card, as today)   |  <- shown until three quests are done; nothing recorded for the fork
+--------------------------------+
```

## Interaction points

- **Keep my progress** -> B when a PIN is stored (`guestSaveGate` `verify`), C on a device with no profile and no PIN (`open`); on a device with profiles and no PIN (`owner`) it is not drawn (A3).
- **See my card** -> CardDetail; Close returns to A.
- **Not now** -> E (`guest.left { at: 'save' }`); nothing is removed.
- B: PIN ok -> C; it opens no grown-up session and gives no fresh-PIN credit. Cancel -> A.
- C: **Continue** -> D; **Back** -> A.
- D: the who cards (no preselected answer); **Add an email** toggles the field; **I'm under 13** switches to the grown-up card and latches; **Continue** -> the stores in F-LEARN-001 order, then `promoteGuest` (same id), then `hr:guest` deleted -> F; `guest.saved`, `onboarding.started { firstRun, fromGuest: true }`.
- E: **Add my name** -> B or C; **Close** -> Welcome or the chooser.

## Entry and exit

Enter from: quest 1 finished in a guest run · Welcome **Add my name** (`onboarding/guest-first-quest.md` D2) · a reopen within 30 minutes after quest 1 (E) · People on this device **Keep as a learner** (C, grown-up session)
Exit to: learner Home (F) · People on this device (after Keep as a learner) · Welcome · `profiles/who-is-using`

## States

- **success**: A to F.
- **incomplete**: C without a valid name; D without an answer, an unticked box, a missing PIN, an email that looks off (today's captions).
- **error**: the PIN could not be set ("Couldn't set the PIN. Try again.", today's line); a profile write that fails keeps the guest and shows today's calm error with Try again (nothing is lost: the data is still under the guest's id).
- **offline**: every panel works; the new learner registers when the network returns; the Privacy Policy link shows its fallback line.
- **two tabs**: a save in one tab ends the guest run in the other, which shows the new profile's Home on its next screen change.

## Accessibility

- Focus moves to each step's heading ("Step 2 of 2. Privacy"); after I'm under 13, to the switch note (as setup-steps).
- **Add an email** is a disclosure button with `expanded`; opening it moves focus to the field.
- Results reading order: Hoya, stars, card, Hoya's line (the save card's heading), Keep my progress, the gate caption, Not now.
- E: its first line is the heading and takes focus when the card opens.
- 64 dp targets; option cards at least `touchTarget.child`; text sizes up to Largest; no colour-only cue.

## Data needs

- Reads: `hr:guest`, the consent timestamps and PIN hash (`account-store`), `hr:profiles` (for `guestSaveGated`), the quest's result (stars, the new card).
- Writes (on the last Continue only): consent, PIN hash, email (when typed), then `hr:profiles` with the guest's id and `hr:profiles:active`, then the deletion of `hr:guest`.
- Never before the last Continue: anything about the learner to the server.

## Open questions

- OQ-G5 (G4 target), OQ-G6 (fold the email in the ordinary first run too): defaults in spec section 21.
