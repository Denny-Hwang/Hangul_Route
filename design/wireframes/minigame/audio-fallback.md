# Audio prompts and the visible text fallback: Match Sound, Discover (sound + name), Profile Sound card (wireframe v1)

Spec: `docs/specs/F-AUDIO-004-korean-voice-quality.md` (promoted to `design/wireframes/minigame/audio-fallback.md`; the Profile screen (W7) and Discover (W5, W6) parts are cross-referenced from `profile/` and `quest/discover.md`)
Extends: `design/wireframes/minigame/shell.md` (round shell), `quest/discover.md` (F-QUEST-002), `profile/` (Sound switch)
Audience: **any learner, any age** (CLAUDE.md §1); the same screens for everyone. Wireframe level: structure, flow, interaction points. No colours, fonts, art or final copy; text in (parentheses) is a placeholder.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean shown with romanization + gloss (`KoreanText`), `{ x }` content-driven, `(*)` fill-only marker, `<state>` a runtime state.

Screens in this file: W1 Match Sound with sound · W2 Match Sound, sound off · W3 Match Sound, no Korean voice · W4 Match Sound, play failed / blocked · W5 Discover letter: sound first, name second · W6 Discover: silent letter (ㅇ) and a final consonant · W7 Profile Sound card + voice help sheet · W8 Audio state machine · W9 Screens that already print the Korean (A-5b) · W10 The learner audio pass: the panel under what was tapped, and the trace games' one-row form (A-12) · W11 The F-CURR-002 formats: where the sound notice goes (CM-D2)

---

## Scenario (Given-When-Then)

Given: a learner plays any prompt that needs Korean sound (Match Sound, Listen & Pick, Discover, Trace)
When: the device has a Korean voice or a recording / has no Korean voice / the learner (or a grown-up) turned sound off / the browser blocks the first sound
Then: the learner always has a way to play: they either **hear the sound of the letter** (what they will use to read: ga, not gi-yeok), or **read that same sound on screen**, and nothing ever looks like an error or a miss

## Screen goal

"Say the sound if we can; show the sound if we cannot; never leave a silent game."

---

## W1 — Match Sound, sound available (`minigame/match-sound`, state `<ok>`)

```
+----------------------------------+
| [x]  ====o------  (2 / 4)        |  <- same shell: progress is fill-only
|                                  |
|  (Tap the letter you hear)       |  <- heading, audio variant
|                                  |
|        ( (speaker) )  (Tap to    |  <- big replay button, plays the SOUND
|                        replay)   |     of the letter (ga), not its name
|                                  |
|   +------+  +------+             |
|   | ~~ㄴ~~|  | ~~ㄱ~~|             |  <- tiles keep their sound value
|   |  n   |  | g/k  |             |     (romanization) as today
|   +------+  +------+             |
|   +------+  +------+             |
|   | ~~ㄹ~~|  | ~~ㄷ~~|             |
|   |  r/l |  | d/t  |             |
|   +------+  +------+             |
|                                  |
+----------------------------------+
```

