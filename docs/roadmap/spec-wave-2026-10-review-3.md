# REVIEW-3 — independent review of nine Hangul Route specs (2026-10-10)

Specs: F-VOC-001..005, F-PLC-001, F-PLAN-002, F-TCH-004, F-LAYOUT-001. Each was written by one agent and reviewed by a different one against `main` at `ecf6365`. This file keeps the three review logs, the telemetry names and the open owner decisions. Nothing here has been tested on devices or with learners; every item marked unverified in a spec's own section stays open.

## Owner decisions still open

| # | Spec | Decision |
|---|---|---|
| 1 | F-PLC-001 | With romanization visible (D2), the default check is 9 questions, below the 12 floor. Accept 9, pad `always` runs with two extra oral draws, or make hiding an explicit first choice with no pre-selection. |
| 2 | F-PLC-001 | Free-tier learner placed at Stage 2 or above: no entitled start quest, then stories or the map, no paywall and no price. Confirm, or keep today's open Stage 2 taste quests on the cursor. Confirm the grown-up wording "not included with this account yet". |
| 3 | F-PLC-001 | The gloss of a picture option is withheld on an open placement item (narrow exception to the CLAUDE.md §1 gloss rule). |
| 4 | F-PLC-001 | Approve the new directory `content/placement/` (CLAUDE.md §2 edit is in PR P-0). |
| 5 | F-TCH-004 | Approve bundling a Noto Sans KR subset (SIL OFL 1.1, up to 150 KB): the first third-party font (D7 says no external assets for visuals). PR 3 waits for this. |
| 6 | F-TCH-004 | Initials in shareable links: the spec makes names and initials message-only; a copied link always opens a numbers picker. |
| 7 | F-TCH-004 | Teacher un-mute scope: device-wide (`device:audio`) or session-only (needs an F-AUDIO-004 amendment). |
| 8 | F-TCH-004 | Timer chime: follow the device mute (current) or visual-only. |
| 9 | F-VOC-003/005 | Home slot 3 order: vocabulary (3+ words due) first, then replay, then story; the alternative (replay first) means the vocabulary card almost never shows. |
| 10 | F-VOC-003 | Library tab label "Words" instead of "Theme packs". |
| 11 | F-VOC-005 | Keep the two refinements on the `vocab` wire schema (a client bug would 422 an upload and stop sync for that learner) or make it lenient. |
| 12 | F-VOC-002 | `vocab.red` is only ΔE 3.4 from the danger red; needs a design pass. 강아지 is glossed "puppy" though it is the everyday word for a dog. |
| 13 | all | Design mocks for the presenter, layout, vocabulary, placement and planner screens before their UI PRs. |
| 14 | all | Native review: Korean (owner) of the word lists, descriptions, sentence/reply templates and `잠깐`; Spanish (external) of every es string and gloss. |

## Telemetry names added by these specs

# Telemetry event names — consolidated list after review 2 (2026-10-10)

Supersedes `TELEMETRY-NAMES.md` (review 1, 26 names for six specs). This file lists **every** name in `TELEMETRY_EVENT_NAMES` on `main`, the names waiting in an open PR, and every name the specs of both review rounds add, with the owner and the PR that adds and emits it. It was cross-checked by script against the text of F-AUDIO-004 and F-STORY-001..006 (every name below appears in the spec that owns it; no spec mentions a name that is not in this file).

Source of truth in code: the `TELEMETRY_EVENT_NAMES` array in `packages/content-schema/src/schemas/telemetry.ts` (lines 9-43 at `c939348`: **32 names**). The learner app's `track()` type and the Worker whitelist (`packages/backend/src/routes/telemetry.ts` -> `isTelemetryEventName`) both read it; an unknown name is rejected with 422 and silently dropped by the client (`apps/mobile/src/platform/telemetry.ts:40-58`).

Rules that apply to every row:

1. **Worker first, app second**: the PR that adds a name to the shared list is deployed to the Worker before the app release that sends it.
2. Every PR that adds a name also updates the exact-list assertion in `packages/content-schema/src/__tests__/telemetry.test.ts` (lines 5-43; the list is `.sort()`ed, so placement is free). `packages/backend/src/__tests__/telemetry.test.ts` iterates the shared list. Several PRs append to the same array: rebase conflicts are mechanical.
3. Payloads carry ids, codes and counts only: no names, no free text, no email, no voice names. `profileId` rides in the envelope. `learnerType` is never sent (owner answer, review 1 question 2).
4. **Convention**: a unit's lifecycle is `<unit>.start` / `<unit>.complete` (`quest.start`, `episode.complete`, `stage.complete`, `review.start`, `card_set.complete`); a step that ends inside a game or a screen is `<thing>.finished` (`minigame.finished`, `story.check.finished`, `story.read.finished`); a discrete user action or observation is past tense (`locale.changed`, `audio.fallback_shown`, `story.sources.opened`). Names are namespaced by the owning feature, never bare. Two namespaces are new in review 2: `audio.` (F-AUDIO-004) and `journey.` (map/grid events, F-STORY-005).

## A. On `main` today (32)

