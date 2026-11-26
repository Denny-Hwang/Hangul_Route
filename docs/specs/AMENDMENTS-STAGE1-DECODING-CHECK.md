# AMENDMENTS-STAGE1-DECODING-CHECK — the Checks measure reading: romanization waits for the answer, and the Hangul Check asks learners to read new syllables

Status: ready (revision 2, 2026-11-25: the two-lens multi-agent review of revision 1 is adjudicated in §11). Written for work order WO-10 of `docs/roadmap/review-2026-11/phase-2-hangul.md`, row DC-0, on main `8676b5de5` (the work order was written on `d5ba0217c`; §1.1 re-reads every citation). Owner decision 2026-11-22: OD-R1 approved as recommended ("Check 계열은 항상 숨김", README §4 of the 2026-11 review), the rule this amendment builds on. Decisions the work order does not settle are open decisions OD-DC1 to OD-DC12 (§10), each with a provisional value the rows use until the owner answers.

**Owner decision 2026-11-25**: the open decisions OD-DC1 to OD-DC12 are approved as recommended ("권고대로 진행해줘"); they are no longer provisional.

**Amends** (each gets its "Amended 2026-11-25 by AMENDMENTS-STAGE1-DECODING-CHECK" line in the row named): F-QUEST-002 §3.3, §3.8 (no behaviour change, §3.7), §3.9 and §3.10 (DC-0) · F-RVW-001 §3.2 and §3.4 (DC-0) · F-CNT-002 (the Check exception to "always shows romanization and a gloss"; DC-1a, when the behaviour ships) · CLAUDE.md §1 Languages (the exception line; DC-1a) · AMENDMENTS-AUDIT-2026-11 AU-8 (widened, not replaced; DC-4) · AMENDMENTS-AUDIO-CANT-HEAR §3.12 and §4 (the asked and Sound-off text in a Check; DC-4) · F-CURR-002 §4.3, §4.5 and §7.3 (the Daily Review rungs, the Stage Check, the Cell Check; DC-4).
**Not amended**: the star rules (F-001 §3.2 first-try scoring, F-RVW-001 §3.1); the Hangul Check stays non-gating (F-QUEST-002 §3.9, D5); the romanization data (every `romanization` field stays); the screen-reader names (§3.1); the romanization modes and how a mode is chosen (AMENDMENTS-ROMANIZATION-FADE, WO-11).
**Scope**: `apps/mobile` — `logic/locale/check-hold.ts` (new), `logic/listen-pick-flow.ts`, `screens/minigames/{ListenPickGame,cloze-pick-fallback,TypeHangulGame,ClozePickGame,SentenceBuilderGame,PicWordMatchGame,RealiaReadGame,TapRespondGame,MinigameScreen}.tsx`, `logic/pic-word-flow.ts`, `screens/reviews/{StageReviewScreen,ReviewRounds,DailyReviewScreen}.tsx`, `screens/stage-check/StageCheckScreen.tsx`, `screens/cell-check/CellCheckScreen.tsx`, `screens/week-drop/WeekDropScreen.tsx` and `quest-review-chunk.tsx` (pass `practice`), `logic/reviews/{review-rounds,round-look,saved-check,saved-stage-check,stage-check,stage-check-api}.ts`, `store/{check-run-saved,review-run-store}.ts`, `logic/stage1/{hangul-check,review-flow,decode-round}.ts`, `logic/stage1/decode-items.json` (new), `logic/sync/summarize.ts`, `i18n/use-romanization-mode.tsx` (a comment) · `packages/design-system` (`HangulKeyboard`: a held sound line; DC-1b) · `packages/content-schema` (`ProgressSummarySchema.stage1Anchor.version`, optional; DC-2d) · `packages/backend` (`roster-summary.ts` keeps `version`; DC-2d, Worker first) · `packages/i18n` (en, es and ko in the same PR, with the multi-agent review and the ledger re-signed: all three locales are shipped, `packages/i18n/src/locales.ts:31-35`) · `content/audio/tts-manifest.json` and the clip pack (DC-2b, DC-2c) · `docs/roadmap/TELEMETRY-NAMES-2.md` · `design/wireframes/reviews/{hangul-check,stage-check}.md` · `design/screens/hangul-check/` (new, DC-2a).
**Owner**: solo dev
**Rollout**: next release after each row; no migration; one additive summary field, Worker first (§3.6, §7).

---

## 1. Context

Stage 1 is the MVP's core. Its promise is "after Stage 1 you can read Hangul". Two things in today's assessment do not test that promise:

1. **A learner can pass a Check without reading Hangul.** Every Check draws taught Korean with its romanization, except the options of a quest Check that plays a sound (AU-8). A learner who knows English letters, or a heritage learner who understands spoken Korean but cannot read it (P4), can answer most Check rounds from the romanization, the glosses on options, or the Latin sound line of the keyboard.
2. **The Hangul Check asks names and listening, not reading.** 24 of its 35 items play a letter's name and ask for the letter; 6 play a syllable and ask for its final; 5 play a word and ask for its picture. No item shows Hangul and asks what it says. Yet the caregiver verdict `stage1Anchor.met` is computed from these items.