- The sound autoplays on round start (never before the learner's first tap anywhere in the app; see W8 `<blocked>`).
- A wrong tap: tile turns amber, Hoya `thinking`, the same sound replays after 800 ms (unless the learner taps again first).

W1b wrong-answer bubble (replaces name-based text):

```
+------------------------------------------+
| (Hoya thinking)                          |
|  (Listen again. This one says)           |
|    ~~ 가 ~~   (ga)                       |  <- spoken syllable + its romanization
|    [ (speaker) Hear it ]                 |  <- plays the same sound prompt
+------------------------------------------+
```

## W2 — Match Sound, sound is off (`<text>`, reason `muted`)

```
+----------------------------------+
| [x]  ====o------  (2 / 4)        |
|                                  |
|  (Tap the letter for this sound) |  <- heading, text variant
|                                  |
|  +----------------------------+  |
|  |         ~~ 가 ~~           |  |  <- shown BEFORE any play attempt
|  |           (ga)             |  |     (muted => text, F-001 §3.4)
|  |  (Sound is off. Read the   |  |
|  |   sound here.)             |  |
|  |  [ Turn sound on ]         |  |  <- secondary; flips the device setting
|  +----------------------------+  |
|        [ (speaker) ]  disabled   |  <- speaker stays, label says sound is off
|                                  |
|   +------+  +------+             |  <- tiles unchanged (keep romanization)
|   | ㄴ n |  | ㄱ g/k|             |
|   +------+  +------+             |
|   | ㄹ r/l|  | ㄷ d/t|             |
|   +------+  +------+             |
+----------------------------------+
```

- The round scores normally (F-001 §3.3). No hint that the answer is "worth less".
- **Turn sound on** persists (`device:audio`), plays the prompt once, and the text zone stays for the rest of the round (no flicker), then returns to W1 next round.

## W3 — Match Sound, no usable Korean voice (`<text>`, reason `no_voice`)

```
+----------------------------------+
|  (Tap the letter for this sound) |
|  +----------------------------+  |
|  |         ~~ 가 ~~           |  |
|  |           (ga)             |  |
|  |  (No Korean voice on this  |  |
|  |   device. Read the sound   |  |
|  |   here.)                   |  |
|  |  [ How to add a voice ]    |  |  <- opens W7 help sheet; text-only link
|  +----------------------------+  |
|        [ (speaker) ]  disabled   |
|   tiles as W2                    |
+----------------------------------+
```

- Shown proactively when the capability check ends `none` and no recording exists for the item (offline desktop Chrome with only a network voice, Firefox/Linux, an Android without Korean voice data).
- While the check is still `<unknown>` (first 1.5 s) the screen shows W1; it never flashes W3.

## W4 — Match Sound, the sound did not play (`<text>`, reason `error` / `blocked`)

```
+----------------------------------+
|  (Tap the letter you hear)       |
|        ( (speaker) )  (Tap to   |  <- blocked: label "Tap to hear";
|                        hear)    |     this tap is the gesture the
|  +----------------------------+  |     browser wanted
|  |         ~~ 가 ~~           |  |
|  |           (ga)             |  |  <- appears after the failed play
|  |  (No sound? Read it here.) |  |
|  |  [ Try again ]             |  |  <- error only; replays once
|  +----------------------------+  |
|   tiles as W2                    |
+----------------------------------+
```

- `blocked` happens when the browser refused a sound before any tap (deep link into a quest). The learner's next tap unlocks and plays; the text stays for that round.

---

## W5 — Discover, a consonant: sound first, name second (`quest/discover`, F-QUEST-002 §3.2)

```
+----------------------------------+
|  page 1 of 2   ( ) (*)           |
|  +----------------------------+  |
|  |        ~~ ㄱ ~~            |  |  <- big glyph
|  |         g/k                |  |  <- sound value
|  |  (soft, light g sound)     |  |  <- soundHint (F-QUEST-002 App. A)
|  |  [[ (speaker) Hear it ]]   |  |  <- plays 가; caption under it: (ga)
|  |   (ga)                     |  |
|  |  [ Letter name 기역 ]       |  |  <- secondary: plays 기역, shows
|  |    (giyeok)                |  |     "기역 · giyeok" after the tap
|  | - - - - - - - - - - - - -  |  |
|  |  (example word) ~~ 가족 ~~ |  |
|  |  (gajok) (family) [ (sp) ] |  |
|  +----------------------------+  |
|   [[ CONTINUE ]]                 |  <- enabled at once; never gated on hearing
+----------------------------------+
```

- Nothing autoplays on Discover. The first **Hear it** pulses once (static under reduced motion).
- When the state is `<text>` (muted / no voice) the caption under Hear it becomes a full line: "Say it out loud: ga" and the **Letter name** button shows the name as text without a speaker.

## W6 — Discover, the silent letter and a final consonant

```
Silent letter ㅇ (spokenKind: name):       Final consonant ㄱ (batchim):
+------------------------------+          +------------------------------+
|        ~~ ㅇ ~~              |          |   ~~ ㄱ (final) ~~           |
|        silent / ng           |          |    k                         |
| (Silent at the start of a    |          |  [[ (speaker) Hear it ]]     |
|  syllable. Its name is:)     |          |   (ak)                       |
|  [[ (speaker) 이응 ]]         |          |   +-----+-----+              |
|    (ieung)                   |          |   | (C) | (V) |   block      |
|  (example) ~~ 아이 ~~ [ (sp)]|          |   +-----+-----+              |
|  (ai) (child)                |          |   |  (final)  |  lights      |
+------------------------------+          |   (sits at the bottom)       |
                                          |  (example) ~~ 문 ~~ (mun) [sp]|
                                          +------------------------------+
```

- For ㅇ the main button plays the **name** (there is no sound to play); there is no separate **Letter name** button on this page.
- For a final consonant the main button plays the closed syllable (악, 안, 알, 암, 압, 앙), distinct from the initial form; no name button.

---

## W7 — Profile: Sound card with voice status, and the help sheet

```
Profile (existing Sound switch, one new line):
+------------------------------------------+
| (speaker)  (Sound)                (On)   |  <- switch: persisted (device:audio)
|            (Korean voice: ready)         |  <- or (No Korean voice on this device)
|            [ How to add a voice ]        |  <- only when there is none
+------------------------------------------+

Help sheet (bottom sheet, plain text, scrolls):
+------------------------------------------+
| (Add a Korean voice)                [x]  |
|  (iPhone or iPad)  (steps)               |
|  (Android)         (steps)               |
|  (Computer)        (steps)               |
|  (You can still play: the sound is       |
|   written on screen.)                    |
|  [[ OK ]]                                |
+------------------------------------------+
```

- The switch label, state and voice line are one accessibility group ("Sound, on. Korean voice ready.").
- Lecture mode's "Check this device" row reads the same capability (`describeKoVoice()`), not this card.

---

## W8 — Audio state machine (per prompt slot)

```
                       play requested
   <idle> ------------------------------------> <playing>
     ^   \                                        |   |  \
     |    \ muted / capability=none (no clip)     |   |   \ no start within 1.5 s
     |     \--------------------------> <text>   |   |    \----------------> <text: blocked>
     |                                    ^       |   | engine error (once retried)
     |            new round: reset        |       |   \------------------> <text: error>
     +------------------------------------+       |
                                                  | started / ended
                                                  v
                                                <ok>  (text, if already shown, stays)

Resolution inside <playing>:  recording (clip)  ->  device voice (TTS)  ->  text
Supersede: a newer prompt stops the older one; the older one counts as played.
```

---

## W9 — Screens that already print the Korean: status panel only (PR A-5b)

Build Letter, Card Match, Tap & Respond, Culture Quiz, Voice Echo, card detail. The Korean and its romanization are already next to the speaker, so that line is the text; the panel only says why it is silent.

```
Tap & Respond (a turn opens: the NPC line is said once)   Culture Quiz (a new Hear it button)
+----------------------------------+                      +----------------------------------+
|  (Someone says)                  |                      |  (What does this mean?)          |
|  ~~ 안녕하세요! ~~               |                      |        ~~ 김치 ~~                |
|  (annyeonghaseyo)                |                      |         (gimchi)                 |
|  (Hello!)                        |                      |   [ (speaker) Hear it ]          |
|  [ (speaker) Hear it ]           |  <- replays the line  |  +----------------------------+  |
|  +----------------------------+  |                      |  | (Sound is off.)            |  |  <- only after a tap on
|  | (The sound did not play.)  |  |  <- only after a      |  | [ Turn sound on ]          |  |     Hear it
|  | [ Try again ]              |  |     play that failed  |  +----------------------------+  |
|  +----------------------------+  |                      |  [ Kimchi ] [ Rice ] ...         |
|  [ 안녕하세요 annyeonghaseyo ]   |  <- a right reply is  +----------------------------------+
|  [ 잘 가요 jal gayo ]            |     said in full, then
+----------------------------------+     the next turn opens

Build Letter / Voice Echo / card detail: the panel sits right under the syllable box, the speaker word
or the Hear it button. Card Match: under the two columns, for the last word tapped (a different word
starts a new slot).
```

- Nothing new autoplays except the Tap & Respond NPC line (audit F06 / AUD-13); Culture Quiz, Build Letter, Card Match, Voice Echo and the card detail play on tap only.
- No panel while the sound works or before any tap; a muted device sees "Sound is off" only after asking for a sound.
- Tap & Respond with sound off: the NPC line does not play on turn open (the learner taps Hear it to ask), so "Sound is off" is not announced again on every turn. While a right reply is being said, Hear it is disabled and the panel action does nothing, so the reply is never cut off.
- Speaker and Hear it labels name the word ("Hear annyeong"); the sound state is announced by the status panel after the first tap (spec §3.9 revision note).
- The round still scores normally in every state; the panel is never red.

## W10 — The learner audio pass: the panel under what was tapped, and the trace games' one row (A-12, 2026-10-17)

Story episode page, Culture notes, Discover, Realia Read, the Story Order replay, Pic-Word Match, Trace a Word, Trace Stroke. Each screen has one prompt slot (Discover: one per card); its status panel shows only under the thing tapped last, and a tap on a different word, title, term, line or pair starts the slot again, so the last one's "Tap to hear" or "Try again" never shows under a word that is being said.

```
Story episode page (one slot for the page)            Culture notes (one slot for the screen)
+----------------------------------------+            +----------------------------------------+
|  (The Day of Hangul)                   |            |  (Clothes for a holiday)               |
|  ~~ 한글날 ~~   <- tap (hide-until-tap) |            |  ~~ 한복 ~~  (hanbok)  [ (speaker) ]   |  <- tap
|  +----------------------------------+  |            |  +----------------------------------+  |
|  | (No Korean voice on this device.)|  |  <- under  |  | (Sound is off.)                  |  |  <- under this
|  | [ How to add a voice ]           |  |     the    |  | [ Turn sound on ]                |  |     note's term
|  +----------------------------------+  |     title  |  +----------------------------------+  |     only
|  ( Hoya: Let's read! )                 |            |  ( Families wear them on holidays. )   |
|  +- tale row ----------------------+   |            |  [ From the story ]                    |
|  | (cover) (The Day of Hangul)     |   |            +----------------------------------------+
|  |         ~~ 한글날 ~~  <- tap    |   |
|  |         (panel moves here)      |   |            Realia Read (one slot)
|  +---------------------------------+   |            +----------------------------------------+
|  (Words)                               |            |  +- menu sheet --------------------+   |
|  [~~ 한글 ~~ (spk)] [~~ 세종 ~~ (spk)] |  <- chips   |  | ~~ 김밥 ~~  ~~ 2,000원 ~~  <- tap |   |
|  ( panel under the chips, for the      |            |  +---------------------------------+   |
|    chip tapped last )                  |            |  ( panel under the sheet: a line )     |
+----------------------------------------+            |  (How much is this?)  ~~ 라면 ~~       |
                                                      |  [ 삼천 원 ] [ 이천 원 ] ...            |
                                                      |  ( panel under the options: the right  |
                                                      |    option, said when picked )          |
                                                      +----------------------------------------+

Trace a Word, stacked (phone)                         Trace Stroke, side by side (tablet landscape)
+----------------------------------------+            +----------------------+-----------------+
|  (Trace the word) ~~ 호야 ~~           |            |                      | (Trace ㄱ)      |
|  [ 호 (spk) ] [ 야 (spk) ]  (hoya)     |  <- strip   |                      | (Sound is off.) |  <- one row, no
|  (Sound is off.) [ Turn sound on ]     |  <- one row |      ( canvas )      | [Turn sound on] |     card; the
|  +----------------------------------+  |     no card |                      | (scrolls if     |     column scrolls
|  |                                  |  |            |                      |  too tall)      |     if needed
|  |            ( canvas )            |  |            |                      | [Show me][Clear]|
|  |                                  |  |            |                      | ( Hoya line )   |
|  +----------------------------------+  |            |                      | [[ Done ]][Skip]|
|  [ Show me ]  [ Clear ]                |            +----------------------+-----------------+
|  ( Hoya line )                         |
|  [[ Done ]]   [ Skip ]                 |
+----------------------------------------+
```

- The row appears only after the learner asked to hear (a block speaker, Show me), never from a round's opening sound.
- **Held while drawing**: while a finger is on the canvas the row keeps what it showed when the stroke began. A late result (a speak the browser dropped, given up after the start timeout; a voice list still loading) waits for the finger to lift, so the canvas never resizes or moves under the finger mid-stroke. It may resize between strokes, which only rescales the ink already drawn.
- Discover: each item card and the exchange card has its own panel under its buttons; the exchange's panel replaces the old Read along status line (nothing stays lit without sound).
- Story Order replay: the panel sits under the replay line; each line starts the slot again; its action says that line.
- Every panel is neutral (never red), a polite live region, and its action plays the same Korean again.

---

## W11 — The F-CURR-002 formats: where the sound notice goes (row CM-D2, 2026-10-21)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.1 (every format reading, listening or writing; Dictation "With no voice it falls back to a `see` round and the sound notice"), §4.3 (with no device voice, recognize and read merge into one rung), §4.5 (`dictation-unambiguous`, the spelling round). Each format's own wireframe has its full no-voice section; this table keeps the placements in one place, next to W1-W10.

| Format | What the round needs from sound | Panel | Where it shows | When | Source id |
|---|---|---|---|---|---|
| Cloze Pick | nothing (the sentence is said after the right tile) | status | under the prompt card | after the right tile's play fails | `cloze-pick` |
| Dictation (Type Hangul `hear`) | the word itself | text (reader variant: Korean on screen) | under the prompt, the round now a `see` round | **at round open** when the capability is `none` and no clip plays, or sound is muted; after a second engine failure | `type-hangul-hear` |
| Spelling round (Letters S2) | the word, but the picture or gloss settles it | status | under Hear it | after the opening play fails or a tap while muted; with `game.spelling-pick` off, the Listen & Pick fallback keeps its own shipped no-voice state | `spelling-pick` |
| Syllable Build | the syllable (its romanization stays on screen) | text (no Korean: the block is the answer) | under the speaker | at round open for `none`; after a tap for `muted`, `error` | `syllable-build` |
| Match Shape | nothing (the right letter's sound is an extra) | status | under the picture card or the grid | after the step's first play attempt | `match-shape` |
| Story Order | nothing (placed lines and the replay are extras) | status | under the slot row; in the replay under the line | after a play attempt; one slot for the screen (W10 rule) | `story-order` |
| Role Play | nothing (the partner line is printed) | status | under the newest partner bubble | after the turn's play attempt; "No Korean voice" once per scene | `role-play` |
| My Story | nothing (finished sentences are said as an extra) | status | under the sentence | after a play attempt | `my-story` |
| Yut Review | nothing (the throw name is printed) | (the review item's own panel) | under the item | the item's format rule | `yut-review` |

```
Dictation with no Korean voice (proactive, the round opens as see)     Role Play, a turn whose line did not play
+--------------------------------+                                    +--------------------------------+
| (2/4) (Type this word) [ Skip ]|                                    |  <partner> ~~ 사서 ~~           |
|  ~~ 사과 ~~ (sagwa) · (apple)  |                                    |  ~~ 여기 있어요. ~~             |
| +----------------------------+ |                                    |  (yeogi isseoyo) (Here it is.) |
| | (No sound? Read it here.)  | |                                    |  [ (speaker) Hear it ]         |
| | (No Korean voice on this   | |                                    |  +--------------------------+  |
| |  device.)                  | |                                    |  | (The sound did not play.)|  |
| | [ How to add a voice ]     | |                                    |  | [ Try again ]            |  |
| +----------------------------+ |                                    |  +--------------------------+  |
|  answer row, keyboard          |                                    |  reply bubbles (pinned)        |
+--------------------------------+                                    +--------------------------------+
```

- **Reading words only.** Every line on these panels is a reading line ("No sound? Read it here.", the reason, the action). The W5 caption "Say it out loud: ga" is a Discover line and is never used by these formats: nothing in F-CURR-002 asks the learner to speak.
- **No new panel kind.** Each placement uses the shipped `PromptPanel` (text or status variant) and `usePromptSlot`; the one new behaviour is Dictation's proactive switch to `see`, which happens before the round opens, so the screen never changes under the learner. While the capability is still `unknown` (the first 1.5 s after the app starts) a hear round holds its opening (speaker disabled, field not focused, keys inactive, nothing said) and opens once when the capability resolves: as `see` with the notice for `none` or muted, as `hear` otherwise, and as `hear` if it is still `unknown` at 1.5 s (`type-hangul.md`, Hear mode, No device voice).
- **Rungs.** With no device voice the review engine asks recognize items at the read rung (§4.3) and never picks Dictation or the spelling round's heard prompt; a quest's authored hear round renders as above.
- Every panel is neutral (the fallback card tone), never amber and never red, and a polite live region; every round scores normally. `audio.fallback_shown { source, reason }` uses the source ids in the table (strings, once per session, source and reason; the Worker's payload check is unchanged, which each build row confirms).

---

## Interaction points

| Where | Gesture | Result |
|---|---|---|
| Replay / Hear it | tap | plays the sound prompt; supersedes anything playing; in `<text>` states still tappable (tries again, may succeed) |
| Letter name (Discover) | tap | plays the name; first tap prints "기역 · giyeok" |
| Turn sound on (W2) | tap | un-mutes the device, plays the prompt once |
| Try again (W4, error) | tap | one replay; text stays |
| How to add a voice (W3, W7) | tap | opens the help sheet |
| Profile Sound switch | tap | mute/un-mute, persisted, stops anything playing |
| Any first tap in the app | tap | unlocks speech/audio for the session (invisible) |

## Navigation graph

Entry: Quest player (Match Sound, Listen & Pick, Discover steps, Build Letter, Card Match, Tap & Respond, Culture Quiz, Voice Echo), Trace Stroke, Card detail, Profile.
Exit: none of these screens navigates because of audio state; the help sheet returns to its caller.

## Data needs

- `audio-store` (local): `muted`, `tts` capability, `unlocked`, `lastFailure` (device-local, `device:audio` for `muted` only).
- Content: `Jamo.spokenKo`, `spokenRomanization`, `nameKo`, `spokenKind`, `audioRef` (bundled in the app; no network).
- Telemetry (no text, no voice names): `audio.capability_checked`, `audio.fallback_shown`, `audio.mute_changed`, `audio.playback_failed`.

## Accessibility

- The speaker button is the first focus target after the heading; its label states the state ("Play sound", "Play sound, sound is off", "Tap to hear").
- The text prompt is a polite live region and does not steal focus; romanization is read with the right language tags (`KoreanText`).
- No red, no X marks; the fallback panel is the neutral card tone; amber stays reserved for a missed answer.
- 200 % text: the prompt card grows, the tiles wrap, the primary action stays reachable (F-LAYOUT-001 once it ships).

## Open questions

- Do we show the Hangul syllable **and** its romanization in W2-W4, or romanization only for a Pictures-first learner who cannot read Hangul yet? (Proposed: both; the syllable is part of the practice.)
- Should W2 offer **Turn sound on** to a learner profile, or only after the parent gate when a grown-up muted it? (Proposed: no gate; the device switch is not sensitive.)
- Is the help sheet worth its text before OS-specific steps are verified on devices?
