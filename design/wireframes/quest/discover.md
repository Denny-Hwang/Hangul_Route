# Quest Discover + Check, Listen & Pick, Pic-Word Match, next-quest teaser, Stage 1 complete, Hangul Check (wireframe v1)

Spec: `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` (this file is split on promotion into `design/wireframes/quest/discover.md`, `quest/check.md`, `minigame/listen-pick.md`, `minigame/pic-word-match.md`, `results/next-quest-teaser.md`, `results/stage1-complete.md`, `reviews/hangul-check.md`)
Extends: `design/wireframes/quest/player.md` (6-step shell), `minigame/shell.md`, `results/celebrate.md`, `episode/detail.md`, `journey/grid.md`
Audience: **any learner, any age** (CLAUDE.md §1); same screens for everyone. Wireframe level: structure, flow, interaction points. No colours, fonts, art or final copy; text in (parentheses) is a placeholder.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `{ x }` content-driven, `( ) ( ) (*)` dots (fill-only), `~~` taught Korean shown with romanization + gloss (`KoreanText`).

Screens in this file: S1 Discover (letters) · S2 Discover (final consonant, words) · S3 Check launcher · S4 Listen & Pick (text options) · S5 Listen & Pick (picture options) · S6 Pic-Word Match · S7 Results with teaser · S8 Stage 1 prize · S9 Hangul Check (invitation, item, break, result) · S10 Episode page with soft prerequisite · S11 Journey Stage 1 header

---

## Scenario (Given-When-Then)

Given: a learner starts any Stage 1 quest (from Episode, Home "Continue", the first-quest preview or a teacher plan)
When: the player moves through its six steps
Then: Hoya says hello, the **new letters are shown and heard before anything asks about them**, two games practise them, two quick questions check them, the learner sees stars and a card plus **what comes next**; and after the 15th quest a short, optional check shows which letters still need a look (to a grown-up only)

## Screen goal

"Show it, hear it, practise it, check it twice, and point at the next step — without ever making a miss feel like failing."

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

## S3 — Check launcher (`quest/player`, step `check`)

```
+----------------------------------+
| [x leave]  o o o o (*) .  (5 / 6)|
|  (Quick check)  [step pill]      |
|                                  |
|   (Hoya small)  "Two quick ones" |  <- one line
|                                  |
|   [[ GO ]]                       |
|                                  |   <- no "Skip for now" on this step
+----------------------------------+
```

## S4 — Listen & Pick, text options (Check round, practice step, Hangul Check item)

```
+----------------------------------+
| ( ) (*)            [x leave]     |  <- Check: 2 dots; practice: progress bar; review: chunk dots
|                                  |
|  (prompt line: "Listen")         |
|        [[ (speaker) ]]           |  <- hero-size; round 1 waits for a tap, later rounds autoplay
|        [ Hear it again ]         |  <- unlimited
|                                  |
|  +-----------+  +-----------+    |
|  |  ~~ 가 ~~ |  |  ~~ 거 ~~ |    |  <- 2 columns for short text; 1 column when long or narrow
|  |  (ga)     |  |  (geo)    |    |  <- romanization visible (hidden until tap only if opted in)
|  +-----------+  +-----------+    |
|  +-----------+  +-----------+    |
|  |  ~~ 나 ~~ |  |  ~~ 너 ~~ |    |
|  +-----------+  +-----------+    |
|                                  |
|  (Hoya bubble appears on a miss) |
+----------------------------------+
```

States of one round:

```
miss:      tapped card = amber + mark, stays locked; Hoya thinking: "(Listen again)"; sound replays after 0.8 s
2nd miss:  the right card gets a "look here" ring
hit:       card = green + check mark; gloss + romanization appear; sound once more; next after 0.7 s
no sound:  prompt zone becomes text: ~~ Korean ~~ + (romanization)   "(No sound? Read it here.)"
```

## S5 — Listen & Pick, picture options

```
+----------------------------------+
|  ( ) (*)                         |
|        [[ (speaker) ]]  [Hear again]
|  +--------------+ +--------------+|
|  | {picture}    | | {picture}    ||  <- art at hero size
|  | (English     | | (English     ||  <- label stays visible (it is also the accessible name)
|  |  label)      | |  label)      ||
|  +--------------+ +--------------+|
|  +--------------+ +--------------+|
|  | {picture}    | | {picture}    ||
|  +--------------+ +--------------+|
+----------------------------------+
```

## S6 — Pic-Word Match (one board, 3-5 pairs)

