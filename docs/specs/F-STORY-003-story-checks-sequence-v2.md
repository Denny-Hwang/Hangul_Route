Status: ready

# F-STORY-003 — Story checks, Story Order v2, word recap and the story reward flow

> **Start order (review 2, 2026-10-10)**: the blocker of review 1 is gone: F-STORY-001 (schema) and F-STORY-002 (reader) are specs now, and every name this spec uses from them was checked against their text (`Tier.checks`, `sequenceSceneIds`, `newKeywordIds`, `scene.captionEn`, `StoryScope`, the `story-read` ref grammar, `StoryReader` params). `StoryCheckSchema` is **implemented by F-STORY-001 PR 1.1a** from §3.1 below (so PR 3.1 here shrinks to the minigame kind, telemetry names and tests). **Startable now, independent of the story chain**: PR 3.3 (`ChoiceCard`, after F-I18N-001 PR 4), 3.5a (Story Order v2 on the legacy scopes, after F-CNT-002 PR 2a), 3.6 (monotonic stars), 3.8 (validator fields). PRs 3.2b-3.7 follow F-STORY-001 PR 1.1a/1.1b and F-STORY-002 PR 2.6.

**Scope**: `packages/content-schema` (check schema, `story-check` kind, telemetry names) · `apps/mobile` (`logic/story/`, `screens/minigames/`, `screens/results/`, `store/progress-store`, `logic/minigame-config`) · `packages/design-system` (`ChoiceCard`) · `scripts/validate-content.mjs`
**Owner**: solo dev
**Rollout**: Story mode phase 1, after F-STORY-001 (schema) and F-STORY-002 (reader). PR order in §6.
**Wireframes**: `design/wireframes/story/check.md` · `story/sequence.md` · `story/word-recap.md` · `results/celebrate-story.md` — drafted in one file, `wireframes/story-checks-sequence.md` (added by the 2026-10-10 review; the original draft named a file that did not exist), promoted by PR 3.0

Parent / siblings: F-STORY-001 (story schema, content pipeline) · F-STORY-002 (reader, `StoryScene`) · F-STORY-004 (shelf, Home card, bookmarks) · F-STORY-005 (grid) · F-STORY-006 (episode-completion cards) · F-AUDIO-004 (story audio) · F-I18N-001 / F-CNT-002 (locales, romanization) · F-001 §3.2 (first-try scoring) · F-MOTION-003 (card reveal) · audit PR-10 (first-try, UX-02) and PR-14 (card reveal, UX-03)

---

## 1. Context

A story quest has five steps (content-skill pattern, `quest.ts:8`): `intro` (Hoya) → `present` = **story-read** (F-STORY-002) → `practice` = **story-check** (this spec) → `apply` = **story-sequence** (this spec, v2) → `reward` (Hoya) → Results. F-STORY-002 lets a learner *read* a tale; this spec is the other half: "did I understand it?", "which pictures come first?", "which new words did I meet?" and "what do I get for it?".

Terms used here. **Story / tale**: one JSON file under `content/stories/` (F-STORY-001). **Level (tier)**: `listen` | `read-along` | `read`. **Story quest**: the quest that plays one story at one level. **Shelf episode / book episode**: F-STORY-004 / F-STORY-005. **Round**: one scored answer (`quest-run-store` counts rounds).

