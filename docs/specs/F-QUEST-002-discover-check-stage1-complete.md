Status: ready

# F-QUEST-002 — Discover and Check steps, the full Stage 1 (15 quests, 30 symbols), Stage 1 completion and the Hangul Check, plus Listen & Pick and Pic-Word Match

> Start order (review of 2026-10-10): Q-1, Q-2 and Q-5b have no external dependency; Q-3b, Q-4 and Q-5a need `ChoiceCard` (F-STORY-003 PR 3.3) and `KoreanText` (F-I18N-001 PR 4), both startable now; **Q-9 alone is blocked** until F-STORY-006's award engine exists (interface in §3.8). Content PRs Q-6a-Q-8 need the native-speaker review listed under External before they ship to learners.

**Scope**: `packages/content-schema` (step kinds, discover data, two minigame kinds, review/summary additions, telemetry names) · `apps/mobile` (`screens/quest/`, `screens/minigames/`, `screens/results/`, `screens/reviews/`, `logic/`, `content/`, `store/`) · `packages/design-system` (small: `SyllableBlock`, reuse of `ChoiceCard` / `KoreanText`) · `apps/web` (teacher plan-builder catalog mirror only)
**Owner**: solo dev
**Rollout**: Stage 1 content pass, after F-STORY-003 (`ChoiceCard`), F-STORY-006 (card-award engine) and F-AUDIO-004 (prompt audio). PR order in §6.
**Wireframes**: promoted from the single drafted file `wireframes/quest-discover-check.md` into `design/wireframes/quest/discover.md` · `quest/check.md` · `minigame/listen-pick.md` · `minigame/pic-word-match.md` · `results/next-quest-teaser.md` · `results/stage1-complete.md` · `reviews/hangul-check.md`