```
+----------------------------------+
| (progress)                [Skip] |  <- Skip appears after the first answer
|  (prompt: "Match each picture")  |
|  pictures            words       |
|  +--------+        +-----------+ |
|  |{pic} 1 |        | ~~ 밥 ~~  | |  <- number badge appears on BOTH tiles of a matched pair
|  +--------+        | (bap)     | |
|  +--------+        +-----------+ |
|  |{pic}   |        | ~~ 김치 ~~| |
|  +--------+        | (gimchi)  | |
|  +--------+        +-----------+ |
|  |{pic}   |        | ~~ ... ~~ | |
|  +--------+        +-----------+ |
|  (Hoya bubble on a miss)         |
+----------------------------------+
```

```
select:   tap a picture (or a word) -> it is highlighted; tap again clears
match:    both lock + same number badge + check; word is spoken; gloss appears under the word
miss:     the tapped word goes amber, clears after 0.6 s; the picture stays selected; nothing ends
2nd miss: the right word gets a "look here" ring
no art:   the picture tile shows the English gloss instead (plays like Card Match); never blank
done:     all pairs locked -> 0.7 s -> next board or back to the quest
```

## S7 — Results with the next-quest teaser (`results/celebrate`, extended)

```
+----------------------------------+
|        [HOYA cheering]           |
|       (Great!)   * * *           |  <- no number, no fraction
|  ( Hoya bubble, 1 line )         |
|  +----------------------------+  |
|  | CARD UNLOCK BANNER         |  |  <- 2+ stars, first time only (unchanged)
|  +----------------------------+  |
|  +----------------------------+  |
|  | NEXT UP                    |  |  <- the cursor quest (same as Home "Continue")
|  | (quest title)              |  |
|  | (one line: "New letters:   |  |
|  |   ~~ ㅈ ㅊ ~~")            |  |
|  +----------------------------+  |
|   [[ PLAY NEXT QUEST ]]          |  <- the ONE primary
|   [ Back home ]  [ Episode page ]|  <- ghost
+----------------------------------+
```

- Variants: skipped everything -> teaser is the same quest ("Try this one again"); last missing quest of Stage 1 -> primary is **See your Stage 1 prize** (S8); no next quest (and Stage 1 not just finished) -> the old two buttons.

## S8 — Stage 1 prize (`results/stage1-complete`)

```
+----------------------------------+
|        [HOYA cheering, large]    |
|       (Stage 1 headline)         |
|  +----------------------------+  |
|  | SYMBOL WALL  (30 tiles)    |  |  <- every tile lit; no counts
|  | ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ...    |  |
|  +----------------------------+  |
|  [card] [card] [card]            |  <- the three new legendary cards -> card detail
|  (one line: what you can do now) |
|   [[ TAKE THE HANGUL CHECK ]]    |  <- "about 4 minutes, you can skip it"
|   [ See my cards ] [ Back home ] |
+----------------------------------+
```

- No Premium pill, no purchase prompt, no timer.

## S9 — Hangul Check (`reviews/stage-review`, Stage 1 configuration)

```
Invitation:                           Item (same component as S4/S5):
+------------------------------+      +------------------------------+
| [HOYA]  (Hangul Check)       |      | (* . . . .)  chunk 1 of 5    |
| (about 4 minutes. Pictures   |      |        [[ (speaker) ]]       |
|  and sounds. No timer.)      |      |  [ ㅌ ] [ ㄷ ] [ ㅋ ] [ ㅍ ]   |
|  [ ] Hide the romanization   |      |  (romanization on each)      |
|      until I tap  (this      |      +------------------------------+
|      time only)              |
|  [[ START ]]  [ Not now ]    |      Break between chunks:
+------------------------------+      +------------------------------+
                                      | (Hoya: one encouraging line) |
Result (certificate variant):         |   [[ KEEP GOING ]]           |
+------------------------------+      +------------------------------+
|        [HOYA]   * * *        |
|  +------------------------+  |
|  | CERTIFICATE            |  |  <- name, "Stage 1: Hangul", date
|  +------------------------+  |
|  (Hoya's tip: up to 3 chips) |  <- "Try again: ㅌ ㅠ" -> the quest that teaches it
|  [card][card][card] ->       |  <- Stage 1 collection wall
|   [[ BACK HOME ]]            |
|   [ Take it again ] [ Cards ]|
+------------------------------+
```

- No number, ratio or percent on any of these screens. The 90 % anchor verdict goes only to the grown-up channel.
- Leaving mid-check: one-line confirm, nothing saved, nothing lost.

## S10 — Episode page: soft prerequisite (`episode/detail`, extended)

```
+----------------------------------+
| [<]   (Episode title)            |
|  ...                             |
|  Quests                          |
|  +----------------------------+  |
|  | 1 (title)          * * .   |  |
|  | [ Play again ]             |  |
|  +----------------------------+  |
|  +----------------------------+  |
|  | 4 (title)                  |  |
|  | (Builds on: <previous>)    |  |  <- only when the previous quest is not done
|  | [[ START ]]                |  |
|  +----------------------------+  |
+----------------------------------+

Sheet after tapping START on such a quest (once per quest per session):
+----------------------------------+
| (This one uses letters from      |
|  <previous>. Start there?)       |
|  [[ START THERE ]] [ PLAY ANYWAY ]|  <- nothing is locked
+----------------------------------+
```

