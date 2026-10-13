# Quest/Discover — teach before play (wireframe v1)

Spec: `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` §3.2 (Discover step), §3.1 (step kinds), §3.6 (Discover pages per quest), §6 PR Q-5a
Extends: `design/wireframes/quest/player.md` (6-step shell)
Audience: **any learner, any age** (CLAUDE.md §1); same screens for everyone. Wireframe level: structure, flow, interaction points. No colours, fonts, art or final copy; text in (parentheses) is a placeholder.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `{ x }` content-driven, `( ) ( ) (*)` dots (fill-only), `~~` taught Korean shown with romanization + gloss (`KoreanText`).
Code: `apps/mobile/src/screens/quest/DiscoverStep.tsx` (renders), `apps/mobile/src/logic/stage1/discover-flow.ts` (decides)

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
- Audio never autoplays; first Hear it pulses once.
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

- **Hear it**: plays the symbol's sound or the word via `playPrompt` (never the letter name of a consonant; ㅇ by its name 이응); a result of `unavailable` / `muted` shows the line "Say it out loud: <spoken romanization>", no error. A tiny "heard" mark appears on the item (fill-only, never a gate).
- **Letter name** (optional, second button): plays the letter's name.
- **CONTINUE**: next page; on the last page the step ends (`quest.discover_completed { questId, pages, heard }`). Always enabled.
- **[x leave]**: the quest's leave sheet (run discarded after confirm), as on every step.

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
- telemetry: `quest.discover_completed { questId, pages, heard }`

## Open questions

- Should Discover offer an optional "See how it is drawn" (existing stroke demo) on each letter? Recommend: later, behind the same Hear-it row; not v1.
- Spoken carrier for isolated consonants is F-AUDIO-004's call (decided: ㅏ, and ㅇ by its name); the wireframe does not depend on it.
