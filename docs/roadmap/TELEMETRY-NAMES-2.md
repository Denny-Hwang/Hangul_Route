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
| 11 | `story.locked.tapped` | F-STORY-004 §3.11 | `{ storyId }` (only when gating is switched on) | 4.3a | 4.5, 4.8e (a locked Home card; same payload) |
| 12 | `story.read.finished` | F-STORY-002 §3.12 | `{ storyId, level, mode: 'quest' \| 'replay', scenes, scenesSeen, linesPlayed, termsOpened }` | 2.1 | 2.6a |
| 13 | `story.sources.opened` | F-STORY-002 §3.12 | `{ storyId, from: 'reader' \| 'end' \| 'episode' \| 'notes' \| 'scene', factId? }` | 2.1 | 2.7 |
| 14 | `story.sources.link_opened` | F-STORY-002 §3.12 | `{ storyId, factId }` (after the grown-up gate, on a successful hand-off) | 2.1 | 2.7 |
| 15 | `journey.cell_stories_opened` | F-STORY-005 §3.11 | `{ stageKey, themeKey, stories, source: 'cell' \| 'lesson-row' \| 'story-pill' }` | 5.5b | 5.5b |
| 16 | `card.catchup_granted` | F-STORY-006 §3.9 | `{ count, episode, stage, welcome, quest, set }` (one per reconcile that adds more than the welcome card) | 6.2 | 6.4b |
| 17 | `card_set.complete` | F-STORY-006 §3.9 | `{ setId, cardsAwarded }` | 6.2 | 6.4b |
| 18 | `audio.capability_checked` | F-AUDIO-004 §3.14 | `{ platform, engine: 'clips+tts' \| 'tts' \| 'clips' \| 'none', koVoice: 'none' \| 'network' \| 'local' \| 'enhanced' \| 'premium', reason? }` (once per session) | A-1 | A-4a |
| 19 | `audio.fallback_shown` | F-AUDIO-004 §3.14 | `{ source, reason: 'muted' \| 'no_voice' \| 'error' \| 'blocked' }` (once per session, source, reason) | A-1 | A-5a, A-5b, 002 2.6a, 003 3.4a |
| 20 | `audio.mute_changed` | F-AUDIO-004 §3.14 | `{ muted, source: 'profile' \| 'fallback_panel' }` | A-1 | A-4a |
| 21 | `audio.playback_failed` | F-AUDIO-004 §3.14 | `{ kind: 'clip' \| 'tts', reason: 'missing' \| 'fetch' \| 'decode' \| 'blocked' \| 'timeout' \| 'engine', code, source }`: `code` a Web Speech error code, `timeout`, `none` or `other`; `source` the surface id or `unknown` (amended 2026-10-17, A-11; at most 3 per (kind, reason, code) and 12 per page) | A-1 | A-3, A-4a, A-11 |

`source` values for the two audio events that other specs rely on: `match-sound`, `discover`, `listen-pick`, `trace`, `story-reader`, `story-check`, `story-order`, `presenter` (a presenter slide's sound) and `presenter-check` (the presenter's Test the sound; both added 2026-10-17, F-AUDIO-004 A-11).

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

## H. My route / Learning Route names (F-ROUTE-001; added by its R-0 docs PR, row 4 by LR-0)