Parent / siblings: F-001 §3.2 (first-try scoring, revised 2026-10-10, PR #94) and §3.3 (audio fallback) · F-003 (Build a Letter) · F-004 (Trace Stroke) · F-010 (Odd-One-Out, Culture Quiz) · F-011 / F-012 (Stage 2 / 4 taste quests, untouched) · F-MOTION-003 §3.5 (card at 2+ stars) · F-RVW-001 §3.1 / §3.3 / §3.4 (stars-only learner surface, Feedback Review, Stage Review) · F-STORY-003 (`ChoiceCard`, check pattern) · F-STORY-004 (`isFreeContent`, grid selectors) · F-STORY-006 (`unlockedBy` award engine) · F-AUDIO-004 (spoken forms, prompt audio) · F-CNT-002 (romanization policy) · F-I18N-001 (messages, `KoreanText`, `romanizationShown`) · F-PLAN-001 (plan catalog mirror) · audit `conf-learning` (Stage 1 anchor, 15 quests, Discover/Check, missing catalog games, reward loop) · blueprint 04 §3.4 / §4 · blueprint 05 §1 · blueprint 06 §1 ② ③ and §3–4 ⑥ ⑨ ⑩ ⑫

---

## 1. Context

Stage 1's stated anchor is "recognize 24 jamo + 6 batchim at >= 90 % accuracy" (`apps/mobile/src/content/stages.ts:13`; blueprint 05 §1.1). Verified on `main` HEAD `332e199` (PRs #94-#97 merged; this section was first written at `5841dcf`, and the lines it cites were re-read after #95 moved `JourneyScreen`, `HomeScreen`, `PinEntryScreen` and the tab bar), the shipped Stage 1 cannot deliver it, and a quest teaches nothing before it tests.

**What exists today (all line numbers re-read after PR #94):**

- **Quest shape has no teach step and no check step.** `QuestStepKindSchema` is `intro | present | practice | apply | reward` (`packages/content-schema/src/schemas/quest.ts:8`), a quest has 3-7 steps (`:29`) and 3-15 minutes (`:28`). Blueprint 04 §3.4 and `.claude/skills/content-skill/SKILL.md` §3.1 define Hook / **Discover** / Play / **Check** (2-3 questions) / Celebrate; the code collapses Discover into a quiz. The three Letters quests open with a `present` step that is a Match Sound game over letters nobody has been shown (`apps/mobile/src/content/quests.ts:17, 32, 47`). The one line meant to teach, `hoyaLineEn: 'Tap each one to hear it.'` (`quests.ts:17`), is never displayed: a step with a `minigameRef` renders the launcher, which has no Hoya line (`screens/quest/QuestPlayerScreen.tsx:136-152`, `MinigameLauncher` `:182-208`).
- **Only 8 Stage 1 quests** (letters 3, life 2, rites 1, nature 1, crafts 1; `quests.ts:11-132`) against the blueprint's 5 episodes x 3 quests = 15 (`docs/blueprints/04-main-content-outline.md:393`). The Letters episode subtitle promises "the first 14 consonants" (`content/episodes.ts:17`) but its quests teach 8 consonants and 6 vowels; it lists 5 reward cards (`:24`) but only 3 are quest rewards, and no code ever awards the other cards of any episode, nor the `stage1-complete` / `first-launch` cards (`content/heritage-cards.ts:35, 51, 54, 67`; the only `unlockCard` call is `screens/results/ResultsScreen.tsx:66-84` via `logic/results-award.ts:66-80`).
- **18 of the 30 anchor symbols are ever asked; 12 never are.** Union of every `jamoIds` / syllable list reachable from a Stage 1 quest = 12 consonants (not ㅊ, ㅌ) + 6 vowels (not ㅑ ㅕ ㅛ ㅠ) + **0 batchim**. `const Jb` (the batchim id helper) is defined and never called (`logic/minigame-config.ts:24`); the six `jamo:*-batchim` entries exist (`content/jamo.ts:93-100`) and have stroke skeletons (`content/jamo-strokes.ts`), but no scope contains one. Blueprint 05 itself never assigns ㅑ ㅕ ㅛ ㅠ (`05-episode-learning-goals.md:99-145`).
- **Duplicate and dead steps.** `quest:stage1-life-q1` plays the same scope twice in a row (`quests.ts:63` and `:64`, both `minigame:s1-life-card-1`); `quest:stage1-life-q2` plays `s1-life-card-2` at `:77` and again at `:79`. `s1-letters-recognize-1` and `s1-letters-match-1` have identical jamo (`minigame-config.ts:28-37`) and both yield 4 rounds, because prompts are unique per pool (`logic/round-builder.ts:45`, `.slice(0, rounds)`; the 5 in `match-1` is silently capped). `s1-letters-match-3` is referenced by no quest (`minigame-config.ts:80`).
- **Build a Letter cannot build a batchim syllable.** Final consonants are looked up by character, so the final ㄹ in 물 becomes the *initial* `jamo:rieul` tile (`round-builder.ts:71`, `jamoAll.find((j) => j.char === ch)`), and a syllable with the same jamo twice (밥) collapses to one tile because selection and tile keys are by id (`screens/minigames/BuildLetterGame.tsx:63, 169-172`).
- **Scoring is first-try now** (PR #94): a round is scored once on the first answer; later answers are retries (`logic/first-try.ts:24-34`; `store/quest-run-store.ts:55-68`; round keys `logic/round-keys.ts`); stars `>= 0.95` -> 3, `>= 0.6` -> 2, `>= 0.2` -> 1 (`logic/score.ts:6-13`); a card is awarded at 2+ stars and announced only the first time (`logic/reward.ts:6-35`, `logic/results-award.ts:37-82`). A run with no scored round completes nothing (`results-award.ts:39-48`). Quest completion is recorded by `recordQuestComplete` (`store/progress-store.ts:184-204`); a replay overwrites stars (`:196-198`) while sync keeps the maximum (`logic/sync/merge.ts:34-41`).
- **No next-quest teaser.** The cursor exists only as a private function of the Home builder (`logic/homework/mission-builder.ts:110-119`); Results offers "Back home" and "Episode page" (`ResultsScreen.tsx:131-157`). Stage completion is computed nowhere except per episode (`logic/journey.ts:29-38`).
- **Catalog games.** `MinigameKindSchema` lists 13 kinds (`schemas/minigame.ts:16-30`); `MinigameScreen` renders 9 and falls through to "This minigame is coming soon." for the rest (`screens/minigames/MinigameScreen.tsx:55-77`). Of the 12 catalog games (blueprint 06 §0.4) there is no Listen & Pick (③), no Sentence Builder (⑥), no Role Play (⑨), no Hidden Heritage (⑩), no My Story (⑫), and Pic-Word Match (②) exists only as the text-only Card Match (`CardMatchGame.tsx`, ko <-> en text pairs). Four enum members have no component and no catalog entry the app uses: `match-shape`, `syllable-build`, `tap-rhythm`, `order-it` (`minigame.ts:18, 22, 25, 26`).
- **Sound is the letter name.** `playJamoSound(char)` calls `speak(char)` and ignores `audioRef` (`platform/audio.ts:50-54`); on the iOS/Safari ko-KR voice a lone consonant is read as its name (기역, 니은 ...) and a batchim is read like its initial (audit F01, AUD-01). The wrong-answer bubble then plays "Hear it" with the same name (`MatchSoundGame.tsx:154`). F-AUDIO-004 owns the fix; this spec consumes its output (§3.12).
- **Summaries read the scopes.** `questJamo` (`content/sync-context.ts:13-25`) maps each quest to the jamo *characters* in its scopes, and `summarize` marks them recognized at accuracy >= 0.8 or shaky below 0.6 (`logic/sync/summarize.ts:41-42, 59-61`). A batchim id maps to the same character as its initial consonant (`sync-context.ts:11`), so batchim coverage would be indistinguishable. The teacher plan builder keeps a hand-written mirror with the same 8 quests (`apps/web/src/data/stage1-catalog.ts:25-34`).
- **Gating today.** `FREE_STAGES = {stage1}` (`logic/entitlement.ts:16`); the Journey row shows a "Premium" pill for non-entitled stages (`screens/journey/JourneyScreen.tsx:95`). F-STORY-004 §3.9 moves this behind one `isFreeContent(kind, id)` without behaviour change.

**What this spec does.** (1) adds a **Discover** (teach) step and a **Check** (2 questions) step to the quest model and player, with a plain-language next-quest teaser; (2) re-plans Stage 1 as **15 quests, 3 per theme episode, every one of the 30 symbols taught once and asked many times**, with concrete ids, scopes, games, minutes and reward cards, retiring the duplicated and orphaned steps; (3) defines **Stage 1 completion** (what it is, what it awards) and a short, non-gating **Hangul Check** that audits all 30 symbols; (4) specifies the two missing catalog games the next specs need — **Listen & Pick** and **Pic-Word Match** — in full; (5) lists the remaining catalog games as prioritised follow-up specs.

Terms. **Symbol**: one of the 30 anchor units (14 consonants + 10 vowels + 6 batchim). **Teach once**: a symbol appears in exactly one quest's Discover step. **Reading word**: a word built only from symbols already taught (it can be decoded). **Theme word**: a culture word used for exposure with a picture, which may contain symbols not yet taught. **Round**: one scored answer in a quest run (`quest-run-store`). **Cursor**: the first incomplete quest in content order.

## 2. User story

> As someone learning Hangul from zero — a child with a parent beside them, a teenager, an adult on their own — I want each quest to *show me* the new letters before it asks about them, to check what I just learned with two easy questions, and to tell me what comes next, so that by the end of Stage 1 I can really read 한글 and I feel the progress.

Companion stories:

- As a **parent or teacher**, I want Stage 1 to cover every letter and final consonant, and a short check at the end that shows me which letters still need a look (never shown to the learner as a score).
- As a **content author**, I want the Discover data, the quest list and the two new games to be plain data validated by tests, so adding a Stage 2 quest or a vocabulary game is data plus a reused component.
- As a **learner who plays out of order** (a heritage family that wants to start with Crafts), I want a gentle "this builds on the last quest" note instead of a locked door.

## 3. Acceptance criteria

### 3.1 Quest model: two new step kinds (`packages/content-schema`)

**Shared text type** (reuse if F-STORY-001 / F-VOC-001 already landed it; add `schemas/ko-text.ts` otherwise, exported from `src/index.ts`):

```ts
export const KoTextSchema = z.object({
  ko: z.string().min(1),
  romanization: z.string().min(1),            // Revised Romanization, unhyphenated, pronunciation-based (D13, F-CNT-002)
  en: z.string().min(1),                      // gloss in the content base language (UI locales overlay it, F-I18N-001)
  spokenKo: z.string().min(1).optional(),     // what the voice says when it differs from `ko` (F-AUDIO-004)
  audioRef: z.string().optional(),            // MP3 path, wins over TTS when present (D6)
  syllables: z.array(z.string().min(1)).optional(), // teaching-UI split, e.g. ['a','beo','ji']; join('') must equal `romanization`
});
export const PictureRefSchema = z.string().regex(/^(card|word|swatch):[a-z0-9-]+$/);
// `card:<id>` -> HeritageCardArt; `word:<id>` -> WordArt (F-VOC); `swatch:<token>` -> colour chip. Unresolved -> text fallback (§3.11).
```

**`schemas/quest.ts`**:

```ts
export const QuestStepKindSchema = z.enum(['intro', 'present', 'discover', 'practice', 'apply', 'check', 'reward']);

export const DiscoverItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('jamo'), jamoId: z.string().regex(/^jamo:[a-z0-9-]+$/),
             example: KoTextSchema,                      // a word containing the symbol (reading word or theme word)
             picture: PictureRefSchema.optional() }),
  z.object({ type: z.literal('word'), word: KoTextSchema, picture: PictureRefSchema.optional(),
             noteEn: z.string().max(80).optional() }),
]);
export const DiscoverPageSchema = z.object({
  items: z.array(DiscoverItemSchema).min(1).max(2),      // never more than two new things on one page
  captionEn: z.string().max(90).optional(),
});
export const DiscoverSchema = z.object({ pages: z.array(DiscoverPageSchema).min(1).max(3) });
```

`QuestStepSchema` gains `discover: DiscoverSchema.optional()`. `QuestSchema` gains `teaserEn: z.string().max(70).optional()` and a `.superRefine`:

- a `discover` step has `discover` and **no** `minigameKind` / `minigameRef`; a `check` step has both `minigameKind` and `minigameRef`; no other kind has `discover`;
- at most one `discover` and one `check` per quest; `discover` comes before every `practice` / `apply` / `check`; `check` comes after every `practice` / `apply` and before `reward`;
- a quest that has a `check` step has at least one scored step (so it can complete, `results-award.ts:39-48`).

Limits stay as they are (3-7 steps, 3-15 minutes); the Stage 1 quests use 6 steps. **Stage 2 and Stage 4 taste quests keep their five steps and `present`** (F-011, F-012); they may adopt Discover / Check later with no code change.

`MinigameKindSchema` gains `'listen-pick'` and `'pic-word-match'`; `RoundSchema` gains their round shapes (§3.10, §3.11), also fixing its lag behind the enum (`minigame.ts:78-85`). `ReviewEntrySchema` gains `missedItemIds: z.array(z.string()).optional()` and `ProgressSummarySchema` gains `stage1Anchor` (§3.9). `TELEMETRY_EVENT_NAMES` gains the names in §3.13. `JamoSchema` gains `soundHint: z.string().max(60).optional()` (base English hint; es / ko come from the F-I18N-001 overlay of the same name) and `spokenKo` is added by F-AUDIO-004 (this spec reads it, §3.12).

**Learner-facing step labels.** `questStepLabel` (`logic/quest-steps.ts:8-21`) is an exhaustive switch; add `discover` -> "Look and learn", `check` -> "Quick check" (existing: intro "Hello", present "Look and listen", practice "Practice", apply "Try it", reward "Finish"). Strings move to the F-I18N-001 catalog when it ships; until then they live in one module, `logic/quest-flow/copy.ts`.

- **Given** any Stage 1 quest in `questsAll`, **when** `QuestSchema.safeParse` runs, **then** it passes (today no test parses app content with the schema — audit story-mode defect 1).
- **Given** a quest with two `check` steps, or a `discover` step carrying a `minigameRef`, **when** parsed, **then** it fails with a path to the offending step.

### 3.2 Discover step (teach before play)

**Player.** `QuestPlayerScreen` renders a `discover` step inline (no route push): `<DiscoverStep pages={step.discover.pages} onDone={advance} />` in the branch before the narrative / launcher branch (`QuestPlayerScreen.tsx:136-152`). Header, dots and Leave sheet are unchanged (`:114-128`, `:75-91`). The step is not scored and not skippable by design, but its **Continue is enabled at once** — a learner who already knows the letters is never held (heritage learners, F-001 story 2).

**Pages.** One page shows one or two items (§3.1). Per `jamo` item (rendered with `KoreanText`, F-I18N-001 §3.5):

1. the glyph large (`touchTarget.hero`-scale type), its romanization (`g/k`, `eu`, ...; for ㅇ `silent/ng`, never `∅`, audit F08) and a **Hear it** button (speaker icon, label, >= `touchTarget.child`; it plays the symbol's **sound** — for the silent initial ㅇ its name 이응 — never the letter name of the other consonants, F-AUDIO-004 §3.1; the letter name is a second, optional **Letter name** button, same spec);
2. `soundHint` under it ("soft, light g ..."; full draft table in Appendix A);
3. for a **batchim** item a `SyllableBlock` diagram (new, `packages/design-system/src/components/SyllableBlock/`, tokens only, three boxes initial / vowel / final with the final highlighted) and the line "sits at the bottom of the block";
4. the example word (`KoreanText` with romanization and gloss) with the syllable block that contains the symbol emphasised (the block is found by Hangul decomposition, `logic/stage1/hangul.ts`), and its picture when `picture` resolves; its own **Hear it** button speaks `example.spokenKo ?? example.ko`.

`word` items render the word, romanization (`syllables` joined with a thin separator **in the teaching UI only**, D13), gloss, picture, **Hear it**, and `noteEn` if any.

- **Given** a page opens, **then** nothing autoplays (browsers and iOS block audio outside a gesture, audit AUD-06); the first Hear it button pulses once (static under reduced motion). **When** a Hear it button is tapped, **then** the audio plays through the prompt-audio contract (§3.12) and a tiny "heard" mark appears on that item (a fill-only marker; it never gates Continue).
- **Given** audio is unavailable or muted (`PlayResult` is `unavailable` or `muted`), **then** the item shows its sound as text — romanization is already visible, and the line "Say it out loud: <spoken romanization>" appears (the romanization of the syllable the voice would have said — `ga` for ㄱ, `ak` for the final ㄱ, `ieung` for ㅇ — F-AUDIO-004's `spokenRomanization`, not the tile value `g/k`) — and nothing else changes (F-001 §3.3 spirit; D6 text fallback).
- **Given** `romanizationMode === 'tap'` (F-I18N-001 `ProfileSettings.romanizationMode`, read through `useLocaleStore`; **until F-I18N-001 PR 3 exists the mode is the constant `'always'`** and this branch is dead code behind the same `romanizationShown(mode, revealed)` signature, D2 opt-in), **then** romanization on the example word is hidden behind a "Show how to say it" tap; the symbol's own romanization stays visible (it is the thing being taught) and the gloss is never hidden.
- **Given** the last page and Continue, **then** `advance()` runs and `quest.discover_completed` fires `{ questId, pages, heard }` (`heard` = number of distinct Hear it taps). Back / Leave behaves like any step (run discarded after confirm).
- **Given** reduced motion, **then** the pulse and the page slide are replaced by an instant change (`platform/motion.ts` `useReducedMotion`, as `ResultsScreen.tsx:54`).
- A Discover step with zero resolvable items (bad `jamoId`) renders one line and a Continue button — never a dead end — and `quest.discover_completed` carries `heard: 0`. The content test (§5) makes this unreachable in shipped data.
- **Quests that introduce nothing new** (nature-q2 .. crafts-q3, §3.6) use `word` items only: "Words you can read now", with pictures where an art exists (§3.11 fallback otherwise).

### 3.3 Check step (two questions)

A `check` step is a `listen-pick` scope with **exactly 2 rounds**, launched through the same `Minigame` route as any game (`QuestPlayerScreen.tsx:143`, `MinigameScreen.tsx:22-79` gains `case 'listen-pick'`).

- **Round 1 — the focus.** Quests that teach symbols: *hear a sound, pick the written symbol* (one of that quest's new symbols, options drawn from the confusable set of §3.9, kind-matched; in quest 1, where fewer than four symbols of a kind are taught, the options are the quest's four new symbols). Quests that teach nothing new: *hear a word, pick the picture*. Batchim quests: *hear a syllable, pick the written syllable* (options differ only in the final).
- **Round 2 — reading.** *Hear a reading word, pick the written word* among 3-4 reading words of the quest. Every option is built only from symbols taught by this quest or earlier (test T3).
- **Launcher variant.** For `kind: 'check'` the pre-game card reads "Two quick ones" with a single **Go** button and **no "Skip for now"** (the generic launcher keeps its Skip for practice / apply, `QuestPlayerScreen.tsx:204`). Rationale: the Check is the only evidence the learner can decode what was just taught; it is 30-40 seconds.
- **Scoring.** Both rounds go through the host as `answer(roundIdx, correct)` and are scored **first-try** exactly like any round (`quest-run-store.ts:55-68`; F-001 §3.2 revised): a wrong tap is amber + Hoya `thinking`, the round stays open, the right tap ends it, and only the first answer counts. They add 2 to `total` and so to the quest's stars (a 12-round quest with one slip is 11/12 = 2 stars and a card; with two slips 10/12 = 2 stars).
- **Leaving mid-check.** Back to the launcher keeps the keys already scored (`${stepIndex}:${roundIdx}`, `quest-run-store.ts:59`); re-entering re-presents the two rounds and the earlier answers count as retries. No double counting.
- **Feedback Review.** A quest with a Check step does **not** also show F-RVW-001 §3.3's one-question Feedback Review (the Check is that recall; decision L13). F-RVW-001 §3.3 gets a one-line amendment in PR Q-11.
- **Given** the Check finishes, **then** `quest.check_completed` fires `{ questId, firstTryCorrect, retries }` and the player advances to `reward`.

### 3.4 Quest scoring, rewards, duplicates

- Stars, `starsForAccuracy`, the 2-star card rule, replay announcement rules and `quest.complete` are **unchanged** (PR #94). The only scoring change is more scored rounds per quest: target mix **practice 6 + apply 4 + check 2 = 12** (BP 06 §0.3: 5-7 rounds per game).
- **Rounds above the pool size.** `buildMatchSoundRounds` caps rounds at the pool size (`round-builder.ts:45`). It gains cyclic prompts: when `rounds > pool.length`, prompts repeat in a fresh shuffle, never the same prompt twice in a row, and every id in the new `focusJamoIds` appears at least once. Round keys are indexes, so repeated prompts are separate rounds.
- **Duplicate removal** (all verified, §1): `quest:stage1-life-q1` and `-life-q2` lose their repeated Card Match steps; every Stage 1 quest has **no repeated `minigameRef`** (test T5); scopes `s1-letters-recognize-*`, `s1-letters-match-*`, `s1-letters-trace-1`, `s1-letters-build-*`, `s1-*-card-*`, `s1-*-match-1`, `s1-*-story-1`, `s1-letters-odd-1`, `s1-nature-quiz-1` are replaced by the per-quest ids of §3.6 (scope ids are not persisted: progress stores `questId` and `stepIndex`, `schemas/progress.ts:6-14`), and **no scope in `minigameScopes` may be unreferenced** (test T5).
- **Card award is unchanged at quest level** (2+ stars). Episode and stage awards: §3.8.

### 3.5 Next-quest teaser, cursor, soft prerequisites

**Cursor.** New pure `logic/next-quest.ts`: `nextQuestAfter({ snapshot, quests, episodes, justCompleted?, isEntitled })` = the first quest, in content order of playable grid episodes, that has no `completedAt` once `justCompleted` is treated as done; `undefined` when none. `mission-builder.ts:110-119` is changed to call it (same behaviour, now exported and tested) so Home's "Continue" and the teaser can never disagree. "Playable grid episodes" means `gridEpisodes(episodes)` from F-STORY-004 PR 4.1 (its single owner of the grid/shelf split) once that PR exists; until a shelf episode exists the two lists are identical, so Q-2 may call the existing `playableEpisodes`. F-STORY-004 PR 4.4 later adds the story cards to the same file — rebase, no semantic conflict. `isEntitled(stageKey)` is `isStageEntitled` (`logic/entitlement.ts:31-33`), so a free learner is never teased into a stage the Journey marks Premium (D5: nothing new is gated; existing stage gating is not extended).

**Teaser on Results.** Below the card banner, a "Next up" card shows the next quest's `titleEn` and one line: its `teaserEn` if authored, else generated: "New letters: ㅈ ㅊ" from its Discover jamo items, else its `blurbEn`. The Hangul in that line is rendered as taught content with `KoreanText` (never in a plain UI string). The **primary** button becomes **Play next quest** (to `QuestPlayer` for that quest); "Back home" and "Episode page" become ghost. If there is no next quest, the existing two buttons stay and the Stage 1 completion flow of §3.8 applies. Copy never says "you must" and never shows a count or a percent.

- **Given** the learner replays quest 3 while the cursor is quest 7, **then** the teaser says quest 7 (the learner's real next step), not quest 4.
- **Given** the learner skipped every game (`total === 0`, `results-award.ts:39-48`), **then** the quest did not complete and the teaser offers the same quest again ("Try this one again").
- **Given** the user taps the teaser CTA, **then** `quest.teaser_tapped` fires `{ fromQuestId, toQuestId }`.

**Soft prerequisite (no lock).** `EpisodeDetailScreen` (`screens/episode/EpisodeDetailScreen.tsx:107-146`) shows "Builds on: <previous quest title>" under a quest whose predecessor in Stage 1 order is not complete. Tapping **Start** on such a quest opens a one-line sheet once per quest per session: "This one uses letters from <previous>. Start there?" — **Start there** / **Play anyway** (both always available; nothing is locked, D3). Teacher plans and homework are unaffected (`logic/homework/gating.ts` gates by stage only).

### 3.6 The Stage 1 curriculum: 15 quests, 3 per theme episode, 30 symbols taught once

**Design rules** (each is a test in §5):

- **R1 Teach once, ask many.** Every one of the 30 symbols appears in exactly one quest's Discover step, in the quest list order below; after that it appears as a review prompt in the next quest and in the Hangul Check.
- **R2 New-element cap** (content-skill §3.4: "consonants 1-2, vowels 1-2"): at most **2 consonant-type symbols** (a batchim counts as one) and **2 vowels** per quest; most quests teach 2-4 symbols in 1-2 Discover pages.
- **R3 Decodable reading.** A *reading word* in a quest's Discover, practice or Check is built only from symbols taught in that quest or earlier (Hangul decomposition, test T7). *Theme words* (pictured culture words) may contain untaught symbols, are used only for exposure (Pic-Word Match, Culture Quiz, Discover theme pages), and always show romanization and gloss.
- **R4 Six steps.** `intro -> discover -> practice -> apply -> check -> reward`, 6 steps, 4-5 minutes. Rounds: practice 6 + apply 4 + check 2.
- **R5 Letters first, then reading.** The first 10 quests teach all symbols; the last 5 (nature-q2 .. crafts-q3) teach nothing new and consolidate by reading words ("Words you can read now"), which is what the anchor skill measures.
- **R6 Additive ids.** The 8 shipped quest ids and the 5 episode ids are kept (progress, plans and homework keep working); 7 ids are new. Three shipped quests change which symbols they teach (letters q1-q3); five more keep their id and are rebuilt step by step (life q1-q2, rites q1, nature q1, crafts q1).

**Quest list** (content order = Journey order; `episodes.ts` `questIds`, `estimatedMinutes` and `subtitleEn` change as shown):

| # | Quest id | Episode | Title (English) | Min | New symbols (Discover) | Review | Reading words (decodable) | Reward card |
|---|---|---|---|---|---|---|---|---|
| 1 | `quest:stage1-letters-q1` (kept, **re-scoped**: was g n d l) | letters | Meet a, eo, g, n | 5 | ㅏ ㅓ ㄱ ㄴ | - | 나 na (I, me), 너 neo (you), syllables 가 거 나 너 | `card:book` |
| 2 | `quest:stage1-letters-q2` (kept, **re-scoped**: was m b s ng) | letters | Meet o, u, m and the circle | 5 | ㅗ ㅜ ㅁ ㅇ | ㅏ ㅓ ㄱ ㄴ | 나무 namu (tree), 너무 neomu (too much), 가구 gagu (furniture), 오 o (five) | `card:hanji` |
| 3 | `quest:stage1-letters-q3` (kept, **re-scoped**: was six vowels) | letters | Meet eu, i, d, r | 5 | ㅡ ㅣ ㄷ ㄹ | ㅗ ㅜ ㅁ ㅇ | 다리 dari (leg, bridge), 아이 ai (child), 어머니 eomeoni (mother), 드라마 deurama (drama) | `card:brush` |
| 4 | `quest:stage1-life-q1` (kept; steps rebuilt) | life | Hello Kimchi & Rice | 4 | ㅈ ㅊ | ㄱ ㄴ ㄷ ㄹ | 자두 jadu (plum), 치즈 chijeu (cheese), 고추 gochu (chili pepper), 차 cha (tea) | `card:kimchi` |
| 5 | `quest:stage1-life-q2` (kept; steps rebuilt) | life | Family at the Table | 4 | ㅂ ㅅ | ㅈ ㅊ ㅁ ㅇ | 아버지 abeoji (father), 아기 agi (baby), 바나나 banana (banana), 두부 dubu (tofu) | `card:family-table` |
| 6 | `quest:stage1-life-q3` (**new**) | life | Picnic Snacks | 4 | ㅋ ㅌ | ㄱ ㄷ ㅂ ㅅ | 토마토 tomato (tomato), 코코아 kokoa (cocoa), 쿠키 kuki (cookie), 토스트 toseuteu (toast) | `card:kimbap` |
| 7 | `quest:stage1-rites-q1` (kept; steps rebuilt) | rites | Bow & Eat Tteokguk | 4 | final ㄴ, final ㄹ | ㅁ ㅇ ㄷ ㅅ | 달 dal (moon), 물 mul (water), 문 mun (door), 설날 seollal (Lunar New Year) | `card:seollal` |
| 8 | `quest:stage1-rites-q2` (**new**) | rites | Rice Cakes of Chuseok | 5 | ㅍ ㅑ ㅕ, final ㅇ | ㅂ ㅋ ㅏ ㅓ | 송편 songpyeon (half-moon rice cake), 포도 podo (grape), 야구 yagu (baseball), 여우 yeou (fox) | `card:chuseok` |
| 9 | `quest:stage1-rites-q3` (**new**) | rites | Hanbok and the Bow | 5 | ㅎ ㅛ ㅠ, final ㄱ | ㅇ ㅗ ㅜ final ㄴ | 한복 hanbok (hanbok), 한국 hanguk (Korea), 효도 hyodo (respect for parents), 우유 uyu (milk) | `card:sebae` |
| 10 | `quest:stage1-nature-q1` (kept; steps rebuilt) | nature | Tiger, Magpie, Moon | 4 | final ㅁ, final ㅂ | final ㄴ ㄹ ㅇ ㄱ | 곰 gom (bear), 봄 bom (spring), 밥 bap (rice), 집 jip (house); payoff: 김치 gimchi, 엄마 eomma | `card:magpie` |
| 11 | `quest:stage1-nature-q2` (**new**) | nature | Mountain, River, Sea | 4 | - | all finals | 산 san (mountain), 강 gang (river), 바다 bada (sea), 하늘 haneul (sky) | `card:mountain` |
| 12 | `quest:stage1-nature-q3` (**new**) | nature | Moon, Stars and Night | 4 | - | all finals | 달 dal (moon), 별 byeol (star), 밤 bam (night), 보름달 boreumdal (full moon) | `card:moon` |
| 13 | `quest:stage1-crafts-q1` (kept; steps rebuilt) | crafts | Yut, Kite, Top | 4 | - | all finals | 연 yeon (kite), 공 gong (ball), 줄 jul (rope), 놀이 nori (play, game) | `card:yutnori` |
| 14 | `quest:stage1-crafts-q2` (**new**) | crafts | Paper and Pottery | 4 | - | all finals | 한지 hanji (Korean paper), 종이 jongi (paper), 청자 cheongja (celadon), 도자기 dojagi (pottery) | `card:pottery` |
| 15 | `quest:stage1-crafts-q3` (**new**) | crafts | Read Hangul! | 4 | - | everything | 한글 hangeul (the Korean alphabet), 호야 hoya (Hoya), 안녕 annyeong (hi), 사랑 sarang (love) | `card:kite` |

Symbol accounting: 14 consonants (ㄱㄴ L1, ㅁㅇ L2, ㄷㄹ L3, ㅈㅊ F1, ㅂㅅ F2, ㅋㅌ F3, ㅍ R2, ㅎ R3), 10 vowels (ㅏㅓ L1, ㅗㅜ L2, ㅡㅣ L3, ㅑㅕ R2, ㅛㅠ R3), 6 batchim (ㄴㄹ R1, ㅇ R2, ㄱ R3, ㅁㅂ N1) = **30**. Total time = 5 quests x 5 min + 10 quests x 4 min = 65 minutes (blueprint 04 §4.3 estimated about 52 minutes for 15 x 3.5; the Discover step and two check rounds per quest account for the difference). Episode minutes: letters 15, life 12, rites 14, nature 12, crafts 12 (today 12 / 10 / 8 / 9 / 10, `episodes.ts:25, 38, 51, 64, 77`). `episodes.ts:17` subtitle becomes "Twelve letters, and your first real words." (today "The first 14 consonants come alive." is false). Learner-facing quest titles carry romanization, never Hangul, in `titleEn` / `blurbEn` (the policy of F-CNT-001; today `quests.ts:43` puts Hangul in `blurbEn`).

**Re-scope migration.** Letters q1 / q2 / q3 change *which symbols* they teach (today g n d l / m b s ng / six vowels, `quests.ts:11-55`). Completion records are by quest id and are kept: a learner who finished an old quest stays complete for the same id and never sees its new Discover; any gap (for example the old q3 learner who never met ㅈ) is caught by the next quests and by the Hangul Check (§3.9). No stored data is rewritten. Episodes whose `questIds` grow (life 2 -> 3, rites 1 -> 3, nature 1 -> 3, crafts 1 -> 3) become incomplete for existing learners (`logic/journey.ts:29-38` requires all quests) — intended, and the point of the episode card.

**Steps and scopes.** Step ids `s1..s6`: `s1` intro (6-8 s, English Hoya line only), `s2` discover (40 s for 2 pages, 60 s for 3), `s3` practice (75-90 s), `s4` apply (60-75 s), `s5` check (35 s), `s6` reward (8 s). Scope ids are `minigame:s1-<theme>-q<n>-play | -apply | -check` (regex `^minigame:[a-z0-9-]+$`, `minigame.ts:89`). Notation: **MS** Match Sound (`jamoIds`, `rounds: 6`, `focusJamoIds` = the quest's new symbols; review symbols fill the pool to >= 8) · **BL** Build a Letter (`syllables[]`; batchim syllables carry explicit `jamoIds`, §3.7) · **TR** Trace Stroke · **OO** Odd One Out · **CQ** Culture Quiz · **SS** Story Sequence · **PW** Pic-Word Match (§3.11) · **LP** Listen & Pick (§3.10): *sym* = sound -> written symbol, *syl* = syllable -> written syllable (options differ only in the final), *word* = word -> written word, *pic* = word -> picture.

| # | `-play` (practice, 6 rounds) | `-apply` (4 rounds) | `-check` (2 rounds): round 1 / round 2 |
|---|---|---|---|
| 1 | MS ㅏ ㅓ ㄱ ㄴ | BL 가 ga, 거 geo, 나 na, 너 neo | LP-sym ㅓ among {ㅓ ㅏ ㄱ ㄴ} / LP-word 너 among {가 거 나 너} |
| 2 | MS ㅗ ㅜ ㅁ ㅇ + review | TR ㅁ ㅇ ㅗ ㅜ | LP-sym ㅜ among {ㅜ ㅗ ㅏ ㅓ} / LP-word 나무 among {나무 너무 가구 오} |
| 3 | MS ㅡ ㅣ ㄷ ㄹ + review | OO consonants vs vowels (pool ㄷ ㄹ ㄱ ㄴ ㅁ ㅡ ㅣ ㅏ) | LP-sym ㅡ among {ㅡ ㅜ ㅣ ㅓ} / LP-word 다리 among {다리 아이 어머니 드라마} |
| 4 | MS ㅈ ㅊ + review | PW 김치 gimchi `card:kimchi`, 밥 bap `card:rice`, 김밥 gimbap `card:kimbap`, 젓가락 jeotgarak `card:chopsticks` | LP-sym ㅊ among {ㅊ ㅈ ㄱ ㄷ} / LP-word 치즈 among {치즈 자두 고추 차} |
| 5 | MS ㅂ ㅅ + review | BL 바 ba, 보 bo, 사 sa, 수 su | LP-sym ㅅ among {ㅅ ㅈ ㅂ ㅁ} / LP-word 아버지 among {아버지 아기 바나나 두부} |
| 6 | MS ㅋ ㅌ + ㄱ ㄷ ㅂ ㅅ (twins) | CQ 토마토 tomato, 코코아 cocoa, 쿠키 cookie, 토스트 toast, 김밥 kimbap | LP-sym ㅋ among {ㅋ ㄱ ㅌ ㄷ} / LP-word 토마토 among {토마토 코코아 쿠키 토스트} |
| 7 | LP-syl 달 단 물 문 산 살 (3 options: no final / ㄴ / ㄹ) | BL (CVC, explicit ids) 달 dal, 물 mul, 문 mun, 산 san | LP-syl 달 among {다 달 단} / LP-word 설날 among {설날 설 날 달} |
| 8 | MS ㅍ ㅑ ㅕ + ㅏ ㅓ ㅂ ㅋ | BL 송 song, 편 pyeon, 야 ya, 여 yeo | LP-syl 송 among {소 송 손} / LP-word 송편 among {송편 포도 야구 여우} |
| 9 | LP mix: sym ㅎ, ㅛ, ㅠ; syl 복, 한, 학 | SS "New Year Order": 한복 입기 hanbok ipgi, 세배 드리기 sebae deurigi, 떡국 먹기 tteokguk meokgi, 세뱃돈 받기 sebaetdon batgi | LP-sym ㅛ among {ㅛ ㅗ ㅠ ㅕ} / LP-word 한복 among {한복 한국 효도 우유} |
| 10 | LP-syl 곰 봄 밥 집 입 감 (4 options, finals from the 7 taught) | PW 호랑이 horangi `card:tiger`, 까치 kkachi `card:magpie`, 달 dal `card:moon`, 산 san `card:mountain` | LP-syl 곰 among {고 곰 공 골} / LP-word 집 among {집 밥 곰 봄} |
| 11 | LP-word 산 강 바다 하늘 별 곰 | BL (CVC) 산 san, 강 gang, 별 byeol, 곰 gom | LP-pic 산 among `card:mountain`, `card:sea`, `card:moon`, `card:tiger` / LP-word 강 among {강 산 바다 하늘} |
| 12 | LP-word 달 별 밤 보름달 하늘 산 | TR final ㅁ ㅂ ㄹ ㅇ (`*-batchim` ids) | LP-pic 달 among `card:moon`, `card:mountain`, `card:sea`, `card:kite` / LP-word 보름달 among {달 별 밤 보름달} |
| 13 | BL (CVC) 연 yeon, 공 gong, 줄 jul, 놀 nol | PW 윷 yut `card:yutnori`, 연 yeon `card:kite`, 팽이 paengi `card:top`, 제기 jegi `card:jegi` | LP-pic 연 among `card:kite`, `card:top`, `card:jegi`, `card:yutnori` / LP-word 놀이 among {놀이 공 줄 연} |
| 14 | LP-word 한지 종이 청자 도자기 연 공 | PW 한지 hanji `card:hanji`, 청자 cheongja `card:pottery`, 붓 but `card:brush`, 종이접기 jongijeopgi `card:origami` | LP-pic 청자 among `card:pottery`, `card:hanji`, `card:brush`, `card:origami` / LP-word 한지 among {한지 종이 청자 도자기} |
| 15 | LP-word 한글 호야 안녕 사랑 한국 한복 | BL 한 han, 글 geul, 호 ho, 야 ya | LP-pic 한글 among `card:hangul-day`, `card:hanbok`, `card:tiger`, `card:book` / LP-word 안녕 among {안녕 사랑 호야 한글} |

**Discover pages per quest** (items are `jamo` unless marked word; the example is a reading word containing the symbol):

| # | Page 1 | Page 2 | Page 3 |
|---|---|---|---|
| 1 | ㅏ (example 나) · ㅓ (너) | ㄱ (가 ga, "the sound ga") · ㄴ (나) | - |
| 2 | ㅗ (오) · ㅜ (나무) | ㅁ (나무) · ㅇ (오; hint: silent at the start of a block) | - |
| 3 | ㅡ (드라마) · ㅣ (아이) | ㄷ (다리) · ㄹ (드라마) | - |
| 4 | ㅈ (자두) · ㅊ (치즈) | word 고추 · word 차 | - |
| 5 | ㅂ (바나나) · ㅅ (사자 saja, lion) | word 아버지 · word 아기 | theme words 엄마 eomma, 가족 gajok (`card:family-table`) |
| 6 | ㅋ (쿠키) with a "ㄱ plus a puff of air" note · ㅌ (토마토) with "ㄷ plus a puff" | word 코코아 · word 토스트 | - |
| 7 | final ㄴ (문) · final ㄹ (달), both with `SyllableBlock` | theme words 설날 seollal (`card:seollal`), 떡국 tteokguk (`card:tteokguk`) | - |
| 8 | ㅑ (야구) · ㅕ (여우) | ㅍ (포도) · final ㅇ (송편) | theme words 추석 chuseok (`card:chuseok`), 송편 (`card:songpyeon`) |
| 9 | ㅛ (효도) · ㅠ (우유) | ㅎ (한복) · final ㄱ (한국) | - |
| 10 | final ㅁ (곰) · final ㅂ (집) | word 봄 · word 밥 | payoff: 김치 gimchi, 엄마 eomma ("You can read these now!") |
| 11 | words 산 (`card:mountain`) · 강 | words 바다 (`card:sea`) · 하늘 | - |
| 12 | words 달 (`card:moon`) · 별 | words 밤 · 보름달 | - |
| 13 | words 연 (`card:kite`) · 공 | words 줄 · 놀이 | - |
| 14 | words 한지 (`card:hanji`) · 종이 | words 청자 (`card:pottery`) · 도자기 | - |
| 15 | words 한글 (`card:hangul-day`) · 호야 (`card:tiger`) | words 안녕 · 사랑 | - |

**Reward cards.** All 15 quest rewards are existing cards in `heritage-cards.ts:28-68` (and have art in `HeritageCardArt` `supportedCardIds`). No card is added. Cards per episode after this spec: letters q1-3 `book hanji brush` + episode `ink origami`; life q1-3 `kimchi family-table kimbap` + episode `rice chopsticks hanbok`; rites q1-3 `seollal chuseok sebae` + episode `tteokguk songpyeon`; nature q1-3 `magpie mountain moon` + episode `mugunghwa sea`; crafts q1-3 `yutnori pottery kite` + episode `jegi top` = 15 + 11. With the 3 `stage1-complete` cards (`hangul-day`, `lantern`, `gayageum`) and the `first-launch` card (`tiger`) this makes **all 30 Stage 1 cards earnable** (today 11 of 42 cards across all stages are, audit `conf-learning`). Each episode's cards are exactly those whose `unlockedBy` is `episode:<id>` (test T9).

### 3.7 Supporting content and logic changes (the plumbing the quest list needs)

| Area | Change | Why |
|---|---|---|
| `apps/mobile/src/logic/stage1/` (new, pure) | `hangul.ts` — `decompose(block)` via Unicode arithmetic (initial / medial / final); `symbolsOf(word)` -> jamo ids (a final in the six taught batchim maps to `jamo:*-batchim`, initial ㅇ maps to `jamo:ieung`, anything else -> `null`); `symbolKey(jamo)` -> `'ㄱ'` for consonants / vowels and `'ㄱ/final'` for batchim · `curriculum.ts` — `STAGE1_QUESTS` (derived from `episodesAll` + `questsAll`, grid episodes of stage1, content order), `questTeaches(quest)`, `teachingQuestFor(jamoId)`, `symbolsMetThrough(questId)` · `confusables.ts` — §3.9 table · `completion.ts` — §3.8 | testable rules (§5), one place for "which quest teaches X" |
| `content/jamo.ts` (`:53-102`) + `JamoSchema` | add `soundHint` (Appendix A) to the 30 entries; romanization `'∅/ng'` -> `'silent/ng'` (`jamo.ts` ㅇ entry; audit F08) because Discover prints it; `exampleWordKo` / `exampleWordEn` are unchanged and **not used** by Discover (the example is authored per item; the old examples have no romanization and one is wrong, e.g. 으뜸 "first" contains the untaught ㄸ, audit F13) | Discover content, accessibility |
| `logic/round-builder.ts` | `buildMatchSoundRounds` cyclic prompts + `focusJamoIds` (§3.4); `buildBuildLetterRounds` accepts `syllables[].jamoIds` (explicit ids, used when present instead of the char lookup at `:71`), rejects (throws in the builder, caught by the content test) a syllable that repeats a jamo id, and for 3-part syllables picks distractors as 1 initial consonant + 1 other batchim id | batchim build (R/N quests), audit F02 |
| `screens/minigames/BuildLetterGame.tsx` | a batchim tile shows its glyph and its final romanization (`k`, `n`, `l`, `m`, `p`, `ng`) and accessibility label "final <romanization>"; slots for a 3-part target render as `SyllableBlock`-shaped boxes (final slot lower); the hint "letters go left to right" is replaced for blocks whose vowel sits beside / under the consonant by a block-shape diagram (UX-16 pointer; if F-LAYOUT / UX PR lands first, reuse it) | correctness of the hint, batchim |
| `logic/minigame-config.ts` | `MinigameScope` gains `focusJamoIds?`, `listenPick?`, `picWord?`; new scope entries per §3.6 (45 entries: 15 quests x play / apply / check); builders `lp.sym`, `lp.syl`, `lp.word`, `lp.pic`, `pw(pairs)` so scopes stay short; scope ids of the retired steps removed (§3.4); the one surviving story-sequence scope (quest 9, "New Year Order") keeps the four `storySteps` of the old rites scope **with** the romanizations F-CNT-002 PR 2b supplies, and renders through F-STORY-003's Story Order v2 once that lands | data |
| `content/quests.ts`, `content/episodes.ts` | 15 Stage 1 quests (§3.6) with `discover` / `check` steps; episodes' `questIds`, `estimatedMinutes`, letters `subtitleEn`; `rewardCardIds` unchanged | data |
| quest 7 intro | the Seollal greeting leaves `hoyaLineEn` (`quests.ts:92`): F-CNT-002 §3.5 adds `hoyaLineKo: { ko, romanization, en }`; this spec's step `s1` of quest 7 uses it with the value F-CNT-002 §3.7 fixes (`saehae bok mani badeuseyo`, `Happy New Year!`; D13). The field and its rendering are F-CNT-002 PR 2a, the data PR 2b | F-CNT-001 policy |
| `content/sync-context.ts` (`:13-25`) | `questJamo` = `symbolKey` of (Discover jamo items + every scope's `jamoIds` + syllable components), so batchim recognition is reported as `'ㄴ/final'`, not as the initial `'ㄴ'`; `stage1QuestIds` is unchanged in shape (15 ids), so `questsTotal` becomes 15 (`summarize.ts:75`) | caregiver coverage |
| `apps/web/src/data/stage1-catalog.ts` (`:25-42`) | 15 quests / 5 episodes with the same ids, titles and minutes; a parity test in `apps/web/src/data/__tests__/` imports the mobile content arrays and asserts ids / titles / minutes / episode membership are equal (the hand-written mirror is allowed to drift today, F-PLAN-001 §3.5) | teacher plans see the new quests |
| `logic/homework/mission-builder.ts` (`:110-119`) | uses `nextQuestAfter` (§3.5) | one cursor |
| `logic/quest-steps.ts` | labels for the two new kinds (§3.1) | exhaustive switch |
| `logic/stage1/discover-flow.ts`, `logic/listen-pick-flow.ts`, `logic/pic-word-flow.ts`, `logic/quest-flow/` (copy + view-models), `logic/stage1/review-flow.ts` (all new, pure) | the behaviour of `DiscoverStep`, `ListenPickGame`, `PicWordMatchGame`, the Check launcher / Results teaser and `StageReviewScreen` lives here as reducers and view-models (the same pattern as F-STORY-003's `check-player`); the screens only render them | the mobile test lanes cannot render components (§5) |

### 3.8 Stage 1 completion and the Stage 1 prize

- **Definition.** Stage 1 is complete when every grid episode of `stage1` is complete (`isEpisodeComplete`, `logic/journey.ts:29-38`) — i.e. all 15 quests have a `completedAt`, **at any star count**. New pure `logic/stage1/completion.ts`: `isStageComplete(stage, episodes, snapshot)` and `completionTransition(before, after)` (`{ episodesJustCompleted: string[]; stageJustCompleted: boolean }`).
- **Awards (consumes F-STORY-006's engine).** In the single Results write (`applyQuestResult`, `results-award.ts:49-80`), after `recordQuestComplete`, the engine is asked for the completion awards: for each episode just completed, every card in `episode.rewardCardIds` the profile does not own; for Stage 1 just completed, every card with `unlockedBy === 'stage1-complete'` (`hangul-day`, `lantern`, `gayageum`). These awards are **not star-gated** (the 2-star rule applies to a quest's own card only): finishing all 15 quests with some 1-star runs still earns the legendary cards — a learner is never blocked from the prize by a hard first-try round. `first-launch` (`tiger`) is F-STORY-006's job at onboarding. Awards are idempotent (`progress-store.ts:206-209` returns when owned). Telemetry: `card.unlocked` per card and `stage.complete` `{ stageKey: 'stage1', cardsAwarded }` once.
- **Results.** When `stageJustCompleted`, the Results primary button is **See your Stage 1 prize**, which opens the ceremony screen; the usual star row / quest card banner still show first. Episode completion (not stage) shows the extra cards as a second banner line ("2 more cards joined from this episode") — F-STORY-006 owns that banner.
- **Ceremony screen.** New route `StageComplete { stageKey: 'stage1' }`, `screens/results/StageCompleteScreen.tsx`: Hoya `cheering`; headline; a **symbol wall** — all 30 symbols in a fixed grid, every one lit (fill-only; no counts, no percentages, D3); the three new legendary cards (`HeritageCardArt`, each opens `CardDetail`); primary **Take the Hangul Check** ("about 4 minutes, you can skip it"); ghost **See my cards** and **Back home**. It is never shown automatically a second time; it stays reachable from the Journey Stage 1 header (below). It shows no Premium pill and offers no purchase (D5); what comes after Stage 1 for free learners is F-STORY-004 / F-VOC.
- **Journey.** When Stage 1 is complete the Stage 1 header pill reads "Complete" instead of "Open" (`stagePillLabel`, `logic/journey.ts:18-27` gains a `complete` state) and a small **Hangul Check** button appears beside it. The "Premium" pill for non-entitled stages is untouched (`JourneyScreen.tsx:100`, F-STORY-004 §3.9).
- **Given** a learner who completes quest 15 as the last missing quest, **then** the three legendary cards and the episode extras are awarded exactly once, the ceremony opens from Results, and replaying quest 15 later announces nothing.
- **Given** a learner completes quests out of order, **then** episodes complete independently and the stage completes when the last quest of any episode completes.

### 3.9 The Hangul Check (Stage 1 graduation check, non-gating)

This is the Stage 1 configuration of F-RVW-001 §3.4's Stage Review (the "anchor audit"), and it supersedes that section's "N = 4 to 6 items" for Stage 1 only, because the anchor is 30 symbols. It never gates anything (Stage 2 is not unlocked by it, D5), it can be skipped and retaken, and its numbers reach only the caregiver channel.

- **Entry.** Primary button on the ceremony screen; the Journey Stage 1 header button once complete; route `StageReview { stageKey: 'stage1' }`, `screens/reviews/StageReviewScreen.tsx` (wireframe name `reviews/stage-review`, F-RVW-001 §5). Before it starts, a card shows "About 4 minutes. Pictures and sounds. No timer." and one switch, **Reading practice: hide the romanization until I tap**, scoped to this attempt (D2's opt-in; the persistent per-profile mode lives in F-I18N-001 / Profile and, when `'tap'`, is applied here without asking).
- **Items (35).** Built by `logic/stage1/hangul-check.ts` `buildHangulCheck({ seed })`, pure and deterministic: **30 symbol items, one per symbol** — consonant / vowel: *hear the sound, pick the written letter* among 4 (target + the first three entries of the confusable list below, in order, shuffled); batchim: *hear the syllable ㅇ + ㅏ + final (악 안 알 암 압 앙), pick the written syllable* among 4 (target + three other finals or no final) — plus **5 word items**, one per theme episode: *hear a word, pick the picture* among 4 of {한글 `card:hangul-day`, 밥 `card:rice`, 한복 `card:hanbok`, 산 `card:mountain`, 연 `card:kite`}. The 5 word items satisfy F-RVW-001 §3.4's "each pillar contributes >= 1". Seven items per chunk (6 symbols + 1 word), 5 chunks; between chunks a one-line Hoya break with a single **Keep going** button; chunk dots only fill. Option order is shuffled per attempt; the correct option is not at index 0 more than ~40 % of the time over any seed (test).
- **Confusable lists** (`logic/stage1/confusables.ts`; each symbol keeps three, same kind; shapes and sounds learners actually mix up): ㄱ ㅋ ㄴ ㄷ · ㄴ ㄱ ㄷ ㄹ · ㄷ ㅌ ㄹ ㄴ · ㄹ ㄷ ㄴ ㅁ · ㅁ ㅂ ㅇ ㄴ · ㅂ ㅍ ㅁ ㅅ · ㅅ ㅈ ㅊ ㅇ · ㅇ ㅎ ㅁ ㅅ · ㅈ ㅊ ㅅ ㄱ · ㅊ ㅈ ㅅ ㅎ · ㅋ ㄱ ㅌ ㅍ · ㅌ ㄷ ㅋ ㅍ · ㅍ ㅂ ㅋ ㅌ · ㅎ ㅇ ㅊ ㅅ · ㅏ ㅓ ㅑ ㅣ · ㅑ ㅏ ㅕ ㅛ · ㅓ ㅏ ㅕ ㅗ · ㅕ ㅓ ㅑ ㅠ · ㅗ ㅜ ㅓ ㅛ · ㅛ ㅗ ㅠ ㅑ · ㅜ ㅗ ㅡ ㅠ · ㅠ ㅜ ㅛ ㅕ · ㅡ ㅜ ㅣ ㅓ · ㅣ ㅡ ㅏ ㅓ (first symbol = key, next three = distractors). The same table builds the options of every Check round (§3.3), filtered to symbols already taught at that quest and padded from the taught symbols of the same kind (minimum 2 options).
- **Scoring.** First-try (F-001 §3.2) over the 35 items, through a new ephemeral `store/review-run-store.ts` (it never touches `quest-run-store`, quests or stars of quests). Learner result: stars by F-RVW-001 §3.1 (>= 0.8 of 35 -> 3, >= 0.5 -> 2, else **1; never 0**), Hoya, a certificate card (profile name, "Stage 1: Hangul", date, Hoya) and the collection wall of Stage 1 cards. No number, ratio or percent anywhere (`logic/reviews/banned-text.ts` of F-RVW-001 §3.1 scans every string in the screen's copy module). If any symbol was missed first try, "Hoya's tip" shows up to **three** tappable chips ("Try again: ㅌ ㅠ"); each chip opens the quest that teaches it (`teachingQuestFor`). With none missed: "Every letter!".
- **Caregiver channel.** `store/progress-store.ts` gains `recordReview(profileId, entry)` (persist + sync like other writes). Entry: `{ id: 'review:stage1:<iso>', kind: 'stage-certificate', generatedAt, scope: 'stage1', itemIds (35), resultStars, missedItemIds }` (`ReviewEntrySchema` `schemas/progress.ts:65-72` gains the optional `missedItemIds`; `mergeReview` keeps the higher-star entry per id, `logic/sync/merge.ts:69-73`). `ProgressSummarySchema` gains `stage1Anchor?: { met: boolean; checkedAt: string; tricky: string[] /* symbolKeys */ }`, written by `summarize` from the newest stage-certificate review: `met = symbolsFirstTryCorrect >= 27 && wordsFirstTryCorrect >= 4` (>= 90 % of 30, blueprint 05 §1.4 "4 of 5 words"). `summarize` already emits `stage1.anchorAccuracy` (the average accuracy of completed Stage 1 quests, `summarize.ts:48-49,76`); it stays unchanged, and `stage1Anchor` is a different thing — the verdict of the Hangul Check — so the dashboard must not conflate them. The caregiver dashboard that shows it is F-PAR-001's; this spec only produces the data. Telemetry `review.complete` `{ kind: 'stage-certificate', stageKey, symbolsCorrect, wordsCorrect, retries, stars }` (internal analytics; numbers are allowed here, not on the learner screen).
- **Leaving.** Close -> a one-line confirm ("Stop the check? You can take it again any time.") -> back; nothing is saved and nothing is lost. No session clock, no hearts, no fail state; Challenge mode (D3) is out of scope here.
- **Rollout order of schema.** The server's zod strips unknown keys, so the backend build that knows `missedItemIds` and `stage1Anchor` must deploy **before** the app version that sends them (design input topic-speed-quiz, same rule).
- **Given** a learner takes the check twice, **then** two entries exist; the summary reflects the newest; the older one stays as history.
- **Given** every symbol answered correctly first try but one word item missed, **then** `met` is `true` (4 of 5) and the learner sees 3 stars.

### 3.10 Game: Listen & Pick (catalog ③) — full specification

**Purpose.** Hear a Korean sound, word or line; pick what it means or how it is written. Family Recognition, "listening comprehension" (blueprint 06 §1 ③). In this spec it carries the 2-question Check, five Stage 1 practice steps and the Hangul Check; it is written content-agnostic so F-VOC (voice -> picture format), F-STORY-003 (`pick-picture`) and F-PLC-001 (placement listening items) reuse the rounds, builder and component.

**Data** (`packages/content-schema/src/schemas/minigame.ts`, 100 % covered; `RoundSchema` gains `{ kind: 'listen-pick', data: ListenPickRoundSchema }`):

```ts
export const ListenPickOptionSchema = z.object({
  id: z.string(),
  text: KoTextSchema.optional(),                 // a written option: Korean + romanization + gloss
  pictureRef: PictureRefSchema.optional(),       // a picture option
  labelEn: z.string().max(40).optional(),        // visible label under a picture and its accessible name
}).refine((o) => Boolean(o.text) || Boolean(o.pictureRef), 'an option needs text or a picture');
export const ListenPickRoundSchema = z.object({
  id: z.string(),
  prompt: KoTextSchema,                          // spoken: prompt.spokenKo ?? prompt.ko (or audioRef)
  options: z.array(ListenPickOptionSchema).min(2).max(4),
  answerId: z.string(),
}).superRefine(/* option ids unique; answerId is one of them; no two options share text.ko or pictureRef */);
```

`MinigameScope.listenPick?: { rounds: ListenPickRound[] }`; `logic/minigame-config.ts` helpers `lp.sym(jamoId, taughtIds)`, `lp.syl(syllable, distractors)`, `lp.word(word, distractors)`, `lp.pic(word, pictureRefs)` build rounds from ids (options from the confusable table, §3.9) so scopes stay short. `logic/listen-pick.ts` (pure): `shuffleOptions(round, seed)` (deterministic, answer never always first), `roundCount(scope)`, `distractorsFor(...)`.

**Round behaviour** (`screens/minigames/ListenPickGame.tsx`, props `{ scope, host: MinigameHost }`):

- **Given** round 1 opens, **then** the prompt is *not* auto-played (first audio needs a gesture, AUD-06): a large speaker button pulses once (static under reduced motion). **Given** round 2 and later, **then** the prompt plays on open (the gesture chain is established); a failed autoplay is silent, not an error.
- The prompt zone shows the speaker button (>= `touchTarget.hero`), "Hear it again" (unlimited — deliberately not the catalog's "3 times", because device voices fail and a screen-reader user may need several plays; decision L5), and nothing that gives the answer away: no English gloss until the round resolves.
- **Options** are `ChoiceCard`s (F-STORY-003 §3.4): text options show Korean (`KoreanText`) with romanization (unless `romanizationMode === 'tap'`, D2); picture options show the art (`PictureArt`, §3.11) and `labelEn`. 2 columns for pictures and for <= 8-glyph text, 1 column otherwise or when width < 340 dp; order shuffled per mount.
- **Given** a tap on a wrong option, **then** (first touch within 50 ms only, F-001 §3.4) that option turns amber (`feedback.nudge`, never `danger`) with a non-colour mark and stays locked, Hoya `thinking` says "Listen again", the prompt replays after 800 ms unless the learner acts first (F-001 §3.2), the round does **not** end, and `host.answer(roundIdx, false)` is reported (scored once, first answer only). **Given** a second wrong tap in the same round, **then** the correct option gets a hint ring ("look here").
- **Given** the correct option is tapped (first or later), **then** it turns green with a check mark, `host.answer(roundIdx, true)` is reported (a retry if this is not the first answer), the prompt's `en` gloss and romanization appear, the prompt plays once more, and after 700 ms the next round opens; after the last round `host.complete()` runs.
- **Audio unavailable or muted** (`playPrompt` resolves `unavailable` / `muted`, §3.12): the prompt zone shows the prompt as text — Korean, romanization, no gloss — and a one-line "No sound? Read it here." The round scores normally (F-001 §3.3; D6 text fallback).
- Check header variant (`host.mode === 'check'`): two fill-only dots instead of "n / N", title "Quick check". `review` mode (Hangul Check): chunk dots, no per-item feedback text beyond the amber nudge / green check, no hint ring.
- **Empty / bad data.** A scope with < 1 valid round renders "Nothing to play here" with a Back button (never a dead end); a round whose `answerId` is not in its options is skipped and the content test fails (§5).
- **Stage variants without code change:** Stage 2 word -> picture; Stage 3 `prompt` = a short sentence, options = pictures that differ in subject or object; Stage 4 `prompt` = one line of dialogue, options = situation pictures; Stage 5+ `prompt` = a short passage (replay matters), options = summary pictures or sentences.
- Telemetry: `minigame.finished` (existing) with `{ kind: 'listen-pick', questId, stepIndex }`; per-round detail stays in the run store (`correct`, `retries`).

### 3.11 Game: Pic-Word Match (catalog ②) — full specification

**Purpose.** Pair 3-5 pictures with their Korean words. Family Recognition, vocabulary. It supersedes Card Match for new content (Card Match stays for the Stage 2 / Stage 4 taste quests, F-011 / F-012, until they are migrated; its component and scope kind are untouched). Used by Stage 1 quests 4, 10, 13, 14 and by F-VOC.

**Data** (`schemas/minigame.ts`; `RoundSchema` gains `{ kind: 'pic-word-match', data: PicWordRoundSchema }`):

```ts
export const PicWordPairSchema = z.object({ id: z.string(), pictureRef: PictureRefSchema.optional(), word: KoTextSchema });
export const PicWordRoundSchema = z.object({ pairs: z.array(PicWordPairSchema).min(3).max(5) })
  .superRefine(/* pair ids, word.ko and pictureRef unique within a board */);
```

`MinigameScope.picWord?: { boards: PicWordRound[] }`; `rounds` = number of boards (Stage 1: 1 board, 4 pairs -> 4 scored rounds).

**Picture resolution** (`screens/minigames/PictureArt.tsx`, one place for all games): `card:<id>` -> `HeritageCardArt` when the id is in `supportedCardIds` (`packages/design-system/src/components/HeritageCardArt/HeritageCardArt.tsx:21-57`); `word:<id>` -> `WordArt` once F-VOC ships (D7: hand-authored SVG, tokens only, no emoji, no raster); `swatch:<token>` -> a colour chip from `colors.*`. **Unresolved or absent -> the tile shows the pair's English gloss** in a plain card (the board then plays like Card Match) — never a blank tile. All art is SVG from the design system (D7); this spec adds none.

**Board behaviour** (`screens/minigames/PicWordMatchGame.tsx`, props `{ scope, host }`):

- Two columns: pictures (left, shuffled) and words (right, shuffled independently, never aligned with their pictures). Words show Korean + romanization; the gloss is **hidden until the pair is matched** (it would give the answer away), then appears under the word. Tiles >= `touchTarget.min` tall, 8 dp apart.
- **Pairing is tap-tap**: tap a picture then a word, or a word then a picture; tapping the selected tile again clears it. Drag-to-draw-a-line (the catalog's gesture) is not v1 (accessibility, no gesture-handler dependency); see §4.
- **Given** a correct pair, **then** both tiles lock with the same number badge and a check mark (never colour alone), the word is spoken (`playPrompt`, §3.12) and its gloss appears; **given** a wrong pair, **then** the tapped word turns amber and clears after 600 ms, Hoya `thinking`, the picture stays selected, nothing ends.
- **Scoring.** One scored round per pair, keyed `b<board>:<pairId>` where `pairId` is the id of the **first tile the learner selected** for that attempt (a wrong second tile does not score the pair it was mistakenly tapped against); first answer scores, later ones are retries (`logic/first-try.ts:24-34`, the same convention as Card Match's `pairRoundKey`, `logic/round-keys.ts:9-11`). After a pair's second wrong attempt its right partner gets a hint ring; the pair still resolves only when matched.
- A board ends when all pairs are matched (700 ms), then the next board or `host.complete()`. **Skip** (ghost) is available after the first answer, as the other games (`CardMatchGame.tsx` pattern), and calls `host.complete()` without marking unmatched pairs.
- **Layout.** Portrait: two columns; at 5 pairs and 320 x 568 the board scrolls rather than shrinking tiles below 64 dp; landscape: same two columns with a smaller picture. `Screen scrollable` (audit L4).
- **Accessibility.** Each tile is a button with a label (pictures: `labelEn` / gloss; words: `KoreanText` label); selection state is announced ("Picture selected: kimchi. Choose a word."); order = pictures top to bottom, then words.
- **Empty / bad data.** < 3 valid pairs -> "Nothing to play here" + Back. Telemetry: `minigame.finished` `{ kind: 'pic-word-match', ... }`.

### 3.12 Contracts shared by the new games

**MinigameHost** (`apps/mobile/src/screens/minigames/host.ts`; if F-VOC-001's PR 1 added it first, reuse its file and these member names):

```ts
export type HostMode = 'quest' | 'check' | 'review' | 'vocab' | 'preview';
export interface MinigameHost {
  mode: HostMode;
  answer(roundKey: string | number, correct: boolean, meta?: { itemId?: string }): void; // first answer per key scores
  complete(): void;                                                                         // quest: markStepComplete() then close
}
```
`MinigameScreen` builds the quest host: `answer` -> `useQuestRunStore.getState().answerRound` (`store/quest-run-store.ts:55-68`), `complete` -> `markStepComplete(); close()` (as `MatchSoundGame.tsx:77-79`); `mode` is `'check'` when the step kind is `check`. `StageReviewScreen` builds a review host over `review-run-store`. **The nine existing games keep their direct store calls** (no refactor in this spec); only Listen & Pick and Pic-Word Match take a host.

**Prompt audio** (`platform/audio.ts`; owner F-AUDIO-004, which keeps this signature):

```ts
export type PlayResult = 'played' | 'muted' | 'unavailable';
export function playPrompt(spec: { text: string; audioRef?: string; language?: 'ko-KR' | 'en-US' }): Promise<PlayResult>;
```
`text` is `item.spokenKo ?? item.ko`; for a symbol it is `jamo.spokenKo` (consonant spoken as a sound with a carrier vowel, batchim as a short closed syllable such as 악 안 알 암 압 앙; D6, audit F01 / AUD-08), **not** the letter name. If F-AUDIO-004's data is not in yet, Q-3a adds `logic/stage1/spoken.ts` with the interim map (consonant + ㅏ carrier: 가 나 다 라 마 바 사 자 차 카 타 파 하; **initial ㅇ by its name 이응**, because 아 is the same audio as the vowel ㅏ and the two could not be told apart by ear — F-AUDIO-004 AD2, `spokenKind: 'name'`; vowels as their ㅇ-syllables 아 야 어 여 오 요 우 유 으 이; batchim as above) used only when `spokenKo` is absent; F-AUDIO-004 PR A-2 replaces the interim file by data on `JamoSchema` (`spokenKo`, `spokenRomanization`, `spokenKind`, `nameKo`; read through its `spokenFor()`): the values are the same, the shape is not, and the one value that differs is ㅇ (이응). If F-AUDIO-004 has not added `playPrompt`, Q-3a adds a thin one: `muted` when `isMuted()` (`platform/audio.ts:15-17`), `unavailable` when the speech engine reports an error or no voice exists, else `played` on `onDone`. **Code fact**: `speak()` currently wires `onDone`, `onStopped` **and** `onError` to the same `opts.onDone` (`platform/audio.ts:36-38`), so a failure is indistinguishable from a normal end; the shim therefore adds an optional `onError?: () => void` to `SpeakOptions` (`audio.ts:19-24`, existing callers unchanged) and routes `Speech.speak`'s `onError` to it. `SpeakOptions.language` is `'ko-KR' | 'en-US'` today; widening it to the UI-locale tags (`es-US`) is F-AUDIO-004's change. `audioRef` wins over TTS when a recording exists (D6, owner task T-017).

### 3.13 Telemetry (added to `TELEMETRY_EVENT_NAMES`, `packages/content-schema/src/schemas/telemetry.ts:9-33`, so the API whitelist and `track()` stay one list)

| Name | Payload | When |
|---|---|---|
| `quest.discover_completed` | `{ questId, pages, heard }` | Continue on the last Discover page |
| `quest.check_completed` | `{ questId, firstTryCorrect, retries }` | after the Check's 2nd round |
| `quest.teaser_tapped` | `{ fromQuestId, toQuestId }` | "Play next quest" |
| `stage.complete` | `{ stageKey, cardsAwarded }` | once, when `stageJustCompleted` |
| `review.start` | `{ kind: 'stage-certificate', stageKey, hideRomanization }` | Hangul Check begins |
| `review.complete` | `{ kind, stageKey, symbolsCorrect, wordsCorrect, retries, stars }` | Hangul Check ends (numbers are internal; never on a learner screen) |

`quest.complete` / `card.unlocked` / `card.first_earned` / `minigame.finished` are unchanged. No event carries a name or free text; `profileId` rides in the existing field.

### 3.14 Accessibility, layout, offline, errors (all new surfaces)

- **Targets and type.** Every tappable >= `touchTarget.min` (64); option cards and Hear buttons >= `touchTarget.child` (80); symbol glyphs at `touchTarget.hero`-scale type; body text >= 18 (CLAUDE.md §1). Tokens only; no emoji; no raster; new art is SVG in the design system (D7). The literal `'#B5862A'` in `Tile.tsx:23` is not copied; new components use `ChoiceCard` and `colors.*`.
- **Screen readers.** Taught Korean is read with a Korean language tag (`KoreanText`, F-I18N-001 §3.5); a symbol is announced as its romanization and gloss ("Korean letter ng, as in sing"), never as the glyph alone and never "empty set" for ㅇ. Feedback is a polite live region. When a round advances, focus moves to the prompt button. VoiceOver / TalkBack never get the answer from a label before the round resolves (picture options excepted: their label is the gloss).
- **Small and large screens.** Works at 320 x 568, landscape phones and 200 % text: the step body scrolls and the primary button stays reachable (sticky); verified against F-LAYOUT-001 once it ships (audit L1-L4).
- **Reduced motion.** Pulses, slides and the pair-lock animation are replaced by instant state changes (`useReducedMotion`, `platform/motion.ts`).
- **Offline.** Everything is bundled content; speech needs a local voice. No voice -> text fallback (§3.2, §3.10, §3.11), never an error. A Stage 1 quest plays fully offline for learners with a Korean voice; the web landing claim about offline Stage 1 stays F-AUDIO-004's to word.
- **Error and empty states**, one line each and always a way out: unknown quest ("Quest not found", existing `QuestPlayerScreen.tsx:102-110`), empty Discover, empty Listen & Pick / Pic-Word scope, unreadable picture (text tile), audio failure (text prompt), review leave confirm.
- **Tone (D1, D3).** Plain Pre-A1 English; no age words, no "kids"; Hoya warm, never babyish; wrong = amber + `thinking`; no red; no combo or streak resets; no numbers on learner result screens; a missed day is never mentioned.

### 3.15 Gating and "Premium" (D5)

Stage 1 is the intended free set (`isFreeContent('stage', 'stage1')`, F-STORY-004 §3.9) and is already free (`entitlement.ts:16`). This spec adds **no** gating: the Discover and Check steps, both games, the ceremony and the Hangul Check are free; it draws no lock and no "Premium" pill; the teaser only offers quests in stages `isStageEntitled` allows (§3.5); the existing Journey "Premium" pill for later stages is unchanged (`JourneyScreen.tsx:100`). Nothing here reads a flag that is switched off.

## 4. Out of scope, and the follow-up game specs

**Out of scope here** (each has an owner or a later spec):

- Recorded audio and the capability check / spoken-form decisions (F-AUDIO-004, owner task T-017); this spec only consumes `playPrompt` and `spokenKo`.
- `WordArt` and the vocabulary decks (F-VOC-001..005): `word:*` pictures resolve there; Stage 1 uses `card:*` art only.
- The generic `unlockedBy` award engine, the episode-completion banner and the story shelf rewards (F-STORY-006, F-STORY-004); this spec defines *which* Stage 1 cards and *when*.
- Per-item mastery ledger, daily test pools and spaced repetition (F-RVW-001 Daily Test, F-VOC SRS); the Hangul Check stores one review entry, not item history.
- The caregiver view of `stage1Anchor` (F-PAR-001), a PDF / shareable certificate (blueprint 04 §4.4, F-CARD-003 family), Challenge mode (D3), placement (F-PLC-001, which reuses the Listen & Pick rounds and builder).
- Adopting Discover / Check in the Stage 2 / Stage 4 taste quests (F-011, F-012) and migrating Card Match to Pic-Word Match there.
- Heritage-pillar episodes from blueprint 04 (훈민정음, 팔만대장경, 실록, 김홍도, 측우기) and pillar companion characters: D9 makes the 7 x 5 theme-key grid the authority; the pillar sub-themes become tags in a later content spec.
- Drag-to-draw lines in Pic-Word Match, animated stroke "Show me" inside Discover (the existing `StrokeHint` may be reused later), Hoya line variants (`content/characters/hoya/voice.md`).
- The UX-17 launcher cleanup (auto-start after a Hoya line, one Hoya per screen) and the safe-area work of PR #95 / F-LAYOUT-001; the new screens are built to work with both.

**Remaining catalog games — proposed follow-up specs (ids are proposals; D8 does not reserve them), in priority order:**

| Order | Proposed id | Game (catalog) | Priority | Why that order | Needs first |
|---|---|---|---|---|---|
| 1 | F-GAME-003 | Sentence Builder (⑥) — word tiles into a sentence, trap tile, speaks the finished sentence | **P1** | Stage 3's anchor skill is building subject-verb sentences; the Stage 3 row is "soon" until it exists; cheapest of the four (blueprint 06 §6 production cost 2 of 4; tap-to-place first, drag second); also the substrate of My Story | MinigameHost (§3.12), F-VOC-001 P0 words, tile component (`ChoiceCard`) |
| 2 | F-GAME-004 | Hidden Heritage (⑩) — find the word's object in a large heritage scene | **P2** | The catalog's signature game and the strongest tie of vocabulary to heritage (blueprint 06 §4); needs authored hit regions per scene (blueprint 06 cost 3 of 4) and scene art | F-STORY-002 `StoryScene`, F-VOC `WordArt`, Pic-Word `PictureArt` (§3.11) |
| 3 | F-GAME-005 | Role Play (⑨) — speak or tap through a scenario | **P3** | Stage 4+; needs Voice Echo (STT bench, T-013; `flags.voiceEchoEnabled` is off, `config/flags.ts`) and authored branching scenarios (blueprint 06 cost 4 of 4); MVP is one scenario ("greet Sejong") built on Tap Respond | Voice Echo flag, Tap Respond (exists), F-GAME-003 |
| 4 | F-GAME-006 | My Story (⑫) — retell or compose from word tiles | **P3** | Stage 5-7; free-response evaluation is the hard part (blueprint 06: "MVP workaround — passes if N learned words are used"); builds on F-GAME-003 tiles and F-STORY-003 sequences | F-GAME-003, F-STORY-003, F-VOC word state |

Housekeeping the first of these specs must settle: four `MinigameKindSchema` members have no component and no spec — `match-shape`, `syllable-build`, `tap-rhythm`, `order-it` (`schemas/minigame.ts:18, 22, 25, 26`); implement or remove them so the enum equals the catalog.

## 5. Tests

Coverage lanes (CLAUDE.md §6, `docs/tests/coverage-targets.md`): `packages/content-schema` 100 %; `apps/mobile` business logic (`src/logic/**`, `src/content/**` rules) 90 % rising to 100 % for the files named; `apps/mobile` platform / screens as the existing 70 % lane; `packages/design-system` 85 %. TDD: each PR carries its tests (CLAUDE.md §5).

| File | Level | Coverage focus |
|---|---|---|
| `content-schema/__tests__/quest-discover.test.ts` | unit, 100 % | `discover` / `check` shape rules (§3.1): a `discover` step with a `minigameRef` fails; two `check` steps fail; order rules; `DiscoverPage` > 2 items fails; `teaserEn` length; Stage 2 / 4 quests still parse |
| `content-schema/__tests__/minigame-rounds.test.ts` | unit, 100 % | `ListenPickRoundSchema` (answer in options, unique ids / texts, 2-4 options, option needs text or picture), `PicWordRoundSchema` (3-5 pairs, unique), `RoundSchema` union; `KoTextSchema.syllables` joins to `romanization`; `PictureRefSchema` |
| `content-schema/__tests__/progress-review.test.ts` | unit | `missedItemIds` optional / parses, old entries parse; `stage1Anchor` optional on `ProgressSummary`; telemetry names are in the shared list and the API whitelist |
| `mobile/logic/stage1/__tests__/hangul.test.ts` | unit, 100 % | `decompose` for CV, CVC, ㅇ-initial, unsupported finals; `symbolsOf` ids incl. `jamo:*-batchim`; `symbolKey` |
| `mobile/logic/stage1/__tests__/confusables.test.ts` | unit, 100 % | every one of the 24 keys has 3 same-kind entries; none equals its key; options builder filters to taught symbols and pads to >= 2 |
| `mobile/logic/stage1/__tests__/completion.test.ts` | unit, 100 % | `isStageComplete`, `completionTransition` (before / after), out-of-order completion, a 1-star completion still completes |
| `mobile/logic/__tests__/next-quest.test.ts` | unit, 100 % | cursor = first incomplete; `justCompleted` treated as done; replay of an earlier quest; all done -> undefined; entitlement filter; preview / shelf episodes skipped; Home builder gives the same answer (golden against the old private function) |
| `mobile/logic/__tests__/round-builder.test.ts` (extended) | unit | cyclic prompts (rounds > pool, no immediate repeat, focus ids all present); explicit `jamoIds` for batchim syllables; duplicate-jamo syllable rejected; distractor policy for CVC |
| `mobile/logic/__tests__/listen-pick.test.ts` | unit, 100 % | `shuffleOptions` determinism, answer index not constant over seeds, `lp.*` helpers, picture / text rounds |
| `mobile/logic/stage1/__tests__/hangul-check.test.ts` | unit, 100 % | 35 items: each of the 30 symbols exactly once, 5 words one per theme, 4 options each, no duplicate options, batchim options differ only in the final, chunking 7 x 5, determinism by seed, answer-index distribution (<= 40 % at index 0 over 200 seeds) |
| `mobile/logic/reviews/__tests__/star-calc.test.ts` + `banned-text.test.ts` | unit, 100 % | F-RVW-001 §3.1 tiers and the 1-star floor over 35 items; no `%` / `x/y` / fraction in any learner string of the Hangul Check and ceremony copy modules |
| `mobile/logic/sync/__tests__/summarize.test.ts` (extended) | unit | `questJamo` batchim keys `'ㄴ/final'`; `questsTotal` 15; `stage1Anchor` from the newest review: `met` thresholds (26/30 -> false, 27/30 + 4/5 -> true, 30/30 + 3/5 -> false) |
| `mobile/store/__tests__/review-run-store.test.ts`, `progress-store.test.ts` (ext.) | unit | first-try tally over items; `recordReview` persists, merges by id, idempotent; completion awards idempotent |
| `mobile/content/__tests__/stage1-curriculum.test.ts` | content invariants (the heart of the spec) | **T1** the union of Discover jamo items over the 15 Stage 1 quests is exactly the 30 jamo ids, each once · **T2** per-quest caps: <= 2 consonant-type, <= 2 vowels · **T3** every scope's and every Check option's symbols are taught by that quest or earlier (global order) · **T4** each quest has exactly 6 steps in the order intro, discover, practice, apply, check, reward; Discover <= 3 pages, <= 2 items per page; Check scope has exactly 2 rounds; practice 6, apply 4 rounds · **T5** no repeated `minigameRef` inside a quest; no unreferenced entry in `minigameScopes`; every ref resolves to a scope of the same kind · **T6** every quest passes `QuestSchema` · **T7** every reading word decomposes into taught symbols (`hangul.ts`), and its `romanization` equals `syllables.join('')` when present · **T8** romanization strings are lower-case Latin, unhyphenated (and pass F-CNT-002's checker when it lands) · **T9** every quest `rewardCardId` exists and belongs to its episode's `rewardCardIds`; every card in an episode list has `unlockedBy === episode.id`; the union of quest rewards, episode extras, `stage1-complete` and `first-launch` cards is exactly the 30 Stage 1 cards · **T10** `estimatedMinutes` equals `round(sum(durationSeconds) / 60)` within 1 · **T11** no Hangul in any `*En` field |
| `mobile/content/__tests__/content-integrity.test.ts` (extended) | content | existing checks stay green (they cover refs, build-letter chars, selection pools); `selection-style scopes carry enough jamo` also covers `listen-pick` / `pic-word-match` |
| `web/src/data/__tests__/stage1-catalog-parity.test.ts` | content | the web mirror equals the mobile content (ids, titles, minutes, episode membership) |
| `mobile/logic/stage1/__tests__/discover-flow.test.ts` | unit, 100 % | pure view-model behind `DiscoverStep`: pages advance and the last page reports `{ pages, heard }`; Hear it maps `PlayResult` to "heard" mark or the text line; Continue is always enabled; `romanizationMode: 'tap'` hides the example's romanization only (never the symbol's, never the gloss); an unresolvable item is skipped without a dead end |
| `mobile/logic/__tests__/listen-pick-flow.test.ts` | unit, 100 % | reducer behind `ListenPickGame`: no autoplay on round 1, autoplay from round 2; first tap within 50 ms only; wrong tap locks the option, schedules the 800 ms replay effect, hint ring after the second wrong; one scored answer per round (`host.answer` keys), later answers are retries; text fallback when `playPrompt` is `unavailable`/`muted`; empty scope |
| `mobile/logic/__tests__/pic-word-flow.test.ts` | unit, 100 % | reducer behind `PicWordMatchGame`: tap-tap pairing in both orders, selection clears on re-tap; gloss hidden until matched; scoring key is the first-selected tile's pair; hint after two wrong; picture fallback to the gloss; board completes and calls `host.complete()` |
| `mobile/logic/__tests__/quest-flow.test.ts` | unit, 100 % | `logic/quest-flow/` view-models: the Check launcher has no Skip and says "Two quick ones"; step labels; the Results teaser ("Play next quest", or "Try this one again" when `total === 0`), stage-complete CTA and the ghost demotion of Back home / Episode page |
| `mobile/logic/stage1/__tests__/review-flow.test.ts` | unit, 100 % | reducer behind `StageReviewScreen`: 35 items in 5 chunks of 7, leave confirm, stars-only result copy (banned-text scan), tip chips route to `teachingQuestFor`; symbol wall "all lit" view-model has no numbers |
| *Why no component tests* | note | `apps/mobile/vitest.config.ts:19-25` includes only `src/{logic,store,content,config,platform}/**/*.test.ts` in a `node` environment (RN component tests are a Detox/Playwright concern); so every behaviour above is a pure module under `logic/`, the screens stay thin, and the rendering is proven by the Playwright rows below |
| Integration (vitest, in-memory stores) | integration | simulate 15 quests (mixed 1-3 stars) -> 15 + 11 + 3 cards, `stage.complete` once, replay idempotent; Hangul Check twice -> two entries, summary uses newest; cold start mid-quest-run discards the run (existing behaviour) |
| E2E (Playwright, nightly) `apps/mobile/e2e/web/discover-check.spec.ts`, `stage1-complete.spec.ts` | e2e | web PWA: cold start -> quest 1 -> Discover (Hear it with a stubbed voice) -> practice -> build -> Check -> Results teaser -> "Play next quest"; one run with speech disabled to prove the text fallback; seeded 14-of-15 profile -> last quest -> ceremony -> Hangul Check (35 items) |

Manual QA before ship: VoiceOver and TalkBack on one Discover page, one Listen & Pick round and one Pic-Word board; 320 x 568 and landscape; 200 % text; offline with no Korean voice; reduced motion; a native Korean speaker reads Appendix A and the 60 reading / theme words (their sound and their Revised Romanization).

## 6. Rollout

Behind no flag: Stage 1 content is replaced in place. The feature set is additive in the schema (every new field optional), so an older client that receives a newer snapshot parses it (zod strips unknown keys, `schemas/progress.ts`); a **newer client must not send** `missedItemIds` / `stage1Anchor` before the backend that knows them is deployed (PR Q-10a/Q-10b).

| PR | Type | Content | Depends on |
|---|---|---|---|
| Q-1 | `feat(content-schema)` | `KoText` (`schemas/ko-text.ts`, full field set, §3.1), `PictureRef`, step kinds `discover` / `check`, `DiscoverSchema`, `QuestSchema.superRefine`, `teaserEn`, `listen-pick` / `pic-word-match` kinds and round schemas, `JamoSchema.soundHint`, `ReviewEntry.missedItemIds`, `ProgressSummary.stage1Anchor`, telemetry names; fixtures `listen-pick.valid / invalid`, `pic-word-match.valid / invalid`; 100 % tests | - |
| Q-2 | `feat(mobile)` | `logic/stage1/{hangul,confusables,curriculum,completion}.ts`, `logic/next-quest.ts` (+ Home builder uses it), `round-builder` changes (cyclic prompts), `quest-steps` labels | Q-1 |
| Q-3a | `feat(mobile)` | `MinigameHost`, `playPrompt` shim + `logic/stage1/spoken.ts` interim map (registered with F-CNT-002), `logic/listen-pick.ts`, scope builders `lp.*` / `pw`, `PictureArt` | Q-1, Q-2 |
| Q-3b | `feat(mobile)` | `ListenPickGame`, `MinigameScreen` cases | Q-3a, F-STORY-003 PR 3.3 (`ChoiceCard`), F-I18N-001 PR 4 (`KoreanText`) |
| Q-4 | `feat(mobile)` | `PicWordMatchGame` | Q-3a, F-STORY-003 PR 3.3 |
| Q-5a | `feat(mobile)` | `SyllableBlock` (design-system), `DiscoverStep`, `QuestPlayerScreen` discover / check branches and the Check launcher variant, `quest.discover_completed` / `quest.check_completed` | Q-2, Q-3b, F-I18N-001 PR 4 |
| Q-5b | `feat(mobile)` | Results teaser ("Next up", "Play next quest"), `EpisodeDetailScreen` soft prerequisite, `quest.teaser_tapped` | Q-2 |
| Q-6a | `content(stage1)` | quests 1-3 (letters), `soundHint` x 30, their scopes, web catalog mirror + parity test (partial list allowed until Q-8), T2-T11 live, T1 `runIf` all 15 present | Q-5a |
| Q-6b | `content(stage1)` | quests 4-6 (life) incl. the first Pic-Word board | Q-4, Q-6a |
| Q-7a | `feat(mobile)` | `BuildLetterGame` batchim tiles / block-shape hint and `round-builder` explicit `jamoIds` (needed by quests 7-9, 11-13, 15) | Q-2 |
| Q-7b | `content(stage1)` | quests 7-9 (rites) incl. the `hoyaLineKo` intro | Q-6b, Q-7a, F-CNT-002 PR 2a/2b |
| Q-8 | `content(stage1)` | quests 10-15 (nature, crafts), `episodes.ts` metadata, `sync-context`, T1 live, web mirror complete | Q-7b |
| Q-9 | `feat(mobile)` | completion transition, awards call (F-STORY-006 engine), `StageCompleteScreen` (primary action **See my cards** until Q-10b adds the Hangul Check button), Journey "Complete" pill, `stage.complete` | Q-8, F-STORY-006 |
| Q-10a | `feat(backend)` | `ReviewEntrySchema.missedItemIds` and `ProgressSummary.stage1Anchor` accepted by the Worker; **deploy before Q-10b** | Q-1 |
| Q-10b | `feat(mobile)` | `review-run-store`, `hangul-check` (registered with F-CNT-002), `StageReviewScreen`, `recordReview`, `stage1Anchor` in `summarize`, `review.start` / `review.complete`, the Hangul Check buttons on the ceremony and the Journey header. Depends on Q-8 (all 30 symbols taught), **not** on Q-9's engine | Q-8, Q-10a deployed |
| Q-11 | `docs` | promote the wireframes to `design/wireframes/`; amend F-RVW-001 §3.3 (no Feedback Review when a Check exists), §3.4 (Stage 1 = 35 items) and its `stage_anchor_accuracy` event (replaced by `review.complete` + `stage1Anchor`), content-skill §3.1 (Discover / Check as real step kinds), blueprint 05 §1.3 (assigns ㅑ ㅕ ㅛ ㅠ and the batchim quests), F-PLAN-001 §3.5 catalog note; CLAUDE.md §2 needs no edit from this spec (F-I18N-001 PR 0 lists the new `content/` directories) | Q-10b |

Beta: one family playtest of quests 1-3 (Discover + Check feel, 4-5 minute claim) and one of the Hangul Check before the content PRs Q-7b+ are merged; the audit's hallway-test protocol (`docs/launch/hallway-test-protocol.md`) is the checklist.

## 7. Dependencies

**Upstream (must be in, or taken with the stated fallback):**

- **PR #94** first-try scoring — merged (`5841dcf`): `answerRound`, `tallyAnswer`, `applyQuestResult`.
- **F-STORY-003** owns `ChoiceCard` (its PR 3.3); Q-3b depends on it — this spec does not create a second copy; **F-STORY-004** `content-access.ts` / grid selectors (this spec only calls `isStageEntitled`, which F-STORY-004 re-routes without behaviour change); **F-STORY-006** the `unlockedBy` award engine (Q-9 is the only PR blocked on it; the interface needed is "given episodes just completed and stage just completed, return cards to award", §3.8).
- **F-AUDIO-004** `playPrompt` + `spokenKo` (interim map in Q-3a if late); **F-I18N-001** `KoreanText` (its PR 4, which depends only on its PR 0; Q-5a depends on it), `romanizationShown` and `romanizationMode` (its PR 1-3; interim constant `'always'`), message catalog (until then one English copy module, `logic/quest-flow/copy.ts`); **F-CNT-002** romanization rules, `hoyaLineKo` (its PR 2a/2b; Q-7b) and the coverage registry: the new Hangul-bearing files of Q-2/Q-3a/Q-10 (`logic/stage1/spoken.ts`, `hangul-check.ts`) must be registered in F-CNT-002's coverage list in the same PR.
- **F-RVW-001** star math and banned-text scan (Q-10b builds the minimal engine files named in §3.5 of that spec if absent; F-RVW-001 extends them).
- Soft: PR #95 / F-LAYOUT-001 (safe areas), F-VOC-001 (`MinigameHost`, `WordArt`).

**Downstream (unblocked by this spec):** F-VOC-001..005 (Listen & Pick, Pic-Word Match, host), F-STORY-003 pick-picture options, F-PLC-001 (placement listening items and the symbol bank), F-RVW-001 Daily Test (symbol item ids, `stage-certificate` entries), F-PLAN-002 (the curriculum planner now has 15 Stage 1 quests / about 65 minutes instead of 8 / about 38), F-TCH-004 / lecture mode (Discover pages as slides), F-GAME-003..006.

**External:** native-speaker review of Appendix A, the reading / theme words and their romanization; recorded audio (T-017) is optional.

## 8. Decisions

Binding owner decisions (not re-opened) and how this spec applies them:

| Id | Applied as |
|---|---|
| D1 anyone, any age | No age words anywhere; plain Pre-A1 English; Hoya warm not babyish; no level-dependent behaviour (the learner level is not read by this spec); tap targets stay large for everyone |
| D2 locales and romanization | All UI strings in one catalog-ready module; taught Korean always `KoreanText` with romanization + gloss; "hide until tap" only when the learner / teacher opted in (`romanizationMode`), never hiding the gloss; the Hangul Check's per-attempt switch is that opt-in |
| D3 anti-shame loosened | Amber nudge + `thinking` on a miss; fill-only dots / symbol wall; no resets; no numbers or percents on learner screens; no timer (Relaxed); nothing earned is removed |
| D4 content source | **Deviation, stated openly**: Stage 1 quests, scopes and jamo stay authored in TypeScript (`apps/mobile/src/content/*.ts`, `logic/minigame-config.ts`) in this spec, with every Korean string in `{ ko, romanization, en }` shape. D4's acceptance bar — "the validator scans the SHIPPED content" — is met by F-CNT-002 class B, which reads those TS arrays directly (no JSON export is needed to validate them). Moving Stage 1 to JSON under `content/` plus a generated TS module belongs to the F-STORY-001 pipeline and would change location, not content; it is not part of this spec |
| D5 no new gating | §3.15 |
| D6 audio | `playPrompt`, `spokenKo` (sounds, not names), `audioRef` wins, visible text fallback |
| D7 visuals | `card:*` SVG art, `SyllableBlock` SVG-style views, tokens only, no emoji / raster / external assets |
| D8 ids | F-QUEST-002; follow-ups use proposed `F-GAME-003..006` |
| D9 grid authority | Stage 1 = 5 theme episodes x 3 quests; ids kept; episode awards and `stage1-complete` honoured; blueprint pillar episodes become tags later |
| D10 placement | Not built here; the symbol bank, confusables and Listen & Pick are the reusable parts |
| D13 romanization | Revised Romanization, unhyphenated, pronunciation-based; hyphens only as `syllables` split in the teaching UI |
| D14 heritage content | No heritage facts are added; card facts are untouched here |
| D11, D12 | Not applicable (curriculum planner and lecture mode consume this spec's quest list) |

Decisions made in this spec:

| Id | Decision | Why |
|---|---|---|
| L1 | Stage 1 quest = 6 steps: intro, discover, practice, apply, check, reward; `discover` replaces `present` for Stage 1 | Blueprint 04 §3.4 / content-skill §3.1 pattern; `present` stays valid for Stages 2 / 4 |
| L2 | Discover is unscored and never gates; Check is scored (first-try), 2 rounds, no Skip | The Check is the only decode evidence; teaching must not feel like a test |
| L3 | 15 quests = 10 that teach (30 symbols, <= 4 per quest) + 5 that consolidate by reading | Meets the anchor and the "teach once" rule while keeping cultural episodes |
| L4 | Keep the 8 shipped quest ids; re-scope three (letters q1-q3) and rebuild five; add 7 ids; no data migration | No loss of learner progress, plans or homework |
| L5 | Unlimited audio replay in Listen & Pick (catalog says 3) | Unreliable device voices, accessibility |
| L6 | The Hangul Check never gates, always gives >= 1 star, shows no number; the 90 % anchor verdict is caregiver-only | D3, D5, F-RVW-001 §3.1 |
| L7 | The teaser is the real cursor, not "the next in the episode" | Home and Results agree |
| L8 | Stage 1 complete = 15 quests completed at any stars; stage / episode awards are not star-gated | A hard first-try round must not block the prize |
| L9 | Soft prerequisite sheet, never a lock | D3; heritage families may start anywhere |
| L10 | Pictures are `PictureRef`s that fall back to the gloss; Stage 1 uses card art only | D7, no new art |
| L11 | New games take a `MinigameHost`; existing games are not refactored here | Smallest change that unblocks vocab / story / placement |
| L12 | Tap-tap pairing in Pic-Word Match, drag deferred | Accessibility, no gesture dependency |
| L13 | A Check replaces F-RVW-001 §3.3's Feedback Review for that quest | One recall per quest, not two |
| L14 | Follow-up game spec ids and order (Sentence Builder, Hidden Heritage, Role Play, My Story) | §4 |

## 9. Unverified assumptions and open items

1. **Pedagogy and wording are drafts.** Appendix A sound hints, the choice of 60 reading words, the 4-5 minute estimate (blueprint says 3-4) and the "twin sounds" framing for ㅋ ㅌ ㅍ are authored here without a native review or a playtest. Romanization values follow D13 / F-CNT-002 by hand and were **not** run through the `rr.py` converter.
2. **Interim spoken forms** (`logic/stage1/spoken.ts`) assume a consonant + ㅏ carrier is acceptable for isolated sounds; **Closed by F-AUDIO-004 (review 2):** the carrier is ㅏ (AD2) and initial ㅇ is spoken by its name. Until recordings exist TTS quality varies (audit F09).
3. **Cross-spec contracts not yet implemented in code:** F-STORY-003 `ChoiceCard`, F-STORY-006's award engine, F-AUDIO-004 `playPrompt` / `spokenKo`, F-I18N-001 `KoreanText` / `romanizationShown`, a shared `MinigameHost`. This spec names the member shapes it needs; if a sibling spec lands different names the Q-PRs adapt, not the behaviour.
4. **`HeritageCardArt` as a vocabulary picture** (stylised card art for 산, 달, 연, 팽이 ...) has not been tested for recognisability at 96 dp on a 320 px screen; the gloss label under each option is the safety net.
5. **expo-speech error reporting** on web / iOS is the basis of `unavailable`; if it does not fire reliably the text prompt would show only when muted. F-AUDIO-004's capability check is the better signal.
6. **Quest content stays in `apps/mobile/src/content/*.ts`** (see the D4 row in §8). If the owner wants Stage 1 JSON-first now, Q-6a..Q-8 change location, not content; F-CNT-002 would then scan the JSON as class A instead of class B1.
7. **`mergeQuest` keeps the higher stars on sync, a replay overwrites locally** (`progress-store.ts:196-198` vs `merge.ts:34-41`): not changed here; completion (the only thing Stage 1 completion reads) is unaffected.
8. **Planner and homework numbers** quoted in other specs (11 playable quests, about 52 minutes) become 18 playable quests / about 79 minutes when Stage 1 is 15 quests (65 + the two Stage 2 quests + one Stage 4 quest); F-PLAN-002 should re-read the catalog rather than hard-code.
9. **Hangul decomposition** supports only the 14 consonants, 10 vowels and 6 batchim; any reading word needing a double consonant, compound vowel or other final fails test T7 by design (so none is authored).
10. **Dead enum kinds** (`match-shape`, `syllable-build`, `tap-rhythm`, `order-it`) are left as they are; removing them is F-GAME-003's call.

## Appendix A — draft `soundHint` copy (English base; native and pedagogical review required; es / ko come from F-I18N-001 overlays)

Wording rule: no "voiced English" claims for the soft stops (audit F15): ㄱ ㄷ ㅂ ㅈ are "soft and light", ㅋ ㅌ ㅍ ㅊ are "with a puff of air".

| Symbol | Romanization | Hint | Symbol | Romanization | Hint |
|---|---|---|---|---|---|
| ㄱ | g/k | a soft, light g (between g and k) | ㅏ | a | like the a in "father" |
| ㄴ | n | like n in "nose" | ㅑ | ya | like "ya" in "yacht" |
| ㄷ | d/t | a soft, light d (between d and t) | ㅓ | eo | like the u in "cup", mouth wide open |
| ㄹ | r/l | a quick tap of the tongue, between r and l | ㅕ | yeo | like "yu" in "young" |
| ㅁ | m | like m in "moon" | ㅗ | o | like the o in "go", lips round |
| ㅂ | b/p | a soft, light b (between b and p) | ㅛ | yo | like "yo" in "yoga" |
| ㅅ | s | like s in "sun" | ㅜ | u | like "oo" in "moon" |
| ㅇ | silent/ng | silent at the start of a block; "ng" in "sing" at the end | ㅠ | yu | like "you" |
| ㅈ | j | a soft, light j | ㅡ | eu | say "oo" with flat lips |
| ㅊ | ch | like ch in "chair", with a puff of air | ㅣ | i | like "ee" in "see" |
| ㅋ | k | like k in "kite", with a puff of air | final ㄴ | n | ends like n in "sun" |
| ㅌ | t | like t in "top", with a puff of air | final ㄹ | l | ends like l in "ball" |
| ㅍ | p | like p in "pie", with a puff of air | final ㅁ | m | ends like m in "ham" |
| ㅎ | h | like h in "hat" | final ㅇ | ng | ends like ng in "sing" |
| | | | final ㄱ | k | a short, closed k (like "book" cut off) |
| | | | final ㅂ | p | a short, closed p (like "cup" cut off) |