This amendment does two things. **DC-1** holds the keys to the answer (romanization, option glosses, the keyboard's Latin line) in every Check until the question is answered, by widening AU-8's held line. **DC-2 and DC-3** replace half of the Hangul Check's name items with decoding items (see a syllable, pick its sound) and make the word items reading items, and redefine `met` on the decoding items.

### 1.1 Citations re-read on `8676b5de5`

| WO-10 citation | Now | Note |
|---|---|---|
| `packages/content-schema/src/schemas/locale.ts:39` `romanizationMode` default `'always'` | same line | confirmed |
| `logic/locale/romanization-mode.ts` `resolveRomanizationMode`: override, then profile, then `always` | `:9-14` | confirmed |
| `content/placement/syllable-reading.json:383` `pitem:syl-cv-see-geu` | `:383` (item `:382-399`) | confirmed. Its options are Latin sound chips (`"sound":"geu"`), `"leaks": true` |
| `packages/content-schema/src/placement/run.ts:141-143` `leaks` skipped when `revealMode === 'always'` | `:141` destructures, `:143` skips | confirmed |
| `logic/listen-pick-flow.ts:304-317` `heldRomanization` | moved: `OptionView.heldRomanization` `:264-269`; `OptionViewContext.holdRomanization` `:286-290`; `checkHoldsRomanization` `:293-301`; applied in `optionView` `:335-347` | moved, same meaning |
| `listen-pick-flow.ts:309` option romanization; `:316-317` held | moved to `:335` (what the mode shows) and `:337-343` (held while `asking`) | moved |
| `KoreanText` and `ChoiceCard` `romanizationReserved` | `packages/design-system/src/korean-text.ts:47-52, 96`; `components/ChoiceCard/ChoiceCard.tsx:34, 93-94` | confirmed |
| `screens/minigames/BuildLetterGame.tsx:210, 323-330` target and tile romanization | moved: target `:252`, tiles `:415`, `:422` | moved. Build a Letter is a practice game, never a Check step (`content/quests.ts` has 15 `kind: 'check'` steps, all `listen-pick`), so it is outside this amendment (§4, D2) |
| `logic/stage1/hangul-check.ts`: 24 letter items "hear the name, pick the letter", 5 word items "hear, pick the picture"; `stage1Anchor.met` 27 of 30 | `hangul-check.ts:1-121` (`symbolRound` `:78-86`, `buildHangulCheck` `:105-121`, words mapped to parts in a fixed order `:107-113`); `logic/sync/summarize.ts:168-169` (`ANCHOR_SYMBOLS = 27`, `ANCHOR_WORDS = 4`), `:180-194` (`stage1AnchorOf`) | confirmed. The 30 symbol items are 24 letters and 6 finals (hear 아 + final, pick the written syllable) |
| F-QUEST-002 §3.8 completion "at any star count" | `F-QUEST-002…md:262` | confirmed |
| `packages/i18n/src/romanization.ts:9` `romanizationShown(mode, revealed)` | `:9-11` | confirmed |
| `logic/korean-labels.ts` reads romanization as a sound value | `:1-10` (`a11yRomanization`) | confirmed |
| AU-8 as built: "Practice games, the Hangul Check, vocabulary, text-prompt Checks and the no-sound path are unchanged … Not covered: the prompt of a Read Pick Meaning Check … Checks built on other games" | `AMENDMENTS-AUDIT-2026-11.md:109` | confirmed |

What CH-1e (#1121) and the owner decision of 2026-11-25 already ship (`AMENDMENTS-AUDIO-CANT-HEAR.md` §3.12), so no row here re-does it:

- The quest Check's asked text (Can't hear it?, then Show the letters) is the romanization only, no Hangul (`askedTextIsRomanizationOnly`, `listen-pick-flow.ts:250-253`; `promptView` `:220-240`).
- The Hangul Check's asked text is the romanization only **when its mode is `tap`** (`:252`).
- The Hangul Check's attempt switch sets `RomanizationModeOverride mode={hide ? 'tap' : 'always'}` (`screens/reviews/StageReviewScreen.tsx:292-294`; switch `:476`; default from the profile, `logic/stage1/review-flow.ts:61`). In `tap` mode an option shows its romanization only once touched (`listen-pick-flow.ts:335`).
- The Stage Check's switch does the same (`screens/stage-check/StageCheckScreen.tsx:442-453`, switch `:537`) and, with it on, holds a heard round's options' romanization (`ReviewRounds.tsx:155`) and makes the asked text romanization only (`:158`). The Cell Check has no switch and holds nothing.
- "Always show the letters" (CH-2) does not reach any Check.

Still open (WO-10's re-check note, confirmed): the Hangul Check and Stage Check with their switch off; the Cell Check; the Daily Review's read and produce rungs; the prompt of a text-prompt Check (Read Pick Meaning, `ListenPickGame.tsx:197-213`, its mode read at `:208`; the Cloze Pick fallback, `cloze-pick-fallback.tsx:34-50`); quest Checks built on other games; the Sound-off text in a Check (CH §4 hands it to WO-10 and WO-11); and all of DC-2 and DC-3.

### 1.2 Facts the design relies on

- **The Decoding Sprint** (F-CURR-002 row CM-32, decision record `F-CURR-002…md:1025-1031`) measures decoding *fluency* (right first tries per minute), behind `decodingSprint` at 0 %. Its held-out probe is 24 blocks (노 투 기 돈 숨 콩 / 로 푸 티 벌 잠 상 / 포 추 지 반 힘 동 / 소 쿠 니 솔 남 창) that no drill, review item or taught word may show, so G9 compares sprint 1 with sprint 4 on blocks new to both.
- **Recorded syllable clips.** `content/audio/tts-manifest.json` has 270 `syllable` rows. Blocks made only of Stage 1 symbols (14 consonants, 10 vowels, the finals ㄱ ㄴ ㄹ ㅁ ㅂ ㅇ or none), less the carrier syllables (consonant + ㅏ, ㅇ + vowel, 아 + final) and the probe blocks: 169 have a clip (54 open, 115 closed). **After the exclusion of §3.4**, the review's scan of the Stage 1 content leaves about 26 open and 63 closed candidates. The open ones carry only ㅡ ㅓ ㅜ ㅗ ㅛ (ㅡ and ㅓ are 18 of the 26); no open target can have ㅏ (every consonant + ㅏ is a carrier), and ㅑ ㅕ ㅠ have none usable. So new clips are needed: row DC-2c is planned, not optional. A new clip needs the owner's generate step (AMENDMENTS-AUDIO-CLIPS §7, AC-B5: agents run `--dry-run` only).
- **Clips load by pack.** The clips sit in many packs (placement 56, stage1 53, stage7 29 and others, by the first pack holding each candidate). `hasClipFor` sees only the start pack (`jamo-s1`) and the packs a screen has loaded (`logic/audio/clip-assets.ts:4-8`), and `StageReviewScreen` loads none. A decode pool must live in one pack that the Hangul Check loads (§3.4, row DC-2d).
- **The review engine's rounds know their rung** (`ReviewQuestion.rung`, `logic/reviews/engine.ts:121`). A read round of a symbol or block (`ask: 'sound'`, `logic/reviews/review-rounds.ts:440, 449-451`) shows the romanization as its prompt and Hangul options without romanization; that round is already a reading item and keeps its look. `ReviewRounds` never reads the romanization mode: once answered, every line shows (`KoreanText` defaults to shown).
- **The keyboard prints a Latin sound line under each key** (`packages/design-system/src/components/HangulKeyboard/HangulKeyboard.tsx:92`, `soundOf`), used by Type Hangul (`TypeHangulGame.tsx:382-386`) and the review type rounds (`ReviewRounds.tsx:434-438`). With it a learner who knows a word's romanization can type the word without reading. Type Hangul's picture mode draws the romanization as its cue (`TypeHangulGame.tsx:219-221`).
- **`stage1Anchor` is drawn on no screen today.** It is produced (`summarize.ts:210`), synced (`packages/content-schema/src/schemas/sync.ts:160-167`) and kept for family scope by key list (`packages/backend/src/lib/roster-summary.ts:162, 216`); nothing under `apps/web/src` or `apps/mobile/src/screens` reads it. The console's "Stage 1 first-try answers" is `stage1.anchorAccuracy`, another number (`packages/i18n/src/messages/en/console.ts:395`).
- **`ReviewEntrySchema` strips unknown keys** (`packages/content-schema/src/schemas/progress.ts:83-92`), and so does the server; a new entry field is lost when an older build re-saves.
- **A stored Hangul Check is resumed only when the check rebuilt from its seed has the same item ids** (`logic/reviews/saved-check.ts:159-188`, id check `:177`), and both stored checks require a boolean `hideRomanization` (`saved-check.ts:167`, `saved-stage-check.ts:178`).
- **Listen & Pick never autoplays round 1** (first audio needs a gesture; `listen-pick-flow.ts:13`), and one `ListenPickGame` plays one part (`StageReviewScreen.tsx:287-296`), ended through the review host (`store/review-run-store.ts:56-63`). The Hangul Check host drops `meta.hinted` (CH-1f: it has no memory path).

---

## 2. User story

- As a **learner (any age)**, when I answer a Check I read the Hangul. The Latin letters and the meanings of the choices come once I have answered, so I can check how it sounds.
- As a **heritage learner (P4)** who understands Korean but is learning to read it, the Hangul Check asks me to find the sound of syllables I have not practised, so it shows whether I can sound out letters, not whether I remember words.
- As a **parent or teacher**, the Hangul Check's verdict means my learner picked the right sound for new syllables, not that they matched letters to names.
- As the **owner**, a test proves that a responder who understands spoken Korean but reads only Latin letters stays at chance on the reading rounds of every Check.

---

## 3. Acceptance criteria

### 3.1 The hold (rows DC-1a to DC-1c; owner decision 2026-11-22, OD-R1, review-2026-11 README §4)

One rule, one place: `apps/mobile/src/logic/locale/check-hold.ts` (new, pure).

```ts
export type HoldSurface = 'quest-check' | 'hangul-check' | 'stage-check' | 'cell-check' | 'daily-review' | 'practice';
/** Whether the keys to this question's answer are held while the question is open. */
export function holdsRomanization(surface: HoldSurface, rung?: Rung): boolean;
```

- **Check surfaces hold every round:** `quest-check` (a quest's `kind: 'check'` step, host mode `check`), `hangul-check` (host mode `review`), `stage-check`, `cell-check` (every Cell Check mode, test-out and Stage Jump included: each is an assessment). **`daily-review`** (the Daily Review and Keep going) holds at the **read and produce rungs** only; its recognize rung (hear it, pick it) is practice and is unchanged. **`practice`** never holds and is the default wherever a surface passes nothing (This week in Korea, the quest warm-up and Try these again pass `practice`, OD-DC3).
- **What is held** while the question is open (not yet answered right): every romanization line of the question's taught Korean — the prompt or stimulus and every option or tile — and the **gloss of every Korean option** (a reply's meaning in Tap Respond, a word card's meaning). In a Check (not the Daily Review, OD-DC12) the keyboard's Latin sound line is held too, and Type Hangul's picture-mode romanization cue (§3.3). A held line keeps its room, draws nothing and is off the accessibility tree (AU-8's `romanizationReserved`); options already missed wait too. A gloss that is the stimulus itself (a meaning to find in Korean, a picture) is not held.
- **When it ends**: when the round resolves (the right answer). Then every line shows as the surface shows it today: Listen & Pick by the learner's mode (`romanizationShown(mode, touched)`); `ReviewRounds` all lines (it never reads the mode, §1.2; unchanged). This is the learning moment: the answer, then how it sounds and what it means. One named exception: `ReviewRounds`' MissLine (Hoya after a miss, `ReviewRounds.tsx:270-279`) still names the right answer with its romanization once the first, scored answer has been a miss (the Hangul Check's review host draws no miss line).
- **A multi-item board** (Pic-Word Match pairs): each item is held until it is matched right; a merely selected word is held too (`logic/pic-word-flow.ts:363-364` shows a selected word's romanization today).
- **The hold applies whatever the profile's romanization mode is**: `always`, `tap`, or the `auto` mode of AMENDMENTS-ROMANIZATION-FADE (WO-11). While a Check question is open the hold wins; after the answer the line follows the mode as that amendment resolves it, where the surface reads a mode. This amendment adds no mode and no resolution rule, and no Check uses `RomanizationModeOverride` any more (DC-1a and DC-1b remove the two Check uses; its other users, All lessons and the e2e screens, are unchanged).
- **Not a new override** (WO-10 re-check note): no screen passes an override to `resolveRomanizationMode` for this. `checkHoldsRomanization` (`listen-pick-flow.ts:293-301`) becomes a call of `holdsRomanization`, its text-prompt exclusion is dropped (a text prompt's own romanization is now held), and `ReviewRounds`' `hidesRomanization` prop becomes the computed hold.
- **A held line cannot be revealed by a tap**: no held text is pressable before the answer.
- **Screen-reader names are unchanged** (WO-10 §1): an option or prompt keeps the name it has today (its romanization read as a sound value, `logic/korean-labels.ts`). The hold is visual, not a removal of accessible information. §4 records the known limit.
- **Data unchanged**: no `romanization` or gloss field is removed or emptied (README §5.2).
- **Rounds that ask with romanization as the stimulus keep it**: the review read round of a symbol or block (`ask: 'sound'`), and the asked or Sound-off text of §3.2. There the romanization is the sound to find, not a key to the answer.
- **Unchanged practice surfaces**: practice and apply steps of quests (Build a Letter included), the quest warm-up, Try these again, This week in Korea, the vocab Speed round, stories, the Decoding Sprint, the presenter (beyond AU-8's listen question), and the level check (its own `leaks` rule, `run.ts:143`).

### 3.2 The Sound-off and asked text in a Check (row DC-1a; OD-DC2, provisional)

- In a Check, when a heard round cannot be heard — the learner asked (Show the letters), Sound is off, there is no Korean voice and no clip, or the play failed or was blocked — the text that stands in for the sound is the **romanization only** while the question is open, never the Hangul. This extends CH-1e's asked-text rule to the Hangul Check, the Stage Check and the Cell Check whatever the mode, and to the Sound-off paths of all four Checks (CH §4 handed the Sound-off text to this work order).
- The round is then a reading item: read the sound, find its spelling among Hangul options that show none. Printing the prompt's Hangul above Hangul options would make it shape matching.
- `askedTextIsRomanizationOnly(mode, romanizationMode, textPrompt)` loses its `romanizationMode` argument and is true for every Check host with a sound prompt; the Sound-off paths use the same predicate. In the quest Check a right answer after the learner's own ask is still marked hinted (CH-1f); in the Hangul Check nothing records it (its host drops `meta.hinted`) and it counts as right, as today. A Sound-off answer is never marked.
- Once the round resolves, the Korean shows with its romanization, as today.

### 3.3 Where the hold lands (rows DC-1a to DC-1c)

| Surface | What is held while the question is open | Row |
|---|---|---|
| Listen & Pick, quest Check, heard rounds | options (AU-8, unchanged) | — |
| Listen & Pick, quest Check, text-prompt rounds (Read Pick Meaning; the Cloze Pick fallback) | the prompt's romanization (`ListenPickGame.tsx:208`; `cloze-pick-fallback.tsx:34-50`) and any text options. `ListenPickTextPrompt.prompt(round, focusRef)` (`ListenPickGame.tsx:115-122`) gains a `held` argument, since it receives no state today. The fallback's sentence meaning is the stimulus and stays | DC-1a |
| Listen & Pick, Hangul Check (`review` host), every round | options and any text prompt; the attempt switch is removed (OD-DC1) | DC-1a |
| `ReviewRounds` pick rounds, Stage Check and Cell Check, every rung | `spelling` (heard): options; `meaning`: the prompt (`ReviewRounds.tsx:241`); `reply`: the line and the reply options; `sound`: unchanged | DC-1b |
| `ReviewRounds` type and cloze rounds, Stage Check and Cell Check | Type Hangul `see`: the shown word (`:401`, and the Show-the-letters variant `:398`); the keyboard's sound line; Cloze Pick: the gapped sentence's romanization (`:593`) and its tiles' (`:606`). Sentence Builder tiles draw Hangul only (nothing to hold) and its line (`:489`) holds its romanization; Dictation shows no Korean before the answer (its keyboard line is held); Syllable Build already holds the block's romanization until built (CM-32) | DC-1b |
| Daily Review and Keep going (`DailyReviewScreen.tsx`), read and produce rungs | as the two rows above for rounds whose `question.rung` is `read` or `produce`, except the keyboard's sound line (OD-DC12) | DC-1b |
| Stage Check switch | removed (OD-DC1) | DC-1b |
| Quest Checks on other games (Stages 2-7; check steps in content today: Cloze Pick 40, Type Hangul 30, Order It 27, Listen & Pick 30, Tap Respond 11, Realia Read 11, Pic-Word Match 9, Write Frame 10) | the question's Korean (prompt, card, line) and every Korean option or tile, with option glosses (Tap Respond's reply glosses, ~`TapRespondGame.tsx:233`); Type Hangul in a Check: the keyboard's sound line and the picture mode's romanization cue (`:219-221`; the picture and its meaning stay: the task becomes spelling from meaning, OD-DC4) | DC-1c |
| Write Frame and My Story Check steps | unchanged: open writing with no single right answer; the frame is scaffolding (OD-DC4). Story Order and Role Play have no Check step today; a future one follows §3.1 | — |

- Tap Respond is mounted without `host` (`MinigameScreen.tsx:274-275`) and records through the run store itself; it gains a `hold` boolean, not a host, so nothing records twice.
- No `Tile` change: the design-system `Tile` is not used by a Check game. Each game draws its own held line with `KoreanText`'s or `ChoiceCard`'s `romanizationReserved`, or with the same contract (room kept, nothing drawn, hidden from assistive tech) where it draws its own text (`ClozePickGame.tsx:482-484`, Sentence Builder's tray tiles). `HangulKeyboard` gains a held sound line (`soundHeld`, same contract; the key's accessible name unchanged).

### 3.4 The Hangul Check, version 2: items (rows DC-2a to DC-2d; owner decision 2026-11-22, OD-R1, review-2026-11 README §4 and WO-10 §2-§3)

**Composition (35 items, the length does not grow).**

| Kind | Count | Ask | Options | Id | Round kind (§3.9) |
|---|---|---|---|---|---|
| Decode, open (CV) | 6 (new) | **see** a syllable (Hangul only), pick its **sound** | 4 recorded sounds (§3.4 distractors) | `decode:<syllable>` | reading |
| Decode, closed (CVC) | 6 (new) | see a syllable with a final, pick its sound | 4 recorded sounds | `decode:<syllable>` | reading |
| Name | 12 (was 24) | hear the letter's name (니은), pick the written letter (today's `lp:sym:` round) | target + 3 confusables (unchanged) | `jamo:<id>` | reading (letter) |
| Final | 6 (unchanged) | hear 아 + final (악 안 알 암 압 앙), pick the written syllable | unchanged | `jamo:<id>-batchim` | reading (letter) |
| Word | 5 (unchanged count) | DC-2d: hear the word, pick its picture (today); **DC-3: see the word (Hangul only), pick its picture** | 4 of the 5 theme pictures | `word:<romanization>` | listening (DC-2d), then known word (DC-3) |

**Parts.** Five parts of seven, a Hoya pause between parts (unchanged). Each part runs **decode items first** (so no name or final answer in the part has shown a letter's romanization just before), then names, then finals, then its word: part 1 = 2 decode, 3 names, 1 final, 1 word; part 2 = 2, 3, 1, 1; part 3 = 3, 2, 1, 1; part 4 = 3, 2, 1, 1; part 5 = 2, 2, 2, 1. Open and closed decode items alternate across the check, starting open. **The words' order across the parts is shuffled per attempt** (today part 1 is always 한글, part 5 always 연, `hangul-check.ts:107-113`).

**The decode item pool** (`apps/mobile/src/logic/stage1/decode-items.json`, authored language content: content-skill rules, the multi-agent review, registered in `packages/content-schema/src/__tests__/helpers/romanization-registry.ts` and `apps/mobile/src/content/__tests__/romanization.test.ts`):

- **Targets** are one block made only of Stage 1 symbols: an initial of the 14 basic consonants, one of the 10 basic vowels, and for a closed target a final of ㄱ ㄴ ㄹ ㅁ ㅂ ㅇ. At least 30 open and 30 closed targets once DC-2c lands (DC-2b may start with what today's clips allow; §1.2). ㅏ appears in closed targets only (every consonant + ㅏ is a carrier). Every consonant is the initial of at least two targets and every vowel the vowel of at least two, counted after DC-2c.
- **Not practised** (WO-10 §3: decoding, not a remembered word, at the block level): no target is a block that a Stage 1 quest shows as a reading word, a Discover example, a game's prompt or target, or a Check's right answer (computed from `content/quests.ts`, `logic/minigame-config.ts`, `content/jamo.ts` and the Discover data, not a hand list); no carrier syllable (the letters' voices, `jamoVoice`); no block of the five Hangul Check words (한 글 밥 복 산 연); no Decoding Sprint probe block. A block that appeared in a quest only as a wrong option may be a target (WO-10 says "우선": prefer). No option of any item is a probe block either, so the Hangul Check never shows one. Targets outside the sprint's drill pool (`logic/syllable-build/decode-pool.json`) are preferred; DC-2b reports the overlap.
- **Phonology exclusions** (blocks that sound like another): no ㅈ or ㅊ with ㅑ ㅕ ㅛ ㅠ (져 sounds as 저, 쳐 as 처, 쥬 close to 주), as target or option.
- **Clips**: every option has a clip row of kind `syllable` whose `say` is the block with a full stop (not the rows that end in "!"), in **one pack** (DC-2b assigns the pool's rows to the `review` pack if the Hangul Check can open it, else a new `hangul-check` pack in `audio-packs`), which the Hangul Check loads (`useClipPacks`, row DC-2d). The pool test reads the manifest rows and their pack, not the runtime `hasClipFor`.

**Distractors: a balanced set** (OD-DC5, OD-DC6, provisional). The four options of an item are built so that **no option stands out by its pattern**: each option shares the same number of letters with the others, so a responder who compares the sounds (or the Latin chips) without reading the Hangul cannot find the target as the "middle" one.

- **Open target CV**: the 2 × 2 set {CV, C'V, CV', C'V'} (e.g. 그 드 거 더). A learner who reads only the initial or only the vowel is right half the time; chance is 1/4.
- **Closed target CVF**: the set {CVF, C'V'F, C'VF', CV'F'}, where every pair of options differs in exactly two positions (in letters: for 곰, a set shaped like 곰, 둠, 독, 국; DC-2b authors the real items from clip-backed blocks). F' is another final, never "no final" (an open option among closed ones would mark the closed target by shape). Reading only one letter gives 1/2; chance is 1/4.
- **Contrasts told apart by ear** (WO-10 §2, "소리로 확실히 구별되는 것만"):
  - **Initial C-C'**: any two Stage 1 consonants except the plain/aspirated pairs ㄱ-ㅋ, ㄷ-ㅌ, ㅂ-ㅍ, ㅈ-ㅊ (WO-16 owns those), ㅇ-ㅎ (a weak [h] in a lone clip), and ㅅ against ㅈ or ㅊ before ㅣ or a y-vowel (ㅅ is [ɕ] there). The pairs ㄴ-ㄷ and ㅁ-ㅂ (a word-initial nasal can lose its nasal sound in a clip) are used only once the owner's listening pass of DC-2c clears them for those clips.
  - **Vowel V-V'**: any two basic vowels except ㅓ-ㅗ, ㅡ-ㅜ and ㅕ-ㅛ.
  - **Final F-F'**: finals of two sound classes only (stops ㄱ ㅂ, nasals ㄴ ㅁ ㅇ, the liquid ㄹ); never two of one class (ㄴ-ㅇ, ㄱ-ㅂ), which the final items test with their own table.
  - No two options of an item sound the same (no shared clip, no shared pronunciation in the manifest).
- Each item lists its options explicitly; the builder never invents a block.

**Per attempt** (`buildHangulCheck({ seed, askedBefore })`, pure and deterministic by its inputs):

1. Draw 6 open and 6 closed decode targets, seeded, with **12 different initial consonants**, preferring targets not in `askedBefore` (the `decode:` ids of this profile's earlier version 2 entries generated before this run started; the least recently asked first once every target has been asked). A resumed run passes the same `askedBefore` (the entries before its `startedAt`), so the rebuilt check has the same item ids.
2. Draw the 12 name items: first every basic letter that no drawn decode target holds, then seeded letters to reach 12. So **each attempt asks every one of the 24 letters**, named or read.
3. Finals as today; the five words in a seeded order. Option order shuffled per attempt (the existing ~40 % rule on index 0 applies to every kind).

**Length.** WO-10: the check stays within about four minutes. Decode items take longest (up to four clip plays and a commit). The on-device timed run of §6 is a gate for DC-2d: if a median run is over four minutes, the fallback is 10 decode items and 14 names (the decode rule of §3.6 becomes 9 of 10), recorded here before the row merges.

### 3.5 The decode round (rows DC-2a, DC-2d)

```
B2. A decode item (Hangul Check, review host)
+-----------------------------------------+
| [x]  o o . . . . .                      |  <- the part's dots, continuing across the part
|   Read it. Which sound is it?           |
|                 그                       |  <- the syllable, Hangul only (held, §3.1)
|   [ (speaker) Sound 1 ]                 |  <- a tap plays the clip and selects the card
|   [ (speaker) Sound 2 ]  <- selected    |
|   [ (speaker) Sound 3 ]                 |
|   [ (speaker) Sound 4 ]                 |
|   [[ THIS ONE ]]                        |  <- shown once a card is selected; commits it
|   Can't hear it?                        |  <- CH link: Show the letters turns the cards into
|                                         |     their romanization (Latin sound chips)
+-----------------------------------------+
```

- **Interaction (OD-DC10, provisional; the DC-2a mock settles it).** A tap on a sound card plays its clip and selects it (outline); tapping another card plays and selects that one; **This one** commits the selected card. Playing is never scored; only the commit is an answer. The first commit is the scored first try (F-001 §3.2); a wrong commit is amber with the replay mark (F-A11Y-001), the round stays open until the right card is committed. No hint ring, no gloss, no feedback text (the review host's rules, F-QUEST-002 §3.10). A decode syllable is a sound unit with no meaning, so it has no gloss (the CLAUDE.md §1 exception line says so, row DC-1a).
- **After the right commit**: the syllable shows its romanization, the right card plays once more, and the round moves on after `motion.duration.slow`.
- **No sound** (Sound off, the pack not loaded or offline, a failed or blocked play) or **Show the letters**: each card shows its option's romanization as a Latin sound chip (the level check's `see-pick-sound` look, `design/wireframes/placement/item.md:42-44`); the syllable stays Hangul only. The item is still a reading item (Hangul to sound value), and the balanced set keeps the chips from pointing at the target.
- **Screen readers**: the syllable's name is its romanization read as a sound value (unchanged rule, §3.1); each card is "Sound 1 of 4" with its selected state and plays on activation; This one is "Pick sound 2".
- **Strings** (en, es and ko in DC-2d, §3.8): `learner.stageReview.decode.heading: 'Read it. Which sound is it?'`, `learner.stageReview.decode.sound: (n) => \`Sound ${n}\``, `learner.stageReview.decode.pick.cta: 'This one'`; `a11y.minigame.soundOption(n, total)`, `a11y.minigame.pickSound(n)`. Pre-A1, no age wording.
- **Never**: a timer, a red mark, a count on screen.

### 3.6 The caregiver verdict, version 2 (row DC-2d; owner decision 2026-11-22, OD-R1, WO-10 §4-§5)

- **Version of an entry (OD-DC8, provisional).** A Hangul Check entry is version 2 when any of its `itemIds` starts with `decode:`; otherwise version 1. No new entry field (it would be stripped, §1.2). `HANGUL_CHECK_VERSION = 2` names it in code.
- **Version of the verdict.** `ProgressSummarySchema.stage1Anchor` gains an optional `version: 1 | 2` (additive; the Worker's `STAGE1_ANCHOR_KEYS` keeps it, `roster-summary.ts:162`; Worker first, F-QUEST-002 §3.9 rollout rule). Nothing reads `stage1Anchor` today, so a surface that draws it later can tell a reading verdict (2) from a letter-name verdict (1 or absent).
- **Which entry is read.** `stage1AnchorOf` reads the entries that carry `missedItemIds` (unchanged) and takes the **highest version present, then the newest** (WO-10 §5: "리포트는 최신 버전 결과를 쓴다"). Version 1 entries stay and are read with the version 1 rule only when no version 2 entry exists.
- **`met`, version 1** (unchanged): 27 or more of the 30 symbol items and 4 or more of the 5 words right first try.
- **`met`, version 2**: **11 or more of the 12 decode items** (WO-10 §4) **and 16 or more of the 18 name and final items** (the letter rule kept, as a miss allowance near the old one: 3 in 30 then, 2 in 18 now; OD-DC7). **The words are not in it** (OD-DC7): they are five taught words with pictures, answerable by elimination and word length (the review simulated 73 % right for a non-reader using both), so they are known-word recognition, not reading evidence.
- **How often a reader meets it** (binomial, every item at the same rate, both parts): 95 % right per item → met about 83 % of the time; 90 % → about 48 %; 85 % → about 21 %. A verdict of "not met" is therefore "not shown yet", never "cannot read": the wording below says so.
- **`tricky`**: the symbol keys of the missed name and final items (unchanged meaning). A missed decode item adds no key (OD-DC9).
- **Non-gating stays** (WO-10 §4): no learner screen says pass, fail, met or a count. The learner sees stars over the 35 items (F-RVW-001 §3.1, unchanged), Hoya, the certificate and the cards. Hoya's tip comes from the missed name and final items as today; **"Every letter!" shows only when no name, final or decode item was missed** (with a decode item missed and no letter missed, the tip row is left out) (OD-DC9).
- **Caregiver wording.** No shipped surface prints `stage1Anchor` (§1.2), so no row adds a caregiver string. The JSDoc of `ProgressSummarySchema.stage1Anchor` and of `stage1AnchorOf` says per version what `met` means, and the surface that first draws it (F-PAR-001 or F-REPORT-001) words a version 2 `met` as "Picks the right sound for new syllables", a version 2 not-met as "Not shown yet", and never draws a version 1 verdict as a reading verdict.
- **Why the verdict moves with DC-2d, not DC-3** (departure D1, §10): an entry of version 2 items read with the version 1 rule counts at most 18 symbols, so it would always be "not met". The rule ships with the items.

### 3.7 Words become read, and Stage 1 completion (row DC-3)

- The five word items show the word in Hangul (held romanization) and ask for its picture among four of the five theme pictures: Listen & Pick's text-prompt look (Read Pick Meaning) in the review host, the word said once after the right pick. The word is the last segment of its part (§3.4), so `isReadPickScope` over that one-round segment already picks the text-prompt mode; no per-round mode is needed. Ids unchanged; not part of `met` (§3.6).
- F-QUEST-002 §3.8 (completion at any star count) is unchanged: completing Stage 1 never needs a star count or the Hangul Check. Its amendment line records that the Hangul Check's decode items, not completion, are the reading evidence, and that a caregiver surface never presents completion as "can read".

### 3.8 Strings, stored runs and telemetry

- **All three UI locales are shipped** (`packages/i18n/src/locales.ts:31-35`), so a missing key fails the es and ko coverage tests and a changed English file fails the ledger test. Every row that adds, changes or deletes a string ships en, es and ko together, runs the multi-agent review of the changed keys, and re-signs `messages/review-ledger.json` (CLAUDE.md §1: values come from the review, not ad hoc).
- **Deleted** (DC-1b, the last user): `learner.stageReview.intro.hideRomanization` in en, es and ko, and `AttemptSwitch` (`StageReviewScreen.tsx:513-557`) when nothing else uses it.
- **Changed** (DC-2d): `learner.stageReview.intro.body` → "About four minutes. Read and listen. No timer."; `learner.stageReview.pause.first` → "Nice work! Ready for more?"; the `learner.stageReview` JSDoc.
- **New** (DC-2d): §3.5.
- **Stored runs.** The stored shapes keep `hideRomanization` and `v: 1`: the rows write the constant `true` (every Check holds) and the readers ignore its value (`saved-check.ts:167`, `saved-stage-check.ts:178` still require a boolean, so a run stored before DC-1a or after it resumes). `review-flow.ts` drops the toggle (state `:32`, events `:42`, `:52`, `:69`, `:77-78`, `:83`); `store/check-run-saved.ts:85-89` and `logic/reviews/stage-check-api.ts:111-113, 251-252` pass the constant. A Hangul Check stored before DC-2d is dropped after it (its item ids differ, §1.2).
- **Telemetry** (`docs/roadmap/TELEMETRY-NAMES-2.md:22`; the Worker keeps the payload as sent and reads `stars` only, `learning-rollups.ts:247-252`): `review.start` drops `hideRomanization` (DC-1a for the Hangul Check, DC-1b for the Stage Check, `stage-check.ts:145`); `review.complete` for the Hangul Check gains `decodeCorrect` and `checkVersion` (DC-2d), and `symbolsCorrect` then counts the 18 name and final items. Internal analytics only.

### 3.9 The romanization-only bot (acceptance of WO-10)

A test responder that **understands spoken Korean and reads only Latin letters** (the strongest non-reader: a heritage learner who knows English letters):

- It knows the romanization of any sound it hears (a heard prompt, a played option clip) and of any Latin text that is **drawn visibly**; it reads every visible UI-language string (glosses, labels). It cannot read Hangul. It knows every taught item's meaning, picture and reply by its romanization (a lexicon oracle from the content).
- **Strategies, in order**: (1) match: the option whose known romanization, meaning, picture or reply matches the stimulus; (2) pattern: the option closest to all the others by their known romanizations (the "middle" option); (3) elimination: rule out answers already given in the same check (pictures, words); (4) length: options whose block count fits the stimulus; then a seeded uniform guess among what is left.
- It reads what a view draws, in two ways: the pure view models (`optionView`, `promptView`, the text-prompt view and the new `roundLook` and `decodeRoundView`, §6), and, in the screen tests, the rendered tree (every visible text node; reserved lines and accessible names excluded).

**Round kinds.** Each round is labelled `reading` (the decode items, name and final items, heard spelling rounds, read meaning and reply rounds, text-prompt rounds), `listening` (a heard word, picture options), `known-word` (the Hangul Check's read words, DC-3) or `production` (type, order, build, dictation).

**Acceptance**, per surface, over 200 seeds:

- **Exact check, every `reading` round**: before the answer, strategies (1) and (2) rule out no option; strategy (4) rules out none in a decode item (all its options are one block).
- **Pooled, per round kind**: on `reading` rounds the bot's first-try accuracy is at most chance + 0.03 (chance = 1/options of each round). On `production` rounds the exact check is that no visible Latin or UI-language text names the answer's letters before the answer (the keyboard's sound line is held in a Check).
- **Hangul Check version 2**: `met` is false for every seed. `listening` and `known-word` rounds are reported, not held to chance (no hold can make a heard word unreadable; elimination stays possible over five words; that is why the words are not in `met`).
- **Control**: the same bot with the hold off (`holdsRomanization` stubbed false) answers at least 0.9 of the `reading` rounds whose stimulus and answer share a romanization or meaning, so the test proves the hold, not a weak bot.
- **Surfaces**: every Stage 1 quest Check round (DC-1a); the version 1 Hangul Check's name and final rounds (DC-1a); a Stage Check, a Cell Check and a Daily Review fixture (read and produce rounds) (DC-1b); one quest Check per game of §3.3 (DC-1c); the version 2 Hangul Check (DC-2d); its read words reported (DC-3).

---

## 4. Out of scope

- **Romanization modes**, a stage-based fade, the `auto` mode and its resolution: AMENDMENTS-ROMANIZATION-FADE (WO-11). This spec owns Check surfaces only.
- **Practice surfaces**, Build a Letter included (its target and tile romanization let a learner build by Latin letters, `BuildLetterGame.tsx:252, 415, 422`): a practice game, never a Check step; handed to WO-11 (D2).
- **Screen-reader answers as reading evidence.** The accessible names keep the romanization (WO-10 §1), so a Check answered with a screen reader is a listening item. The summary cannot tell those answers apart, as it cannot tell an asked answer apart (F-AUDIO-004 §8 item 9).
- Heard word → picture rounds in Stage 1 quest Checks (e.g. `minigame-config.ts:510, 539, 577, 615`): listening rounds by design (F-QUEST-002 §3.3); turning them into read rounds is content work for WO-12, not this amendment.
- The plain/aspirated/tense contrasts (WO-16), the 7 representative finals (WO-15), the level check, the Decoding Sprint and G9 (only the probe exclusion of §3.4 touches it).
- A caregiver screen that draws `stage1Anchor` (F-PAR-001, F-REPORT-001).
- Showing the learner a score, a pass or a fail; making the Hangul Check gate anything; a timer.

## 5. UI sketch

- `design/wireframes/reviews/hangul-check.md` (updated in this row, DC-0): the intro without the switch, the version 2 parts, the decode round (B2), the read word round (B3), the no-sound look of B2, the data needs and the verdict.
- `design/wireframes/reviews/stage-check.md`: the switch line removed (row DC-1b).
- `design/screens/hangul-check/` (new, row DC-2a): the mock of B2 (four sound cards, the selected state, This one, the Latin-chip fallback, 320 x 568 and a wide window, 200 % text), approved by the multi-agent review (CLAUDE.md §5, 2026-10-12 owner decision).

## 6. Tests

- **`logic/locale/__tests__/check-hold.test.ts`** (DC-1a): surface × rung → hold; `practice` never and the default; `daily-review` only at read and produce.
- **`listen-pick-flow` tests** (DC-1a): in the `check` and `review` hosts every option and a text prompt hold while `asking` and show per mode once resolved; accessible names equal today's; `askedTextIsRomanizationOnly` true in every Check host with sound; the Sound-off path of a Check gives romanization only. A pure text-prompt view (`textPromptView(round, state, held)`) for the bot.
- **Screen tests** (DC-1a to DC-1c): `StageReviewScreen`, `StageCheckScreen`, `CellCheckScreen` (every mode), `DailyReviewScreen` (a read and a produce round held, a recognize round unchanged), `WeekDropScreen` unchanged, and each Check game of §3.3 in check and practice modes: the held line is invisible and outside the accessibility tree before the answer and visible after; option glosses and the keyboard's sound line likewise; no switch on either intro; `review.start` without `hideRomanization`. `romanization-hook-scan` still passes. The rendered-tree bot scan of §3.9 runs in these tests.
- **Pure view models** (DC-1b, DC-1c): `ReviewRounds`' inline hold logic (`:155-158`, `:254`) moves to `logic/reviews/round-look.ts` (`roundLook(round, { solved, hold })`), shared by the view and the bot; Tap Respond and Type Hangul get the same kind of look function for their held lines (`TypeHangulGame` computes `romanizationVisible` inline today).
- **`HangulKeyboard`** (DC-1b): `soundHeld` keeps the line's room, draws nothing, keeps the key's name; default unchanged (design-system coverage 85 %).
- **Stored runs** (DC-1a, DC-1b): `review-flow.test.ts`, `saved-check.test.ts`, `check-run-saved.test.ts`, `stage-check-api.test.ts`, `stage-check.test.ts`, `hangul-check-resume.test.tsx`, `stage-check-resume.test.tsx`: a run stored with `hideRomanization: false` still resumes; new runs store `true`.
- **Decode pool** (`logic/stage1/__tests__/decode-items.test.ts`, DC-2b): blocks of Stage 1 symbols only; no target practised (computed from the content), carrier, Hangul Check word block or probe block; no option a probe block; the phonology exclusions; every item a balanced set (§3.4: every pair of options of a closed item differs in two positions; an open item is a 2 × 2 set) with every contrast on the allowlist; no two options share a clip or a pronunciation; every option's manifest row is `syllable`, `say` ends in ".", in the chosen pack; coverage of consonants and vowels; registered for the romanization lint.
- **`buildHangulCheck`** (DC-2d): 35 items, 12 + 12 + 6 + 5; the part order (decode first); 12 different initials; every one of the 24 letters named or read in each of 200 seeds; deterministic by seed and `askedBefore`; targets not in `askedBefore` first; words in a seeded order; the index-0 rule.
- **`stage1AnchorOf`** (DC-2d): version by `decode:` ids; highest version then newest; version 1 rule unchanged on version 1 entries; version 2 boundaries (11/12 decode, 16/18 symbols; words ignored), `tricky` from names and finals; `version` in the summary; the Worker keeps it (`roster-summary` test).
- **Part player and resume** (DC-2d): one set of dots across a part's segments; a segment after a decode segment autoplays its first round (the This one tap is the gesture); a stored version 2 run resumes inside a decode segment (`resumePointOf`); `review-run-store` tallies decode items.
- **The bot** (`apps/mobile/src/logic/__tests__/romanization-bot.test.ts`): §3.9, surfaces added row by row.
- **e2e** (Playwright): `apps/mobile/e2e/web/hangul-check.spec.ts`, `cant-hear-checks.spec.ts` and `cant-hear-stage-check.spec.ts` stop clicking the switch (DC-1a, DC-1b); `hangul-check.spec.ts` answers decode items (DC-2d) and read words (DC-3); no romanization text is visible before any answer.
- **[On device, owner]** (a gate for DC-2d): one Hangul Check run on a phone, timed (§3.4 length rule); VoiceOver and TalkBack on B2; the owner's listening pass of the decode clips (DC-2c).

## 7. Rollout

- DC-1a to DC-1c may ship in any order after DC-0; DC-2d needs DC-1a, DC-2a, DC-2b and DC-2c; DC-3 needs DC-2d; DC-4 closes.
- The summary's `version` is additive: the backend build that keeps it deploys before the app that sends it (DC-2d, Worker first). No migration.
- An older build that reads a version 2 entry counts its decode items as words and at most 18 symbols, so it computes `met` false (with no `version`). Older builds reload on a stale bundle on the web (F-CURR-002 §10); a native build that is behind can write that until it updates. Accepted (OD-DC8).
- A stored Hangul Check from before DC-2d is dropped on the first open after it; the learner starts a new one.

## 8. Dependencies

- **AU-8** (`AMENDMENTS-AUDIT-2026-11.md`): the held line this widens. **CH-1e, CH-1f, CH-2** (`AMENDMENTS-AUDIO-CANT-HEAR.md`): the asked text, the hinted mark, Always show the letters outside Checks.
- **AMENDMENTS-QUEST-LEAVE-RESUME** (LR-3a, LR-3b): the stored checks and resume.
- **AMENDMENTS-ROMANIZATION-FADE** (WO-11, written in parallel): the modes the held line follows after the answer.
- **AMENDMENTS-AUDIO-CLIPS**: the clip pipeline (manifest, the owner's generate step, QA, packs).
- **F-CURR-002** CM-32 (probe blocks), §4.3 (rungs). **F-A11Y-001**: the answer marks of the decode round.
- **F-I18N-001**: the shipped-locale coverage and the ledger.

---

## 9. Rows

One commit = test + implementation (TDD). Branches as README §5.1. Every row that touches strings ships en, es and ko with the multi-agent review and the ledger re-signed (§3.8).

| Row | Model | What | Files | Tests | Done when | Needs |
|---|---|---|---|---|---|---|
| DC-0 | Opus 5.5 | This spec; `design/wireframes/reviews/hangul-check.md`; "Amended" lines in F-QUEST-002 and F-RVW-001; the index line | docs only | — | multi-agent review adjudicated (§11), status `ready` | — |
| DC-1a | Sonnet 5.5 | **Built 2026-11-25 on `feat/check-hold`** (`logic/locale/check-hold.ts` with `holdsRomanization(surface, rung)` and `hostSurface(mode)`; `checkHoldsRomanization(mode)` is a call of it and holds in the quest Check and the Hangul Check, a text prompt round included; `askedTextIsRomanizationOnly(mode, textPrompt)` is true for every Check host with a sound prompt and `ListenPickGame` passes it for the Sound-off, no-voice, failed-play and blocked-play text as well as Show the letters (a Sound-off answer is never marked hinted); `textPromptView(round, state, hold)` and `ListenPickTextPrompt.prompt(round, focusRef, held)` hold the Read Pick Meaning prompt's romanization (only in the room the mode would show it) and the Cloze Pick fallback's sentence line, the sentence's meaning stays; the Hangul Check has no switch and no `RomanizationModeOverride`, its options follow the learner's own mode after the answer; `review-flow` dropped the toggle, `hideRomanization` in the state, the events and the `started` effect, `startReviewFlow({ chunks, reading })`; `reviewStartEvent(profileId)` sends no `hideRomanization`; `keepReviewRunSaved` stores the constant `STORED_HIDE_ROMANIZATION = true` and a run stored with `false` or `true` still resumes; no UI string changed, so no ledger change (`learner.stageReview.intro.hideRomanization` stays for the Stage Check until DC-1b); the bot (`logic/__tests__/romanization-bot.test.ts`) passes its exact check and pooled limit on the Stage 1 quest Checks and the version 1 Hangul Check's name and final rounds, and its control passes; two findings the bot measured and this row does not hold: the Stage 1 word rounds' options differ in block count from the heard word, so strategy (4) beats chance there (content, WO-12), and elimination of answers already given beats chance on the version 1 Hangul Check's letter rounds (the spec limits elimination to pictures and words; version 2 changes these items); `CLAUDE.md` §1's line goes in a separate PR after the owner confirms) The hold rule (§3.1); Listen & Pick in the `check` and `review` hosts, text prompts and the Cloze Pick fallback included; the Check Sound-off and asked text (§3.2); the Hangul Check's switch and override removed; stored `hideRomanization` constant; `review.start` for the Hangul Check; CLAUDE.md §1's exception line widened to: "In a Check, and at the read and produce rungs of the Daily Review, the romanization and the option glosses of the question's taught Korean show only once it is answered (the accessible label keeps them; a decode syllable is a sound with no gloss; owner decision 2026-11-22, OD-R1; AMENDMENTS-STAGE1-DECODING-CHECK)"; the F-CNT-002 "Amended" line | `logic/locale/check-hold.ts` (new), `logic/listen-pick-flow.ts`, `screens/minigames/{ListenPickGame,cloze-pick-fallback}.tsx`, `screens/reviews/StageReviewScreen.tsx`, `logic/stage1/review-flow.ts`, `store/check-run-saved.ts`, `i18n/use-romanization-mode.tsx` (comment), `CLAUDE.md`, `docs/specs/F-CNT-002-romanization-policy.md`, `docs/roadmap/TELEMETRY-NAMES-2.md`, the two e2e specs | §6 check-hold, listen-pick-flow, screen and stored-run tests; bot on the Stage 1 quest Checks and the version 1 Hangul Check's name and final rounds | bot exact check and pooled limit pass; control passes | DC-0 |
| DC-1b | Sonnet 5.5 | **Built 2026-11-25 on `feat/review-rounds-hold`** (`RoundProps.holdSurface` (default `practice`) replaces `hidesRomanization`; `logic/reviews/round-look.ts` with `roundLook(round, { surface, solved })`, `roundHolds` and `keyboardSoundHeld` is the one pure look the rounds and the bot read; the Stage Check passes `stage-check`, the Cell Check `cell-check` (every mode), the Daily Review and Keep going `daily-review` (held at the read and produce rungs by `holdsRomanization`), This week in Korea `practice` explicitly; pick rounds hold a heard round's options, a meaning round's prompt, a reply round's line and options (a sound round is unchanged), the text that stands in for a sound (Show the letters, Sound off, no voice) is the romanization only in a Check, Type Hangul `see` holds the shown word, Cloze Pick its gapped sentence and tiles, Sentence Builder its line; a typed round counts a right answer or a one-letter slip as solved; `HangulKeyboard` gained `soundHeld` (the line keeps its room, draws nothing, off the accessibility tree, the key's name kept) and the review rounds pass it in a Check and not in the Daily Review (OD-DC12); the Stage Check lost its switch, its `RomanizationModeOverride` and `AttemptSwitch`; `review.start` for the Stage Check sends no `hideRomanization`; the stored Stage Check writes the constant `STORED_HIDE_ROMANIZATION = true` (moved to `saved-check.ts`) and a run stored with either value still resumes; `learner.stageReview.intro.hideRomanization` is deleted in en, es and ko and the learner `enSha` of es and ko is re-signed with no new text to review (a deletion adds no string, so no MAR ran; the ledger date is unchanged); the bot passes its exact check and pooled limit on the Stage Check, Cell Check and Daily Review (read rung) fixtures and its control passes; Syllable Build and Match Shape keep their chunk's own hold; the Dictation hear round does not offer "Show how it sounds" while a Check (or the Daily Review at its produce rung) holds it, since a held line cannot be revealed by a tap (section 3.1; section 3.3's "Dictation shows no Korean before the answer" extended to its romanization hint): `HearPrompt` takes `holdRomanization`, practice and Type Hangul keep the hint) `ReviewRounds` hold (pick, type, cloze, order line) with an explicit `holdSurface` prop (default `practice`); Stage Check and Cell Check (every mode) every rung; Daily Review and Keep going read and produce; the keyboard's held sound line in Checks; Stage Check switch removed; the deleted strings and `AttemptSwitch`; `review.start` for the Stage Check; `stage-check.md` wireframe line | `screens/reviews/{ReviewRounds,DailyReviewScreen}.tsx`, `logic/reviews/round-look.ts` (new), `screens/stage-check/StageCheckScreen.tsx`, `screens/cell-check/CellCheckScreen.tsx`, `screens/week-drop/WeekDropScreen.tsx`, `quest-review-chunk.tsx`, `logic/reviews/{stage-check,stage-check-api,saved-stage-check}.ts`, `packages/design-system/src/components/HangulKeyboard/*`, `packages/i18n/src/messages/{en,es,ko}/learner.ts` + ledger, `design/wireframes/reviews/stage-check.md`, `cant-hear-stage-check.spec.ts` | §6 screen, keyboard and stored-run tests; recognize rung unchanged; bot on Stage Check, Cell Check and Daily Review fixtures | bot passes; control passes; no Check uses the override | DC-1a |
| DC-1c | Sonnet 5.5 | Quest Checks on other games (§3.3, OD-DC4): Type Hangul (keyboard line, picture-mode cue), Cloze Pick, Sentence Builder, Pic-Word Match (selection included), Realia Read, Tap Respond (`hold` boolean, reply glosses) | `screens/minigames/{TypeHangulGame,ClozePickGame,SentenceBuilderGame,PicWordMatchGame,RealiaReadGame,TapRespondGame,MinigameScreen}.tsx`, `logic/pic-word-flow.ts`, look functions for Tap Respond and Type Hangul | per-game Check vs practice render test; bot over one Check of each game | held before the answer, shown after, practice unchanged | DC-1a, DC-1b (keyboard) |
| DC-2a | Opus 5.5 | Design pass: the decode round mock (§3.5, OD-DC10) and the version 2 part with continuing dots | `design/screens/hangul-check/` (new: README, mock, shots) | multi-agent design review | mock approved; OD-DC10 confirmed | DC-0 |
| DC-2b | Opus 5.5 | The decode item pool (§3.4) from today's clips, its pack assignment, the manifest rows (`--dry-run`) for the blocks DC-2c must generate (the y-vowels and ㅏ closed targets at least), the drill-pool overlap report | `logic/stage1/decode-items.json` (new), `logic/stage1/__tests__/decode-items.test.ts`, `content/audio/tts-manifest.json`, `packages/content-schema/src/__tests__/helpers/romanization-registry.ts`, `apps/mobile/src/content/__tests__/romanization.test.ts` (and `audio-packs` if a new pack) | pool test of §6 | the pool test passes on the items authored; the generate list is ready | DC-0 |
| DC-2c | owner, then Sonnet 5.5 | The owner runs `audio:tts:generate` for the DC-2b list and the listening pass (including the ㄴ-ㄷ and ㅁ-ㅂ initials); an agent runs QA and opens the `content(audio)` PR (AMENDMENTS-AUDIO-CLIPS §7, AC-B5 hand-off); DC-2b's pool grows to 30 + 30 | `apps/mobile/assets/audio/…`, the audio map, lock and licence rows, `decode-items.json` | `audio:check`, QA report, pool test | every pool block has a clip; the pool meets §3.4 | DC-2b |
| DC-2d | Opus 5.5 | Version 2 `buildHangulCheck` (§3.4, `askedBefore`); the decode round (§3.5); the part player (segments: decode, then Listen & Pick names and finals, then the word; one set of dots, a dots offset for Listen & Pick in the review host; autoplay after a segment; the host's `complete` moves to the next segment); the clip pack load; version 2 `met`, `tricky`, "Every letter!" and the version reading (§3.6); the summary's `version` (Worker first); tally and `review.complete` (§3.8); intro, pause and decode strings | `logic/stage1/{hangul-check,decode-round,review-flow}.ts`, `screens/reviews/{StageReviewScreen,DecodeRound}.tsx` (DecodeRound new), `store/review-run-store.ts`, `logic/listen-pick-flow.ts` (`headerView` `:178-188`), `screens/minigames/ListenPickGame.tsx`, `logic/reviews/saved-check.ts`, `logic/sync/summarize.ts`, `packages/content-schema/src/schemas/sync.ts`, `packages/backend/src/lib/roster-summary.ts`, `packages/i18n/src/messages/{en,es,ko}/{learner,a11y}.ts` + ledger, `docs/roadmap/TELEMETRY-NAMES-2.md`, `hangul-check.spec.ts` | builder, decode round, anchor, part player, resume and bot tests of §6; on-device timing gate | the version 2 check plays end to end; bot passes; `met` never for the bot; timed run within the length rule | DC-1a, DC-2a, DC-2b, DC-2c |
| DC-3 | Sonnet 5.5 | Word items read (§3.7) in their own last segment | `logic/stage1/hangul-check.ts`, `screens/reviews/StageReviewScreen.tsx`, `hangul-check.spec.ts` | word round tests; bot reports the known-word rounds; e2e | the five words are read, not heard | DC-2d |
| DC-4 | Sonnet 5.5 | Closing docs: "Amended" lines in F-CURR-002 (§4.3, §4.5, §7.3), AMENDMENTS-AUDIT-2026-11 (AU-8) and AMENDMENTS-AUDIO-CANT-HEAR (§3.12, §4); As built per row; status `shipped` after the on-device checks of §6 | docs only | — | every amended spec carries its line | DC-1a to DC-3 |

Estimates: DC-1a 1d, DC-1b 1.25d, DC-1c 1d, DC-2a 0.5d, DC-2b 0.75d, DC-2c owner time and 0.25d, DC-2d 2d, DC-3 0.25d, DC-4 0.25d. WO-10 estimated 2d to build; the rows are larger because WO-10's DC-1 named three surfaces and the CH and LR work since then added hosts, and because new clips are needed.

## 10. Decisions

**Settled by WO-10 and OD-R1** (owner decision 2026-11-22, OD-R1, review-2026-11 README §4; WO-10 "사양이 정해야 할 것"):

1. **The hold's range** (WO-10 §1): the quest Check, the Hangul Check, the Stage Check, and the Daily Review's read and produce rungs, before the answer; shown after; the data and the screen-reader names unchanged (§3.1). The Cell Check is a Check and is included.
2. **The decode format** (WO-10 §2): see a syllable, pick its sound among recorded clips; only contrasts told apart by ear (§3.4, §3.5).
3. **The composition** (WO-10 §3): 24 name items become 12 names and 12 decode items (6 open, 6 closed); 35 items in all; decode targets are not blocks a quest has practised (§3.4).
4. **`met`** (WO-10 §4): 11 or more of 12 decode items, with the letter rule kept; never shown to the learner (§3.6).
5. **Learners who took version 1** (WO-10 §5): their entries stay; version 2 is marked; the verdict reads the newest entry of the highest version (§3.6).
6. **The Decoding Sprint probe** (WO-10 §6): complementary, neither a duplicate nor a replacement. The Hangul Check measures decoding **accuracy**, untimed, once per attempt, for the caregiver verdict; the probe measures decoding **fluency** (rate) across sprints for G9, opt-in and off today. They share no block: the Hangul Check never shows a probe block, as target or option (§3.4), so the probe keeps its novelty; the sprint is unchanged.

**Departures from WO-10's text** (recorded, not open):

- **D1.** `met` is redefined in DC-2d, not DC-3: the items and the rule must ship together (§3.6).
- **D2.** Build a Letter is not in this amendment: WO-10's evidence lists it, but it is a practice game, never a Check step (§1.1). Its romanization is WO-11's. `AMENDMENTS-ROMANIZATION-FADE.md` (#1128) §3.6 keeps it as prompt-style romanization (the target caption and tile values say which letter to build, not a word to read), so neither amendment changes it; this is intended, because a practice game may lean on romanization. How DC-1's hold and that spec's `check` mode compose is set out in its §3.7.
- **D3.** WO-10 §1 says the screens pass an override to `resolveRomanizationMode`. The work order's own re-check note, and this row's brief, say to widen AU-8's held line instead, with no new override. An override to `tap` would still show a missed option's romanization before the answer and would change what the learner's mode means; the held line does neither (§3.1).
- **D4.** The hold covers option glosses and, in a Check, the keyboard's Latin line, not only romanization: either lets a non-reader answer (review of revision 1, §11). This follows OD-R1's purpose ("Check 계열은 항상 숨김": the Checks measure reading).

**Open decisions** (not covered by WO-10 or the README; each has a provisional value the rows use until the owner answers):

- **OD-DC1 — the attempt switch "Reading practice: hide the romanization until I tap"** (Hangul Check, Stage Check). (a) Remove it: every Check holds, so it would only choose what shows after the answer. (b) Keep it as an after-answer choice. (c) Keep it, on by default. **Recommended and provisional: (a).**
- **OD-DC2 — the text that stands in for a sound in a Check** (Sound off, no voice, a failed or blocked play). (a) Romanization only while open, as the asked text (§3.2). (b) As today: Hangul and romanization (AD13); with options held, a learner matches Hangul shapes without reading. (c) Skip the item. **Recommended and provisional: (a)**, OD-CH6 (c)'s reasoning applied to the same rounds.
- **OD-DC3 — other review surfaces** (the quest warm-up, Try these again, This week in Korea). (a) Unchanged (`practice`): none is a Check or the Daily Review. (b) Hold at the read and produce rungs as the Daily Review. **Recommended and provisional: (a).**
- **OD-DC4 — quest Checks on other games** (Stages 2-7). (a) Every Check game with a right answer (§3.3); Write Frame and My Story unchanged; Type Hangul in a Check holds its picture-mode romanization cue and the keyboard's Latin line, so it becomes spelling from a picture and meaning. (b) Stage 1 Checks only. (c) As (a), but Type Hangul unchanged (production, not reading). **Recommended and provisional: (a).**
- **OD-DC5 — the option set of a decode item.** (a) A balanced set: open 2 × 2 {CV, C'V, CV', C'V'}, closed {CVF, C'V'F, C'VF', CV'F'}, 4 options each. (b) Revision 1's one variant per position (3 and 4 options): the target is the only option one step from every other, so it can be found without reading (review, §11). (c) WO-10's letter: initial or vowel variants only, the final never varied. **Recommended and provisional: (a).**
- **OD-DC6 — the contrast allowlist.** The exclusions of §3.4 (plain/aspirated pairs, ㅇ-ㅎ, ㅅ against ㅈ/ㅊ before ㅣ and y-vowels, ㄴ-ㄷ and ㅁ-ㅂ only after a listening pass; ㅓ-ㅗ, ㅡ-ㅜ, ㅕ-ㅛ; finals of one class; ㅈ/ㅊ + y-vowel blocks). (a) As written. (b) Only WO-10's two named rules. **Recommended and provisional: (a)**, so a miss means the learner did not read the letter, not that two clips sounded alike.
- **OD-DC7 — version 2 `met`.** (a) 11+ of 12 decode and 16+ of 18 name and final items; the words left out. (b) As (a) with the words (4+ of 5) kept. (c) As (a) with 17+ of 18 (90 % taken literally). **Recommended and provisional: (a)**: the words are answerable by elimination and length (§3.6), and each extra condition lowers the rate at which real readers meet the verdict.
- **OD-DC8 — the version marker of an entry.** (a) From the item ids (`decode:`), no entry field; an older build reads a version 2 entry as "not met" until it updates. (b) An optional `version` entry field: stripped by older builds and the server. (c) A new `scope`: older builds ignore the entry, but every reader must know two scopes. **Recommended and provisional: (a)**, with the summary's own `version` (§3.6).
- **OD-DC9 — a missed decode item in the result.** (a) No tip and no `tricky` key from it, and "Every letter!" only when no name, final or decode item was missed. (b) A tip for the letter the first wrong pick differs in (the stored run keeps the first pick; with a balanced set a pick can differ in two letters, so the tip may name two). (c) Revision 1: no effect at all ("Every letter!" could show after decode misses, which is untrue). **Recommended and provisional: (a)**; (b) is a follow-up once data shows it is needed.
- **OD-DC10 — choosing among sounds.** (a) A tap plays and selects; This one commits. (b) A second tap on the same card commits. (c) The sounds play in order, then a tap commits. **Recommended and provisional: (a)**, so no answer is given by accident while listening. The DC-2a mock confirms it.
- **OD-DC11 — how a version 2 part is played.** (a) Segments in one part: a decode segment (new `DecodeRound`), then Listen & Pick for names and finals, then Listen & Pick for the word, with one set of dots. (b) Decode as a new Listen & Pick round kind (sound options in `ListenPickRound`, a `content-schema` change reaching every Listen & Pick host, the presenter and previews). **Recommended and provisional: (a)**: it touches only the Hangul Check.
- **OD-DC12 — the keyboard's Latin line in the Daily Review's produce rung.** (a) Kept: the Daily Review is practice, and the line is how a learner finds keys while learning to type. (b) Held, as in a Check. **Recommended and provisional: (a).** The Daily Review's produce rounds are then held for their question text only, and the bot's exact check there excludes the keyboard.

## 11. Review log

**Revision 1 → 2 (2026-11-25), multi-agent review, two independent lenses on revision 1.** Every finding was checked against the code on `8676b5de5` before it was adopted.

*Pedagogy and decoding validity.*
- Major, adopted: one variant per position marks the target as the "middle" option, findable by ear or on the Latin chips without reading → balanced sets (§3.4, OD-DC5 (a)), the pattern strategy in the bot (§3.9).
- Major, adopted: the keyboard's Latin line (`HangulKeyboard.tsx:92`), Type Hangul's picture-mode romanization cue and visible glosses let a non-reader answer → the hold covers option glosses and, in a Check, the keyboard line and the cue (§3.1, §3.3, D4, OD-DC4, OD-DC12); the bot reads the rendered tree too.
- Major, adopted: the acceptance could not pass while heard word → picture rounds count (the oracle bot answers them) → round kinds; chance applies to `reading` rounds; listening and known-word rounds are reported (§3.9).
- Major, adopted: "chance + 0.05" was undefined per seed or pooled, and blind to small leaks → an exact per-round check plus a pooled limit per round kind (§3.9).
- Major, adopted: the five words are fixed in order and answerable by elimination and length → shuffled order, called known-word recognition, left out of `met` (§3.4, §3.6, OD-DC7).
- Major, adopted: the pool after the exclusion is about 26 open and 63 closed, vowel-skewed; ㅏ open targets are impossible → numbers restated, DC-2c planned, ㅏ in closed targets only, the WO's "prefer" wording for blocks seen only as wrong options (§1.2, §3.4).
- Major, adopted: retakes wear out novelty → `askedBefore`, a 30 + 30 pool (§3.4).
- Minor, adopted: ㅈ/ㅊ + y-vowels and ㅅ before ㅣ, initial nasal clips (OD-DC6); the probe block 기 in the sketch and "Nice listening!" in the wireframe; decode items first in each part; met's false-negative rates and "not shown yet" (§3.6); "Every letter!" after decode misses (OD-DC9 (a) revised); the hold's end and MissLine named; F-CNT-002 amended with DC-1a; the timing gate and fallback (§3.4); caregiver wording "Picks the right sound for new syllables".
- Not adopted: a larger balanced per-theme word pool (the words leave `met` instead; WO-12 owns Stage 1 word content).

*Engineering feasibility.*
- Major, adopted: es and ko are shipped, so "es and ko by R8" fails CI → every string row ships all three with the review and the ledger (§3.8).
- Major, adopted: the clips sit in packs the Hangul Check never loads → one pack for the pool, loaded by the screen; the pool test reads the manifest (§1.2, §3.4, DC-2d).
- Major, adopted: the structural give-away (same finding as pedagogy) → OD-DC5 (a).
- Major, adopted: the bot acceptance and the heard words → round kinds (§3.9).
- Major, adopted: Tap Respond prints English glosses; Type Hangul's picture mode; chance undefined for production rounds → glosses held, OD-DC4, production rounds by exact check (§3.3, §3.9).
- Major, adopted: dropping `hideRomanization` would break resume → the stored field stays (constant `true`), files listed (§3.8).
- Major, adopted: the summary had no version → `stage1Anchor.version`, Worker first (§3.6, §7).
- Major, adopted: the part player needed more files, autoplay after a remount, and DC-3's per-round mode was unnecessary → DC-2d files, autoplay after a segment, DC-3 uses a one-round segment (§3.7, DC-2d, OD-DC11 records the alternative).
- Minor, adopted: e2e and unit tests per row; no `Tile` change (no Check uses it); real Check step counts (Story Order and Role Play have none); Tap Respond gets a `hold` boolean; Pic-Word Match's selected word; an explicit `holdSurface` prop with `practice` default; Cell Check's test-out and Stage Jump hold; `ReviewRounds` shows all lines after the answer (unchanged); the text-prompt signature and the Cloze Pick fallback moved to DC-1a; "hinted" is not recorded by the Hangul Check; clip kind and `say` form; registry files; citation fixes (`:208`, `:262`, `:398`, order tiles).
