# Quest/Discover — teach before play (wireframe v1)

Spec: `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` §3.2 (Discover step), §3.1 (step kinds), §3.6 (Discover pages per quest), §6 PR Q-5a
Extends: `design/wireframes/quest/player.md` (6-step shell)
Audience: **any learner, any age** (CLAUDE.md §1); same screens for everyone. Wireframe level: structure, flow, interaction points. No colours, fonts, art or final copy; text in (parentheses) is a placeholder.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `{ x }` content-driven, `( ) ( ) (*)` dots (fill-only), `~~` taught Korean shown with romanization + gloss (`KoreanText`).
Code: `apps/mobile/src/screens/quest/DiscoverStep.tsx` (renders), `apps/mobile/src/logic/stage1/discover-flow.ts` (decides)

> **[SF] Amended 2026-11-25 by `docs/specs/AMENDMENTS-DISCOVER-SOUND-FIRST.md`** (owner decision 2026-11-22, OD-R2; row SF-0): a consonant card plays its **sound** first (**Hear it**: 가, with the line "가 = ㄱ + ㅏ · ga") and its **name** second (**Hear the name**: 기역, with "기역 · giyeok"). This reverses the name-first order of `AMENDMENTS-AUDIO-CLIPS.md` JV-A5 (AU-OD-2) and restores this wireframe's original intent. See "[SF] Sound first (consonant card)" below.

> **[SF-3] Amended 2026-11-26 by `docs/specs/AMENDMENTS-DISCOVER-SOUND-FIRST.md` §12** (row SF-3a; WO-12 item 13, owner decision 2026-11-26): the initial ㅇ card gets a second button, **Hear it with vowels**, which plays 아, 오, 우 one after the other from the shipped vowel clips, so the learner hears that ㅇ adds no sound at the start of a block. See "[SF-3] The ㅇ card" below.