`session.start` · `session.end` · `episode.start` · `episode.complete` · `quest.start` · `quest.complete` · `round.correct` · `round.wrong` · `card.unlocked` · `card.first_earned` · `profile.switch` · `parent.gate.opened` · `onboarding.started` · `minigame.finished` · `space.join.attempted` · `space.join.succeeded` · `space.join.failed` · `space.left` · `space.relink.requested` · `space.relink.approved` · `space.relink.denied` · `paywall.viewed` · `paywall.console_opened` (23 original) · `locale.changed` · `romanization.mode_changed` (F-I18N-001, #100) · `onboarding.who_selected` · `onboarding.level_selected` · `onboarding.consent_given` · `profile.updated` · `pin.created` · `pin.reset_requested` · `pin.reset_completed` (F-LEARN-001, #101).

## B. In an open PR (6): F-QUEST-002 Q-1, PR #103

`quest.discover_completed` `{ questId, pages, heard }` · `quest.check_completed` `{ questId, firstTryCorrect, retries }` · `quest.teaser_tapped` `{ fromQuestId, toQuestId }` · `stage.complete` `{ stageKey, cardsAwarded }` · `review.start` `{ kind, stageKey, hideRomanization }` · `review.complete` `{ kind, stageKey, symbolsCorrect, wordsCorrect, retries, stars }` (internal).

## C. New names of the F-STORY chain (21)

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `story.check.answered` | F-STORY-003 §3.9 | `{ storyId, level, checkId, kind, firstTry, taps }` | 3.1 | 3.4a |
| 2 | `story.check.finished` | F-STORY-003 §3.9 | `{ storyId, level, items, firstTryCorrect, retries }` | 3.1 | 3.4a |
| 3 | `story.sequence.finished` | F-STORY-003 §3.9 | `{ storyId \| null, sequenceId, slots, firstTryCorrect, retries, replayed, skipped }` | 3.1 | 3.5a |
| 4 | `story.recap.word_played` | F-STORY-003 §3.9 | `{ storyId, wordId }` | 3.1 | 3.4b |
| 5 | `story.results.action` | F-STORY-003 §3.9 | `{ questId, storyId, action: 'next-story' \| 'read-again' \| 'episode' \| 'home' \| 'culture-note' }` | 3.1 | 3.7 |
| 6 | `story.shelf.viewed` | F-STORY-004 §3.11 | `{ section: 'story-time' \| 'culture', stories, started, finished }` | 4.3a | 4.5 |
| 7 | `story.opened` | F-STORY-004 §3.11 | `{ storyId, source: 'home' \| 'library' \| 'episode' \| 'results', mode: 'start' \| 'continue' \| 'restart' \| 'play-again' \| 'read-again' }` | 4.3a | 4.4a, 4.5, 4.6 |
| 8 | `home.story_card.shown` | F-STORY-004 §3.11 | `{ storyId, reason: 'continue' \| 'next' \| 'again' }` | 4.3a | 4.4a |
| 9 | `story.bookmark.resumed` | F-STORY-004 §3.11 | `{ storyId, sceneIndex }` | 4.3a | 4.4b |
| 10 | `culture.note.viewed` | F-STORY-004 §3.11 | `{ noteId, storyId }` | 4.3a | 4.7 |
| 11 | `story.locked.tapped` | F-STORY-004 §3.11 | `{ storyId }` (only when gating is switched on) | 4.3a | 4.5 |
| 12 | `story.read.finished` | F-STORY-002 §3.12 | `{ storyId, level, mode: 'quest' \| 'replay', scenes, scenesSeen, linesPlayed, termsOpened }` | 2.1 | 2.6a |
| 13 | `story.sources.opened` | F-STORY-002 §3.12 | `{ storyId, from: 'reader' \| 'end' \| 'episode' \| 'notes' \| 'scene', factId? }` | 2.1 | 2.7 |
| 14 | `story.sources.link_opened` | F-STORY-002 §3.12 | `{ storyId, factId }` (after the grown-up gate, on a successful hand-off) | 2.1 | 2.7 |
| 15 | `journey.cell_stories_opened` | F-STORY-005 §3.11 | `{ stageKey, themeKey, stories, source: 'cell' \| 'lesson-row' \| 'story-pill' }` | 5.5b | 5.5b |
| 16 | `card.catchup_granted` | F-STORY-006 §3.9 | `{ count, episode, stage, welcome, quest, set }` (one per reconcile that adds more than the welcome card) | 6.2 | 6.4b |
| 17 | `card_set.complete` | F-STORY-006 §3.9 | `{ setId, cardsAwarded }` | 6.2 | 6.4b |
| 18 | `audio.capability_checked` | F-AUDIO-004 §3.14 | `{ platform, engine: 'clips+tts' \| 'tts' \| 'clips' \| 'none', koVoice: 'none' \| 'network' \| 'local' \| 'enhanced' \| 'premium', reason? }` (once per session) | A-1 | A-4a |
| 19 | `audio.fallback_shown` | F-AUDIO-004 §3.14 | `{ source, reason: 'muted' \| 'no_voice' \| 'error' \| 'blocked' }` (once per session, source, reason) | A-1 | A-5a, A-5b, 002 2.6a, 003 3.4a |
| 20 | `audio.mute_changed` | F-AUDIO-004 §3.14 | `{ muted, source: 'profile' \| 'fallback_panel' }` | A-1 | A-4a |
| 21 | `audio.playback_failed` | F-AUDIO-004 §3.14 | `{ kind: 'clip' \| 'tts', reason: 'missing' \| 'fetch' \| 'decode' \| 'blocked' \| 'timeout' \| 'engine' }` (at most 3 per session) | A-1 | A-3, A-4a |

`source` values for the two audio events that other specs rely on: `match-sound`, `discover`, `listen-pick`, `trace`, `story-reader`, `story-check`, `story-order`.

**Total after every spec above lands: 32 + 6 + 21 = 59 names.** (Review 1 listed 26 new names; 11 of them are rows 1-11 here, 9 landed in #100/#101, 6 are in #103. Review 2 adds rows 12-21: 10 names.) F-STORY-001 defines no event.

## D. Changed payloads of existing names (no list change; the Worker accepts any payload)

| Name | Change | Owner |
|---|---|---|
| `onboarding.started` | `{ ageGroup, firstRun, hasParentEmail }` -> `{ level, firstRun, hasEmail }` (strict schema in `packages/content-schema/src/schemas/onboarding-telemetry.ts`, PR #101; `learnerType` is never sent, owner answer 2026-10-10) | F-LEARN-001 |
| `card.unlocked` | gains `source: 'quest' \| 'episode' \| 'stage' \| 'welcome' \| 'set'` and optional `episodeId`; retro awards (reconcile) emit none | F-STORY-006 §3.9 |
| `episode.complete` | whitelisted since the start, **finally emitted**: `{ episodeId, cardsAwarded }` | F-STORY-006 §3.3 |

## E. Renames made by review 2

| Old (as drafted) | New | Why |
|---|---|---|
| `story.source.link_opened` | `story.sources.link_opened` | the sibling event is `story.sources.opened`; one namespace segment, not `story.source` next to `story.sources` |

(Review 1 renames stay: `locale.change` -> `locale.changed`, `romanization.mode_change` -> `romanization.mode_changed`, `discover.completed` -> `quest.discover_completed`, `check.completed` -> `quest.check_completed`, `teaser.tapped` -> `quest.teaser_tapped`, `stage.completed` -> `stage.complete`, `review.started/completed` -> `review.start/complete`.)

## F. Checks run

- No duplicate within section C and none collides with sections A or B (script, 59 distinct names).
- Every name in C appears in the spec that owns it and in no other spec under a different spelling (script over F-AUDIO-004 and F-STORY-001..006 and the wireframes; the only other mentions are cross-references, e.g. F-STORY-002 citing F-STORY-004's `story.opened`).
- `stage_anchor_accuracy` (F-RVW-001 §3.4) is superseded by `review.complete` (F-QUEST-002 Q-11 amends F-RVW-001).
- Specs outside both reviews (F-VOC-001..005, F-PLC-001, F-PLAN-002, F-TCH-004, F-LAYOUT-001) must add their names here and follow the convention; they must not reuse any `story.*`, `audio.*`, `journey.*`, `card.*` or `culture.*` name above.
- The web console has no telemetry client (F-I18N-001 §3.12), so no console event is defined.

## G. Vocabulary names (F-VOC-003/004/005; added by the VOC review of 2026-10-10)

Seven names, none colliding with sections A-C (script over all three lists), all in the `vocab.` namespace except the Home card, which follows `home.story_card.shown`. Same Worker-first rule: each PR that adds names ships and deploys before the app release that sends them.

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `vocab.topic_opened` | F-VOC-003 §3.7 | `{ topicKey, source: 'library' \| 'home' \| 'plan' \| 'results' }` | C-1 | C-4 |
| 2 | `vocab.cards.start` | F-VOC-003 §3.7 | `{ topicKey, chunk, chunks, words, level }` | C-1 | C-5 |
| 3 | `vocab.cards.complete` | F-VOC-003 §3.7 | `{ topicKey, chunk, words, gotIt, again, heard, newlyCollected, checkFirstTry, checkQuestions }` | C-1 | C-5 |
| 4 | `vocab.round.start` | F-VOC-004 §3.10 | `{ topicKey, mode, clockScale, optionCount, level, questions, audio }` | S-1 | S-5 |
| 5 | `vocab.round.complete` | F-VOC-004 §3.10 | `{ topicKey, mode, endedBy, answered, firstTryCorrect, hinted, caught, stars, pauses, activeMs, newBest }` | S-1 | S-5 |
| 6 | `vocab.challenge_toggled` | F-VOC-004 §3.10 | `{ on, source: 'profile' \| 'start_sheet', clockScale }` | S-1 | S-6 |
| 7 | `home.vocab_card.shown` | F-VOC-005 §3.9 | `{ topicKey, due }` | P-1 | P-3 |

`source` values for `audio.fallback_shown` that the VOC specs add to the list in section C: `vocab-card` (F-VOC-003), `vocab-speed` (F-VOC-004).

**Total after every spec above lands: 38 on `main` (section A had 32 before #103) + 21 (C) + 7 (G) = 66 names** (section B's six are already on `main` since #103).

## Amendments to landed specs

# Amendments to the four landed specs (review 2, 2026-10-10)

The four specs below are in `docs/specs/` (read-only for the reviewer). The seven specs under review change or depend on them in the places listed. Apply with a small `docs(specs)` PR (or inside the PR named in the last column). Nothing here changes a decision of the landed specs; each item removes a contradiction.

| # | Landed spec | Where | Change | Caused by | Apply in |
|---|---|---|---|---|---|
| 1 | F-QUEST-002 | §3.12 (interim spoken forms) | initial ㅇ is spoken by its name 이응, not 아 (same audio as the vowel ㅏ) | F-AUDIO-004 AD2 | F-QUEST-002 Q-3a (or a docs PR before it) |
| 2 | F-QUEST-002 | §3.12 | "F-AUDIO-004 replaces the values, not the shape" -> it replaces the interim file by `JamoSchema` data read through `spokenFor()`; only ㅇ differs | F-AUDIO-004 PR A-2 | same |
| 3 | F-QUEST-002 | §3.2 item 1 (Discover, Hear it) | Hear it plays the sound (for ㅇ the name); the letter name is a separate optional button | F-AUDIO-004 §3.1 | same |
| 4 | F-QUEST-002 | §3.2 (fallback line) | "Say it out loud" shows the spoken romanization (`ga`), not the tile value (`g/k`) | F-AUDIO-004 §3.1 rule 5 | same |
| 5 | F-QUEST-002 | §9 assumption 2 | carrier question closed: ㅏ | F-AUDIO-004 AD2 | same |
| 6 | F-CNT-002 | §3.4 class A scope | the scan skips `content/stories/research/` (provenance data, `rr` keys, hyphenated romanization in one value) | PR #104 + F-STORY-001 §3.1 | F-STORY-001 PR 1.3 |
| 7 | F-CNT-002 | §3.4 class A (R-rules) | an empty `romanization` in a `state: 'draft'` story is a warning, an error in `ready` | F-STORY-001 §3.2.4 | F-STORY-001 PR 1.3 |
| 8 | F-I18N-001 | §3.6 `OVERLAY_FIELDS` | row for id prefix `story:` (field paths in F-STORY-001 §3.12) and the `overlay-token-mismatch` rule | F-STORY-001 | F-STORY-001 PR 1.3 (already stated there) |
| 9 | F-I18N-001 | §3.2 `ProfileSettingsSchema` | additive optional `readToMe?: boolean` | F-STORY-002 §3.4 | F-STORY-002 PR 2.5 (already stated there) |
| 10 | F-QUEST-002 | §3.1 `ko-text.ts` | add two additive exports, `KoTextShape` (un-refined object) and `refineKoText`, because `KoTextSchema` is a `ZodEffects` and cannot be `.extend()`ed | F-STORY-001 §3.2 | F-QUEST-002 Q-1 (PR #103, still open: add to it) or F-STORY-001 PR 1.1a |
| 11 | F-STORY-004 | §3.3 `LIBRARY_SECTIONS` row `theme-packs` | title "Theme packs" -> **"Words"** (id unchanged; availability = `flags.vocabTopicsEnabled && visibleTopics().length > 0`, registered by F-VOC-003) | F-VOC-003 T1 (VOC review) | F-VOC-003 PR C-4 (or a docs PR before it) |
| 12 | F-STORY-004 | §3.7 preference-chain table, row "③, no daily test" | `next` story -> best remaining replay -> `again` story -> `explore` becomes **vocabulary card (>= 3 due words, flag on) -> `next` story -> replay -> `again` -> `explore`**; slot ① unchanged | F-VOC-005 §3.7 (VOC review; owner decision recorded there) | F-VOC-005 PR P-3 (rebase against 4.4a) |
| 13 | F-I18N-001 | §3.6 `OVERLAY_FIELDS` table | two rows: `vocab:` -> `gloss`, `senseNote`; `vocab-topic:` -> `title`, `blurb`, `hoyaIntro` (entity ids come from the `id` fields of item and topic objects, so `overlay-unknown-id` needs no new code) | F-VOC-001 §3.7 | F-VOC-001 PR V-2a (after F-I18N-001 PR 12) |
| 14 | F-RVW-001 (draft) | §3.7 Challenge mode bullet | "off by default; turned on by the learner or a caregiver" is stored in **`ProfileSettings.challengeMode`** (F-VOC-004 S8, one Challenge switch for the whole app) | F-VOC-004 | F-VOC-004 PR S-1 (or when F-RVW-001 is readied) |
| 15 | F-TCH-004 (under review elsewhere) | `LectureBlockSchema` vocab block (`topicId: /^vocab:[a-z0-9-]+$/`) | topic ids are **`vocab-topic:<key>`** and word ids `vocab:<slug>` (F-VOC-001 §3.2); the draft's `vocab:` prefix would collide with the item namespace | F-VOC-001 | F-TCH-004 PR 9 |

Item 1-5 as a diff against the landed file (the amended copy is `F-QUEST-002-discover-check-stage1-complete.md` in this folder):

```diff
--- /Users/ggoboogi/workspace/Hangul_Route/docs/specs/F-QUEST-002-discover-check-stage1-complete.md	2026-10-10 14:17:01
+++ F-QUEST-002-discover-check-stage1-complete.md	2026-10-10 16:13:04
@@ -104,7 +104,7 @@
 
 **Pages.** One page shows one or two items (§3.1). Per `jamo` item (rendered with `KoreanText`, F-I18N-001 §3.5):
 
-1. the glyph large (`touchTarget.hero`-scale type), its romanization (`g/k`, `eu`, ...; for ㅇ `silent/ng`, never `∅`, audit F08) and a **Hear it** button (speaker icon, label, >= `touchTarget.child`);
+1. the glyph large (`touchTarget.hero`-scale type), its romanization (`g/k`, `eu`, ...; for ㅇ `silent/ng`, never `∅`, audit F08) and a **Hear it** button (speaker icon, label, >= `touchTarget.child`; it plays the symbol's **sound** — for the silent initial ㅇ its name 이응 — never the letter name of the other consonants, F-AUDIO-004 §3.1; the letter name is a second, optional **Letter name** button, same spec);
 2. `soundHint` under it ("soft, light g ..."; full draft table in Appendix A);
 3. for a **batchim** item a `SyllableBlock` diagram (new, `packages/design-system/src/components/SyllableBlock/`, tokens only, three boxes initial / vowel / final with the final highlighted) and the line "sits at the bottom of the block";
 4. the example word (`KoreanText` with romanization and gloss) with the syllable block that contains the symbol emphasised (the block is found by Hangul decomposition, `logic/stage1/hangul.ts`), and its picture when `picture` resolves; its own **Hear it** button speaks `example.spokenKo ?? example.ko`.
@@ -112,7 +112,7 @@
 `word` items render the word, romanization (`syllables` joined with a thin separator **in the teaching UI only**, D13), gloss, picture, **Hear it**, and `noteEn` if any.
 
 - **Given** a page opens, **then** nothing autoplays (browsers and iOS block audio outside a gesture, audit AUD-06); the first Hear it button pulses once (static under reduced motion). **When** a Hear it button is tapped, **then** the audio plays through the prompt-audio contract (§3.12) and a tiny "heard" mark appears on that item (a fill-only marker; it never gates Continue).
-- **Given** audio is unavailable or muted (`PlayResult` is `unavailable` or `muted`), **then** the item shows its sound as text — romanization is already visible, and the line "Say it out loud: <romanization>" appears — and nothing else changes (F-001 §3.3 spirit; D6 text fallback).
+- **Given** audio is unavailable or muted (`PlayResult` is `unavailable` or `muted`), **then** the item shows its sound as text — romanization is already visible, and the line "Say it out loud: <spoken romanization>" appears (the romanization of the syllable the voice would have said — `ga` for ㄱ, `ak` for the final ㄱ, `ieung` for ㅇ — F-AUDIO-004's `spokenRomanization`, not the tile value `g/k`) — and nothing else changes (F-001 §3.3 spirit; D6 text fallback).
 - **Given** `romanizationMode === 'tap'` (F-I18N-001 `ProfileSettings.romanizationMode`, read through `useLocaleStore`; **until F-I18N-001 PR 3 exists the mode is the constant `'always'`** and this branch is dead code behind the same `romanizationShown(mode, revealed)` signature, D2 opt-in), **then** romanization on the example word is hidden behind a "Show how to say it" tap; the symbol's own romanization stays visible (it is the thing being taught) and the gloss is never hidden.
 - **Given** the last page and Continue, **then** `advance()` runs and `quest.discover_completed` fires `{ questId, pages, heard }` (`heard` = number of distinct Hear it taps). Back / Leave behaves like any step (run discarded after confirm).
 - **Given** reduced motion, **then** the pulse and the page slide are replaced by an instant change (`platform/motion.ts` `useReducedMotion`, as `ResultsScreen.tsx:54`).
@@ -351,7 +351,7 @@
 export type PlayResult = 'played' | 'muted' | 'unavailable';
 export function playPrompt(spec: { text: string; audioRef?: string; language?: 'ko-KR' | 'en-US' }): Promise<PlayResult>;
 ```
-`text` is `item.spokenKo ?? item.ko`; for a symbol it is `jamo.spokenKo` (consonant spoken as a sound with a carrier vowel, batchim as a short closed syllable such as 악 안 알 암 압 앙; D6, audit F01 / AUD-08), **not** the letter name. If F-AUDIO-004's data is not in yet, Q-3a adds `logic/stage1/spoken.ts` with the interim map (consonant + ㅏ carrier: 가 나 다 라 마 바 사 아 자 차 카 타 파 하; vowels as their ㅇ-syllables 아 야 어 여 오 요 우 유 으 이; batchim as above) used only when `spokenKo` is absent; F-AUDIO-004 replaces the values, not the shape. If F-AUDIO-004 has not added `playPrompt`, Q-3a adds a thin one: `muted` when `isMuted()` (`platform/audio.ts:15-17`), `unavailable` when the speech engine reports an error or no voice exists, else `played` on `onDone`. **Code fact**: `speak()` currently wires `onDone`, `onStopped` **and** `onError` to the same `opts.onDone` (`platform/audio.ts:36-38`), so a failure is indistinguishable from a normal end; the shim therefore adds an optional `onError?: () => void` to `SpeakOptions` (`audio.ts:19-24`, existing callers unchanged) and routes `Speech.speak`'s `onError` to it. `SpeakOptions.language` is `'ko-KR' | 'en-US'` today; widening it to the UI-locale tags (`es-US`) is F-AUDIO-004's change. `audioRef` wins over TTS when a recording exists (D6, owner task T-017).
+`text` is `item.spokenKo ?? item.ko`; for a symbol it is `jamo.spokenKo` (consonant spoken as a sound with a carrier vowel, batchim as a short closed syllable such as 악 안 알 암 압 앙; D6, audit F01 / AUD-08), **not** the letter name. If F-AUDIO-004's data is not in yet, Q-3a adds `logic/stage1/spoken.ts` with the interim map (consonant + ㅏ carrier: 가 나 다 라 마 바 사 자 차 카 타 파 하; **initial ㅇ by its name 이응**, because 아 is the same audio as the vowel ㅏ and the two could not be told apart by ear — F-AUDIO-004 AD2, `spokenKind: 'name'`; vowels as their ㅇ-syllables 아 야 어 여 오 요 우 유 으 이; batchim as above) used only when `spokenKo` is absent; F-AUDIO-004 PR A-2 replaces the interim file by data on `JamoSchema` (`spokenKo`, `spokenRomanization`, `spokenKind`, `nameKo`; read through its `spokenFor()`): the values are the same, the shape is not, and the one value that differs is ㅇ (이응). If F-AUDIO-004 has not added `playPrompt`, Q-3a adds a thin one: `muted` when `isMuted()` (`platform/audio.ts:15-17`), `unavailable` when the speech engine reports an error or no voice exists, else `played` on `onDone`. **Code fact**: `speak()` currently wires `onDone`, `onStopped` **and** `onError` to the same `opts.onDone` (`platform/audio.ts:36-38`), so a failure is indistinguishable from a normal end; the shim therefore adds an optional `onError?: () => void` to `SpeakOptions` (`audio.ts:19-24`, existing callers unchanged) and routes `Speech.speak`'s `onError` to it. `SpeakOptions.language` is `'ko-KR' | 'en-US'` today; widening it to the UI-locale tags (`es-US`) is F-AUDIO-004's change. `audioRef` wins over TTS when a recording exists (D6, owner task T-017).
 
 ### 3.13 Telemetry (added to `TELEMETRY_EVENT_NAMES`, `packages/content-schema/src/schemas/telemetry.ts:9-33`, so the API whitelist and `track()` stay one list)
 
@@ -519,7 +519,7 @@
 ## 9. Unverified assumptions and open items
 
 1. **Pedagogy and wording are drafts.** Appendix A sound hints, the choice of 60 reading words, the 4-5 minute estimate (blueprint says 3-4) and the "twin sounds" framing for ㅋ ㅌ ㅍ are authored here without a native review or a playtest. Romanization values follow D13 / F-CNT-002 by hand and were **not** run through the `rr.py` converter.
-2. **Interim spoken forms** (`logic/stage1/spoken.ts`) assume a consonant + ㅏ carrier is acceptable for isolated sounds; F-AUDIO-004 may choose another carrier (e.g. ㅡ). Until recordings exist TTS quality varies (audit F09).
+2. **Interim spoken forms** (`logic/stage1/spoken.ts`) assume a consonant + ㅏ carrier is acceptable for isolated sounds; **Closed by F-AUDIO-004 (review 2):** the carrier is ㅏ (AD2) and initial ㅇ is spoken by its name. Until recordings exist TTS quality varies (audit F09).
 3. **Cross-spec contracts not yet implemented in code:** F-STORY-003 `ChoiceCard`, F-STORY-006's award engine, F-AUDIO-004 `playPrompt` / `spokenKo`, F-I18N-001 `KoreanText` / `romanizationShown`, a shared `MinigameHost`. This spec names the member shapes it needs; if a sibling spec lands different names the Q-PRs adapt, not the behaviour.
 4. **`HeritageCardArt` as a vocabulary picture** (stylised card art for 산, 달, 연, 팽이 ...) has not been tested for recognisability at 96 dp on a 320 px screen; the gloss label under each option is the safety net.
 5. **expo-speech error reporting** on web / iOS is the basis of `unavailable`; if it does not fire reliably the text prompt would show only when muted. F-AUDIO-004's capability check is the better signal.
```

---

## Review log: REVIEW-VOC — independent review of F-VOC-001..005 and three wireframes (2026-10-10)

Reviewed against `origin/main` at `ecf6365` (PRs #98-#105 merged; the author wrote the specs against `c939348`, so #103 `ko-text.ts` + 6 telemetry names, #104 research files and #105 landed specs were new to them). Throwaway worktree `/Users/ggoboogi/workspace/.hr-wt/review-voc`; the repo checkout was not touched. All edits are in `specs-out/` (originals kept in `scratchpad/reviews/before/`). Companion edits: `TELEMETRY-NAMES-2.md` (new section G, 7 names) and `AMENDMENTS-LANDED-SPECS.md` (rows 11-15).

## 1. Result

| Spec | Status | Why |
|---|---|---|
| F-VOC-001 vocabulary schema, 144 words, pipeline | **ready** | 4 blockers found and fixed (below); nothing open that stops V-1 / V-2a |
| F-VOC-002 WordArt | **ready** | 1 ordering blocker fixed (colour-object glyphs), W-1 split in three |
| F-VOC-003 topic picker, flashcards | **ready** | Library slot and dependency ids fixed; tile meter fixed |
| F-VOC-004 Speed Round | **ready** | view split out (S-4b), hints/P3 contradiction closed |
| F-VOC-005 progress, SRS, sync | **ready** | Worker claims verified; preserve rule/reset/summary and pre-hydration races fixed; Home slot ③ reconciled (owner decision) |
| wireframes `vocab-topics`, `vocab-flashcards`, `vocab-speed-round` | updated | tile meter, slot note, hint note |

No spec needed to be set back to `draft`. Two owner decisions and the native review are open (section 5).

## 2. How it was checked

- **Citations**: 98 distinct `file:line` cites parsed mechanically from the five specs and the wireframes, plus about 30 cites in prose form (`:50`, `:101-102`, ...) read by hand; each resolved in the worktree and the cited lines read against the claim. **About 20 were stale or wrong (16 %)**: all `validate-content.mjs` lines (shifted by #104), `telemetry.ts:9-43` / `telemetry.test.ts:5-34` (now 9-50 / 5-49), `progress.ts:75-86` (now 77-88), `schemas/sync.ts:41-48 / 12-38 / 79-85` (now 49-55 / 14-45 / 88-94), `sync-api.ts:145-148` (the conflict cast is 138-141; 145-148 is `issueRescueCode`), `0001_schema_v1.sql:30` (**wrong table**: the sync route uses `snapshots` in `0002_schema_v2.sql:32-41`), `CardDetailScreen.tsx:101-107` (102, 104-108), the HEAD hash. All corrected. Every other cite (tokens, flags, merge, engine, progress-store, mission-builder, HomeScreen, rollup, console page, Library, navigation, round-builder, score, first-try, quest-run-store, MinigameScreen, CultureQuizGame, heritage cards, `supportedCardIds` ids, `tokens-parity`, `vitest` configs, `banned-text`) was correct.
- **Sync / Worker**: read `packages/backend/src/routes/sync.ts`, `db/d1.ts` (`putSnapshot` CAS, JSON text columns), `store.ts`, `recovery.ts`, `apps/api/migrations/0002_schema_v2.sql`, `apps/mobile/src/logic/sync/{merge,engine,scheduler,restore,backup}.ts`, `platform/sync-api.ts`, `store/progress-store.ts`.
- **Korean**: all 144 words parsed from the spec text and run through the shipped `romanizeWord` / `checkRomanization` (copy of `packages/content-schema/src/romanization` from `origin/main`, `reviews/rrts`, run with `node --experimental-strip-types`): **144 of 144 equal the converter**; the only duplicate `ko` / romanization pairs are the intended homonyms (눈, 배). The same extractor was run over `apps/**`, `packages/**` and `content/**` to compare the launch words with the existing sources (section 3, F4).
- **Colours**: the contrast and colour-vision numbers of F-VOC-002 §3.4 were recomputed (WCAG contrast, CIEDE2000, Machado matrices): every number in the spec reproduces (closest normal-vision pair 21.1; protan red/brown 2.4; deutan blue/purple 5.0; tritan orange/pink 7.6; non-text contrast 1.4/1.6/1.1/2.1/2.3/2.5). Two claims did not: `vocab.red` vs `feedback.danger` is only CIEDE2000 3.4 ("visibly different" is too strong) and the outline contrast is 15.2:1 not 14:1.
- **Validator**: `scripts/validate-content.mjs` was run on a sample `content/` tree built from the spec's shapes (`reviews/vcroot`): a `ko` overlay with Hangul fails (`korean-in-ui-field`), and a `_senses.json` with a `ko` field and no romanization fails (`korean-without-romanization` + `korean-without-gloss`).

## 3. Findings

Severity: **B** blocker (would break CI/compile or the PR order), **H** high, **M** medium, **L** low. "Fixed" = edited in the specs.

### F-VOC-001

| # | Sev | Finding | Change |
|---|---|---|---|
| F1 | B | `content/vocab/_senses.json` stores a `ko` string per group with no `romanization` / `en` beside it; `validate-content.mjs:88-108` (run) fails the file, so CI would be red from V-2 on | `ko` removed from `VocabSensesFileSchema`; the homonym is detected from the items' own `ko`; table column marked documentation-only; V1 now says every Hangul-bearing object must carry romanization and gloss |
| F2 | B | `titleKo: KoTextSchema.pick({...})`: `KoTextSchema` is a `ZodEffects` (it has a `superRefine`, `ko-text.ts`), which has no `.pick` / `.extend` | `titleKo: KoTextSchema` used whole; §3.1 states the limit. The spec also still said `ko-text.ts` might not exist: it does (F-QUEST-002 Q-1, #103) |
| F3 | B | "`romanization-content.test.ts` already scans the JSON, so a vocabulary file is checked the moment it exists": that suite and `romanization-coverage.test.ts` / `ROMANIZATION_SCAN_IGNORE` are F-CNT-002 **PR 3** and are not on `main` (only PR 1 shipped) | §1 and §3.7 rewritten: V-2a's own `vocab-content.test.ts` runs `checkRomanization`; the ignore-list registration is done by whichever of PR 3 and V-3 lands second |
| F4 | B | R5 consistency (`checkConsistency`, hyphens included): 12 launch words (강아지, 나비, 라면, 사과, 호랑이, 야구, 여우, 오리, 토끼, 아빠, 우유, 윷놀이) already exist hyphenated in `content/episodes/stage-1/{jamo,cards}.json` and `apps/web/src/data/stage1-cards.ts` (script). The spec named only 강아지 and 윷놀이 and made only Animals wait for PR 2b, so Food (V-2) would have gone red | `vocab-romanization-consistent` is switched on with F-CNT-002 PR 3 / after PR 2b; V-5, V-6a, V-6b name the words that wait; the list is in §1 |
| F5 | H | `id` of the topic: F-I18N-001's `overlay-unknown-id` resolves entity ids from `id` fields; the topic object had only `key`, so every `vocab-topic:*` overlay would be "unknown" | topic gains `id: 'vocab-topic:<key>'` + a refinement; overlay file shape stated |
| F6 | H | `ko` overlays with Hangul fail `validate-content.mjs` until F-I18N-001 PR 12 makes it overlay-aware (run) | V-2b states it: `content/i18n/ko/vocab-*.json` is committed only after PR 12 |
| F7 | M | V-2 and V-6 too large (generator + validator + CI + data + overlays; 96 words) | V-2 split into V-2a (pipeline) / V-2b (Food); V-6 into V-6a / V-6b |
| F8 | M | §3.7 put the accessors in `src/content/vocab.ts` "100 % covered", §5 in `logic/vocab/catalog.ts` (the coverage `include` has `src/logic/**` only, `vitest.config.ts:33`) | §3.7 and the test table aligned to `logic/vocab/catalog.ts` + a 3-line binding |
| F9 | M | `flags.vocabShowDrafts` used by V-3 but registered nowhere; V-3 would depend on F-VOC-003's flags module | accessor takes `showDrafts`; the flag is registered by F-VOC-003 C-3 |
| F10 | M | Sense rules did not require a launch member's item to name its `senseGroup`, so `sameSense` could miss a homonym | rule (e) added |
| F11 | M | 나 (pronoun) was in Family but `pos` allowed only noun/number at launch | `pronoun` added to `VocabPosSchema` |
| F12 | M | Family glosses "older sister (a girl says this)" speak to children only; learners are any age (D1) | "said by a woman or girl" / "said by a man or boy" (39 chars max, within `en` max 40); senseNote updated |
| F13 | L | "crayon box", "a child sees", "words a child says first" in selection rules; Food rule said "at most three" Korean items but lists four; Science "level 2-3" contradicts the syllable rule; `visual-count` exemption named only Numbers | all reworded; 강아지-is-also-"dog" note added |
| F14 | L | `content-validation.yml` already has `paths: content/**`; the spec said it "gains" them; `VocabTopicFileSchema` had no refinement for `coverItemId` although §8 relies on it | corrected |

### F-VOC-002

| # | Sev | Finding | Change |
|---|---|---|---|
| W1 | B | The Colors swatches draw `animal-bear`, `animal-elephant`, `nature-cloud`, `nature-flower` (§3.6.1), but batch W-3 (Colors) came before Animals (W-4) and Nature (W-5): the registry cannot hold a swatch whose object is missing | those four glyphs move to W-3 (still counted in their own families); §3.12 batches and §6 table renumbered and made consistent (§3.12 used W-2..W-5, §6 W-3..W-6) |
| W2 | H | W-1 bundled tokens, 9 pure modules, 4 generators, a component, the brief, tests and 25 glyphs (well over L) | W-1a tokens + `card-ids` (S), W-1b core (M), W-1c generators + component + brief (M) |
| W3 | M | `vocab-keys.test.ts` "every glyph used exactly once" fails for any glyph whose topic JSON is not merged yet, blocking W-1/W-3 before V-5/V-6 | rule applies per existing topic file |
| W4 | M | `vocab.red` is only CIEDE2000 3.4 from `feedback.danger`; contrast of the outline is 15.2:1 | claims corrected; the import guard, not the hue, is the protection; design review may move the red |
| W5 | L | `COLOR_CONFUSION_PAIRS` had no file; F-VOC-004 needs it without React | `word-art/color-confusion.ts`, exported from `./word-art`; F-VOC-004 S-2 depends on W-1b |
| W6 | L | batches were `design(...)` commits but are TypeScript data with tests | `feat(design-system)`; the contact sheet is the design mock |

### F-VOC-003

| # | Sev | Finding | Change |
|---|---|---|---|
| C1 | H | F-STORY-004 §3.3 reserves Library section `theme-packs` titled "Theme packs" and says F-VOC-003 registers it; this spec called it "Words" and deferred to an entry card | T1 now registers `theme-packs`, retitled **Words** (amendment row 11), with its availability rule; entry card remains the fallback if the tabs have not landed |
| C2 | H | 12-dot `Progress variant="dots"` is 232 dp wide, a 2-column tile at 360 dp is about 150 dp; and `Progress` exposes `accessibilityValue {now,max}` which a screen reader announces as a ratio/percentage (breaks "never n of m") | tile uses a fill-only bar; dots only at full width; meter hidden from assistive tech, the tile name carries the count |
| C3 | H | Dependencies named F-VOC-005 "PR 1" for `recordVocab` (it is P-2; P-1 is the Worker PR) and F-VOC-004 "PR 2 (question view)" (S-2 is the builder; the view was inside the L-sized S-5, which itself depends on C-4) | C-3 -> P-2a; C-5 -> S-2 + new **S-4b** (shared `VocabQuestionView`); C-5 and S-5 "merge only after the P-1 Worker deploy" |
| C4 | M | C-7 said "three free-set topics"; the free set is four (Food, Animals, Colors, Numbers) | fixed |
| C5 | M | UI components with no design mock step (CLAUDE.md §5) | C-4 / C-5 / S-4b / S-5 require mocks in `design/screens/vocab/` first |
| C6 | L | `VOCAB_COPY` has no path into F-I18N-001's dictionary | stated in Dependencies |

### F-VOC-004

| # | Sev | Finding | Change |
|---|---|---|---|
| S1 | M | P3 (F-VOC-005) says response time is never used "so a learner who needs more time is not scheduled worse", but the Relaxed idle hint (12 s / 20 s) withholds a promotion by elapsed time | the exception is stated in P3 and §3.6; hints are off with a screen reader; a hint never demotes |
| S2 | M | `answered === 0` "writes a session event with `answered: 0` (F-VOC-005 skips it)": F-VOC-005 has no such field or rule and would count a session | nothing is written |
| S3 | M | Challenge setting would exist twice (F-VOC-004 `challengeMode`, F-RVW-001 "learner or caregiver turns it on") | S8: one setting; amendment row 14 |
| S4 | L | `session` event carried `endedBy`, absent from F-VOC-005's `VocabEvent` | field added (ignored by the reducer) |
| S5 | L | start sheet always said "10 words" (8 at Pictures first); `playPrompt` had no `source` for telemetry | corrected; `source: 'vocab-speed'` |

### F-VOC-005

| # | Sev | Finding | Change |
|---|---|---|---|
| P1 | H | Cites: the no-migration claim pointed at `0001_schema_v1.sql:30`, the legacy `progress` table; the sync row is `snapshots.payload_json` (`0002_schema_v2.sql:32-41`). The conclusion (no migration) holds | cite fixed, `SnapshotRecord.payload: unknown` and the JSON read/write path added |
| P2 | H | Preserve rule vs reset: `progress-store.reset` writes a blank snapshot (no `vocab` key); the rule would resurrect the old words on the server while quests and cards are blanked. `summary.vocab` preserved independently could describe a slice the payload no longer has | preserve only an **absent** key; reset writes the explicit empty slice; summary preserved only when the payload slice was; behaviour 15 rewritten |
| P3 | M | "Events recorded before hydration are merged by `hydrate` through `mergeSnapshots`": a slice built from a blank one carries a fresh `at`, so last-writer-wins would overwrite the saved schedule of a word already in box 3 | pre-hydration queue replayed onto the loaded slice |
| P4 | H | Home slot ③: the spec said F-STORY-004 and it would produce "replay -> vocabulary -> story"; F-STORY-004 §3.7 (landed) says ③ = `next` story -> replay -> `again` story -> `explore`. As written the vocabulary card would almost never show (a replay candidate exists nearly every day) | chain reconciled: **vocabulary (>=3 due) -> next story -> replay -> again -> explore**; amendment row 12; **owner decision** |
| P5 | H | Deploy rule said "P-3 onward may write"; the first writers are F-VOC-003 C-5 and F-VOC-004 S-5. P-3 (Home card opens `VocabSpeedRound`) did not depend on S-5 | rule rewritten; P-3 depends on S-5 |
| P6 | M | "Pool D first has members on day 8-9" then "(due again on day 11)" in one sentence | day 11 |
| P7 | M | Console line `Words to revisit: 사과 · 눈` shows Hangul without romanization or gloss (CLAUDE.md §1, §8) and 눈 is ambiguous | `사과 sagwa (apple) · 눈 nun (eye)` |
| P8 | M | P-2 (6 modules + merge + store + summary) too large | P-2a core / P-2b selectors, pools, nudge, summary |
| P9 | L | `missedItemIds` "not in the repo" (it is, `progress.ts:72-73`); "23 / 26 telemetry names" (38 on main); "1 MB-class D1 limit" (2 MB documented, to re-check) | fixed |

### Wireframes

`vocab-topics.md`: tile meter bar, a11y note. `vocab-flashcards.md`: Home card slot-③ note. `vocab-speed-round.md`: hints off with a screen reader.

## 4. D1 / Worker verification (item 2)

| Claim in F-VOC-005 | Result |
|---|---|
| `SnapshotPutSchema` is a plain `z.object` that strips unknown keys (`routes/sync.ts:49-51`) | **True.** `ProgressSnapshotSchema` and `ProgressSummarySchema` are non-strict objects; an old Worker silently drops `vocab` and answers 200 |
| The stored payload is the parsed (stripped) body | **True** (`payload: body.snapshot`, `:77`); read back with `JSON.parse` as `unknown` (`d1.ts:31`), returned raw on 409 (`:61`), by GET (`:95`) and by the Rescue Code claim (`recovery.ts:110`) |
| No migration | **True.** `snapshots.payload_json TEXT NOT NULL` (`0002_schema_v2.sql:39`); no column, index or table changes |
| An old client re-uploading after a conflict erases the slice | **True** (`mergeSnapshots` copies only listed fields, `merge.ts:80-98`); the preserve rule is feasible because `payload`/`summary` are `unknown` |
| Additive and safe for production data | **Yes**, with the fixes above: existing rows parse unchanged, old apps ignore the field (`BackupFileSchema` strips it), the 30 s sync debounce (`scheduler.ts`) keeps a 17 KB slice from uploading per answer, the optional field keeps `blankSnapshot` and fixtures compiling |
| Remaining risks | (a) strict wire validation: a client bug that produces `box > bestBox` or a malformed day would make every upload a 422 and stop sync for that learner; the reducer and `mergeVocab` re-establish both refinements and the property tests cover them, but the owner may prefer a lenient wire schema; (b) D1 row size limit quoted from memory; (c) nothing was run against the deployed Worker (the spec's checklist stays a checklist) |

## 5. Open items and owner tasks

**Owner decisions**
1. Home slot ③ order (P4): vocabulary card ahead of a new story, or replay first (card then rarely shows).
2. Library tab label "Words" instead of "Theme packs" (C1).
3. Whether the wire schema for `vocab` should drop the two refinements (section 4 (a)).
4. `vocab.red` final value (W4); 강아지 glossed "puppy" (the plain 개 "dog" is v1.1).

**Native review (not done by this review; romanizations are machine-checked, meanings are not)**
- Korean (owner): word choice of all 144; descriptions of the 48 detailed words (e.g. the number descriptions `수 1을 우리말로 센 것` are awkward; 라면/떡/밥 descriptions; 빨간색 vs 빨강 forms); 나 is the casual "I"; 드라마, 노래, 춤 as K-Culture words; no word was found wrong or culturally off. Family terms 언니/누나/오빠/형 and the speaker convention are correct as glossed.
- Spanish (external): `café` vs `marrón`, `banana` vs `plátano`, `celeste`, `cachorro`, `pastel de arroz`, `fideos instantáneos`; the other eight topics have no Spanish yet.

**Not verifiable here**: D1 limits and the deployed Worker; react-native-web behaviour of `accessibilityElementsHidden`; a real-device colour-vision check; the 232 dp / 150 dp tile arithmetic uses the default `Progress` dot size and the app's 20 dp gutters (an estimate).

**For the owners of other specs (rows 11-15 of `AMENDMENTS-LANDED-SPECS.md`)**: F-STORY-004 (label, ③ chain), F-I18N-001 (`OVERLAY_FIELDS` rows), F-RVW-001 (one Challenge setting), F-TCH-004 (its `LectureBlockSchema` uses `vocab:` for a topic id; VOC uses `vocab-topic:<key>`, `vocab:` is the item namespace).

## 6. Checks of the charter rules

- **Anti-shame (revised 2026-10-09)**: holds. One session clock only in opt-in Challenge (default Relaxed, off), the clock stops during reveals and never marks a miss (S2, with a 500-sequence invariant test), the spark meter has no code path that lowers it, a miss is amber + dash + Hoya `thinking` (never `feedback.danger`, never red), stars never 0, no percentages or fractions on learner screens (tile meter fix added), no ranking (the personal best is private), nothing earned is removed (monotonic slice; only the schedule can fall and no learner screen reads it).
- **No emoji**: scanned all five specs and wireframes (none). **UI strings**: English module `VOCAB_COPY` until F-I18N-001's dictionary exists (CLAUDE.md §8); Korean appears only as taught content with romanization and gloss. **Tokens only**: checked tokens used exist (`border.focus`, `border.strong`, `touchTarget.*`, `feedback.nudge`, `borderWidth`); new colours go through `tokens.ts` + `colors.v1.md`. **Spec before code**: all five specs are `ready`; mock/wireframe steps added where missing.
- **Audience**: no "ages 5-11" or age range anywhere; level labels only (Pictures first / Some reading / Reads easily, `learner-level.ts:33-35`); the age-like level ids are never shown.

---

## Review log: Review 3 - F-TCH-004 (lecture mode) and F-LAYOUT-001 (responsive / tablet landscape)

Date: 2026-10-10. Reviewer: independent spec reviewer. Code read at `origin/main` `ecf6365` (PRs #91-#105) in a throwaway worktree `/Users/ggoboogi/workspace/.hr-wt/review-tchlay`; the main checkout was not edited.

Files reviewed (edited in place, minimal edits; originals saved as `scratchpad/orig-*.md`):
`specs-out/F-TCH-004-lecture-mode.md`, `specs-out/F-LAYOUT-001-responsive-tablet-landscape.md`, `specs-out/wireframes/layout-wide.md`, `specs-out/wireframes/lecture-presenter.md`. One sibling file touched for consistency: `specs-out/TELEMETRY-NAMES.md` (emit PR numbers of the `lecture.*` rows).

Result: both specs `Status: ready` (no blockers remain after the fixes). Open items and owner-only items are at the end.

## 1. Mandatory owner decisions applied

| Decision | Finding in the draft | Fix |
|---|---|---|
| (a) no student name in any URL | F-TCH-004 TD3 / §3.2 / §3.10 / §3.11 put `picker.labels` (first names or initials) in the `#d=` fragment, gave "private window" advice, and used `window.open(..., 'noopener')`. The wireframe said "Names go into the link". Also review-2's owner answer (line 371) had already said never in the fragment | Deck schema has **no labels** (`.strict()` rejects a `labels` key). New roster hand-off protocol: console opens the presenter with `window.open(url, '_blank')` (no `noopener`), presenter posts `ready` to `window.opener`, console answers with `roster` by `postMessage` to the exact app origin; strict zod schemas for both messages; origin + `event.source` + `deckId` + `mode` + `count` checks on both sides; labels held in a module variable only (never storage, Recent, telemetry, `console.*`); no opener means numbers. `document.title` fixed; `replaceState` kept. Console blocks a deck title containing a roster first name or alias (the title is in the URL). Initials are treated like names (also message-only; stricter than review-2, flagged below as an owner choice). Tests: property test that no built URL contains any roster label; unit tests for both message handlers; a cross-origin Playwright harness (`presenter-roster.spec.ts`) that asserts no URL, request, history entry or `document.title` contains a name |
| (b) timer and picker allowed, never rank or score | TD5 treated this as an open interpretation | TD5 and §8 now record it as owner-confirmed; picker overlay explicitly shows no count, list, score or ranking of anyone; wireframe states the same |
| (c) audience, EN default, KO/ES selectable | Drafts were clean on age framing; "12 children" and "so a child can point" wording | Reworded to "learners" / "anyone"; presenter locale select on the setup page, language chips on the presenter home and help; English default |
| (d) no emoji, tokens only | Scanned all four files for non-ASCII symbols and colour literals | No emoji; no colour literals (only existing-CSS px mentions in F-LAYOUT-001 context) |
| (e) anti-shame as revised 2026-10-09 | Quiz reveal uses success border plus check, others lose emphasis, no `danger`, no "wrong" words; timer only fills | Consistent. D3 sentence in F-TCH-004 rewritten to the revised wording (public ranking, losing earned items forbidden; teacher tools allowed) |

## 2. Blockers found and fixed

1. **Names in the URL fragment** (above).
2. **No owner for the sticky footer.** F-LEARN-001 (line 288) says "F-LAYOUT-001 provides the sticky footer"; F-LAYOUT-001's table said "(F-LEARN-001)"; F-QUEST-002 and F-VOC-003 also point to F-LAYOUT-001. Nobody defined it. Fix: `Screen footer?: ReactNode` defined in F-LAYOUT-001 §3.2 (PR 1).
3. **`sideBySide` contradicted F-STORY-002.** F-LAYOUT-001 excluded `short` windows, but F-STORY-002 §3.3 specifies two columns for landscape phones (width >= 700, wider than tall). Fix: `sideBySide = landscape && width >= 700`, any height; panes still need `wide` and not `short`; table row 844x390 changed to `sideBySide: yes`; game rows say games opt out on short windows.
4. **Visual test plan infeasible.** Both specs planned "design-preview additions (F-VR-001)". `/design-preview` is an `apps/web` Next page that re-draws design-system primitives as HTML and cannot render the React Native Home / Journey / Library or presenter slides; F-VR-003 (automated diff) is deferred. Replaced with a Playwright `HR_SHOTS=1` screenshot helper (artifacts attached to the PR, as CLAUDE.md §9 requires), no new gate.
5. **Wrong review gate / component names for stories.** F-TCH-004 named `content-access` as the review gate (that file is the D5 free-content registry) and `SceneArt` as the renderer (the component is `StoryScene`; `SceneArt` is the data). Fixed to `story-index.ts` (F-STORY-004 §3.1) and `StoryScene`; narration `{kw:}` tokens resolved via `parseNarration`.
6. **Hangul in a message.** F-TCH-004 put `잠깐` in a "message catalogue" while F-I18N-001 §3.4 rule 5 bans Hangul in `en`/`es` messages and has no `presenter` namespace. Fixed: Pause word is a content constant drawn with `KoreanText`; chrome strings go to `learner.presenter` (and `console.lecture`). Same for F-LAYOUT-001's invented `pwa.portraitGuard.title` -> `learner.portraitGuard.title`.
7. **PR breakdowns not small / not ordered, no docs-first PR.** F-TCH-004 PR 4 (L, ten modules) and PR 5 (L, root + eight slides + bar + home) and the wireframe landing last (PR 10) broke "wireframe before code". F-LAYOUT-001 had no docs PR and a mixed PR 2 and PR 5. Both re-cut (F-TCH-004: PR 0 docs, 4/5 split, 6 shell, 7 slides, 8 home, 9 quiz and overlays, 10 console; F-LAYOUT-001: PR 0 docs, 2a/2b, 5a/5b/5c). Dependencies now name real PR ids (F-AUDIO-004 A-4a/A-5a, not A-4/A-5).
8. **Wrong app-map row.** F-TCH-004 said C9 (`10-app-map.md:98`) gets the presenter; C9 is "Worksheets PDF - Templates". Fixed to a new row C10.
9. **Pane math wrong.** F-LAYOUT-001 §8 said 440-620 px for the detail pane at 900-1023 wide; with the 32 px gutters it is 412-535. Corrected, with a size test (five Journey cells at master 400 are 76 wide, above 64).

## 3. Other corrections (non-blocking)

- Stale base commit (`c939348` / `332e199`) -> `ecf6365`; all cites re-read there.
- F-STORY section cites: reader two-column rule is F-STORY-002 §3.3 (not §3.10); "3-4 columns" is F-STORY-003 §3.5 (not §3.4).
- Screens missing from the F-LAYOUT-001 table: Voice Echo game, Oops screen; Journey stories-only cell kind (F-STORY-005) and Library sections / Words card (F-STORY-004, F-VOC-003) now handled (panes only for Cards section; stories-only cell navigates until its view is extracted).
- PinEntry constant location (`PinEntryScreen.tsx:46` today, `PinPad` after F-LEARN-001 PR 4a).
- `layout` / `presenter` token groups must also join the `tokens` aggregate; parity test only parses the colour table today, so a second row parser is specified.
- Presenter text floor: `stageText(n) = max(typography.size.body, round(unit * n))` so projected captions never fall below 18 on a small window.
- Font `--check` made CI-feasible with a committed glyph-list sidecar (no Python or font parser in CI).
- Test counts: `layout.spec.ts` has four tests per viewport (not five); `layout-size.test.ts` was referenced but missing from the test table.
- Telemetry emit PR numbers in `TELEMETRY-NAMES.md` aligned with the new PR numbers.
- Added "Shared files" lists to both PR sections (to be copied into `spec-wave-2026-10.md` §5).
- Presenter language chips (session only) so a teacher laptop without a Welcome run can choose EN / ES / KO.
- Roster labels failing the name class fall back to position numbers; `family` / `class` role wording matches `can.ts:36-37`.

## 4. Citations checked (read at `ecf6365`)

About 60 load-bearing claims were checked against the tree; nearly all were exact or off by one line, the wrong ones are listed in sections 2 and 3. Highlights:

`apps/mobile/index.ts:1-4`; `App.tsx:36-66,75,79`; `store/bootstrap.ts:10-15`; `scripts/pwa-postbuild.mjs:40-48,59-68,88,92-101` (`navigateFallback :96`, `clientsClaim :97`, `skipWaiting :98`); `public/manifest.webmanifest:9`; `app.json:6,18`; `wrangler.toml:18`; `content/jamo.ts:102,104`; `content/jamo-strokes.ts:13,17-32,286`; `content/quests.ts:8,134,166,184,186`; `content/episodes.ts:201,208`; `content/heritage-cards.ts:92,94`; `content/index.ts:1-5` (no store); `logic/minigame-config.ts:8-21,338`; `logic/round-builder.ts:14-23,39-41,145-147,183-185` (LCG seed, throws); `screens/minigames/StrokeHint.tsx:27-39,54`; `screens/minigames/CultureQuizGame.tsx:20,41,55` (9 games use `useQuestRunStore`); `platform/audio.web.ts:36-77` (`pickVoice`, `speak`, `playJamoSound`); `platform/storage.web.ts:9-33`; `platform/telemetry.ts:38,129`; `packages/content-schema/src/schemas/telemetry.ts:9`; `schemas/locale.ts` (`RomanizationModeSchema`, `UiLocaleSchema`); `schemas/plan.ts:12,16`; `schemas/space.ts:10-12,45`; `schemas/relink.ts:46` (`rosterAlias`); `packages/backend/src/routes/spaces.ts:102-104,377` (`rosterName`, roster response); `packages/backend/src/lib/can.ts:36-37`; `apps/web/src/lib/console/{routing.ts:5-21,config.ts:2-25,api.ts:25-41,rollup.ts:18,28-36,plans.ts:60,banned-text.ts:6,copy.ts:12}`; `apps/web/src/app/teach/space/page.tsx:116-120,130-141`; `plan/page.tsx:136-148`; `app/page.tsx:19`; `data/stage1-catalog.ts:1-7,24-53`; `next.config.js` (`output: 'export'`); `profile-model.ts:35-41`; `packages/design-system/src/tokens.ts:105,130-150,198,212-221,231-239`; `components/Screen/Screen.tsx:25-46`; `layout.ts:12-17,40-52,65-69`; `Hoya/types.ts:1`; `HeritageCardArt.tsx:21`; `navigation/tabs.tsx:15,23-29`; `components/PwaBanners.tsx:36-40`; `screens/parent/PinEntryScreen.tsx:16,46,68,70`; `logic/trace-layout.ts:11,19,30,39`; `logic/profiles/pin-pad-layout.ts:8,18`; `scripts/check-token-drift.mjs:29`; `tokens-parity.test.ts:11-15,33,58-70`; `e2e/web/layout.spec.ts:12-17,27-37`; `playwright.config.ts:15`; `design/wireframes` conventions; `10-app-map.md:77,98,120,164`; `F-TCH-001:79-85,106,198-200`. Sibling cross-refs checked: F-AUDIO-004 AD1/AD2/AD7, §3.5, §3.6, §3.8, PR ids A-4a/A-5a; F-I18N-001 §3.4 rules 2/5/8, §3.5, §3.6, §3.9; F-STORY-001 §3.9; F-STORY-002 §3.3/§3.9/§3.10; F-STORY-003 §3.1/§3.5; F-STORY-004 §3.1/§3.3; F-STORY-005; F-LEARN-001 line 288.

Tablet / landscape behaviour: class thresholds checked against the only existing breakpoints (`trace-layout.ts` side mode at width >= 440 and wider than tall; `pin-pad-layout.ts` 3/4/6 columns; the 480 px `#root` cap) - no other `maxWidth`, `Dimensions` or width constant exists in `apps/mobile/src` or `packages/design-system`, so LD1-LD3 collide with nothing. 600/900 and short < 480 give the claimed results for 320x568, 375x553, 390x844, 768x1024, 1180x820, 844x390, 932x430, 960x600, 1100x500 (table recomputed by hand). Pane widths recomputed (see fix 9).

## 5. Feasibility of the e2e plan

- `scripts/serve-dist.mjs` has the SPA fallback, so `/present` resolves in Playwright; offline pattern copied from `offline.spec.ts`.
- All `apps/mobile/e2e/web` specs run in `.github/workflows/web-app.yml` on every PR touching `apps/mobile/` or `packages/` (20-minute job), not nightly; adding seven-plus specs adds minutes (estimate 2-4 for layout viewports): measure in layout PR 2a, shard if over about 12 minutes.
- Every spec inherits the Pixel 5 device (touch, mobile) from `playwright.config.ts:15`; layout specs rely on that (`pointer: coarse` makes the portrait guard appear at 844x390); presenter specs override it to desktop; one extra mouse case proves the guard stays away.
- A second origin for the roster hand-off is faked with `context.route('http://localhost:3000/**')`; that origin is in the default allow-list.
- Playwright cannot emulate `env(safe-area-inset-*)`; those stay on the manual device list.

## 6. Open items (not blockers)

1. Teacher un-mute writes `device:audio`, which is device-wide, so it also un-mutes the learner app on a shared device (F-AUDIO-004 AD7). Alternative: session-only mute (needs an F-AUDIO-004 amendment). Recorded in F-TCH-004 §8.
2. Deck title is teacher-typed text that travels in the URL: the console blocks roster first names and aliases, but cannot know a name that is not in the roster; setup page warns.
3. Opener hand-off needs a non-null `window.opener` and no COOP header; behaviour on iOS home-screen PWAs, Safari pop-up blocking and Chromebooks is not tested (manual device list); fallback is numbers.
4. All device behaviours in both specs are unverified on hardware (orientation lock, fullscreen, wake lock, clicker keys, `matchMedia('(pointer: coarse)')` on hybrids, manifest refresh lag) - both already carry a manual device list.
5. `breakpoint.wide` 900 vs 1024: at 900 the detail pane is only 412 wide; tune before layout PR 5b.
6. CI duration of the e2e job.
7. UI PRs need design mocks (`design/screens/`), which are the owner's manual step; PR 0 of each spec promotes the wireframes first.
8. Native iPad / Android work stays out (decision #28).
9. Cross-spec: F-STORY-002 must drop its "web keeps the 480 px column" sentence once layout PR 2a lands (noted in F-LAYOUT-001 §7); `spec-wave-2026-10.md` §5 should gain the shared-file lists now in both specs.

## 7. Owner-only items

1. **Bundled font approval.** Noto Sans KR Bold subset (SIL OFL 1.1, <= 150 KB) is the first third-party font; D7 says "no external assets" for visuals. F-TCH-004 PR 3 waits for a yes; without it the presenter uses the system Hangul font (UX-24 risk).
2. **Initials in shareable links.** Strict reading of (a) puts initials in the message only, so a copied link always runs the picker in numbers. If the owner wants copied links to carry initials, say so (review-2's note allowed "numbers or initials" in the deck).
3. **Teacher mute scope** (device-wide vs session-only), item 1 above.
4. **Chime for the timer**: acceptable (follows the device mute) or visual-only for schools that forbid sound.
5. **Design mocks** for presenter screens and the layout panes (manual design step).
6. **Native-speaker review** of `잠깐`, the stroke-guide caption and the Spanish / Korean presenter strings before those locales ship.
7. **Hosting facts**: confirm the console origin(s) (`hangulroute.com`, `www.hangulroute.com`) and any preview / workers.dev origins to put in `EXPO_PUBLIC_CONSOLE_ORIGINS`; confirm nobody plans a COOP header on `/teach` or `/present`.

---

## Review log: REVIEW-PLC-PLAN — independent review of F-PLC-001, F-PLAN-002 and their wireframes (2026-10-10)

Reviewed against `origin/main` at `ecf6365` (throwaway worktree `.hr-wt/rev-plcplan`; the main checkout was not touched). Files edited in place under `specs-out/`: `F-PLC-001-placement-test.md`, `F-PLAN-002-curriculum-planner.md`, `wireframes/placement.md`, `wireframes/curriculum-planner.md`. Originals are kept in `reviews/plcplan/*.orig.md`; patch scripts `reviews/plcplan/patch_*.py` show every replacement. Both specs stay `Status: ready` (no blocker left; owner-only items are listed at the end).

## 1. Verdict

| Spec | Status | Why |
|---|---|---|
| F-PLC-001 | **ready** | engine, scoring and ladder re-derived and sound; the D2 conflict, a per-question timer, a false "all art exists" claim and a data-loss path were fixed |
| F-PLAN-002 | **ready** | migration and Worker behaviour verified; two festival dates were wrong (Chinese instead of Korean dates) and a missing-default crash path was fixed |

## 2. Checks and results

### (1) Citations
About 116 `file:line` cites were parsed mechanically from the two specs (56 + 60), each resolved to a file on `origin/main` and the cited lines printed; the load-bearing ones (cursor, merge, summarize, schemas, routes, migration, entitlement, derivation, Home, Journey) were read in full. All resolve to the right code except:

| Spec | Cite | Problem | Fix |
|---|---|---|---|
| PLC | `SnapshotPutSchema` at `schemas/sync.ts:41-48` (3 places) | lines are `planProgress`; the schema is `:49-56` | corrected |
| PLC | `ProgressSnapshotSchema` `progress.ts:75-86` | starts at 77 (`:77-88`) | corrected |
| PLC | `supportedCardIds` "all pictures exist" | **the list (`HeritageCardArt.tsx:21-57`) holds the 30 Stage 1 cards only; the 8 Stage 2 cards have no art** | see 3 below |
| PLC | `stage2Cards` `heritage-cards.ts:73-85` | block is `:70-82` | corrected |
| PLAN | `schemas/sync.ts:80-87` for the backup file | those lines are `SyncInbox`; `BackupFileSchema` is `:88-95` | corrected |
| PLAN | assumption list order 10, 9 | numbering | fixed (9 entitlement, 10 `?cap`) |

### (2) F-PLAN-002 migration, Worker, old apps
- `0004_plan_meta.sql` = `ALTER TABLE plans ADD COLUMN meta_json TEXT;` is additive and nullable (same shape as `0003_device_scope.sql`). `d1.ts` `putPlan` uses an explicit column list plus `ON CONFLICT DO UPDATE`, so the new column must be added to both the INSERT and the UPDATE; the spec says so, and "migration, then Worker" is in the PR table (P2-4) and the opening note. Confirmed.
- `z.object` strips unknown keys on `PlanUpsertSchema` and `SnapshotPutSchema` (`routes/plans.ts:29`, `routes/sync.ts:49`): confirmed, so server-first deploy is required; it is stated. An old Worker rejects a >30-item curriculum with 422 (fail-safe) but would silently store a short one as a classic plan.
- `?cap=curriculum` gating at `routes/sync.ts:103-124` is feasible (the route already filters `plans` after `inboxPlansFor`); roster redaction at `routes/spaces.ts:382` is the only place a class teacher can read a summary (`school.ts:53` reads aggregates only); `snapshot.read` is family-only (`lib/can.ts:36`). Confirmed.
- **Fixed, three real gaps:**
  1. `PlanUpsertSchema.meta` with `.default(null)` would let an older console strip a route's meta on update; now `.nullable().optional()` (absent = keep).
  2. **Local snapshots are read unparsed** (`progress-store.ts:156` `readJson<ProgressSnapshot>`), so zod defaults do not protect existing devices: `snap.placements` / `selfRoute` would be `undefined` and `mergeSnapshots` (field-by-field object, `merge.ts:80-98`) would crash for every existing user. Both specs now require a `withSnapshotDefaults` helper in hydrate / replace / restore / server read, and merge / `isSubsetOf` treat missing as empty, with a legacy-object test.
  3. **Mixed-version data loss:** the Worker stores the uploaded snapshot as the new payload (`routes/sync.ts:71-79`); an older build re-uploading after a merge erases the new fields from the server copy. F-VOC-005 P-1 already adds a preserve rule for `vocab`; PLC P-2 and PLAN P2-4 now extend the same shared helper (`placements` append-only, so empty-incoming + non-empty-stored = old client; `selfRoute` null never overwrites non-null).
- Smaller: `completedQuestIds` is no longer persisted in plan `meta` (device fact, size and privacy); `assignedBy` for `school` spaces noted; `catalog-parity` supersedes the F-QUEST-002 and F-STORY-005 web parity tests and F-TCH-004's mirrors (P2-6 deletes them together).
- Known and not new: `isSubsetOf` ignores homework, so re-dated or removed pending assignments reach the server only with the next summary-changing upload, and `unionBy` can resurrect removed pending copies from another device until the next derive. Same behaviour as archived plans today; logged as open item O-3.

### (3) F-PLC-001 engine, F-RVW-001 edits, scoring
- **Floor and ceiling re-derived** by enumerating every outcome path (`reviews/plcplan/ladder.py`): full, visual and audio on: 12, 15, 18 or 21 questions; quick: 12 or 15; `visual` off: 9 to 18; audio off: 6 to 21 (documented exceptions). 12/21 are correct.
- **Guesser:** exact P(pass a 3-question rung) = 0.15625 at 4 options (7/27 at 3 options). 4-option guesser: band 0 97.5 %, band 1 2.1 %, band 2 0.3 %, band 3 0.05 % (Monte Carlo 200k matches; the spec's table said 97.7 / 1.7 / 0.6, which is sampling noise and is now replaced by the exact figures). The test threshold (>= 95 % at band 1 or lower) holds with huge margin. **But a 2-option guesser reaches band 2+ in 12.6 %**: the schema allowed 2 options, so a validator rule (every scored template has >= 3 options) was added.
- **Logic errors fixed:** (a) "every run measures listening" was false: runs that read vocabulary and sentences, or fail vocab read, never ask `sentence` oral; claim, P1 and Appendix C reworded (`oralStage: null` is already specified). (b) The 30-second per-question idle `timeout` was a per-question timer and contradicted D3 and CLAUDE.md as revised 2026-10-09 ("timers only as session clock; unanswered = skipped, never wrong"), and the spec's own "(D3: no per-question timer)". Replaced by a session-level 45-second inactivity pause that records nothing; "not sure" and unanswered are `skipped`; the `timeout` outcome and function were removed from the shared engine. (c) Override: the effective override is the newest one, so it survives retakes. (d) The shared-engine text said placement both uses and "does not touch" the session reducer; now: placement decides only the next rung and the reducer stays non-adaptive.
- **F-RVW-001 amendments B1-B8**: all anchors exist in the landed text (Scope header, 3.5, 3.7 clock, 3.2 Pool C, 4 adaptive, 6 tests, 8 upstream). F-RVW-001 is `draft` and `apps/mobile/src/logic/reviews/` does not exist, so no shipped behaviour changes; `ReviewEntrySchema` is untouched. Fixes: B4 (Pool C is *one* forced item; priority tokens now take that slot one per test over three tests, and `skill:` tokens are ignored), B5 wording aligned with 3.3, new B9 (Feedback Review's 15 s auto-skip stays `skipped`; no `timeout` outcome).
- **F-QUEST-002 mapping** (15 quests, `teaches`, 30 symbols, confusables 3.9, Listen & Pick 3.10, spoken forms 3.12, AD2 initial ㅇ by name so ㅇ is untested by ear) re-checked row by row: the placed-out table and start quests are correct (band 3 start = `nature-q2`, q8/q9 need rest + finals).

### (4) CLAUDE.md conformance
- Audience: no "kids"/age wording on shared surfaces; only the caregiver wireframe uses the existing `memberNoun`. Test language selectable (`UiLocale`, en/es/ko), UI strings via `learner.placement` messages, Spanish/Korean as overlays. No emoji, tokens only.
- **D2 sound-guide conflict resolved:** options screen no longer pre-selects or recommends hiding; it pre-selects the learner's current `romanizationMode` (read, never written), neither choice is recommended, one neutral consequence sentence; `revealMode` has no engine default; P8, assumption 11, wireframe C and the open question updated; copy-test list now includes the pre-selection. Consequence flagged for the owner (O-1): on the default setting the check is the 9-question listening-and-shapes run.
- Learner "no numbers" test contradicted the "about 4 to 6 minutes" strings: copy test now allow-lists three duration keys.
- Gloss withheld on an open item is a narrow exception to "taught Korean always shows a gloss" (the gloss would be the answer); stated and listed for owner confirmation (O-4).

### (5) PNNL / commercial
No prices, plan names or revenue claims exist in either spec. Removed "a Pro / school feature" (PLAN) and "opens with Premium" (PLC parent report and wireframe; now "not included with this account yet", no price, no button). Learner-facing route preview no longer shows the `premium-needed` warning (it stays only in the grown-up console wizard). Free-tier handling for a placed-out learner is kept as **assumption 10** (PLC), with the verified fact that the Journey does not block opening Stage 2 cells today and that F-QUEST-002 3.5 already makes the cursor skip non-entitled stages; no paywall, nothing is gated by these specs.

### (6) Korean, Spanish and festival dates
- All 123 Korean/romanization pairs of PLC Appendix A re-run through the repo converter (`romanization/`, copied to `reviews/plcplan/rr`): all agree (the 5 reported diffs were regex noise from English words). Sentence naturalness spot-check of the 10 reply pairs and the 16 N-ieyo / N-eul V-yo sentences: natural. Read-vocabulary words are all decodable from the 30 Stage 1 symbols. The read **sentences** use ㅔ ㅖ ㅐ ㅘ ㅢ (never taught in Stage 1), so they are chunk reads with picture support: added as assumption 12 (also: sentence oral mostly retests nouns). The spec contains no Spanish prose besides endonyms; es/ko strings are generated later through overlays and need the native reviews already listed.
- **Art:** vocabulary 53 -> 40 drawable and sentences 54 -> 50 drawable (the Stage 2 cards have no art; 17 templates start `draft` until F-VOC-002 `word:` art). Minimum 40 per strand is met exactly for vocabulary.
- **Festival dates** (method: new-moon times from `ephem` converted to KST; `korean-lunar-calendar` package; web search of timeanddate / publicholidays.co.kr / Korea Aerospace Administration 2027 guidelines). Seollal: 2026-02-17 ok, **2027-02-07** (spec said 02-06, Chinese date), **2028-01-27** (spec said 01-26, Chinese date), 2029-02-13 ok, 2030-02-03 ok. Chuseok 2026-09-25, 2027-09-15, 2028-10-03, 2029-09-22, 2030-09-12 all ok. Hangeul Day 9 October ok. Search snippets for 2028 (Jan 26) and 2030 (Feb 4) from one aggregator disagreed with the astronomy and were not adopted. Corrected in the PLAN spec (header table, Example B, behaviour, assumption 1). 2028-2030 are computed, not yet in an official KASI announcement.
- Example A and B date arithmetic (weekday of start, 7-day weeks, week counts, 78 sessions, 24 stories / 112 minutes, 29 open sessions, 11 vocabulary weeks) re-checked by script and by walking the algorithm; the only gap was the vocabulary-cadence counter, now defined (counts `learn` weeks from the first week topics are allowed).

### (7) Sibling conflicts and ordering
- **CLAUDE.md section 2:** `content/placement/` is a new top-level content directory; it was not in the D4 approval. P-0 now says "only after owner approval P12; fold into F-I18N-001 PR 0's single charter edit". Listed as owner item O-5. F-PLAN-002 adds no directory (`catalog/`, `curriculum/` live inside `packages/content-schema`).
- **Overlay prefix `pitem:`** fits the F-I18N-001 id regex; its `OVERLAY_FIELDS` row is an amendment to F-I18N-001 3.6 (now in P-0); the picture-label field was renamed `options.<id>.gloss` to match the inline-pair convention.
- **F-STORY-005:** `reachedStage` takes `placement?: number`, PLC passed a `StageKey`; now `stageNumber(level.stage)`. Naming collision with `Episode.placement` ('grid'|'shelf') noted. Catalogue parity: PLAN's 24 stories, 112 minutes, 6 sampler flags (1,3,7,8,9,10), anchors, theme and recommended stages match the F-STORY-005 3.3 table; Example B's story order reproduces its `shelf.order`.
- **Shared files / ordering:** `ProgressSnapshotSchema`, `merge.ts`, `blankSnapshot`, `summarize.ts`, `telemetry.ts`, `index.ts` are also edited by F-VOC-005 (`vocab`): land the three schema PRs serially, one shared preserve helper, one shared `withSnapshotDefaults`, one Worker deploy gate. Home: PLC level-check card and PLAN route card both claimed the slot between the mission cards and the progress bar; now at most one quiet card (level check while eligible, then route). Profile rows ordered. `PinEntry.next` gets two additive members (PlacementReport, RouteSetup). Telemetry: seven new names (`placement.*` x5, `route.*` x2) follow the `<unit>.start/complete` convention and collide with nothing; both specs' PRs now add rows to `TELEMETRY-NAMES-2.md`. F-PLAN-001 is shipped: its 4 amended sections are a docs task inside P2-4.

## 3. Open items (not blockers)
- **O-3** (low) homework re-date / removal vs `isSubsetOf` and union merge, see section 2.
- Picture quality of `card:` art as quiz options, native Korean/Spanish review, 17 draft templates awaiting `word:` art, cadence constants untested with users: already in the specs' unverified lists.
- 2028-2030 festival dates to be re-checked against KASI's table when published (test pins the values).

## 4. Owner-only items
1. **O-1 Sound guide default.** With D2's visible default the check runs the 9-question listening-and-shapes version (below D10's 12 floor) unless the learner picks "only when I tap". Choose: accept; pad to 12 with two extra oral draws; or make hiding an explicit first choice with no pre-selection.
2. **O-2 Free tier for placed-out learners.** Confirm "no entitled start quest -> stories or the map" (consistent with F-QUEST-002 3.5) versus keeping today's open Stage 2 taste quests on the cursor; and the exact grown-up wording ("not included with this account yet"). No prices anywhere; PNNL review of outside-activity / IP stays with you.
3. **O-4** Withholding the gloss of picture options on an open placement item (narrow exception to CLAUDE.md section 1).
4. **O-5** Approve the new directory `content/placement/` (P12) and the one-line CLAUDE.md section 2 edit (in PR P-0, not done here).
5. Native Spanish reviewer and Korean review of sentence/reply templates (already open from review 1).
