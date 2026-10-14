Status: ready

# F-VOC-003 — Words: the topic picker, the topic page and flip-card flashcards

**Scope**: `apps/mobile` (`screens/vocab/`, `components/FlipCard.tsx`, `logic/vocab/`, `store/vocab-run-store.ts`, `config/flags.ts`, `navigation/`, `screens/library/LibraryScreen.tsx`) · `packages/design-system` (small: `SectionTabs` is **not** needed; reuses `Card`, `Pill`, `Progress`, `StarRow`, `KoreanText`, `WordArt`) · `packages/content-schema` (telemetry names)
**Owner**: solo dev
**Rollout**: behind `flags.vocabTopicsEnabled` (default `false`), after F-VOC-001 (data), F-VOC-002 (pictures) and F-VOC-005 PR P-2a (`recordVocab`; P-1 is the server-first schema PR and must be deployed before any screen PR that records events, F-VOC-005 §3.3). PR order in §6.
**Wireframes**: `wireframes/vocab-topics.md` (A topic picker, B topic page, C empty and error states) and `wireframes/vocab-flashcards.md` (D front, E back, F chunk end and quick check) — promoted to `design/wireframes/vocab/{topics,topic-detail,flashcards}.md`

Parent / siblings: F-VOC-001 (items, topics, accessors) · F-VOC-002 (WordArt, `PictureArt`) · F-VOC-004 (the Speed Round, which the topic page launches, and the shared question view) · F-VOC-005 (progress events, boxes, sync) · F-I18N-001 §3.5 (`KoreanText`, `romanizationShown`, `romanizationMode`) · F-AUDIO-004 §3.4-§3.8 (`playPrompt`, `canPlayKorean`, prompt-state fallback) · F-MOTION-002 (card flip) · F-STORY-004 §3.3 and §3.9 (Library sections, `content-access.ts`) · F-LEARN-001 (`levelOrder`) · F-QUEST-002 §3.11-§3.12 (Pic-Word Match, `MinigameHost`) · design input `topic-speed-quiz.md` §3 · blueprint 02 §3 A7 (Library "Theme Packs")

---

## Decisions

Binding owner decisions this spec implements: **D1** (no age labels or age-gated content; the learner **level** changes only the chunk size and default question mix) · **D2** (taught Korean always with romanization and a gloss in the UI language; "hide romanization until tap" is an explicit opt-in per profile; default visible) · **D3** (positive nudges only: counts and fill-only meters, no per-card failure) · **D5** (no gating; the free set is data behind `isFreeContent`; no lock or "Premium" pill while gating is off) · **D6** (TTS with a capability check and a visible text fallback) · **D7** (pictures are SVG) · **D8** (spec id).

| # | Decision | Why |
|---|---|---|
| T1 | **Placement: a "Words" entry card on the Library screen that opens full-screen routes**, not a fourth tab and not a Library section tab yet. When F-STORY-004's `SectionTabs` and `library-sections.ts` have landed, this spec **registers the reserved slot** (F-STORY-004 §3.3 says F-VOC-003 registers it): id **`theme-packs`** stays, its `titleEn` becomes **"Words"** (a one-word amendment of the F-STORY-004 §3.3 table row, which said "Theme packs"; the tab label must match the entry card and the routes), `isAvailable` = `flags.vocabTopicsEnabled && visibleTopics().length > 0`, the same `TopicGrid` component renders inline in that section and the entry card is removed in the same PR (if the tabs landed first) or in a small follow-up (if this spec lands first). | The design input chose "a Words section on the Library, not a new tab"; F-STORY-004 sits at step 5 of the global PR order (`docs/roadmap/spec-wave-2026-10.md` §4) and must not block vocabulary. The routes and the grid are the same either way. |
| T2 | **A word is *collected* the first time the learner turns its card over (or marks it)** — a fill-only fact that never goes away (F-VOC-005 `introduced`). Quick-check results change the schedule, never the collection. | D3: collection meters only fill; a missed question can never remove a word the learner already met. |
| T3 | **Self-marking is two buttons on the back of the card, "Got it" and "Show me again"**, available to every learner (D1). "Got it" is a *self report*: it seeds box 2 at most. "Show me again" requeues the card once in this chunk and seeds box 1. Neither is shown to a caregiver as a score. | A self-report must not look like mastery; no age-gating of the control. |
| T4 | **Chunk sizes follow the level, not an age**: Pictures first 4, Some reading 4, Reads easily 6; unknown level 4 (`levelOrder` null). A 12-word topic is 3, 3 or 2 chunks. | Working memory and screen space; D1; F-LEARN-001's `levelOrder()` is the only reader of the level id. |
| T5 | **The Korean line on a card is a `KoreanText`**; romanization visibility is `romanizationShown(mode, revealed)`; the flashcard header has a **"Reading practice" switch** bound to the profile's `romanizationMode` (`always` / `tap`), the same setting as the Profile screen. | One setting, one meaning (F-I18N-001 §3.5.3); changing it in either place changes both. |
| T6 | **Audio**: the card front plays the word once when it appears (never the first card of a session before a gesture exists, F-AUDIO-004 §3.6), a large speaker button replays it without limit, and a failure leaves the Korean and romanization already on screen with one calm line "No sound? You can read it here." | F-QUEST-002 §3.10 uses the same rule; the flashcard already shows the text, so the fallback adds only the explanation. |
| T7 | **The topic page offers three activities** — Learn (flashcards), Speed round (F-VOC-004), Match (F-QUEST-002 Pic-Word Match with a `vocab` host, shown only once that game exists). The learner chooses; the app only *suggests* one with a primary button (the one that fits their progress). | "Choice, then a recommendation" (wireframe-skill §4: 선택 → 추천). |
| T8 | **A topic appears in the picker only when it is `ready`/`shipped` and all its pictures resolve** (`PictureArt` can draw them); otherwise it is skipped, never shown half-empty. | A topic with blank tiles would teach nothing; F-VOC-002 §6 ships art in batches. |
| T9 | **No streak copy on these screens in v1.** Encouraging streak messages (D3) belong to the Home nudges of F-VOC-005 §3.7; the picker and cards show collection counts only. | One surface owns streak messaging. |