> **[TC] Amended 2026-11-25 by `docs/specs/AMENDMENTS-STAGE1-TRACE-COVERAGE.md`** (work order WO-14 of the 2026-11 review; row TC-0): a Discover step that teaches letters gets one more page, **Trace the new letters**, right after its last letter page: each new letter is traced once on a canvas, unscored, with no Done and no miss; Continue stays enabled. See "[TC] Trace the new letters" below. Mock: row TC-0b (`design/screens/discover-trace/`, merged #1154). **Built 2026-11-26** (TC-1a #1164, TC-1b #1171); the "As built" notes under "[TC] Trace the new letters" say where the build departs from the sketch.

> **Promoted 2026-10-12 (F-QUEST-002 PR Q-11).** This file was the single drafted wireframe of the whole spec (screens S1 to S11). It now holds the Discover step only; the other screens live in their own files:
>
> | Drafted screen | File |
> |---|---|
> | S1, S2 Discover pages | this file |
> | S3 Check launcher | `quest/check.md` |
> | S4, S5 Listen & Pick | `minigame/listen-pick.md` |
> | S6 Pic-Word Match | `minigame/pic-word-match.md` |
> | S7 Results with the next-quest teaser | `results/next-quest-teaser.md` |
> | S8 Stage 1 prize, S11 Journey Stage 1 header | `results/stage1-complete.md` |
> | S9 Hangul Check | `reviews/hangul-check.md` |
> | S10 Episode page soft prerequisite | `episode/detail.md` |

---

## Scenario (Given-When-Then)

Given: a learner starts any Stage 1 quest (from Episode, Home "Continue", the first-quest preview or a teacher plan)
When: the player reaches step 2, `discover`
Then: the **new letters (or the words of a reading quest) are shown and heard before anything asks about them**, one or two items per page, and Continue moves on at once (a learner who already knows them is never held)

## Screen goal

"Show it and let me hear it, then let me play."

## S1 — Discover page: two letters (`quest/player`, step `discover`)

```
+----------------------------------+
| [x leave]  o o (*) . . .  (3 / 6)|  <- same header as every step; 6 dots
|                                  |
|  (Look and learn)  [step pill]   |
|                                  |
|   page 1 of 2   ( ) (*)          |  <- page dots, fill-only
|  +------------------------------+|
|  |        ~~ ㅏ ~~              ||  <- big glyph
|  |      (romanization)          ||
|  |  (sound hint, one line)      ||
|  |   [ (speaker) Hear it ]      ||  <- big button, pulses once
|  |  - - - - - - - - - - - -     ||
|  |   (example word) ~~ 나 ~~    ||  <- emphasised block holds the letter
|  |   (romanization) (gloss)     ||
|  |   [ (speaker) ]  {picture?}  ||
|  +------------------------------+|
|  +------------------------------+|
|  |  same card for 2nd letter    ||  <- 1 or 2 items per page, never more
|  +------------------------------+|
|                                  |
|   [[ CONTINUE ]]                 |  <- enabled at once; never gated on hearing
+----------------------------------+
```

- Hoya appears once, small, with the quest's English line (single Hoya per screen).
- First Hear it pulses once. [AU] [QS] The page's first letter plays once by itself 350 ms after the page opens (`AMENDMENTS-AUDIT-2026-11.md` AU-10, `AMENDMENTS-QUEST-SOUND-BACK.md` QS-3): never with sound off or a screen reader on. [SF] It plays what that letter's **Hear it** plays, so on a consonant page it is the sound (가), not the name.
- A consonant card has a second button under the first; see "[SF] Sound first (consonant card)".
- Text scaling 200 %: the two cards stack and the page scrolls; CONTINUE stays pinned at the bottom.

## S2 — Discover page: a final consonant, then words

```
Final consonant page:                 Words page:
+--------------------------------+   +--------------------------------+
| page 1 of 2   ( ) (*)          |   | page 2 of 2   ( ) (*)          |
| +----------------------------+ |   | +----------------------------+ |
| |  ~~ ㄴ (final) ~~          | |   | |  (title: words you can     | |
| |  (romanization n)          | |   | |   read now)                | |
| |  [ Hear it ]               | |   | |  {picture}  ~~ word ~~     | |
| |  +-----+-----+             | |   | |  (romanization) (gloss)    | |
| |  | (C) | (V) |   <- block  | |   | |  [ Hear it ]               | |
| |  +-----+-----+             | |   | |  - - - - - - - - -         | |
| |  |  (final)  |  <- lights  | |   | |  {picture}  ~~ word ~~     | |
| |  +-----------+             | |   | |  (romanization) (gloss)    | |
| |  (sits at the bottom)      | |   | |  [ Hear it ]               | |
| |  example ~~ 문 ~~ + gloss  | |   | +----------------------------+ |
| +----------------------------+ |   |   [[ CONTINUE ]]               |
+--------------------------------+   +--------------------------------+
```

- A third page may hold **theme words** (pictured, "you will read these soon") or **payoff words** ("you can read these now!"); same layout as the words page.
- Quests that teach nothing new have only word pages.

## Interaction points

- **Hear it**: plays the symbol's sound or the word via `playPrompt` (never the letter name of a consonant; ㅇ by its name 이응; a final by its closed syllable); a result of `unavailable` / `muted` shows the line "Say it out loud: <spoken romanization>" (`ga` for ㄱ, never `giyeok`), no error. A tiny "heard" mark appears on the item (fill-only, never a gate).
- **[SF] Hear the name** (consonant cards whose name differs from their sound; optional, second button): plays the letter's name (기역). Not on ㅇ, vowels or finals.
- **[SF-3] Hear it with vowels** (the initial ㅇ card only; optional, second button): plays 아, 오, 우 in order, each after the one before (+150 ms), with the lines 아 = ㅇ + ㅏ, 오 = ㅇ + ㅗ, 우 = ㅇ + ㅜ under it. Another sound, Continue, Previous or leaving stops it. Never plays by itself.
- **CONTINUE**: next page; on the last page the step ends (`quest.discover_completed { questId, pages, heard }`). Always enabled.
- **Previous**: the page before, or the step before on page 1; see "[QB] Previous inside the step" below.
- **[x leave]**: the quest's leave sheet (run discarded after confirm), as on every step.

## [SF] Sound first (consonant card) (AMENDMENTS-DISCOVER-SOUND-FIRST §3.1)

```
+------------------------------+
|        ~~ ㄱ ~~              |  <- big glyph
|        (g/k)                 |  <- romanization (sound value)
|  (a soft, light g ...)       |  <- sound hint, one line: it describes what Hear it plays
|   [ (speaker) Hear it ]      |  <- big button, pulses once; plays the SOUND (가)
|   ~~ 가 = ㄱ + ㅏ ~~ (ga)     |  <- taught line, content (KoreanText), not a UI string
|   [ (speaker) Hear the name ]|  <- smaller, quiet button; plays the NAME (기역)
|   ~~ 기역 ~~ (giyeok)         |  <- the name with its romanization
|   (Can't hear it?)           |  <- first card of the page only (CH-1d), guidance only
|  - - - - - - - - - - - -     |
|   (example word) ~~ 가족 ~~   |
|   (romanization) (gloss)     |
|   [ (speaker) ]  {picture?}  |
+------------------------------+
```

| Card | Hear it | Line under it | Hear the name | Line under it |
|---|---|---|---|---|
| Consonant, name differs from sound (ㄱ-ㅎ but ㅇ; ㄲ ㄸ ㅃ ㅆ ㅉ) | sound: 가, 까 | 가 = ㄱ + ㅏ · ga | name: 기역, 쌍기역 | 기역 · giyeok |
| Initial ㅇ | 이응 | 이응 · ieung (and the silent-letter hint) | none; [SF-3] **Hear it with vowels** in its place: 아, 오, 우 | 아 = ㅇ + ㅏ · a, 오 = ㅇ + ㅗ · o, 우 = ㅇ + ㅜ · u (three lines) |
| Vowel | 아 | 아 · a | none | — |
| Final | 악 | the final line ("ㄱ at the bottom: 악 · ak") | none | — |

- Screen-reader order is the visual order: glyph (with its hint), "Hear it. Korean letter g/k. ...", the taught line (read as "가, ga", never 기역), "Hear the name. Korean letter g/k", the name line.
- Largest text / 320 wide: the two buttons stack, each centred at its own width (sizes unchanged), each line under its own button; nothing sits side by side.
- No sound (no clip and no Korean voice, sound off, a failed play): "Say it out loud: ga" under the card; the two lines are already printed, so nothing else is needed.

## [SF-3] The ㅇ card (AMENDMENTS-DISCOVER-SOUND-FIRST §12)

```
+------------------------------+
|   (heard)                    |  <- pill, once anything on the card played (only fills)
|        ~~ ㅇ ~~              |  <- big glyph
|      (silent/ng)             |  <- romanization (sound value)
|  (silent at the start ...)   |  <- sound hint, one line
|   [ (speaker) Hear it ]      |  <- big button (pulses only on a page's first card); plays the NAME 이응
|   ~~ 이응 ~~ (ieung)          |  <- what Hear it says
|   [ (speaker) Hear it with   |  <- smaller, quiet button, the place and look of "Hear the name";
|     vowels ]                 |     one tap: 아 .. 오 .. 우 (each after the one before, +150 ms)
|   ~~ 아 = ㅇ + ㅏ ~~ (a)      |  <- three carrier lines, content (KoreanText), stacked;
|   ~~ 오 = ㅇ + ㅗ ~~ (o)      |     the ㅁ card above reads "마 = ㅁ + ㅏ (ma)": the contrast
|   ~~ 우 = ㅇ + ㅜ ~~ (u)      |     is the lesson; they are also the button's text fallback
|   (Can't hear it?)           |  <- only if this is the page's first card (CH-1d); on quest 2 it is under ㅁ
|   (Say it out loud: ieung)   |  <- only when Hear it could not play
|   (status panel)             |  <- why a sound did not play, with its one action (plays all three again)
|  - - - - - - - - - - - -     |
|   (example word) ~~ 오 ~~     |
|   (romanization) (gloss)     |
|   [ (speaker) ]              |
+------------------------------+
```

- Only the initial ㅇ card (quest 2, page 2, after ㅁ). Not the final ㅇ, vowels or other consonants; no card has three letter buttons.
- The three sounds are the vowel cards' own clips (ㅏ in quest 1, ㅗ ㅜ on quest 2's page 1): no new clip.
- **Stops** on another sound (Hear it, an example, a line, Read along), Continue, Previous or leaving the step; nothing of the rest plays. Show how to say it, Can't hear it? and help do not stop it. A second tap starts again from 아.
- **No playing state**: the label stays, no Stop toggle, no announcement, no per-syllable highlight (about 3.5 s, started only by a tap, the syllables are printed). Not the Read along pattern.
- Screen-reader order is the visual order: "Hear it. Korean letter silent/ng. ...", "이응, ieung", "Hear it with vowels. Korean letter silent/ng", "아, a", "오, o", "우, u" (each carrier line reads its syllable only, never the lone ㅇ as 이응).
- No sound: the run stops at the sound that could not play; the status panel says why; the lines are already printed. Nothing is scored; Continue never waits.
- Largest text / 320 wide: as the consonant card (buttons stack, each line under its own button); the card scrolls.