Three names in the new `route_map.` namespace (the map of progress; F-PLAN-002's dated weekly plan keeps `route.`). None collides with sections A to G, with the 55 names on `main` at `abda11d`, or with F-PLAN-002's `route.*` names (`route.created`, `route.repaced`, and `route.proposed`, `route.proposal_skipped`, `route.updated` from amendment FP-B7, whose rows that spec's P2-4 adds). Worker first: R-W1 adds them to `TELEMETRY_EVENT_NAMES` and its exact-list test and is deployed before the app build that sends them (R-3). Sent for the active profile only, never in read-only (grown-up) mode; stage keys, booleans and codes only.

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `route_map.viewed` | F-ROUTE-001 §3.16 | `{ source: 'home' \| 'journey' \| 'result' \| 'parent', stage: StageKey, hasStart: boolean, hasPlan: boolean }` (the page opens) | R-W1 | R-3 (sources `home` R-4b, `result` F-PLC-001 P-7b) |
| 2 | `route_map.stage_opened` | F-ROUTE-001 §3.16 | `{ stage: StageKey }` (a stage row is expanded) | R-W1 | R-3 |
| 3 | `route_map.continue_tapped` | F-ROUTE-001 §3.16 | `{ stage: StageKey, hero: 'start' \| 'continue' }` (the hero button is pressed) | R-W1 | R-3 |
| 4 | `route_map.goal_reached` | F-ROUTE-001 §3.16 [LR-A7], `AMENDMENTS-ROUTE-LEARNING-ROUTE.md` §8 | `{ stage: StageKey, goalFrom: 'class' \| 'school' \| 'family' \| 'self' }` (the first time the Route tab shows a reached plan goal on this device) | LR-W1 | LR-5c |

**Learning Route amendment (2026-10-11).** Row 4 is new; Worker first: LR-W1 appends it after `route_map.continue_tapped` in `TELEMETRY_EVENT_NAMES` and its exact-list tests and is deployed before the app build that sends it (LR-5c). Rows 1 and 3 widen their payloads without a Worker change (the Worker checks names only and stores the payload as sent, `packages/backend/src/routes/telemetry.ts:68-75`): row 1 `source` gains `'tab'` (LR-4) and the payload gains `goalFrom: 'class' | 'school' | 'family' | 'self' | 'default' | 'none'` (LR-5a); row 3 gains `from: 'class' | 'school' | 'family' | 'self' | 'cursor'` (F-ENT-003's `NextSource`, LR-5a). Only the learner's Route tab sends these; the grown-up root-stack screen and the console send nothing. Continue also sends F-ENT-003's `route.next_started { surface: 'route' }` (section N). The route page has no ask button, so it never sends `access.help_asked`.

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

## L. Progress report names (F-REPORT-001; added by its RP-0 docs PR)

One name in the new `report.` namespace (grown-up reports of a learner or a class). None collides with sections A to K or with `TELEMETRY_EVENT_NAMES` on `main` at `ea9049e4` (no existing name starts with `report.`; the level check's grown-up report screen sends no event of its own). Worker first: RP-W1 adds the name to `TELEMETRY_EVENT_NAMES`, its exact-list test and a `report.*` payload filter in `packages/backend/src/lib/server-events.ts` (`keptEventFields`, shared by `POST /api/telemetry` and `recordServerEvent`; keeps only `scope`, `space`, `period` with their enum values; always drops `profileId`), and is deployed before RP-5 records it and before any app build with RP-9 sends it. **Two emitters**: the console has no telemetry client, so the Worker records the event itself inside the two report routes (`packages/backend/src/lib/server-events.ts` appends to the same in-memory store as `POST /api/telemetry`); the learner app sends it through `track()` from the in-app report. Codes only: **no `profileId`, no space id, no learner id, no name**.

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `report.viewed` | F-REPORT-001 §3.13 | `{ scope: 'learner' \| 'class', space: 'family' \| 'class' \| 'device', period: 'day' \| 'week' \| 'month' \| 'all' }` (a report opens, its period changes or it steps to a past window) | RP-W1 | RP-5 / RP-5b (Worker, console views), RP-9 (learner app, `space: 'device'`) |

## M. Notes from grown-ups names (F-FEEDBACK-001; added by its FB-0 docs PR)

Seven names in the new `notes.` namespace (the learner side of the adult-to-learner feedback channel). None collides with sections A to L or with `TELEMETRY_EVENT_NAMES` on `main` at `ea9049e4` (no existing name starts with `notes.`). Worker first: FB-1 adds all seven to `TELEMETRY_EVENT_NAMES` and its exact-list test, and the API Worker is deployed with FB-1 before the app builds that send them (FB-8, FB-9). App only (the console has no telemetry client). Payloads never carry note text, a note or batch id, a sender label, a space name or id, an account id or a learner name; **every** `notes.*` event is sent **without `profileId`**, so the server holds no per-learner log of opened notes. The Worker enforces both (FB-1): `keptEventFields` in `packages/backend/src/lib/server-events.ts` (shared by `POST /api/telemetry` and `recordServerEvent`) drops any `profileId` on a `notes.*` event and keeps, per name, only the payload keys of the table below in their documented shapes (`NOTES_PAYLOAD_RULES`: codes from the shared notes lists, booleans, counts 0-30); every other key is dropped.

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `notes.card_shown` | F-FEEDBACK-001 §10 | `{ unread }` (once per app session, when the Home card first shows) | FB-1 | FB-8 |
| 2 | `notes.list_viewed` | F-FEEDBACK-001 §10 | `{ notes, unread }` | FB-1 | FB-8 |
| 3 | `notes.note_opened` | F-FEEDBACK-001 §10 | `{ presetId, fromRole: 'teacher' \| 'family', hasText, hasSuggest, suggestOpen }` | FB-1 | FB-8 |
| 4 | `notes.reaction_picked` | F-FEEDBACK-001 §10 | `{ reaction: 'thanks' \| 'will_try' \| 'did_it' \| 'happy', fromRole, changed }` | FB-1 | FB-8 |
| 5 | `notes.suggest_started` | F-FEEDBACK-001 §10 | `{ fromRole }` (Start on a suggested quest) | FB-1 | FB-8 |
| 6 | `notes.report_sent` | F-FEEDBACK-001 §10 | `{ reason: 'unkind' \| 'unsafe' \| 'not_for_me' \| 'other', via: 'note_page' \| 'grown_up_zone' }` | FB-1 | FB-9 |
| 7 | `notes.prefs_changed` | F-FEEDBACK-001 §10 | `{ classes: 'all' \| 'presets' \| 'off' }` | FB-1 | FB-9 |

## N. Free plan and plan-next names (F-ENT-003; added by its E3-0 docs PR)

Three names in the new `access.` namespace and two in F-PLAN-002's `route.` namespace. None collides with sections A to M or with the names in `TELEMETRY_EVENT_NAMES` on `main` at `ea9049e4` (no existing name starts with `access.`; `route.next_started` and `route.offplan_finished` are new). Worker first: E3-1b adds all five to `TELEMETRY_EVENT_NAMES` and its exact-list tests, and the Worker deploys on merge before any app build that sends them (E3-4, E3-6, E3-7). Active profile only; codes, stage keys and counts only; no title, name, price, product or tier word; F-BROWSE-001 sends none of them. Changed payload of an existing name (section D style): `paywall.viewed.from` gains `episode`, `home`, `results` (F-BILL-002 keeps `paywall.viewed` for its Plan screen).

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `access.preview_opened` | F-ENT-003 §3.12 | `{ stage: StageKey, theme: ThemeKey, from: 'journey' \| 'home' \| 'route' \| 'results' \| 'library' \| 'player' }` (a lesson page opens in preview; stable codes only, the internal route day is not sent) | E3-1b | E3-6 |
| 2 | `access.help_asked` | F-ENT-003 §3.12 | `{ from: 'episode' \| 'home' \| 'results' \| 'library', audience: 'family' \| 'class' \| 'self' }` (the ask button, before the gate) | E3-1b | E3-6, E3-7 |
| 3 | `access.free_end_reached` | F-ENT-003 §3.12 | `{ freeDays: number, placedOut: boolean }` (first time on this device for this profile) | E3-1b | E3-7 |
| 4 | `route.next_started` | F-ENT-003 §3.12 | `{ source: 'class' \| 'school' \| 'family' \| 'self' \| 'cursor', surface: 'home' \| 'results' \| 'journey' \| 'episode' \| 'route' \| 'placement' }` (the `routeNext` quest is started) | E3-1b | E3-4, E3-6 |
| 5 | `route.offplan_finished` | F-ENT-003 §3.12 | `{ source: 'class' \| 'school' \| 'family' \| 'self', stage: StageKey }` (a quest outside the plan is completed while a leading source exists) | E3-1b | E3-4 |

## O. Persona app shell names (F-APP-001; added by its A-0 docs PR)

Three names in the new `shell.` namespace (the learner app's entries into the grown-up area on app.hangulroute.com). None collides with sections A to N or with `TELEMETRY_EVENT_NAMES` on `main` at `ba78478c` (no existing name starts with `shell.`). Worker first: A-1 adds all three to `TELEMETRY_EVENT_NAMES` and its exact-list test, and the API Worker deploys on merge before any app build that sends them (A-6, A-7). Sent by the learner app only (the console has no telemetry client, F-APP-001 OD-9). **No `profileId`** on any of them: codes only, never a name, an email, a path with ids or a space id. The Worker enforces it: for `shell.*` it drops `profileId` and keeps only the keys and values listed below (`SHELL_TELEMETRY_PAYLOADS`), as it does for `space.transfer.*`. Before A-6 merges, confirm the API deployment includes A-1 (F-APP-001 section 3.18). `paywall.console_opened` keeps firing where F-BILL-002 keeps it (flag off).

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `shell.persona_chosen` | F-APP-001 §3.18 | `{ persona: 'learner' \| 'parent' \| 'teacher', from: 'welcome' \| 'welcome-continue' }` (a Welcome persona button, Continue as, or Let's start) | A-1 | A-7 |
| 2 | `shell.grown_up_handoff` | F-APP-001 §3.18 | `{ via: 'profile' \| 'dashboard' \| 'plan' \| 'lock', target: 'router' \| 'billing' \| 'next' }` (the learner app hands the tab to the grown-up area after the gate) | A-1 | A-6 (lock), A-7 (profile, dashboard, plan) |
| 3 | `shell.path_bounced` | F-APP-001 §3.18 | `{ prefix: 'signin' \| 'start' \| 'teach' \| 'parent' \| 'account' }` (the learner bundle booted on a grown-up path with no file and sent the tab to the persona entry) | A-1 | A-6 |

## P. All lessons names (F-BROWSE-001; added by its BR-1 PR)

Five names in the new `browse.` namespace (a paying parent's or teacher's All lessons root, `/browse`). None collides with sections A to O or with `TELEMETRY_EVENT_NAMES` on `main` at `8dce58d3` (no existing name starts with `browse.`). Worker first: BR-1 adds all five to `TELEMETRY_EVENT_NAMES`, its exact-list test and `BROWSE_EVENT_NAMES` (`schemas/browse.ts`, the list the browse telemetry fence allows); BR-2 adds the server-side payload allow-list for `browse.*` in `routes/telemetry.ts` (drops any `profileId` and every payload key not listed here); both deploy before BR-6, the first sender. The browse root has no profile: **every** `browse.*` event is sent **without `profileId`**, on its own queue (`browse:telemetry-queue`). `itemId` is a content id, never a person id; no account id, space, learner id or name. The console has no telemetry client and sends none.

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `browse.opened` | F-BROWSE-001 §9 | `{ source: BrowseSource, scope: 'full' \| 'sampler' \| 'none', passFrom: 'account' \| 'kept' \| 'gate' \| 'none', offlineReady: boolean }` (the root resolved its pass) | BR-1 | BR-6 |
| 2 | `browse.item_viewed` | F-BROWSE-001 §9 | `{ kind: 'episode' \| 'quest' \| 'story' \| 'vocab-topic' \| 'card', itemId, access: 'open' \| 'closed' }` (an episode outline, item page or card opens) | BR-1 | BR-7 |
| 3 | `browse.preview_started` | F-BROWSE-001 §9 | `{ kind: 'quest' \| 'story' \| 'vocab-topic', itemId }` (Preview this lesson) | BR-1 | BR-8 |
| 4 | `browse.preview_ended` | F-BROWSE-001 §9 | `{ kind, itemId, reachedEnd: boolean, minutes }` (`minutes` rounded down, capped at 60; the preview end screen, or leaving early) | BR-1 | BR-8 |
| 5 | `browse.plans_tapped` | F-BROWSE-001 §9 | `{ kind: 'quest' \| 'story' \| 'vocab-topic' }` (See plans on a closed item; only with `flags.contentGatingEnabled` on) | BR-1 | BR-7 |

## Q. Billing names (F-BILL-002; added by its B-3 PR)

Three names in the new `billing.` namespace, recorded from the Stripe webhook. B-5 and B-4 append their five rows here (`billing.checkout_started`, `billing.checkout_refused`, `billing.portal_opened`, `billing.summary_viewed`, `billing.receipts_viewed`), each in the same PR as the only code that sends it. None collides with sections A to P or with `TELEMETRY_EVENT_NAMES` on `main` at `cdb59c7b` (no existing name starts with `billing.`).

**Worker-only.** The console has no telemetry client (F-APP-001 OD-9), so the Worker records these events itself with `recordServerEvent` (`packages/backend/src/lib/server-events.ts`) into the same capped in-memory store that `POST /api/telemetry` writes. They are transient diagnostics, not a metric of record. The record of money is the D1 `billing_events` table. `POST /api/telemetry` refuses every `billing.*` name from a client with 422 (`isServerOnlyTelemetryName`, `schemas/billing.ts`), so an app cannot forge one.

**Codes only.** For each name, `keptEventFields` keeps only the keys listed below in their documented shapes (`BILLING_PAYLOAD_RULES`): `planKey` is one of `PlanKeySchema`, `mode` is one of `StripeModeSchema` (`test` / `live` / `none`; a webhook event is `live` only when Stripe's `livemode` is true), and the flags are booleans. An event never carries an account, space or learner id, an amount, a currency, a promo code, a URL or a `profileId`.

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `billing.checkout_completed` | F-BILL-002 §10 | `{ planKey, mode, duplicate: boolean }` (the webhook applied a `checkout.session.completed`; `duplicate` is set when another Stripe subscription of the same plan already covered the space, §4.4, best effort) | B-3 | B-3 (Worker, webhook) |
| 2 | `billing.payment_failed` | F-BILL-002 §10 | `{ planKey, mode }` (the webhook recorded an `invoice.payment_failed` row for the first time) | B-3 | B-3 (Worker, webhook) |
| 3 | `billing.refund_recorded` | F-BILL-002 §10 | `{ planKey, full: boolean, mode }` (the webhook recorded a `charge.refunded` row for the first time; `full` when the whole charge is refunded) | B-3 | B-3 (Worker, webhook) |
| 4 | `billing.checkout_started` | F-BILL-002 §10 | `{ planKey, mode, promo: boolean }` (a Stripe Checkout session was created; `promo` when a validated code was applied) | B-5 | B-5 (Worker, `POST /api/entitlements/stripe/checkout`) |
| 5 | `billing.checkout_refused` | F-BILL-002 §10 | `{ planKey, reason }`, `reason` one of `reverify_required` (403 step-up), `already_active` (the 409 that landed in BY-1, #371), `live_not_enabled` (503 live guard), `not_configured` (no Stripe key or price bound). No event for a caller who may not buy for the space (403 forbidden) | B-5 | B-5 (Worker, checkout) |
| 6 | `billing.portal_opened` | F-BILL-002 §10 | `{ planKey, mode }` (a Billing Portal session was created; `planKey` of the subscription row it manages) | B-5 | B-5 (Worker, `POST /api/entitlements/stripe/portal`) |
| 7 | `billing.summary_viewed` | F-BILL-002 §10 | `{ cards: n, payerCards: n, mode }` (`GET /api/billing/summary` answered without `poll=1`; counts are whole numbers) | B-4 | B-4 (Worker, `GET /api/billing/summary`) |
| 8 | `billing.receipts_viewed` | F-BILL-002 §10 | `{ rows: n }` (`GET /api/billing/receipts` answered a payer; at most 50) | B-4 | B-4 (Worker, `GET /api/billing/receipts`) |

A retried webhook delivery writes no second history row and sends no second `payment_failed` or `refund_recorded`. `checkout_completed` is sent each time a completion is applied. Every event is recorded only after the whole webhook request has succeeded, so a request that fails and is retried sends it once.

Payload note on an existing name (section D style): `paywall.viewed` keeps the payload `{ from, state }`, where `state` is `covered | premium | free`. F-BILL-002 keeps it for the status-only Plan screen (B-9). `paywall.console_opened` is sent on the web only, when Open billing actually opens after the gate. A native build never sends it, because the button does not exist there. Its payload is `{ state }` (`covered | premium | free`, codes only, through `billingOpenedEvent`) from F-BILL-002 B-9, and it is sent only when the hand-off reports `opened` (a blocked tab, an offline device or a cancelled gate sends nothing). Earlier builds sent `{ plan: 'family_lifetime' }` on every press, and installed copies of them may still do so, so anyone reading stored events must accept both shapes under this one name. With `flags.grownUpHomeEnabled` on (F-BILL-002 B-9b), Open billing hands off in the same tab and sends `shell.grown_up_handoff { via: 'plan', target: 'billing' }` instead; `paywall.console_opened` is then not sent. The Worker passes `paywall.*` payloads through unchanged, so no Worker change was needed.

## R. Category expansion and mastery names (F-CURR-002; added by its CM-0b docs PR)

> **Names only.** This section records the names and payloads of F-CURR-002 section 11.3 (owner decisions of 2026-10-21, F-CURR-002 sections 16 and 21). None of them is in `TELEMETRY_EVENT_NAMES` yet. Row **CM-3** adds every name below to `TELEMETRY_EVENT_NAMES` (the list the Worker allowlist reads), updates the exact-list test (rule 2) and deploys the Worker; only then may the emitting rows send them (rule 1, Worker first). In the same Worker-first deploy, CM-3 also adds the **storage rule** of every name below to `keptEventFields` (`packages/backend/src/lib/server-events.ts`): a payload is stored only when it parses against the exact shape in the table (strict, so an extra key fails; a payload that does not parse is dropped and the event is kept without it), the profile id is dropped where the table says so, and the server-only names are refused on `POST /api/telemetry`. A backend test posts each client-sent name with its documented fields and asserts that they survive. This matters most for `lecture.game.finished`: the Worker sends every `lecture.*` name through `LECTURE_PAYLOAD_RULES`, and a `lecture.*` name with no rule there keeps no payload at all, so adding the name alone would store all three fields as nothing. Row CM-70a then puts the metric names on the `learning_rollups` allowlist (F-CURR-002 section 11.2).

Nineteen new names. None collides with sections A to Q or with `TELEMETRY_EVENT_NAMES` on `main` at `a384759ca` (135 names). The namespaces `memory.`, `items.`, `mastery.`, `testout.`, `goal.`, `week.`, `decode.`, `stamp.`, `weekly_quest.`, `pack.`, `family.` and `exp.` are new; `stage.`, `quest.`, `space.` and `lecture.` already exist, and no name below repeats one of theirs.

**Payload rules** (F-CURR-002 section 11.1, on top of rule 3): ids, codes, counts and buckets only. No names, no free text and no learner input: Write Frame and My Story text is never sent. `profileId` rides in the envelope, and the rollup table never stores it, an install key or a device id. Per-item answers stay on the device and are aggregated into the one daily `memory.daily` event. Dashboards suppress any group with fewer than 20 profiles.

| # | Name | Owning spec | Payload | Added to the list by | Emitted by |
|---|---|---|---|---|---|
| 1 | `memory.daily` | F-CURR-002 §11.3 | `{ hist, lapses, calib, items, newHeld, minutes, durableWeekBucket, dueVolumeBucket, arms }`: `hist` is counts by item kind x rung x lag bucket x `{ right, wrong }`, with lag buckets 0-1, 2-3, 4-7, 8-14, 15-30 and 31+ days; `calib` is 10 calibration bins, sent by row CM-72 only. Sent once a local day | CM-3 | CM-12 (`calib`: CM-72) |
| 2 | `items.seeded` | F-CURR-002 §11.3 | `{ countBucket, spreadDaysBucket }` (the one-time seeding of an existing learner's items, F-CURR-002 §4.8) | CM-3 | CM-12 |
| 3 | `mastery.level_up` | F-CURR-002 §11.3 | `{ cellId, level }` (`level` 1-3, F-CURR-002 §4.4) | CM-3 | CM-20 |
| 4 | `stage.card_opened` | F-CURR-002 §11.3 | `{ stage }` (the stage card or its Passport page was opened) | CM-3 | CM-22 |
| 5 | `testout.finished` | F-CURR-002 §11.3 | `{ cellId, passed, items, firstTryCorrect }` | CM-3 | CM-21 |
| 6 | `quest.adapt` | F-CURR-002 §11.3 | `{ questId, dir: 'compact' \| 'scaffold' }` | CM-3 | CM-24 |
| 7 | `goal.set` | F-CURR-002 §11.3 | `{ daily, weeklyDays }` | CM-3 | CM-17 |
| 8 | `goal.met` | F-CURR-002 §11.3 | `{ points, target }` (once a local day) | CM-3 | CM-17 |
| 9 | `week.goal_met` | F-CURR-002 §11.3 | `{ days, target }` | CM-3 | CM-17 |
| 10 | `decode.sprint.finished` | F-CURR-002 §11.3 | `{ rateBucket, probeRateBucket, sprintIndexBucket }` | CM-3 | CM-32 |
| 11 | `stamp.earned` | F-CURR-002 §11.3 | `{ stampId }` | CM-3 | CM-60 |
| 12 | `weekly_quest.complete` | F-CURR-002 §11.3 | `{ questKind }` | CM-3 | CM-60 |
| 13 | `pack.opened` | F-CURR-002 §11.3 | `{ packId }` | CM-3 | CM-50b |
| 14 | `pack.level_complete` | F-CURR-002 §11.3 | `{ packId, stage }` | CM-3 | CM-50b |
| 15 | `family.goal_met` | F-CURR-002 §11.3 | `{ weekTarget }`, a whole number 1-10000. Account level, no profile breakdown: the Worker stores it **without the profile id** the envelope carries, and the payload never holds a space, account or learner id | CM-3 | CM-61 |
| 16 | `space.goal.set` | F-CURR-002 §11.3 | `{ metric: 'stories' \| 'refreshed' \| 'quests', target }`, `target` a whole number 1-10000 (the class goal of F-CURR-002 §7.6). **Server-only**: recorded by the Worker when a teacher sets a class target; `POST /api/telemetry` refuses it with 422, as `billing.*` (section Q). Stored without a profile id; never a space, class, account or learner id | CM-3 | CM-62 (Worker) |
| 17 | `space.goal.met` | F-CURR-002 §11.3 | `{ metric, target }`, the same codes as row 16. **Server-only**, recorded by the Worker once a week when a class total first reaches its target; refused on `POST /api/telemetry` with 422. Stored without a profile id; never a space, class, account or learner id | CM-3 | CM-62 (Worker) |
| 18 | `lecture.game.finished` | F-CURR-002 §11.3 | `{ preset: 'team-relay' \| 'yut-race' \| 'hidden-heritage-big' \| 'bingo', rounds, teams }` (the `game` block presets of F-CURR-002 §8), `rounds` a whole number 0-200, `teams` a whole number 0-4 (0 for a preset without teams). Stored without a profile id, as every `lecture.*` name; CM-3 adds its rule to `LECTURE_PAYLOAD_RULES` (or checks it before the `lecture.` prefix filter), or the fields are lost | CM-3 | CM-63 |
| 19 | `exp.exposure` | F-CURR-002 §11.3 | `{ experimentId, arm }` | CM-3 | CM-71 |

**Changed payloads of existing names** (section D style; no list change; both are ordinary names, whose payloads the Worker stores as given):

- `review.start` / `review.complete` (section B) keep their payloads. Their `kind` adds `cell-check` and `warmup` to `daily`, `feedback` and `stage-certificate` (`ReviewKindSchema`, row CM-3b). They are additive for telemetry, but `ReviewKindSchema` is a strict enum inside `SnapshotPutSchema` and `BackupFileSchema`, so an older client or Worker that reads a snapshot or backup holding a new kind would reject it whole. The new kinds may be written only after CM-3b has made `reviews[]` lenient per entry on every read path (snapshot, backup, Rescue Code) and that Worker is deployed (F-CURR-002 §4.8). CM-3, the names row, does not touch `ReviewKindSchema`. Emitted by CM-14 (Daily Review, Keep going), CM-15 (warm-up, Try these again), CM-21 (Cell Check) and CM-22 (Stage Check).
- `session.end` (section A) keeps `{ durationSeconds, streakDays }` and gains three **optional** fields, additively, in row CM-3:
  - `questLeft: 0 | 1`: 1 when the session ended inside a quest, before its reward step.
  - `leftAtKind`: the game kind code of the round on screen when the session ended.
  - `afterWrongStreak: 0 | 1 | 2`: the wrong first tries in a row just before the end, where 2 means two or more.

  These three give the quit-rate guardrail without a per-profile join (F-CURR-002 sections 3.3 and 11.2). An older build sends none of them, and a reader treats a missing field as unknown, never as 0. The quit rate read from `questLeft` is a **lower bound**: `session.end` is best effort on `pagehide`, and a session killed before its end sends nothing (F-REPORT-001 section 3.3.2), so the quits most likely to matter are the ones most likely to be missing. Dashboards label it as a lower bound and show it beside the `quest.start` minus `quest.complete` count for the same days.
