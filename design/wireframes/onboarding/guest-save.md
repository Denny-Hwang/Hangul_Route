# Onboarding / Guest save: Results, the gate, the name, Privacy, Not now (wireframe v1)

Spec: `docs/specs/AMENDMENTS-GUEST-FIRST-LESSON.md` sections 5.4, 7.1, 8, 10, 14 (rows GU-4, GU-0b) · reuses `results/celebrate.md` (the card and stars), `onboarding/setup-steps.md` (panels C to E: the agreement cards, the under-13 latch), `profiles/pin-entry-v2.md` (the PIN pad)
Audience: the person who just finished quest 1 as a guest: a learner of any age, or a grown-up who takes over to save it for someone they look after
Route: `Guest/Results` (guest variant) -> `PinEntry { next: 'SaveGuest' }` (gated device only) -> `CreateProfile { firstRun, from: 'guest' }` (two steps) -> `Main/Home`; `Guest/GuestLater` for Not now

Panels:

- A. Results, guest variant (card earned / no card)
- B. The gate on a gated device
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
| [[    SAVE MY PROGRESS    ]]   |   | [[    SAVE MY PROGRESS    ]]   |  <- the ONE primary -> B (gated) or C
| A grown-up enters the PIN to   |   |                                |  <- caption, gated device only
| add a learner.                 |   |                                |
|          [ Not now ]           |   |          [ Not now ]           |  <- quiet text button -> E
+--------------------------------+   +--------------------------------+
  Not drawn: next-quest teaser, Episode page, Back to Journey, stage prize, practice
```

Panel B — the gate (any device that already holds a learner profile or a PIN)

```
+--------------------------------+
| [x Close]               ( Aa ) |
|  (PIN pad of pin-entry-v2:     |  <- verify when a PIN exists; setup on a device without one (L8)
|   dots, keys, pause line)      |
|  (no Forgot PIN?)              |  <- hidden, as for GrownUpUse
+--------------------------------+
  PIN ok -> C (no grown-up session: verifyForLockedProfile)    Close / Cancel -> A
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
| You can change the Hoya and    |
| the reading level later in     |
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
| lessons.                       |   | |     agree to the Privacy   | |  |                                |
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
| Hoya keeps your quest in this  |  <- {days} = 30
| browser for 30 days.           |
| It isn't backed up yet. Add a  |
| name to back it up and keep    |
| going.                         |
| [[      ADD MY NAME       ]]   |  -> B (gated) or C
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

- **Save my progress** -> B on a gated device (`guestSaveGated`: a learner profile or a PIN on the device), else C.
- **See my card** -> CardDetail; Close returns to A.
- **Not now** -> E (`guest.left { at: 'save' }`); nothing is removed.
- B: PIN ok -> C; it opens no grown-up session and gives no fresh-PIN credit. Cancel -> A.
- C: **Continue** -> D; **Back** -> A.
- D: the who cards (no preselected answer); **Add an email** toggles the field; **I'm under 13** switches to the grown-up card and latches; **Continue** -> the stores in F-LEARN-001 order, then `promoteGuest` (same id), then `hr:guest` deleted -> F; `guest.saved`, `onboarding.started { firstRun, fromGuest: true }`.
- E: **Add my name** -> B or C; **Close** -> Welcome or the chooser.

## Entry and exit

Enter from: quest 1 finished in a guest run · Welcome **Add my name** (`onboarding/guest-first-quest.md` D2) · a reopen within 30 minutes after quest 1 (E)
Exit to: learner Home (F) · Welcome · `profiles/who-is-using`

## States

- **success**: A to F.
- **incomplete**: C without a valid name; D without an answer, an unticked box, a missing PIN, an email that looks off (today's captions).
- **error**: the PIN could not be set ("Couldn't set the PIN. Try again.", today's line); a profile write that fails keeps the guest and shows today's calm error with Try again (nothing is lost: the data is still under the guest's id).
- **offline**: every panel works; the new learner registers when the network returns; the Privacy Policy link shows its fallback line.
- **two tabs**: a save in one tab ends the guest run in the other, which shows the new profile's Home on its next screen change.

## Accessibility

- Focus moves to each step's heading ("Step 2 of 2. Privacy"); after I'm under 13, to the switch note (as setup-steps).
- **Add an email** is a disclosure button with `expanded`; opening it moves focus to the field.
- Results reading order: Hoya, stars, card, Hoya's line, Save my progress, the gate caption, Not now.
- 64 dp targets; option cards at least `touchTarget.child`; text sizes up to Largest; no colour-only cue.

## Data needs

- Reads: `hr:guest`, the consent timestamps and PIN hash (`account-store`), `hr:profiles` (for `guestSaveGated`), the quest's result (stars, the new card).
- Writes (on the last Continue only): consent, PIN hash, email (when typed), then `hr:profiles` with the guest's id and `hr:profiles:active`, then the deletion of `hr:guest`.
- Never before the last Continue: anything about the learner to the server.

## Open questions

- OQ-G5 (G4 target), OQ-G6 (fold the email in the ordinary first run too): defaults in spec section 21.