## S11 — Journey: Stage 1 header when complete (`journey/grid`, extended)

```
| (1) (Hangul)            [Complete]  [ Hangul Check ]
```

- Pills of other stages are unchanged (the existing "Premium" pill stays where stage gating already is, D5).

## Interaction points

- **Hear it** (S1, S2): plays the symbol or word via `playPrompt`; result `unavailable` / `muted` -> text line "say it out loud", no error.
- **CONTINUE** (S1, S2): next page; last page -> next step. Always enabled.
- **GO** (S3): opens the Check (`Minigame` route, 2 rounds); Back returns to S3 with answers kept (re-answers count as retries).
- **Option card** (S4, S5): first tap scores the round (right or wrong); a miss never ends the round; the right tap ends it.
- **Tile pair** (S6): tap picture + tap word, either order; the first-selected tile decides which pair is scored.
- **PLAY NEXT QUEST** (S7): `QuestPlayer` for the cursor quest; **Back home** resets to Main; **Episode page** opens the episode.
- **TAKE THE HANGUL CHECK** (S8, S11) -> S9; **Not now** -> home. **Tip chip** (S9 result) -> `QuestPlayer` of the teaching quest.
- **START / START THERE / PLAY ANYWAY** (S10): never blocked.

## Navigation graph

Enter S1-S3 from: `quest/player` (step transitions) <- `episode/detail` · `home/todays-mission` · `homework/list` · `onboarding/first-quest-preview` · teacher plan item
Enter S4-S6 from: `quest/player` -> `minigame/shell` (push, returns); S4 also from S9
Enter S7 from: `quest/player` (stack reset to Main -> Results)
Enter S8 from: S7 (stage just completed) · S11
Enter S9 from: S8 · S11
Exit: S1-S3 -> next step or leave sheet -> `episode/detail`; S4-S6 -> back to the quest; S7 -> `quest/player` (next quest) · Main · `episode/detail` · S8; S8 -> S9 · `library/gallery` · Main; S9 -> Main (result) · `quest/player` (tip chip) · S9 again

## States

- **success**: as drawn.
- **empty**: Discover with no resolvable item, Listen & Pick / Pic-Word with no valid round -> one line + a continue / back button (never a frozen screen); quest not found -> existing "Quest not found" + Go back.
- **error**: audio failure -> text prompt (S4) / text line (S1); picture failure -> gloss tile (S6); a bad round is skipped (and caught by the content test).
- **offline**: all content is bundled; no voice installed -> text everywhere, nothing blocks.
- **reduced motion**: pulse, slide and pair-lock animations become instant state changes.
- **large text / small phone / landscape**: bodies scroll; the primary button is pinned and reachable; option grids fall back to one column.
- **anti-shame**: amber + Hoya thinking on a miss; fill-only dots and symbol wall; no number, fraction or percent on any learner result; no red; no timer.

## Data needs

- reads: `questById(id).steps[]` (incl. `discover.pages`, `check` scope) · `jamoAll` (glyph, romanization, `soundHint`, `spokenKo`) · `scopeFor(ref)` (`listenPick`, `picWord`, `jamoIds`, `focusJamoIds`) · active profile + progress snapshot (cursor, stage completion, cards owned) · `romanizationMode` (F-I18N-001) · `HeritageCardArt` / `WordArt` for pictures
- writes: `quest-run-store` (first-try tally via the host) · `progress-store` (`recordQuestComplete`, `unlockCard`, `recordReview`) · `review-run-store` (ephemeral)
- telemetry: `quest.discover_completed` · `quest.check_completed` · `quest.teaser_tapped` · `stage.complete` · `review.start` · `review.complete` · existing `minigame.finished`, `quest.complete`, `card.unlocked`

## Open questions

- Should Discover offer an optional "See how it is drawn" (existing stroke demo) on each letter? Recommend: later, behind the same Hear-it row; not v1.
- Should Pic-Word Match draw connecting lines (catalog) instead of number badges? Recommend: badges now (accessible without gestures); lines as motion polish.
- Is "Play next quest" as the single primary right for a learner who wants to stop? Recommend yes, with Back home one tap away; revisit after the family playtest.
- Where does the Hangul Check live after the ceremony for a learner who skips it? Journey Stage 1 header (S11) only, or also the Library? Recommend Journey only for now.
- Spoken carrier for isolated consonants (ㅏ vs ㅡ) is F-AUDIO-004's call; the wireframes do not depend on it.
