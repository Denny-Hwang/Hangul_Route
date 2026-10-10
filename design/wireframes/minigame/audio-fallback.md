# Audio prompts and the visible text fallback: Match Sound, Discover (sound + name), Profile Sound card (wireframe v1)

Spec: `docs/specs/F-AUDIO-004-korean-voice-quality.md` (promoted to `design/wireframes/minigame/audio-fallback.md`; the Profile screen (W7) and Discover (W5, W6) parts are cross-referenced from `profile/` and `quest/discover.md`)
Extends: `design/wireframes/minigame/shell.md` (round shell), `quest/discover.md` (F-QUEST-002), `profile/` (Sound switch)
Audience: **any learner, any age** (CLAUDE.md §1); the same screens for everyone. Wireframe level: structure, flow, interaction points. No colours, fonts, art or final copy; text in (parentheses) is a placeholder.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean shown with romanization + gloss (`KoreanText`), `{ x }` content-driven, `(*)` fill-only marker, `<state>` a runtime state.

Screens in this file: W1 Match Sound with sound · W2 Match Sound, sound off · W3 Match Sound, no Korean voice · W4 Match Sound, play failed / blocked · W5 Discover letter: sound first, name second · W6 Discover: silent letter (ㅇ) and a final consonant · W7 Profile Sound card + voice help sheet · W8 Audio state machine

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

Entry: Quest player (Match Sound, Listen & Pick, Discover steps), Trace Stroke, Card detail, Profile.
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