## [TC] Trace the new letters (AMENDMENTS-STAGE1-TRACE-COVERAGE §3.3, §3.4)

Shown once per Discover step, right after the **last page that holds a letter card**, in quests 1–10 (every letter card whose letter has stroke data). Quest 1: ㅏ ㅓ · ㄱ ㄴ · **trace**. Quest 4: ㅈ ㅊ · **trace** · words. Quest 8: ㅑ ㅕ · ㅍ final ㅇ · **trace** · 추석.

```
+----------------------------------+
| [x leave]  o (*) . . . .         |  <- close header and step dots stay
|  (Trace the new letters)         |  <- takes the step title's slot; the step pill
|                                  |     and the step's Hoya line are hidden here
|   page 3 of 3   (*) (*) (*)      |  <- Discover's page dots count this page
|   [ㅏ*] [ㅓ] [ㄱ] [ㄴ]           |  <- letter row: decorative, not buttons; current
|                                  |     ringed, traced ones get a filled mark (only
|                                  |     fills); one summary label for screen readers
|  (Trace the letter a)            |  <- heading with romanization; a final: "Trace the
|                                  |     final n" + "Sits at the bottom of the block"
|  +----------------------------+  |
|  |      {ghost of ㅏ}         |  |  <- canvas: flex slot, >= 160, never inside a
|  |      {learner's ink}       |  |     scroll view (it owns drags)
|  +----------------------------+  |
|  (Hoya) (Trace each line slowly.)|  <- strip: idle / praise / keep going / shape
|  [Hear it][Show me][Clear][Next letter] <- one wrapping row of small buttons; this
|                                  |     row scrolls if large text needs it
|  [ Previous ]  [[ CONTINUE ]]    |  <- pinned; CONTINUE always enabled
+----------------------------------+
```

