# "Can't hear it?": the way out when a sound plays but nothing is heard (wireframe v1)

Spec: `docs/specs/AMENDMENTS-AUDIO-CANT-HEAR.md` (row CH-0; work order WO-05 of `docs/roadmap/review-2026-11/phase-1-safety.md`; owner decision OD-R6, 2026-11-22: no play through the silent switch, guidance and **Show the letters** instead)
Extends: `design/wireframes/minigame/audio-fallback.md` (W1 Match Sound with sound, W2-W4 the text states, W7 the help sheet, W8 the state machine, W11 the F-CURR-002 formats) and `design/wireframes/minigame/shell.md` (round shell)
Audience: **any learner, any age** (CLAUDE.md §1); the same screens for everyone. A grown-up may read the sheet's one line to a young learner.
Wireframe level: structure, flow, interaction points. No colours, fonts, art or final copy; text in (parentheses) is a placeholder (the English is in the spec, §3.10).
Notation: as in `audio-fallback.md`. `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean shown with romanization (`KoreanText`), `<state>` a runtime state (W8).

Screens in this file: C1 Match Sound, a sound that "played" · C2 The Can't hear it? sheet · C3 After Show the letters · C4 The states without the link · C5 The other sound-only rounds · C6 Discover, guidance only (OD-CH3) · C7 Add a Korean voice, one device (P2-22) · C8 Large text and wide screens · C9 Flow

---

## Scenario (Given-When-Then)

Given: a learner is on a round that asks by sound only (Match Sound, Listen & Pick, a heard review round, Syllable Build, Dictation), and the device plays the sound into silence: silent mode on an iPhone, the media volume at zero, a muted browser tab, headphones paired somewhere else. The app is told "played" and shows no text.
When: the learner hears nothing
Then: without answering first, they tap one small link, see **one** line for their own device, and either fix the sound and hear it, or read the letters and play on. Nothing is marked wrong, nothing is lost, and nothing is stored.

## Screen goal

"Never leave a learner in front of a silent speaker: one tap to the reason, one more to the letters."

---

## C1 — Match Sound, the sound "played" but nothing was heard (`<ok>`)

```
+----------------------------------+
| [x]  ====o------  (2 / 4)        |  <- shell unchanged; progress is fill-only
|                                  |
|  (Tap the letter you hear)       |  <- heading, audio variant (W1)
|                                  |
|   ( (speaker) )  (Tap to replay) |  <- speaker row, as W1
|                [ Can't hear it? ]|  <- NEW: a small ghost link in the row.
|                                  |     There from the moment the round opens,
|                                  |     before any play and any answer (D1)
|   +-------+  +-------+           |
|   | ~~ㄴ~~ |  | ~~ㄱ~~ |           |  <- tiles unchanged. The link never moves
|   |   n   |  |  g/k  |           |     them: it is there from the start
|   +-------+  +-------+           |
|   +-------+  +-------+           |
|   | ~~ㄹ~~ |  | ~~ㄷ~~ |           |
|   |  r/l  |  |  d/t  |           |
|   +-------+  +-------+           |
+----------------------------------+
```

- The link is lighter and smaller than the speaker and the tiles: never the largest thing on the screen. It is still a full touch target.
- It is on every round of the step while no text is up; the next round has it again.
- Focus order: heading, speaker, link, tiles.
- Loading: while the round holds (the voice check, at most 2 s; Dictation's `hold`, 1.5 s) the link is drawn but inactive, so it never comes in later and moves the tiles.

## C2 — The sheet (bottom sheet, like the W7 help sheet)

```
+----------------------------------+
|   (the round behind, dimmed)     |  <- scrim: a tap closes the sheet; not an
|                                  |     accessibility element (no second Close)
|                                  |
+----------------------------------+
| (Can't hear it?)            [x]  |  <- title (focus starts here), then the close
|                                  |     button at the end of the title row
|                                  |
|  (one line for THIS device)      |  <- exactly one of the three lines below
|                                  |
|  [[ Show the letters ]]          |  <- primary: closes, the text comes up (C3)
|  [ (speaker) Hear it ]           |  <- secondary: closes, plays the prompt once
+----------------------------------+

The one line, by device (spec §3.4); only one is ever drawn:

  iPhone or iPad, in the app or the browser : (Turn off silent mode. Then turn the volume up.)
  Android, in the app or the browser        : (Turn up the media volume with the volume buttons.)
  Computer                                  : (Turn the volume up. Check that this page is not muted.)
```

- The close button, the scrim and the back close the sheet; nothing else changes; focus returns to the link.
- **Guidance-only sheet** (the cue rule, C5; Discover, C6): no Show the letters, and Hear it is the primary action.
- The sheet also closes when a text arrives while it is open (sound turned off, no Korean voice, a failed or blocked play): the panel then offers its own action.
- Show the letters: the sheet closes, focus moves to the round's focus target (C5), and one beat later the text comes up, so a screen reader says it once. Hear it: focus returns to the link, and the prompt plays after the link's name is said.
- If the round changes while it is open, the sheet closes (Show the letters always acts on the round on screen).
- No Hoya, no amber, no red: a neutral sheet. This is not a miss.
- Nothing is recorded: no answer, no attempt, no star.

## C3 — After Show the letters (`<text>`, asked by the learner, no reason)

```
+----------------------------------+
| [x]  ====o------  (2 / 4)        |
|                                  |
|  (Tap the letter for this sound) |  <- heading, text variant (as W2)
|                                  |
|   ( (speaker) )  (Tap to replay) |  <- the speaker stays and still plays.
|                                  |     The link is gone: the text is up
|  +----------------------------+  |
|  |         ~~ 니은 ~~         |  |  <- what the voice says (a letter question
|  |          (nieun)           |  |     says the letter's name, JV-A1)
|  |  (No sound? Read it here.) |  |  <- read line only: no reason line,
|  +----------------------------+  |     no action button
|   +-------+  +-------+           |
|   | ~~ㄴ~~ |  | ~~ㄱ~~ |           |  <- the tiles move down once, at the
|   |   n   |  |  g/k  |           |     learner's own request (the same
|   +-------+  +-------+           |     move as the shipped text fallback)
|   ...                            |
+----------------------------------+
```

- This round only. The next round is C1 again (or every round opens with its text when the device has "Always show the letters" on, row CH-2).
- A right tap scores as it does today with sound off. A wrong tap is the amber nudge with Hoya `thinking` (W1b), and the 800 ms replay still plays, so a learner who has just turned the sound on hears it.
- Screen reader: focus goes to the speaker, then the letters are read once.

## C4 — The states without the link (each already has its way out)

| State (W8) | Already on screen | Link |
|---|---|---|
| `<idle>` while the round holds (voice check, Dictation `hold`) | the speaker | shown, **inactive** |
| `<idle>`, `<playing>`, `<ok>` | the speaker | **shown** (C1) |
| `<text: muted>` (W2) | the text and **Turn sound on** | hidden |
| `<text: no_voice>` (W3) | the text and **How to add a voice** | hidden |
| `<text: error>` (W4) | the text and **Try again** | hidden |
| `<text: blocked>` (W4) | the text, and **Tap to hear** on the speaker | hidden |
| `<text: asked>` (C3) | the text | hidden |
| answered right, waiting for the next round | the right tile | still shown (no flicker); a sheet left open closes when the round changes |

- Empty state: a step with no rounds shows its existing "no rounds" line, with no speaker and no link.
- Error state: a play that fails is W4 (the existing panel), not this file.

## C5 — The other sound-only rounds (spec §3.1)

| Round | Where the link goes | What Show the letters shows (the round's own text fallback) | No link when |
|---|---|---|---|
| Listen & Pick (quest steps, vocab, Browse preview) | after the speaker and Hear again | the word with its romanization in the prompt zone; focus: the speaker | a text-prompt round. Spelling round: guidance only (cue rule) |
| Listen & Pick in Checks (quest Check, Hangul Check) | as above | **waits for OD-CH6**: the romanization only where the options hold or hide theirs (spec §3.12) | until OD-CH6 is answered: no link |
| Heard rounds of Daily Review, Keep going, This week in Korea | after Hear again | with a picture or meaning cue: guidance only; without: the prompt Korean with its romanization; focus: Hear again | read and write rounds (already printed) |
| Heard rounds of Stage Check, Cell Check | after Hear again | **waits for OD-CH6** | until OD-CH6 is answered: no link |
| Quest warm-up, Try these again (heard rounds) | after the speaker and Hear again | with a cue: guidance only; without (a syllable round): the prompt Korean; focus: the speaker | text rounds |
| Syllable Build (quest step, review round) | after the speaker and the meaning button | the romanization only (the block is the answer) | inside the Decoding Sprint (OD-CH4) |
| Speed round, sound question, Relaxed mode | under the large speaker | the word with its romanization (the options are pictures) | Challenge mode (a clock runs, OD-CH4) |
| Dictation (Type Hangul, `hear`) | after the speaker | the round becomes the W11 `see` round | `see` rounds |

```
Listen & Pick, a quest Check                     Dictation, a hear round
+--------------------------------+               +--------------------------------+
| (Quick check)    (*) ( ) ( )   |               | (2/4) (Type the word you hear) |
|  (Which one did you hear?)     |               |   ( (speaker) )   (meaning)    |
|   ( (speaker) )  [ Hear again ]|               |   [ Show how it sounds ]       |
|   [ Can't hear it? ]           |  <- link      |   [ Can't hear it? ]           |  <- link
|  [ ~~사과~~ ]   [ ~~바다~~ ]     |               |  ( answer row )                |
|  [ ~~나무~~ ]   [ ~~하늘~~ ]     |               |  ( keyboard )                  |
+--------------------------------+               +--------------------------------+
 after Show the letters: ~~ 사과 ~~ (sagwa)       after Show the letters: the W11 see round,
 in the prompt zone, as with sound off;          ~~ 사과 ~~ (sagwa) · (apple) with
 the options keep their held romanization        (No sound? Read it here.) and no reason line
 until answered (AU-8)
```

**The cue rule** (spec §3.1): a pick round that already has a picture or a meaning to answer from gets the guidance-only sheet, because showing its Korean would print the right option. Elsewhere a right answer after Show the letters is marked as help for memory, if the owner approves OD-CH7.

## C6 — Discover: guidance only (OD-CH3 approved 2026-11-23, row CH-1d)

```
+----------------------------------+
|  (page 1 of 2)   ( ) (*)         |
|  +----------------------------+  |
|  |         ~~ ㄱ ~~           |  |  <- the letter is printed: nothing to show
|  |          g/k               |  |
|  |  [[ (speaker) Hear it ]]   |  |
|  |  [ Letter name ]           |  |
|  |  [ Can't hear it? ]        |  |  <- once per page, under the card's buttons
|  +----------------------------+  |
|   [[ CONTINUE ]]                 |  <- never gated on hearing (W5)
+----------------------------------+

Its sheet:  (Can't hear it?) [x]  /  (one line for this device)  /  [[ (speaker) Hear it ]]
            no Show the letters; Hear it is the primary action here
```

- The Discover link is hidden while its status panel shows a reason (sound off, no Korean voice, a failed or blocked play): that panel already says what to do.
- Why Discover: it is the first page that plays a sound in every quest (the first letter plays when the page opens), so a learner on silent can fix the sound before the first sound-only game.

## C7 — Add a Korean voice: this device only (P2-22, spec §3.9)

```
Today (W7): every device                    New: this device's section only
+--------------------------------+          +--------------------------------+
| (Add a Korean voice)      [x]  |          | (Add a Korean voice)      [x]  |
| (Menu names can differ ...)    |          | (Menu names can differ ...)    |
| (iPhone or iPad)   (steps)     |          | (iPhone or iPad)               |
| (Android)          (steps)     |          |   1. (step)                    |
| (Computer)         (steps)     |          |   2. (step)                    |
| (You can still play: ...)      |          |   3. (step)  4. (step)         |
| [[ OK ]]                       |          | (You can still play: ...)      |
+--------------------------------+          | [[ OK ]]                       |
                                            +--------------------------------+
                                              e.g. on an iPhone, in the app or the browser
```

- The same device rule as C2: an iPhone or iPad gets the Apple steps, Android the Android steps, anything else the computer steps. Opened from Profile's Sound card and from the no-voice panel (W3), as today.

## C8 — Large text, narrow and wide screens

```
320 x 568 at 200 % text (phone)              Tablet landscape (prompt left, tiles right)
+------------------------+                   +--------------------+----------------------+
| (Tap the letter        |                   | (Tap the letter    |  +------+  +------+  |
|  you hear)             |                   |  you hear)         |  | ㄴ n |  | ㄱ g/k|  |
|  ( (speaker) )         |                   |  ( (speaker) )     |  +------+  +------+  |
|  (Tap to replay)       |  <- the row wraps |  (Tap to replay)   |  +------+  +------+  |
|  [ Can't hear it? ]    |  <- link under    |  [ Can't hear it? ]|  | ㄹ r/l|  | ㄷ d/t|  |
|  +------+  +------+    |     the caption   |                    |  +------+  +------+  |
|  | ㄴ n |  | ㄱ g/k|    |                   +--------------------+----------------------+
|  ...  (screen scrolls) |                    the link stays in the prompt column
+------------------------+

The sheet at 200 % text: it scrolls inside (its height is capped, like W7); the two buttons
stack full width; the close button stays at the top.
```

## C9 — Flow

```
<a sound-only round opens>
   |-- (speaker) -------------------------------> plays; heard: play on (W1)
   |-- [ Can't hear it? ] ------------------> C2 the sheet
   |        |-- [x] / scrim / back ---------> back to the round, nothing changed
   |        |-- [ Hear it ] ----------------> back to the round, the prompt plays once
   |        '-- [[ Show the letters ]] -----> C3, for this round
   '-- a tile --------------------------------> scored as today (right: on; wrong: amber, W1b)
<the next round> --> C1 again (the asked text is per round)
```

Enter from: any sound-only round of C5 (quest steps, quest Checks, the Hangul Check, Stage and Cell Checks, Daily Review and Keep going, the quest warm-up, the Speed round in Relaxed mode, Browse preview).
Exit to: the same round; the sheet returns to its caller and no screen changes. Profile's Sound card is unchanged (W7), apart from the one-section help sheet (C7).

---

## Interaction points

| Where | Gesture | Result |
|---|---|---|
| Can't hear it? (C1, C5, C6) | tap | opens the sheet (C2); nothing is played, scored or stored |
| Show the letters (C2) | tap | closes the sheet; this round's text comes up (C3); the link goes |
| Hear it (C2, C6) | tap | closes the sheet; plays the prompt once, like the speaker |
| Close, scrim, back (C2, C6) | tap / back | closes the sheet; nothing changes |
| Speaker (C1, C3) | tap | plays the prompt, as today (also in C3) |
| A tile or option (C1, C3) | tap | scored as today; with the text up, as with sound off today (AD13) |
| How to add a voice / Profile Sound card (C7) | tap | the help sheet, this device's steps only |

## Navigation graph

Enter from: the quest player (Match Sound, Listen & Pick, Syllable Build and Dictation steps; Discover only with OD-CH3), the quest warm-up and Try these again, the Hangul Check, the Daily Review, Keep going, Stage Check and Cell Check, the Speed round in Relaxed mode, Browse preview.
Exit to: none. The sheet always returns to the round that opened it.

## Data needs

- The prompt slot's state (local, `logic/audio/prompt-state.ts`): phase, reason and the new `asked` flag. Per round, in memory, never stored.
- The device family (local, computed): `Platform.OS` on native, the user agent and touch points on the web (`installEnv()`). Never stored, never sent.
- Strings: `learner.audio.cantHear.*` (new, spec §3.10), `learner.audio.hearIt.cta`, `learner.audio.readHere`, `common.buttons.close`.
- Telemetry: nothing new by default. If OD-CH2 (re-opened) is approved, row CH-4 adds the reason `asked` to `audio.fallback_shown` (counts only, no profile id).
- Storage: nothing for the link and the sheet. Row CH-2 (OD-CH1 approved) adds one device setting next to mute (`device:audio`).

## Accessibility

- The link's accessible name is its visible words; it has no hint. Focus order: heading, speaker (and Hear again), link, answers.
- The sheet is modal: focus moves into it, the title is a heading, and closing returns focus to the link.
- After Show the letters: focus goes to the speaker, then the letters are read **once** (the panel's polite live region on the web and Android; a VoiceOver announcement on iOS).
- The link and the sheet's buttons are at least the minimum touch target; the sheet's buttons stack full width on a phone.
- No red and no amber on the link or the sheet. Amber stays for a missed answer, and this is not one.

## Open questions (for the mock row CH-0b and the review)

1. Link placement on phones: in the speaker row, wrapping under the caption when narrow (proposed), or always under the row?
2. Does the sheet's Hear it carry the speaker glyph, like the wrong-answer bubble's Hear it (proposed: yes)?
3. Is "Turn off silent mode" clear to a learner who has never opened that setting? A grown-up may help; the mock checks the line length at 200 % text.
4. An iPad browser that asks for the desktop site and reports no touch points (rare), and a large Android tablet whose Chrome asks for the desktop site (a desktop Linux user agent), get the computer line. Acceptable (proposed: yes)? Owner decision 2026-11-24: yes, accepted.
5. Headphones paired elsewhere are named by no line (one short line per device). Leave out (proposed: yes)?
6. The "Always show the letters" switch (OD-CH1 approved, row CH-2) goes on Profile's Sound card (W7), under the Sound switch; the mock row draws it.
7. Should the link carry the `speaker-off` glyph before its words (proposed: the mock tries it)? Owner decision 2026-11-24: no glyph; the link is words only.
8. Translators: "letters" means written characters of any script; in Syllable Build Show the letters shows the romanization.