What exists today (verified on `main`, HEAD `c939348` — PRs #94-#102 merged; first written at `c89a903`, every line below re-read at review 2):

- The only story mechanic is `StorySequenceGame` (`apps/mobile/src/screens/minigames/StorySequenceGame.tsx:33-153`), used by three Stage 1 quests (`content/quests.ts:78, 95, 127`). It shows **text labels only**: no art, no audio, Korean **without romanization** (`:140`, against CLAUDE.md §1), and a `sort(() => Math.random() - 0.5)` shuffle that can come out already in order (`:35`). Since PR #94 it already scores **first-try** (`answerRound(sequenceRoundKey(picked.length), …)`, `:56,60`; `logic/round-keys.ts:15-17`), so the old "one failed round per wrong tap" is gone.
- There is **no comprehension-check mechanic**. `MinigameKindSchema` has no `story-check` (`content-schema/src/schemas/minigame.ts:16-30`); `MinigameScreen` falls through to "This minigame is coming soon." (`screens/minigames/MinigameScreen.tsx:76-77`).
- Results reveals a newly earned card with its art and a "See my card" button (`CardUnlockBanner`, `screens/results/ResultsScreen.tsx:117-129`, from PR #94) and always offers "Back home" as the primary button (`:132-145`) with "Episode page" as the ghost (`:147-155`). A replay writes the new run over the old one, so **stars can go down** locally (`store/progress-store.ts:184-204`, the `quests` filter at `:196-199`), while the sync merge keeps the maximum (`logic/sync/merge.ts:34-41`).
- **PR #94** (first-try scoring: `answerRound(roundKey, correct)` in `store/quest-run-store.ts:55-68`, `logic/first-try.ts`, `logic/round-keys.ts`, `logic/results-award.ts`, `decideCardAward`) and **PR #95** (scrollable safe-area `Screen`, tab bar sizing, profile entry) are **merged**; this spec builds on both (§7).

What the heritage research files tell us about checks (D14: the four `*.final.json` files, now saved as `content/stories/research/*.final.json` by PR #104; 24 tales; counts re-run at review 2 over exactly those files):

| Fact | Count | Consequence |
|---|---|---|
| Checks per tale | exactly 3 (72 total), each with `q_en`, `options[]`, `answer_index`, `fact_id` | Matches "3+ items so one slip still yields 2 stars" |
| Options per check | 37 with 3, 35 with 4 | Option layout must handle 3 and 4 |
| Correct answer at option index 0 | **17 of 72** in the final files (25 at index 2, 21 at 1, 9 at 3; it was 71 of 72 in the first drafts) | Authors reshuffled, but nothing in the schema guarantees it: options are still shuffled at runtime with a seeded shuffle, and CI asserts the displayed index-0 share stays at most 50 % |
| Prompts containing Hangul inside `q_en` | 8 of 72 (e.g. "What does the shape of ㅁ copy?", "What does a 측우기 measure?") | Violates F-CNT-001 `korean-in-ui-field`; needs a `{target}` token + `KoText`. All 8 terms resolve to a keyword of the story or to `jamo.json` |
| Options that are bare jamo ("ㅣ", "ㅡ", "ㅏ") | 3 options in 1 check | Korean options need `ko` + romanization + gloss |
| Longest option string | **79 characters** (`hangeul-day` check 2; the next is 63) | `CHECK_LIMITS.option` is **80** (was 70); a lint warning above 70 (F-STORY-001 `check-option-long`) |
| `fact_id` resolves to a fact of the same tale | 72 of 72 | D14 holds; keep `factIds` mandatory |
| Fact `claim_en` longer than 140 chars | 143 of 211 (68 %) | Facts are too long to be in-game feedback; checks need a short `explainEn` |
| `vocab` entries use `{ko, rr, en}` | 171 | Key is `rr`, the validator wants `romanization` — the import maps it |

## 2. User story

> As a learner at any reading level, after I read a short story I want to answer a few questions about it, put its pictures in order and hear the new words again — so I can tell I understood it and collect its card — and a wrong tap should only ever feel like "try another".

Companion stories:

- As a **content author** I want CI to fail when a check has no cited fact, when its prompt leaks the answer, or when Hangul sits outside a Korean field — before a reviewer ever sees it.
- As a **grown-up or teacher** I want replaying a story never to lower the stars my learner already earned.

## 3. Acceptance criteria

### 3.1 Data

**Check schema** — `packages/content-schema/src/schemas/story-check.ts`, exported from `src/index.ts`. **This section is the one definition; the file is created by F-STORY-001 PR 1.1a** (the story schema needs it for `Tier.checks`, so the file cannot wait for this spec's PRs; F-STORY-001 §3.2 lists the owner of each shared piece). It extends the `ComprehensionCheck` draft of the story-mode design input (§2.3); every addition is optional except `factIds`, which D14 requires from the first story. `KoTextSchema` is `packages/content-schema/src/schemas/ko-text.ts`, **owned by F-QUEST-002 Q-1** (PR #103: `{ ko, romanization, en, spokenKo?, audioRef?, syllables? }`); this spec never creates it, and never defines a story-only variant such as `story-text.ts`. Differences from the first draft of this spec, made at review 2 so that the 24 research episodes import one-to-one (F-STORY-001 §3.14): `explainEn` is optional in the schema (required by the `ready` rule of F-STORY-001 §3.2.2 item 6, so a draft parses before its 72 explanations are written) and `CHECK_LIMITS.option` is **80**.

```ts
import { z } from 'zod';
import { KoTextSchema } from './ko-text';

export const HANGUL = /[ㄱ-㆏가-힣]/; // same range as scripts/validate-content.mjs:25

export const CheckKindSchema = z.enum([
  'detail',       // what / when / why / how many — the research files' default
  'who',
  'pick-meaning', // Korean target -> English meaning (needs `target`)
  'pick-picture', // options are pictures (Listen level)
  'true-false',   // exactly 2 options, never shuffled
  'fill-word',
  'feeling',
]);
// 'order' (in the F-STORY-001 draft) is NOT a check kind: ordering is Story Order (§3.5).

export const CHECK_LIMITS = { prompt: 90, option: 80, explain: 140, hint: 80, options: { min: 2, max: 4 } } as const;   // option 80: the longest research option is 79 chars; F-STORY-001 lint `check-option-long` warns above 70

const ArtRef = z.string().regex(/^(card|hoya|prop|scene):[a-z0-9-]+$/); // same grammar as F-STORY-001 ArtLayer.ref

export const CheckOptionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,16}$/),
    en: z.string().trim().min(1).max(CHECK_LIMITS.option).optional(), // label / gloss / alt text
    ko: z.string().trim().min(1).max(24).optional(),                 // Korean option text
    romanization: z.string().trim().min(1).max(48).optional(),
    art: ArtRef.optional(),
    isCorrect: z.boolean(),
  })
  .superRefine((o, ctx) => {
    if (!o.en && !o.ko && !o.art) ctx.addIssue({ code: 'custom', message: 'option needs en, ko or art' });
    if (o.ko && !(o.romanization && o.en)) ctx.addIssue({ code: 'custom', path: ['ko'], message: 'Korean option needs romanization and an English gloss' });
    if (o.art && !o.en) ctx.addIssue({ code: 'custom', path: ['art'], message: 'picture option needs en (label and alt text)' });
    for (const [k, v] of [['en', o.en]] as const) if (v && HANGUL.test(v)) ctx.addIssue({ code: 'custom', path: [k], message: 'Hangul belongs in ko' });
  });

export const StoryCheckSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,32}$/),                  // unique inside the tier
    kind: CheckKindSchema,
    promptEn: z.string().trim().min(1).max(CHECK_LIMITS.prompt), // at most one "{target}" token, never Hangul
    target: KoTextSchema.optional(),                            // the Korean the question is about
    options: z.array(CheckOptionSchema).min(2).max(4),
    explainEn: z.string().trim().min(1).max(CHECK_LIMITS.explain).optional(), // shown after the item resolves; REQUIRED when the story is `ready` (F-STORY-001 §3.2.2 item 6; the player shows no explanation line if it is ever absent)
    hintEn: z.string().trim().min(1).max(CHECK_LIMITS.hint).optional(), // shown after the first wrong tap
    factIds: z.array(z.string().min(1)).min(1).max(3),           // D14: ids into the story's facts[]
    shuffle: z.boolean().optional(),                            // default true; true-false never shuffles
  })
  .superRefine(/* exactly one isCorrect; option ids unique; "{target}" count <= 1 and implies `target`;
                  pick-meaning requires `target`; pick-picture options all have `art`; true-false has 2 options and shuffle !== true;
                  no Hangul in promptEn / explainEn / hintEn */);
```

`Tier.checks` (F-STORY-001) is `z.array(StoryCheckSchema).min(3).max(5)` (the design-input draft said `min(2)`; three is the floor that keeps a story quest at ≥ 7 scored rounds, §3.2). Check ids are unique within the tier, and every `factIds` entry must exist in `story.facts[]` (cross-reference refine in `story.ts`, owned by F-STORY-001). The same schema serves `Tier.checkpoints` (F-STORY-002 §3.7).

**Prompt token.** Hangul never appears in `promptEn`. A question about a Korean word is written `"What does {target} mean?"` and the UI renders the `target` `KoText` inline (Korean + romanization, §3.4). A `target` without the token is shown as a "word card" above the options.

**Source mapping** (heritage research JSON → story JSON; the import step is F-STORY-001's, this table is the contract for checks):

| Research field | Story field | Rule |
|---|---|---|
| `q_en` | `promptEn` (+ `target`) | Hangul in `q_en` is lifted into `target` and replaced by `{target}` |
| `options[i]` (string) | `options[i]` | ids `a`..`d`; a Hangul-only string becomes `{ko, romanization, en}` (romanization and gloss authored) |
| `answer_index` | `isCorrect` | the option at that index is correct |
| `fact_id` | `factIds: [fact_id]` | unchanged |
| (none) | `explainEn` | copied from `claim_en` only when it is already ≤ 140 chars (68 % of facts are longer); otherwise **authored**; absent in a draft, CI error `check-explain-missing` once the story is `ready` |
| (none) | `kind` | `detail` unless the importer or author sets another |
| `vocab[].rr` | `keywords[].romanization` | key renamed (the validator reads `romanization`) |

**Scope fields.** `apps/mobile/src/logic/minigame-config.ts` gets (additive):

```ts
export interface StoryScope {
  storyId: string;        // 'story:seollal-new-year'
  level: StoryLevel;      // 'listen' | 'read-along' | 'read'  (F-STORY-001)
  checkIds?: string[];    // story-check: subset / order override (default: every check of the tier)
  sceneIds?: string[];    // story-sequence: override (default: tier.sequenceSceneIds)
}
// on MinigameScope:
story?: StoryScope;
storySteps?: Array<{ id: string; labelEn: string; labelKo?: string; romanization?: string }>; // romanization: field and values owned by F-CNT-002 PR 2a/2b
```

**Story refs.** Story quests do not need hand-written entries in `minigameScopes`. `scopeFor(ref)` (`minigame-config.ts:338-340`) becomes `minigameScopes[ref] ?? storyScopeFor(ref)`, where `storyScopeFor` (in `logic/story/story-ref.ts`) parses

```
minigame:story-<step>-<level>-<slug>     step  = read | check | seq
                                         level = listen | along | read      (along = read-along)
                                         slug  = [a-z0-9-]+  (the story id without "story:"; last, so it may contain "read")
```

`read` → kind `story-read` (F-STORY-002), `check` → `story-check`, `seq` → `story-sequence`. Example: `minigame:story-check-listen-seollal-new-year` → `{ kind: 'story-check', story: { storyId: 'story:seollal-new-year', level: 'listen' } }`. A ref that does not parse, or whose story/level does not exist, returns `undefined`, and the shell shows its existing "Minigame not found." fallback with **Back to quest** (`MinigameScreen.tsx:42-52`). (If F-STORY-002 landed first with a different grammar, adopt its grammar and change only the regex.)

`MinigameKindSchema` gains `'story-check'` (F-STORY-002 adds `'story-read'`). The `RoundSchema` union (`minigame.ts:78-85`) is not read by the app and gets no `story-check` member: a check's data is `StoryCheckSchema` inside the story JSON, not a generated round (F-QUEST-002 Q-1 adds the round shapes of *its* two new kinds to the same union; no overlap).

**Story quest skeleton** (what an author writes; stays inside `QuestSchema`: 3-7 steps, 3-15 minutes):

```ts
steps: [
  { id: 's1', kind: 'intro',    titleEn: '…', hoyaLineEn: '…', durationSeconds: 8 },
  { id: 's2', kind: 'present',  titleEn: 'Read the story',         minigameKind: 'story-read',     minigameRef: 'minigame:story-read-listen-<slug>',  durationSeconds: 150 },
  { id: 's3', kind: 'practice', titleEn: 'A few questions',        minigameKind: 'story-check',    minigameRef: 'minigame:story-check-listen-<slug>', durationSeconds: 60 },
  { id: 's4', kind: 'apply',    titleEn: 'Put the story in order', minigameKind: 'story-sequence', minigameRef: 'minigame:story-seq-listen-<slug>',   durationSeconds: 45 },
  { id: 's5', kind: 'reward',   titleEn: '…', hoyaLineEn: '…', durationSeconds: 8 },
]
```

**Legacy sequences.** The three existing `storySteps` scopes (`minigame-config.ts:119-127, 144-152, 185-193`) need a romanization on every step (CLAUDE.md §1). **F-CNT-002 owns both the optional field `storySteps[].romanization` (its PR 2a) and the twelve values (its PR 2b, §3.7 there; Revised Romanization, unhyphenated, pronunciation-based, D13)**: 손 씻기 `son ssitgi` · 상 차리기 `sang charigi` · 같이 먹기 `gachi meokgi` · 잘 먹었습니다 `jal meogeotseumnida` · 한복 입기 `hanbok ipgi` · 세배 드리기 `sebae deurigi` · 떡국 먹기 `tteokguk meokgi` · 세뱃돈 받기 `sebaetdon batgi` · 편 가르기 `pyeon gareugi` · 윷 던지기 `yut deonjigi` · 말 옮기기 `mal omgigi` · 승리 `seungni`. This spec's sequence screen **reads** the field and renders it; it adds no data and no second copy of the list. (Hand-off: F-QUEST-002 later retires the meal and Yut sequences and keeps the Seollal one as quest 9's apply step; the story scopes of §3.1 are unaffected.) The Seollal greeting `새해 복 많이 받으세요` is a story line (F-STORY-001/002 content, and F-CNT-002's `hoyaLineKo` for quest 7), not a sequence step.

### 3.2 Scoring and stars

- **One check item = one scored round**, key `check:<checkId>` (new helper `checkRoundKey(checkId)` next to `pairRoundKey` / `sequenceRoundKey` in `logic/round-keys.ts`). **One sequence slot = one scored round**, key `sequenceRoundKey(slotIndex)` — the helper PR #94 already added (`round-keys.ts:15-17`, returns the slot number; 0-3 or up to 6 for 7 cards), not a second `seq:` scheme. Reader checkpoints (F-STORY-002) use `cp:<id>`. The run store prefixes the step index (`${stepIndex}:${roundKey}`, `quest-run-store.ts:59`), so keys never collide across steps.
- **First try only.** Games report every tap through `useQuestRunStore.getState().answerRound(roundKey, correct)` (PR #94). Only the first answer for a key scores; later taps are *retries* (analytics only). A learner who taps three options on one item loses at most that one round. Leaving a game and coming back re-opens it, but the already-scored keys stay scored, so re-answering cannot be farmed.
- **Stars are unchanged**: `starsForAccuracy` — ≥ 0.95 → 3, ≥ 0.6 → 2, ≥ 0.2 → 1 (`logic/score.ts:6-13`); a card needs ≥ 2 stars (`logic/reward.ts:6-10`).
- A story quest scores **at least 7 rounds** (3 checks + 4 slots) plus the reader's checkpoints. First-try misses that still keep the card (≥ 0.6): **2 of 7**, **3 of 9** (2 checkpoints), **4 of 10**. 3 stars needs no first-try miss while there are fewer than 20 rounds. These numbers are asserted in `story-scoring.test.ts` so a content change that shrinks a quest below 7 rounds fails CI.
- **Skip** (Story Order's ghost button) leaves the remaining slots unrecorded, as today. A run with 0 recorded rounds is still not completed (`logic/results-award.ts:39-48`).
- Progress indicators **only fill**: the bar and the `n / N` position pill advance when an item *resolves*, never drop, and never show a score (D3). No timers (D3 Relaxed default); Challenge mode is out of scope.

### 3.3 Pure logic (all in `apps/mobile/src/logic/story/`, 100 % covered)

| File | Exports | Behavior |
|---|---|---|
| `story-ref.ts` | `parseStoryMinigameRef`, `storyMinigameRef`, `storyScopeFor`, `storyIdOfQuest(quest)`, `levelOfQuest(quest)` | §3.1 grammar; level codes `listen`/`along`/`read`; null on anything malformed; the last two read the quest's `story-read` step ref |
| `seeded-order.ts` | `hashSeed(str)` (FNV-1a 32-bit), `mulberry32(seed)`, `shuffleSeeded(items, seed)` (Fisher-Yates), `derangeSeeded(items, seed)` (Sattolo: a single cycle, so **no item stays in place** for n ≥ 2), `isSameOrder(a, b)` | deterministic, pure, never mutate the input |
| `check-view.ts` | `buildCheckView(check, seedKey)` → `{ promptParts: Array<{ text } \| { target }>, options: OptionView[] }` | splits `{target}`; orders options with `shuffleSeeded(options, hashSeed(storyId + '\|' + check.id))` unless `kind === 'true-false'` or `shuffle === false`; ids stay stable |
| `check-player.ts` | `HIGHLIGHT_AFTER_WRONG = 2`, `initCheckState`, `reduceCheck(state, action, view)` → `{ state, effects }` | state `{ index, phase: 'answering' \| 'explained' \| 'recap' \| 'done', wrong: string[], taps }`; actions `choose(optionId)`, `next()`, `finishRecap()`; effects `{ type: 'answer', roundKey, correct }` (emitted for **every** tap; `answerRound` applies first-try, `quest-run-store.ts:55-68`), `{ type: 'resolved', firstTry, taps }`, `{ type: 'highlight', optionId }` once `HIGHLIGHT_AFTER_WRONG` wrong taps happened on one item, `{ type: 'finish' }` |
| `sequence-player.ts` | `initSequenceState(cards, seed)`, `reduceSequence(state, action)` | state `{ order, placed, phase: 'ordering' \| 'replay' \| 'done', wrongBySlot }`; `tap(cardId)`: right card → placed + effect `answer(sequenceRoundKey(slot), true)`; wrong → effect `answer(sequenceRoundKey(slot), false)`, card unchanged; 2 wrong on a slot → effect `highlight(correctId)`; last slot placed → `phase: 'replay'`; `skipReplay`, `replayNext`, `replayBack`, `togglePause`, `finish` |
| `sequence-cards.ts` | `buildSequenceCards(scope, story)` → `SequenceCard[]` `{ id, caption: string, ko?: KoText, art?: SceneArt }` | story scope: from `tier.sequenceSceneIds`; legacy scope: from `storySteps` (no art). Listen: `caption = scene.captionEn`, `ko = scene.keyword`; read-along / read: `ko = scene.line`. Order of the returned list is the *correct* order |
| `recap.ts` | `recapWords(story, level)` → `KoText & { id }[]` | Listen: `tier.newKeywordIds` (≤ 4); other levels: unique keywords used by the tier's scenes, authored order, ≤ 8 |
| `romanization.ts` | `romanizationShown(mode, revealed)` | **Interim home of the one shared function.** F-I18N-001 owns it (`packages/i18n/src/romanization.ts`, same signature, `RomanizationMode = 'always' \| 'tap'`, setting `ProfileSettings.romanizationMode`); until that package exists this file holds the identical two-line function, and it becomes `export { romanizationShown } from '@hangul-route/i18n'` when it lands. Until the setting exists the caller passes `'always'` |
| `copy.ts` | `STORY_CHECK_COPY` (`as const`, function messages for plurals) | every UI string of §3.4-3.7; a unit test runs `scanLearnerCopy` (`logic/homework/banned-text.ts:30-37`) over all values. When `packages/i18n` ships (F-I18N-001) the object moves to `messages/en/learner.ts` unchanged |
| `results-extras.ts` | `storyResultsExtras(input)` | §3.7 |

### 3.4 Story check screen — `screens/minigames/StoryCheckGame.tsx`

Wired in `MinigameScreen.tsx` as `case 'story-check'` (next to `:72-73`). Props are the existing `{ scope, onFinish }`. Layout follows the shell wireframe (`design/wireframes/minigame/shell.md`): progress bar + position pill on top, prompt, answer area, Hoya bubble slot. The screen scrolls; no fixed heights (audit p1-L4).

- **Given** a `story-check` step whose scope resolves to N ≥ 3 checks, **when** it opens, **then** item 1 shows: the fill-only progress and `1 / N`; the prompt (with the `target` rendered inline when present); 2-4 `ChoiceCard`s in `buildCheckView` order; a speaker button; no timer; no Hoya bubble yet.
- **Given** the correct option is tapped first, **then** `answerRound('check:<id>', true)` runs once, `tapLight()` + `success()` fire, the card shows the correct look (success tone + check icon), the Hoya bubble (`tone="cheering"`) shows `explainEn`, the other options disable, and a **Next** button (`size="hero"`) takes focus. There is **no auto-advance** (the learner may be reading `explainEn`; D3 forbids time pressure).
- **Given** a wrong option is tapped first, **then** `answerRound(…, false)` runs once, `nudge()` fires, the card takes the amber look (`colors.feedback.nudge` / `nudgeLight`) with the text "Try another" (not colour alone), it locks, the bubble (`tone="thinking"`) shows `hintEn` or the default line, and the item stays open. No red, no X, no `colors.feedback.danger` (D3).
- **Given** a second wrong tap on the same item, **then** it is a retry (not scored) and the correct option gets a highlight ring while the bubble says to look at it. The item still resolves only when the correct option is tapped (fail-but-advance, shell wireframe rule 3).
- **Given** the correct option is tapped after wrong taps, **then** no second scored answer is recorded, the explanation shows, and `story.check.answered` carries `firstTry: false`.
- **Given** the last item resolved and Next is tapped, **then** the recap (§3.6) shows when `recapWords` is non-empty; otherwise `markStepComplete()` and `onFinish()` run at once.
- **Given** the step resolves to zero checks (bad ref, empty tier), **then** the screen shows one line and a **Continue** button that calls `markStepComplete(); onFinish()` (never a dead end), and `story.check.finished` fires with `items: 0`.
- **Options are shuffled.** The first draft research files put the answer first in 71 of 72 checks; the final files have it first in 17 of 72, and authors may do either again, so `buildCheckView` always shuffles (seeded by story + check id: stable across re-renders, identical on every device). Tests: (a) over the 72 checks of the committed `content/stories/research/*.final.json` the correct option's displayed index is 0 in at most 50 % of them; (b) over a synthetic fixture whose 72 checks all have the answer authored first, the displayed share is also at most 50 % (the shuffle, not the authors, is what is under test).
- **Audio.** The speaker reads the prompt, then the options in order, in the UI language, through F-AUDIO-004's single entry point (`playPrompt({ text, language, kind: 'sentence', source: 'story-check' })`; until its PR A-4a lands, F-STORY-002's interim `logic/story/audio-port.ts` over `speak`, `platform/audio.ts:26-40`; the `es`/`ko` voices and rates come from F-AUDIO-004). A `target` has its own speaker that plays `audioRef` if present, else `playPrompt({ text: target.spokenKo ?? target.ko, language: 'ko-KR', kind: 'word', audioRef })`. The Korean text and romanization are always on screen, so a missing voice costs nothing (D6 text fallback); when F-AUDIO-004's capability check says no Korean voice exists (`canPlayKorean(getCapability())` is false), the Korean speaker is replaced by the shared "Say it yourself" fallback state and chip (F-AUDIO-004 §3.8; the telemetry is its `audio.fallback_shown` with `source: 'story-check'`). Muted (`playPrompt` returns `muted`) = silent, never an error. If the learner/teacher turned on "hide romanization until tap" (D2), romanization shows behind a "Show how to say it" tap and stays visible once revealed; it is always visible after the item resolves.
- **Read to me.** When F-STORY-002's `readToMe` setting is on (its default is on when the profile's level has `levelOrder(level) === 0`, "Pictures first" (F-LEARN-001 §3.1), and off otherwise; D1 — a default, never a restriction, and never a test of the raw `'5-7'` id), the prompt and `target` are read aloud when an item opens; options are read only on request.
- **The answer is never pre-printed.** For `pick-meaning` and `fill-word` the `target`'s English gloss (`KoText.en`, required in the data by the validator) is **not rendered until the item resolves**; the prompt shows Korean + romanization only.
- **Picture options** (Listen level, `pick-picture`): 2 columns, art ≥ `touchTarget.hero` (96), the `en` label under each picture.
- **Motion.** `useReducedMotion()` (`platform/motion.ts`) removes the press scale and any fade; state changes are instant.

`ChoiceCard` — new design-system component and **the only definition other specs reuse** (F-QUEST-002 Listen & Pick and Pic-Word Match, F-VOC): `packages/design-system/src/components/ChoiceCard/{ChoiceCard.tsx,style.ts,types.ts,index.ts}`, exported from `src/index.ts`. Props: `{ label?: string; ko?: string; romanization?: string; gloss?: string; art?: ReactNode; state: 'idle' | 'correct' | 'wrong' | 'hint' | 'disabled'; onPress?: () => void; accessibilityLabel: string; testID?: string }`. Korean (`ko` + `romanization` + `gloss`) is drawn with `KoreanText` (F-I18N-001 PR 4, which has no dependencies beyond the charter PR), so the target chip and romanization look identical to every other taught-Korean surface. Tokens only: radius `radii.lg`, min height `touchTarget.child` (80), border width `borderWidth.base` (`tokens.ts:206-210`; never a literal 2) using `colors.border.subtle` / `feedback.success` / `feedback.nudge` / `border.focus`, background `surface.paper` / `feedback.successLight` / `feedback.nudgeLight`, text `text.primary` (the Tile-style literal `#B5862A` at `Tile.tsx:23` is **not** copied: use `colors.hoya.furDark`). Left-aligned wrapped text (the pill-shaped `Button` is wrong for 2-line options). State styles live in a pure `choiceCardStyle(state)` (unit-tested); the component has `accessibilityRole="button"` and `accessibilityState={{ disabled, selected }}`.

### 3.5 Story Order v2 — `screens/minigames/StorySequenceGame.tsx` (changed in place)

One component serves legacy `storySteps` scopes and story scopes. The pure `reduceSequence` replaces the inline state.

- **Given** a scope with 3-7 cards, **when** the game opens, **then** the cards are shown in a `derangeSeeded` order (seed = hash of scope ref + a per-mount random nonce, injectable in tests): never the correct order and no card in its correct place. (Today's shuffle can come out sorted: `StorySequenceGame.tsx:35`.)
- **Layout.** A row of numbered **slots** fills left to right; below it the remaining cards (2 columns at ≥ 360 dp, 1 at 320 dp; 3-4 columns at tablet width). A card shows: scene art (when present), the Korean block (Korean large, **romanization upright ≥ 16 sp** below it, UX-24), the English caption. No order numbers on cards.
- **Given** the learner taps the card that comes next, **then** it moves into the next slot, `success()` fires, and `answerRound(sequenceRoundKey(slot), true)` runs (first answer for that slot).
- **Given** a wrong card is tapped, **then** it takes the amber look for ~600 ms, `nudge()` fires, `answerRound(sequenceRoundKey(slot), false)` runs (scored once per slot), and nothing moves. After two wrong taps on a slot the right card gets the highlight ring.
- **Given** all slots are filled, **then** the **story replay** starts: each card in order, full width, with its Korean line spoken (`audioRef` else TTS) and its caption visible. It advances every ~2.5 s with a visible **Pause/Play** control and **Back / Next**; with reduced motion it does not auto-advance. **Skip replay** is always available. The replay records nothing. After it, `markStepComplete()` and `onFinish()` run (a **Done** button, not a timer).
- **Skip this one** (ghost, bottom) keeps today's behavior: `markStepComplete(); onFinish()` without recording the rest.
- **Tap only.** Drag-to-reorder from the catalog (`docs/blueprints/06-mini-game-catalog.md:613`) is out of scope: a tap path must exist anyway for screen-reader and switch users, and it is the only path needed for ≤ 7 cards.
- **No art yet / art missing.** A card whose `art` is absent or unresolved shows the label block alone (surface `sunken`), never a broken image; this is what the three legacy sequences look like until prop art exists.
- Legacy and story cards share the same scoring and the same `story.sequence.finished` event.

### 3.6 Word recap — `screens/story/StoryWordRecap.tsx`

- **Given** `recapWords` returns words, **when** the last check resolves and the learner taps Next, **then** the check screen switches to the recap: heading, a grid of word chips (2 columns at ≥ 360 dp, 1 at 320 dp) and a **Done** button. A chip shows the Korean (title size), romanization (upright ≥ 16 sp, subject to the D2 setting), the gloss, and a speaker (64 dp hit area) that plays `audioRef` or TTS.
- The recap is **unscored** and never blocks: Done → `markStepComplete(); onFinish()`. It records `story.recap.word_played` per distinct word tapped.
- Listen shows `newKeywordIds` (≤ 4); other levels show up to 8 words. Duplicates are removed by id.
- If F-RVW-001's feedback-review ships, a story quest passes `newElementIds = tier.newKeywordIds` to it; nothing else changes here.

### 3.7 Results and reward flow

The route, the single write, the star thresholds and the card gate stay as they are (`ResultsScreen.tsx:47-86` and `logic/results-award.ts:37-82`: `applyQuestResult`, `decideCardAward`, the reveal with "See my card"). The story variant is additive:

- **Given** the quest is a story quest (`storyIdOfQuest(quest)` finds a `story-read` ref), **when** Results mounts, **then** after the card reveal it shows `StoryResultsExtras` (new, `screens/results/StoryResultsExtras.tsx`): the story title (Korean + romanization + English), a one-line link to a culture note when F-STORY-004 supplies one, and the actions below.
- **Primary action**: **Next story** when `nextStoryAfter(questId)` (F-STORY-004) returns one — it opens `QuestPlayer` for that quest; otherwise the existing **Back home**. Secondary (ghost): **Read it again** (`StoryReader { storyId, level, mode: 'replay' }`, unscored, writes nothing) and the existing **Episode page**. One primary, at most two ghosts.
- **Replays never lower stars.** `recordQuestComplete` (`progress-store.ts:184-204`) keeps `max(stars)` with the accuracy that goes with it (higher stars win; on equal stars the higher accuracy wins), adds to `attempts`, and keeps the earliest `startedAt` — the same winner rule as the sync merge (`merge.ts:34-41`). `completedAt` keeps moving to the latest finish, because Home's "collected today" flip and the replay window read it (`mission-builder.ts:86-98, 121-124`). A scored replay can only raise the stored result (D3: no losing earned items). Own PR, own tests (§6).
- **No fractions or percentages anywhere on Results** (D3; `results-copy.ts` after #94). Copy per star tier is unchanged. 0-1 star copy is encouraging and offers "Read it again" first.
- **Replay and the card.** A replay of a finished story shows no "new card" (PR #94's `isNew`); `unlockCard` is idempotent (`progress-store.ts:208`), so F-STORY-006's episode-level award and this quest-level award can both fire safely.
- **Hand-off to F-STORY-006**: the extras component reserves a slot above the actions for an "Episode complete" line when that spec exposes it.

### 3.8 Content rules enforced in CI

`scripts/validate-content.mjs` (F-CNT-001): add `explainEn`, `hintEn`, `captionEn` and `altEn` to `LEARNER_TEXT_FIELDS` (`:49-61`) so the banned-word pass covers them; extend `scripts/__tests__/validate-content.test.mjs`. Hangul stays legal only inside `ko` fields with `romanization` and `en` on the same object (`:84-102`), which is why checks use `target` / `{target}`. Whether a story's `romanization` is *correct* Revised Romanization is F-CNT-002's class A scan (`rr` accepted as an alias of `romanization`); this spec adds no second checker.

`apps/mobile/src/content/__tests__/content-integrity.test.ts` (extend, `:8-81`):

- every story-check / story-sequence `minigameRef` resolves through `storyScopeFor`, and `step.minigameKind === scope.kind`;
- every story quest scores ≥ 7 rounds (checks + 4 slots + checkpoints);
- every check: exactly one correct option, `factIds` resolve, and the correct option's text (lower-cased) is not a substring of `promptEn` (answer leak);
- every scene in `sequenceSceneIds` has `captionEn` ≤ 48 chars and either `art` or an explicit `artPending: true`;
- every `storySteps` entry with `labelKo` has `romanization`;
- `QuestSchema`, `EpisodeSchema` and `StoryCheckSchema` `.parse` every shipped story quest, check and episode (this also surfaces the existing preview-episode failures — F-STORY-001 relaxes `questIds.min(1)` for `preview`).

### 3.9 Telemetry

Append to the `TELEMETRY_EVENT_NAMES` array (`packages/content-schema/src/schemas/telemetry.ts`, lines 9-43 at `c939348`) and to the expected sorted list in `packages/content-schema/src/__tests__/telemetry.test.ts` (lines 5-43; the list is `.sort()`ed, so placement is free); the Worker whitelist is the same list, so it follows automatically (`packages/backend/src/__tests__/telemetry.test.ts` iterates it). **Deploy the Worker before the app release**: an unknown name returns 422 and the client drops it (`platform/telemetry.ts:40-58`). `profileId` is attached by `track`; payloads carry ids and counts only — no free text, no names.

| Event | Fired | Payload |
|---|---|---|
| `story.check.answered` | when an item resolves | `{ storyId, level, checkId, kind, firstTry, taps }` |
| `story.check.finished` | check step ends | `{ storyId, level, items, firstTryCorrect, retries }` |
| `story.sequence.finished` | sequence step ends (story and legacy) | `{ storyId \| null, sequenceId, slots, firstTryCorrect, retries, replayed, skipped }` |
| `story.recap.word_played` | a recap speaker is tapped (once per word per visit) | `{ storyId, wordId }` |
| `story.results.action` | a Results action is chosen | `{ questId, storyId, action: 'next-story' \| 'read-again' \| 'episode' \| 'home' \| 'culture-note' }` |

`quest.complete`, `card.unlocked`, `card.first_earned` and `minigame.finished` are unchanged and keep firing. `round.correct` / `round.wrong` stay unused.

### 3.10 Cross-cutting: accessibility, locale, offline, privacy

- **Targets**: every tappable control ≥ `touchTarget.min` (64); options ≥ 80. Screen-reader order = visual (shuffled) order. Each option's label includes its text and, for Korean, `ko, romanization`; Korean text nodes carry `lang="ko"` on web and `accessibilityLanguage="ko-KR"` on iOS.
- **Announcements**: a tap result is announced (`AccessibilityInfo.announceForAccessibility` on native; the Hoya bubble already has `accessibilityLiveRegion="polite"`, `HoyaBubble.tsx:49`). Focus moves to Next after an item resolves (web: `.focus()`).
- **Colour is never the only cue**: correct = check icon + label, wrong = "Try another" text. No emoji anywhere in rendered output (D7); icons come from the design-system set (`Icon/types.ts:1-20`: `speaker`, `check`, `replay`, `play`, `pause`).
- **Locale (D2)**: all UI strings come from `copy.ts`; check text (`promptEn`, option `en`, `explainEn`, `hintEn`) is addressed by stable ids so a locale overlay can translate it (F-CNT-002); `KoText.en` is the gloss in the UI language. Speech language follows the UI locale through `LOCALE_META[locale].speechLang` (F-I18N-001 §3.1: `en-US`, `es-US` with `es-*` fallback, `ko-KR`); until F-I18N-001 ships it is `en-US`.
- **Offline**: story JSON is bundled; nothing here needs the network. TTS may be absent offline — text carries the meaning.
- **Layout**: no height assumptions; verify at 320×568, 375×667, 844×390 (landscape) and 200 % text scale (audit §6).

### 3.11 Backend, sync, storage

None. No D1 migration, no API route, no `ProgressSnapshot` field, no new storage key: scores ride `QuestProgress`; the run store is in-memory. The only shared-package change that the Worker sees is the telemetry name list.

## 4. Out of scope

- The reader and `StoryScene` (F-STORY-002); the shelf, Home card, bookmarks and Culture notes (F-STORY-004); grid volumes (F-STORY-005); episode-level card awards (F-STORY-006).
- Recorded audio, the Korean-voice capability check and `es-ES` speech (F-AUDIO-004). Locale overlays and the romanization setting itself (F-I18N-001 / F-CNT-002 / F-LEARN-001).
- Drag-to-reorder, free-text or spoken answers, "My Story" (⑫), adaptive difficulty, Challenge-mode countdowns, per-check analytics for teachers, spaced repetition of story words (F-RVW-001 / F-VOC).
- Changing the global star thresholds or the 2-star card rule; first-try scoring for the other eight games (PR #94).
- Auto-starting games without the "Ready for a quick game?" launcher (audit UX-17 / PR-18). If it lands first, story steps inherit it.
- Teacher plan builder catalog entries for story quests (F-PLAN-002 shared catalog; until then `deriveAssignments` counts unknown quests as not ready, `plan-derivation.ts:77-81`).
- Landing-page minigame catalog: only its story-sequence blurb ("Three panels", `apps/web/src/data/minigame-catalog.ts:82`) should say four pictures; no new entry (its test pins 9 games).

## 5. Tests

TDD: each PR ships its tests with the code. Mobile vitest only picks up `src/{logic,store,content,config,platform}/**/*.test.ts` (`apps/mobile/vitest.config.ts`); there is no component test harness, so screens are covered by Playwright (`apps/mobile/e2e/web`).

| File | Level | Coverage focus | Target |
|---|---|---|---|
| `content-schema/src/__tests__/story-check.test.ts` (F-STORY-001 PR 1.1a writes the file; 3.1 extends it) | unit | valid/invalid checks: one correct, unique ids, 2-4 options, `{target}` rules, Korean option needs romanization + gloss, picture option needs `en`, `factIds` ≥ 1, length limits (option 80 accepted at 79 and rejected at 81), `explainEn` absent accepted, `order` kind rejected, Hangul in prompt rejected | 100 % |
| `content-schema/src/__tests__/telemetry.test.ts` | unit | new names present, no duplicates | 100 % |
| `mobile/logic/story/__tests__/story-ref.test.ts` | unit | grammar, all levels/steps, slugs containing `read`/`check`, malformed → null, round trip | 100 % |
| `…/seeded-order.test.ts` | unit | determinism, permutation property, Sattolo has no fixed point (n = 2..8 × 200 seeds), Fisher-Yates position spread, input not mutated | 100 % |
| `…/check-view.test.ts` | unit | `{target}` split, stable order, true-false unshuffled, answer-at-index-0 share ≤ 50 % over the research-derived fixture | 100 % |
| `…/check-player.test.ts` | unit | first-try right/wrong, retries unscored, highlight after 2 wrong, resolve → explained → next → recap → done, empty list, effects order | 100 % |
| `…/sequence-player.test.ts` | unit | slot logic, wrong tap leaves state, highlight, replay phase, skip, pause, legacy 4-step scope | 100 % |
| `…/sequence-cards.test.ts`, `recap.test.ts`, `romanization.test.ts`, `copy.test.ts` | unit | label rules per level, recap caps and dedupe, D2 modes, banned-word scan | 100 % |
| `…/story-scoring.test.ts` | unit | fairness table in §3.2 against `starsForAccuracy` | 100 % |
| `mobile/logic/story/__tests__/results-extras.test.ts` | unit | next story, replay target, culture-note slot, no number in any string | 100 % |
| `mobile/store/__tests__/progress-store.test.ts` | unit | `recordQuestComplete` keeps best stars/accuracy, increments attempts, idempotent | keeps lane ≥ 90 % |
| `mobile/content/__tests__/content-integrity.test.ts` | integration | §3.8 rules over every shipped story and the three legacy scopes | n/a |
| `design-system/src/__tests__/choice-card-style.test.ts` | unit | state → token mapping, no literal colours | lane ≥ 85 % |
| `scripts/__tests__/validate-content.test.mjs` | unit | new learner fields flagged for banned words | n/a |
| `mobile/e2e/web/story-checks.spec.ts` | e2e (Playwright, nightly + on demand) | all-first-try → 3 stars + card; one miss → 2 stars + card; four misses of 9 → 1 star, no card; explanation visible; no auto-advance; amber (no red) via computed style; sound off still playable; reduced motion; 320×568 and 844×390 CTA visible | — |
| `mobile/e2e/web/story-order.spec.ts` | e2e | derangement start; wrong tap leaves slot; highlight after 2; replay pause/skip; Korean + romanization visible | — |
| `mobile/e2e/web/story-results.spec.ts` | e2e | Next story; Read it again unscored (stars unchanged); replay with fewer stars keeps the best | — |

Coverage lanes (CLAUDE.md §6, `docs/tests/coverage-targets.json`): `packages/content-schema` 100 %, `apps/mobile/src/logic` ≥ 90 % (this feature's `logic/story/**` at 100 %), `packages/design-system` ≥ 85 %. Visual regression: add the five `ChoiceCard` states to the design-preview surface (F-VR-001). Manual QA checklist before ship: VoiceOver and TalkBack pass on one check and one sequence; 200 % text; offline with no Korean voice; reduced motion.

## 6. Rollout

No feature flag: the new screens render only for story quests, and story quests exist only when F-STORY-001/002 content ships. Telemetry names deploy with the Worker first. PR order (small PRs, each with tests; branch `feat/story-checks-*`):

| # | PR | Depends on |
|---|---|---|
| 3.0 | `design(wireframe)`: promote `wireframes/story-checks-sequence.md` to `story/check`, `story/sequence`, `story/word-recap`, `results/celebrate-story`; briefs `22-story-check.md`, revised `12-minigame-story-sequence.md`, `components/choice-card.md`; update `design/wireframes/README.md` index. The `ChoiceCard` brief and PR 3.3 are **not** blocked by F-STORY-001 (the component is generic) | — |
| 3.1 | `feat(content-schema)`: `story-check` minigame kind, the five telemetry names (+ exact-list test), extra `story-check` edge tests (`story-check.ts` itself and `ko-text.ts` already exist: F-STORY-001 PR 1.1a and F-QUEST-002 Q-1) | F-STORY-001 PR 1.1a |
| 3.2a | `feat(mobile)`: refs and scopes — `logic/story/{story-ref,seeded-order}.ts`, `logic/round-keys.ts` (`checkRoundKey`), `scopeFor` fallback, `MinigameScope.story`; tests | 3.1 |
| 3.2b | `feat(mobile)`: players and views — `logic/story/{check-view,check-player,sequence-player,sequence-cards,recap,romanization,copy,results-extras}.ts`, `story-scoring.test.ts`, integrity tests (No legacy-romanization commit: F-CNT-002 owns it) | 3.2a, F-STORY-001 PR 1.1b |
| 3.3 | `feat(design-system)`: `ChoiceCard` + `choiceCardStyle` + preview page entry | 3.0, F-I18N-001 PR 4 (`KoreanText`) |
| 3.4a | `feat(mobile)`: `StoryCheckGame` + `MinigameScreen` case + `check` telemetry + e2e (no recap yet) | 3.2b, 3.3, F-STORY-002 PR 2.6b |
| 3.4b | `feat(mobile)`: `StoryWordRecap` + `story.recap.word_played` | 3.4a |
| 3.5a | `feat(mobile)`: Story Order v2 without art — romanization display, derangement, slots, replay of labels, e2e | 3.2b (pure parts: `sequence-player`, `seeded-order`), F-CNT-002 PR 2a (field; PR 2b for correct values) |
| 3.5b | `feat(mobile)`: Story Order v2 scene art and picture replay | 3.5a, F-STORY-002 PR 2.3a (`StoryScene`) |
| 3.6 | `fix(mobile)`: `recordQuestComplete` keeps the best stars (D3) | none (can go first) |
| 3.7 | `feat(mobile)`: `StoryResultsExtras`, next-story and replay actions | 3.4a, F-STORY-004 PR 4.3b (`nextStoryAfter`) |
| 3.8 | `ci(content)`: validator learner fields | none (field names only; the same set is added by F-STORY-001 PR 1.3, idempotent) |

Cross-spec order: F-STORY-001 → F-STORY-002 → (F-STORY-003 ∥ F-STORY-004) → F-STORY-005 / 006. PR 3.5a is valuable on its own: it fixes the sorted-start bug and shows the (F-CNT-002) romanization in shipped Stage 1 content before any story exists. F-QUEST-002 also depends on this spec (PR 3.3 `ChoiceCard`) and on F-I18N-001 PR 4 (`KoreanText`).

## 7. Dependencies

Upstream:

- **F-STORY-001**: `Story` / `Tier` / `SceneArt` schema, the `facts[]` with `sources[]` model (D14), `Tier.checks` / `sequenceSceneIds` / `newKeywordIds`, scene `captionEn`, `sceneKorean()`, `StoryCheckSchema` (implemented there from §3.1), and the import step (`rr`→`romanization`). **F-QUEST-002 Q-1**: `KoTextSchema`. **F-STORY-002**: `StoryReader` route, `StoryScene` (design-system), `story-read` kind, checkpoints (`cp:` keys). **F-STORY-004**: `nextStoryAfter`, culture-note lookup, bookmarks (not needed here).
- **PR #94** (merged: first-try scoring + card reveal): `answerRound` in `quest-run-store`, `logic/first-try.ts`, `logic/round-keys.ts`, `decideCardAward`, `results-copy.ts`, `Results.retries` — do **not** add a second scoring mechanism. **PR #95** (merged): `Screen` is scrollable and pads the safe area (`edges`, `TAB_SCREEN_EDGES`); new screens must not depend on a fixed height either way.
- **F-AUDIO-004** (voice capability, `audioRef` playback, `es-US` voices) and **F-I18N-001** (`useMessages()`, locale overlays, `ProfileSettings.romanizationMode`, `KoreanText` PR 4). Until they land: TTS `en-US` / `ko-KR`, romanization always visible, English copy from `copy.ts`. **F-CNT-002** (storySteps romanization field + values, PR 2a/2b).
- Existing: `logic/score.ts`, `logic/reward.ts`, `logic/homework/banned-text.ts`, `platform/{audio,haptics,motion,telemetry,storage}`, design-system `Button`, `Card`, `HoyaBubble`, `Progress`, `Pill`, `Icon`, `StarRow`, `HeritageCardArt`.

Downstream: F-STORY-004 (Results "Next story"), F-STORY-006 (episode-complete line), F-RVW-001 (`newElementIds`), F-PLAN-002 (catalog).

Assumptions I could not verify (each has a stated fallback): the native-speaker confirmation of the 12 legacy romanizations. (Review 2 closed the others: the F-STORY-001/002 names were read in their specs, and the four `*.final.json` files were checked: three checks per tale, every `fact_id` resolving.)

## 8. Decisions

Binding owner decisions and how this spec applies them:

| Id | Applied here |
|---|---|
| D1 | No age labels or "for kids" copy; the learner level labels (Pictures first / Some reading / Reads easily) are the only audience vocabulary; "Read to me" defaults come from the level id, never from an age |
| D2 | Taught Korean always carries romanization + a gloss in the UI language; "hide romanization until tap" is honoured when the opt-in setting exists; default visible; strings go through `copy.ts` and overlays |
| D3 | No red or X, amber nudge + Hoya thinking; fill-only progress; no timers; no fractions/percentages on Results; stars never go down (PR 3.6) |
| D4 | Checks live in JSON under `content/stories/`, validated by the extended validator over shipped content; every check cites facts |
| D6 | TTS now, `audioRef` supported, text always visible, "Say it yourself" chip when no Korean voice |
| D7 | `ChoiceCard`, slots and cards use tokens only; art is SVG from F-STORY-002; no emoji, no raster |
| D8 | Spec id F-STORY-003 |
| D13 | Legacy romanizations are Revised Romanization, unhyphenated, pronunciation-based |
| D14 | `factIds` mandatory; `explainEn` is short and derived from a cited fact, never invented |

Decisions made in this spec:

1. **One option component, `kind` is metadata.** All 72 research checks are text multiple-choice; picture and Korean options only change what a `ChoiceCard` holds.
2. **Manual Next, no auto-advance** after an answer, so a learner can read the explanation without a clock (the older games auto-advance after ~700 ms, `CultureQuizGame.tsx:43-52`).
3. **Granularity**: one round per check, one per sequence slot — never one per tap.
4. **Two wrong taps highlight the right option**; the item still ends on a correct tap.
5. **Runtime seeded shuffle** instead of trusting authored order (71/72 answers first in the first drafts, 17/72 in the final files).
6. **Derangement for Story Order** so no card sits in its place; tap-to-place only.
7. **Recap at the end of the check step**, unscored; Results stays short.
8. **Replay is passive and pausable** (auto-advance can be stopped; none with reduced motion).
9. **`explainEn` ≤ 140 chars is required for a `ready` story** (optional in a draft), authored from the cited fact, because 68 % of facts are longer than that.
10. **Monotonic stars** ship as a separate PR (3.6) because it touches every quest.
11. **Results primary action = Next story** when one exists; "Back home" otherwise.
12. **No outbound links** on this surface; sources are shown only in Culture notes (F-STORY-004), as text.