- **Finished**: the learner lifts every finger on a finished letter; 1.5 s later the ink takes the success look, Hoya cheers ("Beautiful! That looks like the letter."), the chip fills; for 1.1 s the canvas takes no ink and Next letter is off; then the next letter comes up on an empty canvas. On the last letter the praise stays; Clear lets the learner trace it again; CONTINUE moves on.
- **Never a miss**: no Done, no fail look, no amber, no stars, nothing stored. Unfinished ink waits; after 3 s with no touch the line reads "Keep going, or tap Next letter." ("…or tap Continue." on the last letter).
- **Next letter**: moves on at any time (not during the 1.1 s beat), records nothing; the chip it leaves stays plain (never marked as missed) and is not offered again on this visit.
- **Show me**: the shape reveal and the "Shape guide" line while the letter's stroke order is untaught (every letter until SO-3); the ordered animation once taught. It says the letter's sound, as Hear it does (가 for ㄱ). No order, direction or loop tips on this page.
- **No sound by itself** on this page; **Hear it** plays the current letter (the card's own sound). No "Can't hear it?" link here (the letter pages carry it); a silent play shows the status panel in the strip's place.
- **Sizes** (spec §3.4): at 320 × 568, 375 × 553, 375 × 667, 844 × 390, 390 × 844, 768 × 1024, 1180 × 820 and Largest text on 390 × 844 the canvas is at least 160 and CONTINUE is on screen. Landscape: canvas left, band and controls right (Trace Stroke's side layout). If a size does not fit, first the chips and heading share a line, then the chips drop (the mock in TC-0b decides and measures).
- **Screen reader / switch**: the letter row reads "0 of 4 letters traced"; CONTINUE is reachable at once; the heading reads the letter by its romanized name.
- **Reduced motion**: Show me's still (unnumbered while untaught); no chip animation.
- **Coming back** with Previous inside the step: the current letter and the filled chips stay. A new visit of the step starts plain. Reached by Previous from the practice step, the step opens on this page (its last page) in quests 1–3 and 9.

**As built (row TC-2, 2026-11-26; `AMENDMENTS-STAGE1-TRACE-COVERAGE.md` §12).**

- **The sketch above is the `full` arrangement.** The page takes the first step of a ladder whose canvas slot reaches 160 (`logic/stage1/trace-pad-layout.ts`, chosen once per page from the Screen content box, the text scale and the page): portrait `full` → `beside` (Hear it and Show me in a column beside the canvas) → `compact` (no title slot: the heading leads) → `short` (the step dots in the header between Close and Aa, no page row, Previous and Continue 64 high) → `short-b` (no chips); landscape `side` → `side-short` → `side-short-b`. Measured on the release build (Chromium): 320 × 568 short or short-b (canvas 160–166), 375 × 553 short-b (163), 375 × 667 compact or short (174–221), 844 × 390 side-short, or side-short-b when the page has a final (266), 390 × 844 full (190), 768 × 1024 full (384), 1180 × 820 side (380), Largest text on 390 × 844 beside (160 or more, all six controls on screen). At 844 × 390 quests 7 and 8 (a final adds a line) take `side-short-b`, where the mock had quest 7 on `side-short`.
- **Short arrangements**: the title "Trace the new letters" is not drawn in `compact` and below (owner decision 2026-11-26); the page label and the letter row's summary stay for screen readers through the visually-hidden `srOnly` style (never `opacity: 0`, which VoiceOver skips).
- **The pad loads lazily** (`discover-trace-chunk`, 13.7 KB, asked for as a Discover step with letters opens); until it is in, the page shows Previous and Continue alone. The All lessons preview draws the page too, inside its strip: the strip's height is taken off the window through `ScreenReserveContext`.
- **Telemetry** `quest.discover_completed { questId, pages, heard, written, writeSeconds }`: `pages` counts the trace page; `heard` counts a Hear it or Show me tap on it as `write|<jamoId>`, each id once.
- **Not yet checked**: sizes outside the acceptance set, WebKit (Chromium only was run) and every on-device check of the spec's §3.8, which are the owner's.

## [QB] Previous inside the step (AMENDMENTS-QUEST-SOUND-BACK QB-1, QB-2)

```
Page 2 of 2:                              Page 1 of 2, after Previous:
+--------------------------------+       +--------------------------------+
| page 2 of 2   (*) (*)          |       | page 1 of 2   ((*)) (*)        |  <- dots keep the furthest page;
| ( the page's cards )           |       | ( the page's cards )           |     ((*)) = the page shown
|                                |       |                                |
| [ Previous ] [[ CONTINUE ]]    |       | [ Previous ] [[ CONTINUE ]]    |  <- on page 1, Previous is the step's
+--------------------------------+       +--------------------------------+     (the step before; none on step 1)
```

- **Previous** (page 2 or later): the page before; any sound and any Read along stop. The page dots only fill; the caption names the page shown.
- **Previous** on page 1: the step before (`quest/player.md`, "[QB] Previous"); a quest whose first step is Look and learn shows none there.
- Arriving on this step by Previous from the next step opens the **last** page, with every dot filled.
- `quest.discover_completed` is sent once per step per run, the first time Continue leaves the last page (QB-3).
- Narrow window or Largest text: the row wraps, CONTINUE first.

## Navigation graph

Enter from: `quest/player` step 1 (`intro`)
Exit to: `quest/player` step 3 (`practice`) · leave sheet -> `episode/detail`

## States

- **success**: as drawn (1-3 pages, 1-2 items each).
- **empty**: no resolvable item (a bad `jamoId`): one line and CONTINUE, `heard: 0`; never a dead end (the content test keeps it out of shipped data).
- **no sound**: the "Say it out loud" line; romanization already shows.
- **tap mode** (`romanizationMode === 'tap'`): the example word's romanization hides behind "Show how to say it"; the symbol's own romanization and every gloss stay.
- **reduced motion**: no pulse and no page slide.
- **large text / small phone / landscape**: cards stack, the page scrolls, CONTINUE stays reachable.

## Data needs

- reads: `questById(id).steps[]` (`discover.pages`) · `jamoAll` (glyph, romanization, `soundHint`, `spokenKo`, `nameKo`) · `romanizationMode` (F-I18N-001) · `HeritageCardArt` / `WordArt` for pictures
- writes: nothing (unscored)
- telemetry: `quest.discover_completed { questId, pages, heard }` ([TC] TC-1b added `written`, the letters traced to the end on the trace page, and `writeSeconds`, 0 for a step with no trace page)

## Open questions

- Should Discover offer an optional "See how it is drawn" (existing stroke demo) on each letter? Recommend: later, behind the same Hear-it row; not v1. [TC] Answered 2026-11-25: the trace page's **Show me** (AMENDMENTS-STAGE1-TRACE-COVERAGE §3.3), not a button on each card.
- Spoken carrier for isolated consonants is F-AUDIO-004's call (decided: ㅏ, and ㅇ by its name); the wireframe does not depend on it.
- [SF] The big button keeps the label "Hear it" (not "Hear the sound"): every Hoya line says "Tap Hear it" (open decision SF-OD-1 of the amendment, adopted provisionally).
