# Telemetry event names — consolidated list after review 2 (2026-10-10)

> **In the repository since F-ROUTE-001 R-0 (2026-10-11).** Until then this list lived only in the review working copies (`specs-out/`), and several specs cite it by name (`TELEMETRY-NAMES-2.md`). Sections A to G are the review-2 snapshot, unchanged; the code list (`TELEMETRY_EVENT_NAMES`, 55 names on `main` at `abda11d`) stays the source of truth. New spec names are appended as new sections (H onward), and each spec's names PR adds its rows here (rule 2).

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

## H. My route names (F-ROUTE-001; added by its R-0 docs PR)

Three names in the new `route_map.` namespace (the map of progress; F-PLAN-002's dated weekly plan keeps `route.`). None collides with sections A to G, with the 55 names on `main` at `abda11d`, or with F-PLAN-002's `route.*` names (`route.created`, `route.repaced`, and `route.proposed`, `route.proposal_skipped`, `route.updated` from amendment FP-B7, whose rows that spec's P2-4 adds). Worker first: R-W1 adds them to `TELEMETRY_EVENT_NAMES` and its exact-list test and is deployed before the app build that sends them (R-3). Sent for the active profile only, never in read-only (grown-up) mode; stage keys, booleans and codes only.

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `route_map.viewed` | F-ROUTE-001 §3.16 | `{ source: 'home' \| 'journey' \| 'result' \| 'parent', stage: StageKey, hasStart: boolean, hasPlan: boolean }` (the page opens) | R-W1 | R-3 (sources `home` R-4b, `result` F-PLC-001 P-7b) |
| 2 | `route_map.stage_opened` | F-ROUTE-001 §3.16 | `{ stage: StageKey }` (a stage row is expanded) | R-W1 | R-3 |
| 3 | `route_map.continue_tapped` | F-ROUTE-001 §3.16 | `{ stage: StageKey, hero: 'start' \| 'continue' }` (the hero button is pressed) | R-W1 | R-3 |

## I. Layout names (F-LAYOUT-001; added by its PR 3)

Three names in the new `layout.` namespace; none collides with sections A to H. The spec points at `specs-out/TELEMETRY-NAMES.md`, which is not in the repo, so the rows live here. Worker first: PR 3 adds them to `TELEMETRY_EVENT_NAMES` and its exact-list test, and the Worker whitelist deploys on merge, in the same release as the app build that sends them (an event the old Worker rejects is dropped, never retried). Classes and booleans only: no sizes in px, no profile data (sent without `profileId`).

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `layout.observed` | F-LAYOUT-001 §3.13 | `{ width: 'compact' \| 'regular' \| 'wide', form: 'phone' \| 'tablet', orientation: 'portrait' \| 'landscape', panes: 1 \| 2, standalone: boolean }` (once per session, when the window size is known) | PR 3 | PR 3 |
| 2 | `layout.guard_shown` | F-LAYOUT-001 §3.13 | `{ standalone: boolean }` (each time the portrait guard appears) | PR 3 | PR 3 |
| 3 | `layout.guard_dismissed` | F-LAYOUT-001 §3.13 | `{ via: 'rotated' \| 'keep_sideways' }` | PR 3 | PR 3 |

## J. Lecture mode names (F-TCH-004; added by its PR 0 docs PR)

Four names in the new `lecture.` namespace (a teacher's presenter, `/present`). Lettered J because F-LAYOUT-001 PR 3 (#203) claims section I. None collides with sections A to I (the `layout.` names of #203 included) or with the 63 names in `TELEMETRY_EVENT_NAMES` on `main` at `0f91142`, the three `route_map.` names of #210 among them (no existing name starts with `lecture.`). F-TCH-004 cites this list as `specs-out/TELEMETRY-NAMES.md`; this file is that list. Worker first: PR 1 adds all four to `TELEMETRY_EVENT_NAMES` and its exact-list test and is deployed before the presenter build that sends them (PR 6, PR 9). The presenter has no profile, so events carry **no `profileId`**; payloads never carry a name, a picker label, an id of a person or the deck title (F-TCH-004 §3.14, §3.10). Events use the existing offline queue (`platform/telemetry.ts`); the presenter calls `flushQueue` itself because `App` does not run there.

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `lecture.start` | F-TCH-004 §3.14 | `{ source: 'console' \| 'quick' \| 'recent', blocks, slides, skipped, picker: 'none' \| 'names' \| 'initials' \| 'numbers', romanization: 'always' \| 'tap', voice: 'ready' \| 'none' \| 'unknown', offlineReady: boolean }` (the Start tap) | PR 1 | PR 6 |
| 2 | `lecture.complete` | F-TCH-004 §3.14 | `{ slidesShown, minutes, reveals }` (Exit confirm, or the last slide then exit) | PR 1 | PR 6 |
| 3 | `lecture.tool_used` | F-TCH-004 §3.14 | `{ tool: 'timer' \| 'picker' \| 'blank' \| 'pause' \| 'grid' \| 'fullscreen' }` (first use of each tool per lecture) | PR 1 | PR 9 |
| 4 | `lecture.deck_rejected` | F-TCH-004 §3.14 | `{ reason: 'empty' \| 'too_large' \| 'bad_encoding' \| 'bad_json' \| 'unsupported_version' \| 'invalid' }` (the codec reasons, §3.2) | PR 1 | PR 6 |

## K. Weekly plan names (F-PLAN-002; added by its PR P2-4)

Five names in the `route.` namespace (F-PLAN-002's dated weekly plan; F-ROUTE-001's map of progress uses `route_map.`, section H). None collides with sections A to J (the `lecture.` names of F-TCH-004 included). Worker first: P2-4 adds them to `TELEMETRY_EVENT_NAMES` and its exact-list test, and they ride the shared Worker deploy D2 (F-ROUTE-001 section 6.0) before any app build sends them. App only (the console has no telemetry client); codes and counts only, no names, no dates, no item ids.

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `route.created` | F-PLAN-002 §3.11 | `{ audience: 'self', weeks, sessionsPerWeek, focus, startStage, from: 'proposal' \| 'setup', changed: boolean }` (a self-route is started) | P2-4 | P2-7a / P2-7b |
| 2 | `route.repaced` | F-PLAN-002 §3.11 | `{ mode: 'auto' \| 'manual', pending }` (the self-route is re-paced) | P2-4 | P2-7b |
| 3 | `route.proposed` | F-PLAN-002 §3.11 (FP-B7) | `{ source, kind: 'new' \| 'update', defaultWeeks: 4 \| 12 \| 26, pace: 'gentle' \| 'steady' \| 'brisk' }` (the proposal is shown) | P2-4 | P2-7a |
| 4 | `route.proposal_skipped` | F-PLAN-002 §3.11 (FP-B7) | `{ source }` (Just start / Not now) | P2-4 | P2-7a |
| 5 | `route.updated` | F-PLAN-002 §3.11 (FP-B7) | `{ source: 'retake' \| 'override', itemsRemoved, itemsAdded }` (a retake or an override reseeds the route) | P2-4 | P2-7a |

## L. Notes from grown-ups names (F-FEEDBACK-001; added by its FB-0 docs PR)

Seven names in the new `notes.` namespace (the learner side of the adult-to-learner feedback channel). None collides with sections A to K or with `TELEMETRY_EVENT_NAMES` on `main` at `ea9049e4` (no existing name starts with `notes.`). If another spec's docs PR claims letter L first, this section is relettered on rebase; the names do not change. Worker first: FB-1 adds all seven to `TELEMETRY_EVENT_NAMES` and its exact-list test, and the API Worker is deployed with FB-1 before the app builds that send them (FB-8, FB-9). App only (the console has no telemetry client). Payloads never carry note text, a note or batch id, a sender label, a space name or id, an account id or a learner name; `notes.report_sent` and `notes.prefs_changed` are sent **without `profileId`**.

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `notes.card_shown` | F-FEEDBACK-001 §10 | `{ unread }` (once per app session, when the Home card first shows) | FB-1 | FB-8 |
| 2 | `notes.list_viewed` | F-FEEDBACK-001 §10 | `{ notes, unread }` | FB-1 | FB-8 |
| 3 | `notes.note_opened` | F-FEEDBACK-001 §10 | `{ presetId, fromRole: 'teacher' \| 'family', hasText, hasSuggest, firstOpen }` | FB-1 | FB-8 |
| 4 | `notes.reaction_picked` | F-FEEDBACK-001 §10 | `{ reaction: 'thanks' \| 'will_try' \| 'did_it' \| 'happy', fromRole, changed }` | FB-1 | FB-8 |
| 5 | `notes.suggest_started` | F-FEEDBACK-001 §10 | `{ fromRole }` (Start on a suggested quest) | FB-1 | FB-8 |
| 6 | `notes.report_sent` | F-FEEDBACK-001 §10 | `{ reason: 'unkind' \| 'unsafe' \| 'not_for_me' \| 'other', via: 'note_page' \| 'grown_up_zone' }` (no profileId) | FB-1 | FB-9 |
| 7 | `notes.prefs_changed` | F-FEEDBACK-001 §10 | `{ classes: 'all' \| 'presets' \| 'off' }` (no profileId) | FB-1 | FB-9 |