---

## 1. Context

**What exists** (verified at `main` HEAD `ecf6365`, after PRs #102-#105; cites re-checked by the review of 2026-10-10):

- **Library** is one screen, the card gallery (`apps/mobile/src/screens/library/LibraryScreen.tsx:28-86`): a title row with a collected pill (`:42-48`), theme filter chips, the card grid, and a "How to collect more" card (`:76-82`). It is a bottom tab (`navigation/types.ts:45-49`, `MainTabParamList { Home; Journey; Library }`).
- **Root stack** is registered in `navigation/root.tsx:47-61`; every learner flow beyond a tab (EpisodeDetail, QuestPlayer, Minigame, Results, CardDetail) is a stack screen declared in `RootStackParamList` (`navigation/types.ts:3-37`).
- **The card flip** that flashcards want is inlined in `CardDetailScreen.tsx:64-131`: `react-native-reanimated` shared value, two 200 ms legs (`motion.duration.base`, `tokens.ts:213-221`) with the content swap at the edge-on midpoint, taps ignored while flipping (`:102`), and an instant swap under `useReducedMotion` (`:104-108`). It is not reusable as written.
- **Audio** today is `speak()` / `playJamoSound` with no result and no capability (`platform/audio.ts:26-54`); F-AUDIO-004 replaces them with `playPrompt` returning `'played' | 'muted' | 'unavailable'` and a reducer for the visible fallback (its §3.5, §3.8).
- **No vocabulary routes, store or screens exist**; `config/flags.ts:24-65` has four flags and a launch-defaults object; `config/__tests__/flags.test.ts` pins the defaults.
- **Progress** lives in `ProgressSnapshot` (`packages/content-schema/src/schemas/progress.ts:77-88`) persisted per profile by `store/progress-store.ts` under `progress:${profileId}`; `hydrateLearnerData()` (`store/bootstrap.ts:10-15`) loads every profile before the navigator renders. F-VOC-005 adds the vocabulary slice and the actions used here.
- **Home** is the "Today" tab; nothing about vocabulary appears there until F-VOC-005 §3.7.

**What this spec does.** (1) Adds the `vocabTopicsEnabled` flag and four routes. (2) Specifies the Words entry, the **topic picker** (a grid of 12 tiles), the **topic page** (a word wall and three activities) and the **flashcard** flow (chunks, flip card with a WordArt picture, listen, romanization switch, got-it / show-me-again, a two-question quick check, chunk summary). (3) Defines the pure modules that decide chunks, queues and what to suggest, and the vocabulary host that lets existing games report into the vocabulary store.

Terms. **Chunk**: a short run of cards (4 or 6). **Collected**: a word whose card the learner has flipped or marked. **Word wall**: the grid of a topic's words on the topic page. **Suggested activity**: the one primary button on the topic page.

## 2. User story

> As someone learning Korean words from zero, I want to pick a topic I care about, meet a few new words at a time with a picture and a voice, flip each card to see what it means, and tell the app which ones I already know — and I want to watch my collection grow, without ever being told I got something wrong.

Companion stories:

- As a **parent or teacher**, I want a learner to be able to choose Food or Animals without a lock, and to see a count of words collected, not a grade.
- As a **learner who prefers to read the sound only when I ask** (reading practice), I want romanization hidden until I tap, and the setting remembered.
- As a **learner on a phone with no Korean voice**, I want the Korean and romanization already on the card and a calm note, not an error.
- As a **developer**, I want the chunking, queue and "what to suggest" logic as pure functions, so the screens are thin.

## 3. Acceptance criteria

### 3.1 Flag, routes and entry

- **Flag**: `flags.vocabTopicsEnabled` (interface `config/flags.ts:24-51`, launch defaults `:53-58`, env `EXPO_PUBLIC_VOCAB_TOPICS_ENABLED`, read with `readBool` `:16-22`); launch default **`false`** (the picker is built and tested but unreachable until the first three topics are `approved`, F-VOC-002 §6). `flags.test.ts` gains the default and the env flip. This is the flag F-STORY-004 §3.3 says F-VOC-003 registers. The same PR registers `flags.vocabShowDrafts` (env `EXPO_PUBLIC_VOCAB_SHOW_DRAFTS`, default `false`, dev builds only), which F-VOC-001 §3.7 reads to show `draft` topics.
- **Routes** in `RootStackParamList` (`navigation/types.ts:3-37`), registered in `navigation/root.tsx:47-61`:

```ts
VocabTopics: undefined;                                        // topic picker
VocabTopic:  { topicKey: string };                             // topic page
VocabCards:  { topicKey: string; chunk?: number; startId?: string }; // flashcards (chunk is 0-based; absent = the suggested chunk; startId = a wall tile's word, back face; C-4)
VocabMatch:  { topicKey: string };                             // Pic-Word Match on the topic's collected words (§3.9; only when that game exists)
// F-VOC-004 adds VocabSpeedRound and VocabResults
```

  Each screen reads its param with a guard: an unknown `topicKey` renders "Topic not found" with a Back button (the pattern of `QuestPlayerScreen.tsx`'s "Quest not found").
- **Entry**: `LibraryScreen.tsx` renders, **above** the theme filter chips (after `:50`), a **Words card** when `flags.vocabTopicsEnabled && visibleTopics().length > 0`: a `Card` (tone `brand`) with the title "Words", one plain line ("Pick a topic. Meet a few words at a time."), the **number of words collected** as a plain number with the word "collected" (never a fraction, D3), and a primary button "Open Words" → `VocabTopics`. The card is one pressable (>= `touchTarget.min`, 64) with the accessible name "Words. N collected. Opens topics." When F-STORY-004 ships the section tabs, `theme-packs` ("Words") renders `TopicGrid` inline and this card is deleted (T1).
- With the flag off, `LibraryScreen` renders exactly as today (a render-parity assertion in the e2e, §5).

### 3.2 Pure logic (`apps/mobile/src/logic/vocab/`, 100 % covered, no React, no platform)

| File | Exports | Behaviour |
|---|---|---|
| `topics.ts` | `visibleTopics(topics, canRender)`, `topicState(topic, progress)` | A topic is visible when its status is `ready`/`shipped` (or preview in dev) and `canRender(visual)` is true for **every** item's `visual` (T8). `topicState` returns `{ total, collected, started, complete }` (`collected` = items with `introduced`; **no percent, no fraction field is returned**; the UI prints counts, the dots meter takes the two numbers) |
| `flashcards.ts` | `chunkSize(levelOrder)`, `chunksFor(items, size, fixedOrder)`, `suggestedChunk(chunks, progress)`, `initFlash(chunk)`, `flashReducer(state, event)`, `quickCheckItems(chunk, size)` | §3.5 |
| `suggest.ts` | `suggestActivity(topicKey, progress, now, caps)` → `'learn' \| 'speed' \| 'match'` | §3.4 |
| `wall.ts` | `wallTiles(items, progress)` → `{ id, state: 'collected' \| 'new' }[]` | the word wall (§3.4); never reorders by progress (a stable position is the learner's memory anchor, `design/wireframes/library/gallery.md`) |
| `copy.ts` | `VOCAB_COPY` (`as const`, function messages) | every learner string of this spec and F-VOC-004, in one module until F-I18N-001's catalog exists; a unit test runs `scanLearnerCopy` (`logic/homework/banned-text.ts:30-37`) and the `\d+\s*%` and `\d+\s*/\s*\d+` regexes over every value |

`store/vocab-run-store.ts` (zustand, ephemeral): `{ topicKey, mode: 'cards' | 'speed' | 'match' | null, answers: ... }` with `begin(topicKey, mode)`, `reset()`; it is also the **vocab `MinigameHost`** (§3.9). It persists nothing; persistence is F-VOC-005's actions on `progress-store`.

### 3.3 Topic picker (`screens/vocab/VocabTopicsScreen.tsx`, wireframe A)

- **Given** the picker opens, **then** it shows the title "Words", a one-line description, and a **2-column grid** of topic tiles (1 column at 320 dp, 2 at 360-767, 3 from 768, no horizontal scroll; `Screen scrollable`, `TAB_SCREEN_EDGES` is *not* used because this is a stack screen with a Back control top-left).
- **A tile** (`TopicTile`) is one pressable (>= `touchTarget.child`, 80) containing: the topic **cover picture** (`PictureArt` of the cover item), the English title, the Korean title (`KoreanText`: `titleKo` with romanization and the English title as its gloss), and a **collection meter**: a fill-only bar (`Progress variant="bar"`, no `label`, `max` = the topic's word count, `value` = `collected`) plus the plain text "N collected" (D3: a bar and a count, never "N of M", never a percent in text). A row of 12 dots (`variant="dots"`) is 12 x 12 + 11 x `spacing.sm` = 232 dp wide and does **not** fit a 2-column tile at 360 dp (about 150 dp), so dots are used only where the full width is available (the topic page header below, the chunk dots of the flashcards). `Progress` exposes `accessibilityValue { now, max }`, which screen readers announce as a ratio or percentage: the meter is wrapped in a view hidden from assistive technology (`accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`) and the tile's own accessible name carries the count ("Food. 5 words collected."). The tile border uses the topic tint (`colors.theme.*` / `colors.stage.stage2`) as a fill or border accent only, never as text colour (`tokens.ts:61-63`). Accessible name: "Food. 5 words collected." (topic title, then the count; the Korean title is part of the chip's own label).
- **Order** is the topic `order` (F-VOC-001 §3.3), fixed; it never re-sorts by progress.
- **Tap** → `VocabTopic { topicKey }` and `vocab.topic_opened` `{ topicKey, source: 'library' }`.
- **Locked tiles (gating off = never drawn)**: the tile asks `isContentLocked({ kind: 'vocab-topic', id: topicKey, tier, gatingEnabled })` (F-STORY-004 §3.9); with `contentGatingEnabled = false` (the launch default) it is `false` for every topic: no lock, no "Premium" pill (D5). If a later PR switches gating on, the tile shows F-STORY-004's locked treatment and the tap goes through `gateRequired`; this spec draws nothing for it.
- **Empty**: no visible topic (all `draft`, or art missing) -> a card "Words are on their way." with a Back button (never reachable while the flag is off in a shipped build, but reachable in a dev build with the flag on).
- **A "Mix" option is out of scope** (v1.1; the design input's multi-topic toggle).

### 3.4 Topic page (`screens/vocab/VocabTopicScreen.tsx`, wireframe B)

- **Header**: Back (top-left, the same place on every screen), the English title, the Korean title (`KoreanText`), and the collection meter and count (a row of dots at full width, hidden from assistive technology like the tile's meter; the count is plain text).
- **Word wall** (`WordWall`): all of the topic's words in file order as a grid (as many columns as fit a 120 dp tile, 1 to 4: 2 on most phones, 3 from a 408 dp window, 4 on tablets; amended in C-4, see §9; each tile >= `touchTarget.min`). A **collected** word shows its picture (`PictureArt` at 64-96), the Korean (`KoreanText` small, romanization per the setting, revealed by the page's Show sound in reading practice) with its gloss in the UI language (D2) and is **tappable**: it opens that word's flashcard (`VocabCards { topicKey, chunk: <the chunk that contains it> }` starting at that card, back face). A **new** word shows a **silhouette** (`mono` tone, F-VOC-002 §3.7) with the accessible name "Not collected yet" and no Korean (no spoilers); it is not tappable. The wall never shows empty "lock" icons, never counts what is left, and never re-sorts.
- **Three activities** (drawn **above** the word wall since C-4, §9), in this order, each a large button (>= `touchTarget.child`) with a one-line description; **the suggested one is the primary button** (`suggestActivity`), the others secondary (T7):
  - **Learn** -> `VocabCards { topicKey }`. Always available.
  - **Speed round** -> `VocabSpeedRound { topicKey }` (F-VOC-004). Available when at least **4 words are collected** (the minimum for 4 options; for 3-option levels, 3); otherwise the button is present but shows how many words are still to learn ("Learn 1 word first" with 3 of 4 collected; a positive next step, amended in C-4, §9) and navigates to Learn (never a dead end).
  - **Match** -> `VocabMatch { topicKey }` through the vocab host (§3.9). Shown only when F-QUEST-002's Pic-Word Match exists (`MinigameKindSchema` has `'pic-word-match'`, a boolean `capabilities.picWordMatch` from `logic/vocab/caps.ts`); drawn only once it is available, at >= 3 collected words (it has no "learn first" line of its own; C-4, §9).
- **`suggestActivity`**: `learn` when fewer than 4 words are collected or an uncollected chunk remains and no session happened today; `speed` when >= 4 words are collected and (all words are collected or the learner has done Learn today or a word is due, F-VOC-005 §3.6); `match` is never the default. The rule is a pure function of `(progress, now)` with a golden table in the test.
- **Hoya line** from `hoyaIntroEn` once per topic per learner per session (a `HoyaBubble`, tone `idle`; plain text, no age words).
- **Empty / error**: a topic whose `topicKey` is unknown -> "Topic not found" + Back. A progress read that failed or has not hydrated -> the meter shows no dots filled and the Learn button still works (progress writes wait for hydration like `progress-store.ts:127-135`).

### 3.5 Flashcards (`screens/vocab/VocabCardsScreen.tsx`, wireframes D, E, F)

**Chunking** (`flashcards.ts`):
- `chunkSize(levelOrder)`: `0 -> 4`, `1 -> 4`, `2 -> 6`, `null -> 4`.
- `chunksFor(items, size, fixedOrder)`: the order is the file order when `fixedOrder` (Colors, Numbers), otherwise ascending `level` with file order inside a level (F-VOC-001 §3.1); consecutive slices of `size`; a trailing slice of one word is merged into the previous chunk (so no chunk has fewer than 2 words unless the topic itself does).
- `suggestedChunk(chunks, progress)`: the first chunk with an uncollected word; if every word is collected, chunk 0 (review).

**State machine** (`flashReducer`, pure; the screen only dispatches):

```ts
type Face = 'front' | 'back';
interface FlashState {
  queue: string[];               // item ids, in the order they will be shown
  index: number;                 // position in the queue
  face: Face;
  requeued: ReadonlySet<string>; // ids already requeued once
  outcomes: Record<string, 'got-it' | 'again'>;   // last self-mark per id (this run)
  flipped: ReadonlySet<string>;  // ids whose back was shown -> collected
  heard: number;                 // speaker taps (telemetry)
  phase: 'cards' | 'check' | 'done';
}
type FlashEvent = 'flip' | 'got-it' | 'again' | 'hear' | 'check-done';
```

- `initFlash(chunk)` -> `{ queue: chunk ids, index: 0, face: 'front', ... , phase: 'cards' }`.
- `'flip'` toggles `face` and, on first showing a back, adds the id to `flipped` (**collected**, T2). A flip is ignored while `phase !== 'cards'`.
- `'got-it'` / `'again'` are accepted **only on the back** (the learner has seen the meaning, T3); they record the outcome, add the id to `flipped` if absent, and advance `index` with `face: 'front'`. `'again'` also appends the id to the end of `queue` **once** (guard by `requeued`), so a word can appear at most twice in a chunk.
- When `index` passes the end of `queue`, `phase` becomes `'check'`.
- `quickCheckItems(chunk, size)` returns the **2 words** for the quick check: the first two words of the chunk that were `'again'` (the ones the learner wanted another look at), padded with the earliest words of the chunk, never the same word twice, in the chunk order.

**Card front** (wireframe D): a single large card (`Card`, `tone="paper"`, tint accent border) containing, top to bottom: the **picture** (`PictureArt`, 160 dp or the largest that fits, `decorative`), the **Korean word** at display size via `KoreanText` (romanization line per `romanizationShown(mode, false)`), a **speaker button** (>= `touchTarget.child`, accessible name "Hear the word") and "Tap the card to see what it means". Progress: a **fill-only dots meter** of the chunk (dots for cards seen so far; a requeued card does not add a dot) with no "n / N".
**Card back** (wireframe E): the same card flipped: the **English gloss in the UI language** (`localizedGloss(item, locale)`, `Heading`), the **`senseNote`** when present (plain English), the picture again, the Korean (`KoreanText` again, so romanization can be revealed), and two buttons side by side, each >= `touchTarget.child`: **"Show me again"** (secondary) and **"Got it"** (primary). Both advance to the next card's front.

**Flip** (`components/FlipCard.tsx`, extracted from `CardDetailScreen.tsx:64-131`): props `{ face: 'front' | 'back'; onFlip(): void; front: ReactNode; back: ReactNode; disabled?: boolean; onFlippingChange?(flipping: boolean): void; accessibilityLabelFront: string; accessibilityLabelBack: string }`; the same two 200 ms legs and the same edge-on swap, taps ignored while flipping, an **instant swap under reduced motion** (`useReducedMotion`, `platform/motion.ts:7-25`); `CardDetailScreen` is changed to use it in the same PR with its tests (share gating uses `onFlippingChange`, F-CARD-003 §8). The pure part (`nextFace(face)`, "may flip") is in `logic/flip.ts`, unit-tested.

**Listen** (T6): on a new card front the word plays once through `playPrompt({ text: item.spokenKo ?? item.ko, audioRef: item.audioRef, kind: 'word', source: 'vocab-card' })` **except** when it is the first card of the session and `audio-store.unlocked` is false (F-AUDIO-004 §3.6: the tap that opened the screen normally unlocked it; the guard only matters for a deep link). The speaker button plays on every tap (no replay limit; F-QUEST-002's decision L5). On `'unavailable'` or `'muted'` the F-AUDIO-004 prompt-state shows **one calm line** under the card ("No sound? You can read it here.") and, for `muted`, a "Turn sound on" button (`audio-store.setMuted(false, 'fallback_panel')`); the Korean and its romanization are already visible, so nothing else changes. `audio.fallback_shown` is emitted by F-AUDIO-004's reducer.

**Romanization switch** (T5): a header switch "Reading practice" (>= `touchTarget.min`) bound to `romanizationMode` of the active profile (`locale-store.setRomanizationMode`, F-I18N-001 §3.2; telemetry `romanization.mode_changed` already exists). Off = `always` (visible, the default); on = `tap`: each card's romanization is hidden until the learner taps a "Show sound" chip under the Korean; the reveal lasts for that card and resets on the next; the gloss is never hidden (F-I18N-001 §3.5.3). Until F-I18N-001 PR 3 lands the profile settings store, this switch is not rendered and the constant `romanizationMode = 'always'` applies (the interim of F-QUEST-002 §3.12).

**Quick check** (wireframe F, after the last card of a chunk): two **word-to-picture** questions on `quickCheckItems(...)` using the shared question view and builder of F-VOC-004 (`buildQuestions` with `format: 'word-to-image'`, option count from the level, distractors from the **same topic**, F-VOC-004 §3.3). It is **untimed and un-numbered** ("Quick check", two fill-only dots). A wrong first tap makes that option amber with a non-colour mark and locks it; the learner may tap again until right (Listen & Pick semantics, F-QUEST-002 §3.10); the **first answer** per question is what is recorded (a right first try = `correct`, else `wrong`). On the right answer the word is spoken, its gloss shown, and the next question opens after 700 ms. When the audio capability is missing nothing changes (the question is word-to-picture, not audio). The check reports through the vocab host.

**Chunk summary** (wireframe F, after the quick check): Hoya `cheering`, the line "N new words collected" where N is the **number of words newly collected in this chunk** (a count, never a fraction, never a percentage), a `StarRow` is **not** shown (stars belong to the Speed round), and three buttons: **primary "Next words"** (the next chunk; "Review these" when every word is already collected), **"Speed round"** (when >= 4 words are collected), **"Back to topic"**. `vocab.cards.complete` is emitted here.

**Leaving mid-chunk** (Back or the system gesture): a small sheet "Keep going or stop for now?" — "Keep going" / "Stop". Words already flipped **stay collected** (their `introduced` events were written when they were first flipped, F-VOC-005 §3.3); nothing is lost and nothing is scored.

**Resume**: opening `VocabCards { topicKey }` always starts the suggested chunk; the run state is not persisted (a chunk is about a minute).

### 3.6 What is written (through F-VOC-005's single action)

`useProgressStore.recordVocab(profileId, events, now)` is called with events; this spec produces:

| When | Event |
|---|---|
| a word's back is first shown, or `got-it` / `again` is tapped | `{ type: 'introduced', id }` (idempotent; earliest day wins) |
| `got-it` | `{ type: 'self', id, known: true }` (seeds box 2 at most, F-VOC-005 §3.4) |
| `again` | `{ type: 'self', id, known: false }` (box 1, due tomorrow) |
| the quick check's first answer to a question | `{ type: 'answer', id, correct, format: 'word-to-image', source: 'cards' }` |
| the chunk summary shows | `{ type: 'session', topicKey, kind: 'cards' }` |

Events are written **as they happen** (not on exit), so a closed app loses nothing.

### 3.7 Telemetry (added to `TELEMETRY_EVENT_NAMES`, `packages/content-schema/src/schemas/telemetry.ts:9-50`, and to the consolidated table in `specs-out/TELEMETRY-NAMES-2.md` — the review adds its section G for the seven vocabulary names; names follow its convention)

| Name | Payload | When |
|---|---|---|
| `vocab.topic_opened` | `{ topicKey, source: 'library' \| 'home' \| 'plan' \| 'results' }` | a topic tile or a due-words card is opened |
| `vocab.cards.start` | `{ topicKey, chunk, chunks, words, level }` (`level` = `levelOrder`, never an age) | the first card of a chunk shows |
| `vocab.cards.complete` | `{ topicKey, chunk, words, gotIt, again, heard, newlyCollected, checkFirstTry, checkQuestions }` | the chunk summary shows |

The PR that adds the names ships and deploys first (Worker before app, `TELEMETRY-NAMES-2.md` rule 1) and updates the exact-list test (`packages/content-schema/src/__tests__/telemetry.test.ts:5-49`). No event carries a name or free text; `profileId` rides in the envelope. F-VOC-004 adds `vocab.round.start`, `vocab.round.complete`, `vocab.challenge_toggled`.

### 3.8 Accessibility, layout, offline, errors

- **Targets and type**: tiles, activity buttons, speaker, got-it / again >= `touchTarget.child` (80); the wall tiles and the header switch >= `touchTarget.min` (64); body text >= 18; tokens only; no emoji; art is SVG.
- **Screen readers**: a card announces "Korean: <word>, <romanization>, <gloss>" through `KoreanText`'s caller-supplied label (F-I18N-001 §3.5.1; `romanization` read as words via `a11yRomanization`, F-CNT-002); the picture is `decorative` on a card (the gloss is in the label); the flip is a button "Show meaning" / "Show word"; when a card changes, focus moves to the card; the "collected" counts are plain text in the label, never "n of m".
- **Reduced motion**: the flip is an instant swap; the chunk summary's Hoya pose change is instant.
- **Small and large screens**: works at 320 x 568, landscape phones and 200 % text; the card and the wall scroll (`Screen scrollable`), the two answer buttons stay reachable (sticky at the bottom); verified against F-LAYOUT-001 when it ships.
- **Offline**: everything is bundled; speech needs a local voice or a bundled clip; no voice = the text line of T6, never an error.
- **Errors and empties** (each has a way out): topic not found; no visible topics; progress not hydrated (works, meter empty); audio unavailable (calm line); the quick check cannot build 2 questions (fewer than 4 words in the topic with art: the check is **skipped** and the summary shows).
- **Tone (D1, D3)**: plain Pre-A1 English; no age words; no "wrong", no red, no timers, no percentages or fractions, no streak lines; Hoya warm and never babyish.

### 3.9 The vocab host (reuse of existing games)

`store/vocab-run-store.ts` implements F-QUEST-002 §3.12's `MinigameHost` with `mode: 'vocab'`: `answer(roundKey, correct, meta?)` buffers `{ id: meta.itemId, correct }` (first answer per key) and `complete()` flushes them to `progress-store.recordVocab` as `answer` events with `source: 'match'` and emits `{ type: 'session', kind: 'match' }`. F-QUEST-002's `PicWordMatchGame` is mounted by a thin `VocabMatchScreen` that builds a board from the topic's collected words (3-5 pairs, the `PicWordRoundSchema` shape) and passes `host={vocabHost}`. If F-QUEST-002 Q-3a/Q-3b have not landed, the Match button is not shown (T7).

### 3.10 Behaviours (Given / When / Then)

1. **Given** the flag off, **when** Library opens, **then** it renders exactly as before and no Words card exists.
2. **Given** the flag on and Food `ready` with all 12 pictures resolvable, **when** Library opens, **then** a Words card shows "0 collected" and opens the picker, which shows the Food tile.
3. **Given** Food has one picture that does not resolve, **then** Food is absent from the picker (T8) and no half-empty topic can be opened.
4. **Given** the Pictures-first level and a 12-word topic, **when** Learn starts, **then** the first chunk has 4 words; **given** Reads easily, 6.
5. **Given** a card front, **when** the learner taps the card, **then** it flips (instant under reduced motion), the word is recorded as collected, and the back shows the gloss in the UI language.
6. **Given** a card back, **when** "Show me again" is tapped, **then** the card reappears once at the end of the chunk and the learner is never shown a "wrong" state; **given** it was already requeued, a second "Show me again" advances without requeueing.
7. **Given** `romanizationMode = 'tap'`, **when** a card front shows, **then** the romanization is hidden behind "Show sound", the gloss on the back is visible, and the choice survives restarting the app.
8. **Given** no Korean voice, **when** a card front shows, **then** the Korean and romanization are visible, one calm line explains there is no sound, and the flow is unchanged.
9. **Given** the learner leaves after flipping 2 of 4 cards, **then** those 2 stay collected and the topic's meter still shows them next time.
10. **Given** a chunk finished with 3 words newly collected, **then** the summary says "3 new words collected" (a count) and no fraction or percentage appears anywhere on the screens.
11. **Given** a topic with fewer than 4 words that resolve, **then** the quick check is skipped and the chunk summary shows.
12. **Given** the same chunk is opened again after all its words are collected, **then** the primary button reads "Review these" and `newlyCollected` is 0 in telemetry.

## 4. Out of scope

- The Speed round, its question builder and results (F-VOC-004); progress, boxes, sync and the Home nudge (F-VOC-005).
- Multi-topic "Mix", custom word lists, teacher-assigned topics (`vocab-topic` plan item kind, F-PLAN-002).
- Search, a dictionary view, favourites.
- Recording a learner's voice (STT is out of scope for the product, F-RVW-001 §4).
- Stage 2 Journey integration (a vocabulary topic does not advance the Journey grid in v1; the design input's open question is answered **no**: topic play updates only per-word progress).
- Per-word example sentences (v1.1).
- A lock treatment (gating is off, D5).

## 5. Tests

| File | Level | Coverage focus |
|---|---|---|
| `logic/vocab/__tests__/topics.test.ts` | unit, 100 % | `visibleTopics` hides draft and unrenderable topics; `topicState` counts; no percent field exists |
| `logic/vocab/__tests__/flashcards.test.ts` | unit, 100 % | `chunkSize` per level incl. `null`; `chunksFor` with and without `fixedOrder`, the trailing-single merge, 12 and 24 words; `suggestedChunk`; `flashReducer` over every event incl. the requeue-once guard, flip ignored in `check`, got-it only on the back, `quickCheckItems` (again-words first, padded, distinct) |
| `logic/vocab/__tests__/suggest.test.ts` | unit, 100 % | golden table of `suggestActivity` |
| `logic/vocab/__tests__/wall.test.ts` | unit | stable order; collected vs new |
| `logic/vocab/__tests__/copy.test.ts` | unit | every string passes `scanLearnerCopy`, no `\d+%`, no `\d+/\d+`, no age word |
| `logic/__tests__/flip.test.ts` | unit | `nextFace`, may-flip guard |
| `store/__tests__/vocab-run-store.test.ts` | unit | the host buffers first answers per key, `complete` flushes `answer` + `session` events once, `reset` |
| `config/__tests__/flags.test.ts` (extended) | unit | `vocabTopicsEnabled` default `false`, env flip |
| `content-schema/src/__tests__/telemetry.test.ts` (extended) | unit | the exact list gains the three names |
| `e2e/web/vocab-cards.spec.ts` (Playwright, web PWA) | e2e | flag on: Library -> Words -> Food -> Learn -> flip 4 cards -> got it / show me again -> quick check -> summary shows "4 new words collected" and no `%` or `n/m`; the same flow in airplane mode; reduced motion; sound off keeps text; flag off: Library has no Words card |
| `e2e/web/layout.spec.ts` (extended, F-LAYOUT-001) | e2e | the picker and the card at 320 x 568 and landscape |

Component tests are not possible in the mobile vitest setup (node environment, no renderer, `apps/mobile/vitest.config.ts:21-27`), so every decision lives in the pure modules above and the screens are covered by the Playwright specs. Coverage targets (CLAUDE.md §6): `apps/mobile` business logic **90 % -> 100 %** (all of `logic/vocab/` is in the lane, `apps/mobile/vitest.config.ts:33`); platform-dependent code 70 %.

## 6. Rollout and PR breakdown (dependency order)

| # | PR | Size | Depends on |
|---|---|---|---|
| C-1 | `feat(content-schema)`: telemetry names (`vocab.topic_opened`, `vocab.cards.start`, `vocab.cards.complete`) + exact-list test; **ship and deploy the Worker first** | S | — |
| C-2 | `refactor(mobile)`: extract `components/FlipCard.tsx` + `logic/flip.ts` from `CardDetailScreen.tsx:64-131`, CardDetail uses it, tests | S | — |
| C-3 | `feat(mobile)`: `logic/vocab/{topics,flashcards,suggest,wall,copy}.ts` + tests; `config/flags.ts` flags `vocabTopicsEnabled` and the dev-only `vocabShowDrafts` (F-VOC-001 §3.7) with their `flags.test.ts` cases; `store/vocab-run-store.ts` | M | F-VOC-001 V-3, F-VOC-005 P-2a (`recordVocab`) |
| C-4 | `feat(mobile)`: routes, `VocabTopicsScreen`, `VocabTopicScreen`, `TopicTile`, `WordWall`, the Library Words card; wireframes promoted to `design/wireframes/vocab/` **and the screens' design mocks in `design/screens/vocab/` before the code** (CLAUDE.md §5); screens use `PictureArt`; the lock check calls F-STORY-004's `isContentLocked` when `content-access.ts` exists, else the constant `false` (gating is off, D5) | M | C-3, F-VOC-002 W-7, F-I18N-001 PR 4 (`KoreanText`) |
| C-5 | `feat(mobile)`: `VocabCardsScreen` (front, back, flip, listen with `playPrompt` fallback, reading-practice switch, quick check via F-VOC-004's `VocabQuestionView`, summary), design mock first, e2e (the e2e may follow as C-5b if the PR exceeds ~800 lines). FlipCard (design/components/FlipCard/spec.md): the card's labels carry the word (front) and the word with its meaning (back) and the new face is announced after a flip; the owner's iOS and Android flip pass from C-2 is recorded in this PR. `VocabCards` honours `route.params.ids` when it is given (only those words, in that order): F-VOC-004 S-5's results "Practice these" opens it with the words to see again once `VOCAB_SCREENS.learn` is on, and a C-5 test pins it. **Merges only after the F-VOC-005 P-1 Worker deploy** (it is the first screen PR that records events) | L | C-4, F-VOC-004 S-2 (`buildQuestions`) and S-4b (`VocabQuestionView`), F-AUDIO-004 PR A-3 (`playPrompt`) |
| C-6 | `feat(mobile)`: `VocabMatchScreen` (vocab host + F-QUEST-002 Pic-Word Match) | S | C-5, F-QUEST-002 Q-3b |
| C-7 | `chore(flags)`: flip `vocabTopicsEnabled` to `true` in the launch defaults once the four free-set topics (Food, Animals, Colors, Numbers) are `approved` and native-reviewed (F-VOC-001 V-7) and the F-VOC-005 deploy checklist is ticked; precondition: `VOCAB_SCREENS.learn` is on (C-5 merged), which `logic/vocab/__tests__/caps.test.ts` pins. **Owner decision 2026-10-13: turn vocabulary topics on.** Done in the C-7 PR: the launch default is `true` (`EXPO_PUBLIC_VOCAB_TOPICS_ENABLED=false` or `0` in a build still switches Words off); the four free-set topics are `ready` since the 2026-10-11 production review (F-VOC-001 V12) and all twelve since V-7; `VOCAB_SCREENS.learn` is on; the F-VOC-005 deploy checklist is verified from the repo where it can be and its production-only items stay owner steps (F-VOC-005 §6, *C-7 status 2026-10-13*) | S | all |

(`audio` dependencies degrade gracefully: until `playPrompt` exists, C-5 uses a thin interim `speak` wrapper that reports `'played'`, and the text line is always shown.) Rollback: set the flag to `false`; progress already written stays valid and unread.

Estimated effort: about 6-8 working days (screens and e2e dominate).

## 7. Dependencies

- **Upstream**: F-VOC-001 (accessors, `RuntimeVocabItem`), F-VOC-002 (`PictureArt`, `WordArt`), F-VOC-005 (`recordVocab`, progress selectors), F-VOC-004 (`buildQuestions` S-2 and the shared `VocabQuestionView` S-4b for the quick check), F-I18N-001 PR 4 (`KoreanText`) and PR 3 (settings store, for the switch), F-AUDIO-004 (`playPrompt`, `audio-store`, prompt-state), F-STORY-004 PR 4.2 (`content-access.ts`) for the lock check, F-QUEST-002 Q-3a/Q-3b (host and Pic-Word Match) for Match, F-MOTION-002 (flip timings).
- **Downstream**: F-VOC-004 (launched from the topic page), F-I18N-001 (every learner string of this spec moves from `VOCAB_COPY` into its dictionary when that exists: a mechanical PR with a per-locale banned-word test; until then English only, CLAUDE.md §8), F-VOC-005 (Home nudge opens `VocabTopic`), F-STORY-004 (replaces the Words card with the `theme-packs` section), F-PLAN-002 (`vocab-topic` plan items open `VocabTopic`), F-TCH-004.

## 8. Unverified assumptions and open items

1. **Library entry vs section tab** (resolved in C-4: the tabs had landed, so `theme-packs` is the **Words** tab with `TopicGrid` inline and the card was never built): T1 assumed F-STORY-004's `SectionTabs` will not have landed; if it has when C-4 starts, render `TopicGrid` inside the `theme-packs` section and skip the Words card.
2. **The reanimated flip extraction (C-2)** assumes `CardDetailScreen`'s share-gating (`isFlipping`) can be driven by `onFlippingChange` with no behaviour change; the existing F-MOTION-002 / F-CARD-003 behaviours are not covered by automated tests in the repo (the mobile vitest config cannot render), so C-2 needs a manual check on web and device.
3. **Chunk sizes (4 / 4 / 6)** and "collected on first flip" are product judgements from the design input (4 words suit working memory), not measured; the telemetry (`cards.complete`) lets them be tuned.
4. **A word-wall silhouette** for uncollected words assumes the silhouette (F-VOC-002 §3.7) is not itself a spoiler for easy pictures; if testing says it is, the wall can show a plain tile instead (a data-free change).
5. **`romanizationShown`, `locale-store.setRomanizationMode` and `KoreanText`** are specified by F-I18N-001 but not yet in the repo (`packages/i18n` does not exist at `ecf6365`); until they land the interim constants of §3.5 apply.
6. **`vocab.topic_opened` `source: 'plan'`** is reserved for F-PLAN-002 and unused at launch.
7. **No device test** of the audio-on-card-appear behaviour on iOS Safari was possible: the first-gesture rule (F-AUDIO-004 §3.6) is assumed to cover it.

## 9. Notes from C-4 (#414)

Deviations from §3 taken while building C-4, measured and recorded in `design/screens/vocab/topic.md` and `topics.md`; C-5, C-6, F-VOC-004 S-5 and their reviews read these as the acceptance text.

1. **Wall columns from the fit** (§3.4): the `sm` chip of a three-syllable word is about 109 dp and the romanization "geomeunsaek" about 104 dp at `bodySm`, so 3 columns at 320 dp and 4 at 360 would clip or break words. The wall shows as many 120 dp tiles as fit (1 to 4; the minimum grows with the font scale up to 2x).
2. **Activities above the wall** (§3.4): twelve tiles are three to four rows, so under the wall every activity would start below the fold on a phone.
3. **Match hidden until 3 words are collected** (§3.4): a drawn but unavailable Match would be a dead end.
4. **Speed round line counts the words still to learn** ("Learn 1 word first"), not the threshold (§3.4): it names the next positive step. The "never counts what is left" rule is the word wall's (no remaining count on the wall, the tiles or the meter).
5. **Collected wall tiles print the gloss** in the UI language under the romanization (D2, CLAUDE.md §8), and the page's **Show sound** reveals the wall's romanization too in reading practice.
6. **Hoya's line is once per topic per learner** per app session (a shared device with several profiles).
7. **The topic page checks the lock itself** (`topicPageAccess` with `isContentLocked`), so every entry point (P-3's Home card, BR-9, F-PLAN-002) is held to the same gate as the grid; a locked tile (gating on only) is drawn closed with "Not open yet" and a dotted border, never a lock glyph (F-ENT-003 OD-6).
8. **`VocabCards.startId`** (§3.1): a collected wall tile opens its chunk at that word, back face.
9. **Words tab, not the card** (§3.1, §8 item 1): the Library tab label "Theme packs" became **Words**; the card's two strings were dropped.
