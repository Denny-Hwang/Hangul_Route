Status: ready

# F-STORY-004 — Story shelf: Library sections, the Home story card, continue where you left off, Culture notes

> **Start order (review 2, 2026-10-10)**: the blocker of review 1 is gone: the story model (F-STORY-001: `Story`, `review`, `facts[]`, `cultureNotes[]`, `shelf`, `Episode.format/placement`) and the reader route (F-STORY-002: `StoryReader { storyId, level, mode, sceneIndex? }`) are specs now and every name below was checked against them. **Startable now**: PR 4.2 (`content-access.ts`, the two flags, `isStageEntitled` delegation with its golden test); PR 4.1 (grid-only selectors) needs only the `Episode.placement` field (F-STORY-001 PR 1.1b); 4.3a needs F-STORY-001 PR 1.1b; 4.3b-4.8 follow the order in §6.

**Scope**: `apps/mobile` (`logic/story/`, `logic/content-access.ts`, `logic/homework/mission-builder.ts`, `store/story-store.ts`, `store/bootstrap.ts`, `screens/library/`, `screens/home/`, `screens/episode/`, `screens/story/`, `screens/quest/`, `navigation/`, `config/flags.ts`, `content/episodes.ts`) · `packages/design-system` (`SectionTabs`) · `packages/content-schema` (shelf metadata, telemetry names)
**Owner**: solo dev
**Rollout**: Story mode phases 1-2, after F-STORY-001 and F-STORY-002; ships dark until the first reviewed story exists (§6)
**Wireframes**: `design/wireframes/library/stories.md` · `library/culture.md` · `story/culture-notes.md` · `home/story-time-card.md` · `episode/detail-story.md` — drafted in one file, `wireframes/story-shelf-home-library.md` (added by the 2026-10-10 review; the original draft named a file that did not exist), promoted by PR 4.0

Parent / siblings: F-STORY-001 (schema, content pipeline) · F-STORY-002 (reader, `StoryScene`) · F-STORY-003 (checks, Story Order, Results) · F-STORY-005 (grid volumes) · F-STORY-006 (episode-completion cards) · F-HW-001 §3.1-3.3, §9.2 (Today's mission) · F-ENT-001 / F-SUB-001 (entitlements) · F-VOC-00x (Theme packs) · blueprint 02 §3 (Library) · audit UX-12, UX-13, UX-19

---

## 1. Context

Blueprint 02 §3.2 draws the Library as a place with categories — Theme Packs, **Story Time**, Song Corner, **Culture** — plus a "this week's picks" row, and §3.4 says its content is unlocked from day one. The shipped Library is a single screen: the heritage-card gallery (`apps/mobile/src/screens/library/LibraryScreen.tsx:27-85`). There are no stories to browse, nothing to resume, and the Home "Story time" card is not a story.

What exists today (verified on `main`, HEAD `c939348` — PRs #94-#102 merged; first written at `c89a903`, every line below re-read at review 2):

- **Home card.** `storyCard` labels *any* playable episode "Story time" (`logic/homework/mission-builder.ts:138-147`); `fallbackCard` returns the first playable episode that is not already used (`:167-171`), so a new learner's first card reads "Meet the Letters · Story time" (audit UX-19). Home opens it as an `EpisodeDetail` (`screens/home/HomeScreen.tsx:138-143`).
- **No bookmark.** `QuestPlayer` always starts at step 0 (`screens/quest/QuestPlayerScreen.tsx:41-47`, `store/quest-run-store.ts:26, 53` — `beginQuest` takes `(questId, episodeId)` only); nothing remembers a scene.
- **Episode page** is a generic quest list and text-only reward cards (`screens/episode/EpisodeDetailScreen.tsx:105-188`); its preview copy says "Finish Stage 1 to help Hoya unlock this episode." (`:100`).
- **Grid selectors assume every episode is a grid cell**: `episodeFor` (`content/episodes.ts:212-214`), `stageAvailability(stage.key, episodesAll)` (`screens/journey/JourneyScreen.tsx:63`), the Journey cursor `nextQuest`/`playableEpisodes` (`mission-builder.ts:100-119`), Home's quest count `questsAll.length` (`HomeScreen.tsx:103`) and `firstQuestFor` (sorts shipped episodes by `order`, `logic/onboarding/first-quest.ts:21-23`). Shelf episodes would leak into all of them.
- **Gating.** Only `stage1` is free (`logic/entitlement.ts:16, 31-33`); Journey shows "Premium" on stages whose cells are in fact playable (audit UX-12). Payments are not live (Stripe Live on hold), so D5 forbids gating new content now.
- **Library copy is wrong**: "Legendary cards appear when you complete a whole stage." (`LibraryScreen.tsx:78-80`) — no code awards them (F-STORY-006 fixes the award; this spec does not touch the Cards section).

Terms. **Story**: one JSON file (F-STORY-001). **Shelf story**: a story played from a *shelf episode* — a one-quest episode with `placement: 'shelf'`, outside the 7×5 grid. **Book**: a grid episode that holds several stories (Stage 5, F-STORY-005). **Sampler**: the shelf stories that are free once gating is switched on (D5). **Bookmark**: the scene a learner reached in an unfinished story. **Culture note**: a short sourced "did you know" attached to a story.

## 2. User story

> As a learner at any level I want the Story time card on Today to open the story I was in the middle of — or the next one that is right for me — and I want a shelf in the Library where I can pick any story and find the culture facts I have collected, without anything telling me I'm behind.

Companion stories:

- As a **grown-up or teacher** I want no "Premium" label on anything that is not actually locked, and I want the free sampler defined in one place so it can be switched on later.
- As a **content owner** I want only language-reviewed and culture-reviewed stories to reach the shelf in a production build.

## 3. Acceptance criteria

### 3.1 Data

**Shelf metadata** — `StoryShelfSchema` and the optional `shelf` field are **defined in F-STORY-001 §3.2.1** (PR 1.1b; one owner, one definition: `{ category: 'story-time' | 'culture', order: 1..999, sampler: boolean = false, minutes: 2..10 }`, strict). This spec owns the product rules around it:

- `category`: the Library section; `order`: position inside the category and the order "next story" walks; `sampler`: member of the intended free set (D5), read only through `isFreeContent`; `minutes`: shown on the tile and equal to the story's `minutes` (F-STORY-001 lint `shelf-minutes-mismatch`). `shelf` is present iff the story has a shelf episode.

Authoring guidance: `story-time` = tales told as a story (folk tales, myths, fables, Hoya's day, festival-day stories); `culture` = stories whose point is a tradition, place, person or invention. The heritage research set (D14: the four `*.final.json` files, counted at review 2: ten tales have `recommended_stage` 1 — five `letters`, two `rites`, one each `crafts`, `life`, `nature`) is mostly `culture`; it contains only **one** stage-1 folk tale (`story-sun-and-moon`). All six sampler ids of §3.9 exist in it with `minutes` ≤ 5. The full 24-row placement (category, order, sampler per story) is F-STORY-005 §3.3.

**Shelf episode conventions** (fields come from F-STORY-001; these are the values this spec relies on, enforced by integrity tests): `id: 'episode:shelf-<slug>'`, `format: 'story'`, `placement: 'shelf'`, `stage: 'stage1'`, `theme` = the story's theme, `order: 100 + shelf.order` (so even an unfiltered `firstQuestFor` can never pick a shelf episode), `questIds: ['quest:story-<slug>-listen']` (exactly one), `rewardCardIds: [<card>]`, `status` `ready` or `shipped`. The quest is a story quest (F-STORY-003 skeleton) whose `story-read` ref is `minigame:story-read-listen-<slug>`.

**Story index** — `logic/story/story-index.ts` builds, once at module load and memoised, one entry per *story quest*:

```ts
export interface StoryIndexEntry {
  storyId: string;                 // 'story:seollal-new-year'
  story: Story;
  questId: string;
  episodeId: string;
  level: StoryLevel;               // from the quest's story-read ref (F-STORY-003 storyIdOfQuest / levelOfQuest)
  placement: 'shelf' | 'grid';
  category: 'story-time' | 'culture' | null;   // shelf only
  order: number;                   // shelf.order, or the episode order for grid entries
  minutes: number;
  theme: ThemeKey;
}
```

`StoryIndexEntry` is **defined here and nowhere else** (F-STORY-005 reads `entry.story.recommendedStage` and adds one function, `entriesForCell`, to this file's module; F-STORY-006 reads `episodeId`). `buildStoryIndex({ stories, episodes, quests, showUnreviewed })` skips: stories without a quest; quests whose episode is `draft`/`preview`; and, unless `showUnreviewed` (flag `showUnreviewedStories`, §3.9), stories whose `review.language !== 'native-reviewed'` or `review.culture !== 'culture-reviewed'` (F-STORY-001 review fields; D14). A story can have several entries (Listen shelf quest + Read grid quest); the shelf shows the shelf entry, Culture notes use the story.

**Bookmark** — device-local, per profile (`logic/story/bookmarks.ts`):

```ts
export const BookmarkSchema = z.object({
  level: z.enum(['listen', 'read-along', 'read']),
  sceneIndex: z.number().int().min(0).max(40),
  updatedAt: z.string(),                       // ISO
});
export const BookmarkFileSchema = z.object({
  v: z.literal(1),
  byStory: z.record(z.string(), BookmarkSchema),   // key = storyId
});
```

Storage key `story:bookmarks:<profileId>` through `platform/storage` `readJson`/`writeJson` (`platform/storage.ts:10-21`, IndexedDB on web `storage.web.ts:11-22`; the `hr:` prefix is added there). A read that fails to parse, or has another `v`, is treated as empty — never thrown. At most **20** bookmarks are kept (oldest `updatedAt` dropped). A bookmark is written only when `sceneIndex ≥ 1`, and it is **not** part of backup files, rescue-code restore or sync (§3.13).

**Culture notes** — data is the story's `cultureNotes[]` (F-STORY-001): `{ id, titleEn, bodyEn ≤ 220, term: KoText, cardId?, factIds }`. `factIds` (≥ 1, resolving into `story.facts[]`, each fact having ≥ 1 `sources[]` entry) replaces the design draft's `factCheck` flag: a note without a sourced fact fails CI (D14). **Unlock rule (derived, nothing stored)**: a note is *found* when any quest of its story has a `completedAt` in the learner's `ProgressSnapshot.quests` — so it follows the learner across devices through normal sync.

**Free-content registry** — `logic/content-access.ts` (new, §3.9).

**Flags** — `config/flags.ts` (`Flags` interface `:24-51`, `launchDefaults` `:53-58`, `flags` `:60-65`, `launchDefaultFlags` `:67`, plus the existing `config/__tests__/flags.test.ts`) gains `contentGatingEnabled` (default `false`, env `EXPO_PUBLIC_CONTENT_GATING_ENABLED`) and `showUnreviewedStories` (default `false`, env `EXPO_PUBLIC_SHOW_UNREVIEWED_STORIES`; set to `true` in design-preview and dev builds only).

### 3.2 Pure logic (`apps/mobile/src/logic/`, 100 % covered)

| File | Exports | Behavior |
|---|---|---|
| `content-access.ts` | `ContentKind`, `FreeContentRegistry`, `isFreeContent(kind, id, registry?)`, `isContentLocked({ kind, id, tier, gatingEnabled, registry? })`, `FREE_STAGE_KEYS`, `FREE_VOCAB_TOPIC_IDS` | §3.9 |
| `story/story-index.ts` | `buildStoryIndex`, `shelfEntries(index, category)`, `entryForQuest`, `entryForStory` | §3.1 |
| `story/story-status.ts` | `storyStatus(entry, snapshot, bookmarks)` → `{ state: 'new' \| 'in-progress' \| 'finished', stars: 0-3, bookmark? }` | finished = the entry's quest has `completedAt`; in-progress = a bookmark with the same level and not finished; else new |
| `story/story-pick.ts` | `pickStoryForHome(input)`, `pickedForYou(input)`, `nextStoryAfter(questId, input)` | §3.7, F-STORY-003 §3.7 |
| `story/bookmarks.ts` | `BookmarkFileSchema`, `emptyBookmarks`, `setBookmark`, `clearBookmark`, `pruneBookmarks`, `resumeStepIndex(quest, bookmark)`, `clampScene(bookmark, sceneCount)` | pure reducers over a `BookmarkFile`; `resumeStepIndex` returns the index of the quest's `story-read` step, else 0 |
| `story/open-story.ts` | `planOpenStory({ entry, status, source, mode })` → `{ route, params, event }` | one place that decides `QuestPlayer` vs `StoryReader`, `resume`, and the `story.opened` payload |
| `story/culture-notes.ts` | `foundNotes(index, stories, snapshot)`, `notesForStory`, `groupNotesByTheme` | §3.5; groups follow `themes` order (`content/stages.ts:66-97`) |
| `story/library-sections.ts` | `LibrarySectionId`, `LIBRARY_SECTIONS`, `visibleSections(ctx)` | §3.3 |
| `story/shelf-copy.ts` | `STORY_SHELF_COPY` (`as const`, function messages) | all UI strings of this spec; a unit test runs `scanLearnerCopy` (`logic/homework/banned-text.ts:30-37`) over every value |

`store/story-store.ts` (zustand, CLAUDE.md §4): `byProfile: Record<string, BookmarkFile>`, `hydratedFor`, actions `hydrate(profileId)`, `setBookmark(profileId, storyId, { level, sceneIndex })`, `clearBookmark(profileId, storyId)`. Persists with `writeJson`; hydrated for every profile in `hydrateLearnerData()` (`store/bootstrap.ts:10-15`) so Home never renders before bookmarks are in memory. Writes before hydration stay in memory and merge on load (same discipline as `progress-store.ts:121-135`).

### 3.3 Library sections

`MainTabParamList.Library` becomes `{ section?: LibrarySectionId } | undefined` (`navigation/types.ts:45-49`). `LibrarySectionId = 'cards' | 'story-time' | 'culture' | 'theme-packs'`.

`LIBRARY_SECTIONS` is a registry `{ id, titleEn, isAvailable(ctx) }`:

| Section | Title | Available when |
|---|---|---|
| `cards` | Cards | always |
| `story-time` | Story Time | at least one playable shelf story with `category: 'story-time'` |
| `culture` | Culture | at least one playable `culture` shelf story, or at least one culture note in the bundle |
| `theme-packs` | Theme packs | F-VOC-003 registers the section together with its own flag (no `vocabTopicsEnabled` flag exists on `main`, `config/flags.ts:24-51`); until then `isAvailable` returns `false`. This spec reserves the slot and renders nothing for it |

- **Given** only `cards` is available (no stories bundled, or none reviewed), **when** Library opens, **then** the screen is exactly today's gallery with no tab row.
- **Given** two or more sections are available, **then** a `SectionTabs` row sits under the title "Library"; the selected tab is `route.params.section ?? 'cards'`; switching is local state (not persisted, no navigation); the Cards section is today's header (count pill), theme filter chips, grid and explainer, unchanged.
- **Deep links**: other screens open a section with `navigation.navigate('Main', { screen: 'Library', params: { section: 'story-time' } })`.

`SectionTabs` — new design-system component `packages/design-system/src/components/SectionTabs/{SectionTabs.tsx,style.ts,types.ts,index.ts}`: props `{ items: readonly { id: T; label: string }[]; value: T; onChange(id: T): void; accessibilityLabel: string; testID? }`; a wrapping row of pill chips, each `accessibilityRole="tab"` with `accessibilityState={{ selected }}` inside a `tablist`, **min height `touchTarget.min` (64)**, tokens only (the existing theme filter chips are ~36 dp, audit UX-25, and are not reused). `sectionTabStyle(selected)` is a pure function with a unit test.

### 3.4 Story Time section (and the story tiles of Culture)

- **Given** the Story Time section is selected, **then** it shows, top to bottom: a **Picked for you** hero tile (the `pickedForYou` story with its one primary button — **Start**, **Keep reading** or **Read it again**), then the grid of `shelf` tiles of that category in `shelf.order`. Order never changes with progress ("a stable position is the learner's memory anchor", `design/wireframes/library/gallery.md`).
- **`StoryTile`** (`screens/library/StoryTile.tsx`): cover (the `coverSceneId` scene through F-STORY-002's `StoryScene`, 4:3; if absent, a `colors.theme[theme]` tint with the Korean title), English title, Korean title + romanization (always together, drawn with `KoreanText`, F-I18N-001 §3.5), "about N min", and a state line: **New**, **Keep reading** (bookmark), or **Finished** with a `StarRow` when stars ≥ 1 (no empty stars for a 0-star finish). The whole tile is one button (≥ 64 dp) with the label "`<title>. <state>. About N minutes.`". Tap → `EpisodeDetail { episodeId }` (story variant, §3.6).
- Columns: 1 at 320 dp, 2 at 360-767 dp, 3-4 from 768 dp; no horizontal scroll.
- **Locked** (only when `contentGatingEnabled`, tier free and the story is not in the sampler): the tile shows the lock icon and "Locked"; tap → the same grown-up gate Journey uses for locked stages (`PinEntry { next: 'Paywall' }`, `JourneyScreen.tsx:68-71`) — routed through the gate helper of F-LEARN-001 §3.3 (`gateRequired`), so a self-only device with no PIN opens the paywall directly. With the flag off no tile is ever locked and **no "Premium" pill is shown anywhere in this feature** (D5).
- **Empty** (the category has no playable story): the tab is not offered (§3.3). **Error** (a story or its cover fails to resolve): the tile degrades to the tint + title; one broken story never blanks the shelf.
- `story.shelf.viewed` fires once per visit to a story section.

### 3.5 Culture section and the Culture notes screen

**Culture section** (`screens/library/CultureSection.tsx`): a **Culture notes** card on top — "N found" (a count, never a fraction), the titles of the two newest notes, tap → `CultureNotes` — then the `culture` story tiles exactly as in §3.4.

**Culture notes screen** — new route `CultureNotes: { storyId?: string; noteId?: string } | undefined` in `navigation/types.ts` and `navigation/root.tsx`; component `screens/story/CultureNotesScreen.tsx`.

- **Given** the learner has found notes, **when** the screen opens, **then** notes are grouped under the five theme headings (Letters & Books, Food & Daily Life, Holidays & Traditions, Nature & Animals, Play & Crafts; accent `colors.theme[theme]`), in story order. A note card shows: the title, the body (≤ 220 chars), the `term` as `KoreanText` (Korean + romanization + gloss) with a speaker (`audioRef` else TTS), the story it came from (tap → `EpisodeDetail`), the card art when `cardId` has art (`supportedCardIds`, `HeritageCardArt.tsx:21-56`), and a collapsed **For grown-ups: where this comes from** row. Expanded, it lists each source of the note's facts as plain text — `title`, `publisher` — de-duplicated. **No links**: the learner surface never leaves the app.
- With `storyId`, only that story's notes show; with `noteId`, that note is scrolled into view and expanded, and `culture.note.viewed` fires.
- **Not found yet**: notes the learner has not found are not listed and not counted; there are no locked placeholders (nothing to spoil, nothing to chase).
- **Empty** (no notes found): one card — a short line about finding notes by finishing a story — and a primary button to the Story Time section. **Error** (a note's story or fact does not resolve): that note is skipped; the rest render.
- The bundled `facts[].sources[]` hold Korean publisher names outside a `ko` field; the extended validator exempts `sources[]` as bibliographic data (F-STORY-001 / F-CNT-002). This screen prints them as given.
- Heading levels and a list structure make it navigable by screen reader; Korean text nodes carry `lang="ko"` / `accessibilityLanguage="ko-KR"`.

### 3.6 Story episode detail — `EpisodeDetailScreen` changes

`EpisodeDetailScreen` (`:29-194`) renders `StoryEpisodeDetail` (`screens/episode/StoryEpisodeDetail.tsx`) when `episode.format === 'story'` and `status !== 'preview'`; everything else, including the preview card, is unchanged. The story variant serves a shelf episode (one story) and a book episode (several stories, F-STORY-005) with one component.

- **Header.** Back button top-left (as today), then pills: category (**Story Time** / **Culture**) for a shelf episode or the stage title for a book, the theme, and "N min". A shelf episode never shows the "Hangul" stage pill.
- **Title block.** English title (display), Korean title + romanization beneath, then the Hoya intro bubble (`hoyaIntroEn`). One Hoya on the screen.
- **Tale rows.** One row per quest: a cover thumbnail, English + Korean title, a state line, and actions:
  - *new*: **Start** → `QuestPlayer { questId, episodeId }`;
  - *in progress*: **Keep reading** → `QuestPlayer { …, resume: true }`, plus a ghost **Start over** (clears the bookmark first);
  - *finished*: **Play again** (secondary tone, scored — as the existing quest rows, `EpisodeDetailScreen.tsx:135-146`) and a ghost **Read it again** → `StoryReader { storyId, level, mode: 'replay' }` (unscored, writes nothing).
  Only one button on the screen is large: the first *new* or *in-progress* row; everything else is secondary or ghost (the wireframe rule for `episode/detail`).
- **Words in this story** (single-story pages): the keyword chips (`recapWords`, F-STORY-003) with a speaker each.
- **Culture notes** line: "N found" → `CultureNotes { storyId }`; shown only when N ≥ 1.
- **Reward cards.** For each `rewardCardIds`: earned → `HeritageCardArt` (96) with title, Korean and romanization, tap → `CardDetail`; not earned → a silhouette with the rarity border and no title (no spoilers, `design/wireframes/episode/detail.md`).
- **States**: *error* (episode id unknown) keeps today's "Episode not found." line but adds a Back button; *progress unreadable* renders rows as *new*; *stories missing from the bundle* renders the existing quest list.

### 3.7 Home "Story time" card

Changes in `logic/homework/mission-builder.ts` (pure) and `HomeScreen.tsx`.

- `MissionCardKind` gains `'explore'`; `'story'` now means a **real story**. `MissionCard` gains `storyId?: string`, `storyReason?: 'continue' | 'next' | 'again'`, `storyMode?: 'play' | 'replay'`. `BuildMissionInput` gains optional `stories?: { entries: readonly StoryIndexEntry[]; bookmarks: BookmarkFile; isLocked(storyId): boolean }` (absent → no story cards, so existing tests keep their inputs).
- The old episode fallback (`mission-builder.ts:169-172`) becomes the **`explore`** card — title = the episode title, subtitle "Take a look", icon `journey` — and is offered only after stories: that is the fix for the mislabel (UX-19). `ICON_FOR` (`HomeScreen.tsx:42-47`) gets the `explore` entry.
- **Preference chain** (amends F-HW-001 §3.1 and §9.2, edited in the same PR):

  | Slot | Order |
  |---|---|
  | ① | `continue` story → best replay quest → `next` story → `again` story → `explore` |
  | ② | unchanged: the Journey cursor, **grid episodes only** (§3.10), or an assigned quest (F-PLAN-001) |
  | ③, no daily test | `next` story → best remaining replay → `again` story → `explore` |
  | ③, daily test available | the daily test (unchanged) |

  Why: replay candidates exist almost every day for an active learner (`replayCandidates`, `mission-builder.ts:86-98`), so with the old chain a story would never surface; an unfinished story is a stronger signal than a replay, so it takes ① first. Day one therefore shows two *different* stories and the first quest.
- **`pickStoryForHome`** (pure): candidates = index entries not excluded (`excludeStoryIds`, `excludeQuestIds` — e.g. the quest card ② uses) and not locked. 1) `continue`: a bookmark exists, the quest is not completed, levels match; most recent `updatedAt`, ties by `order`. 2) `next`: the first unfinished **shelf** entry by (`category` order `story-time`, `culture`; then `order`); once every shelf story is finished, the first unfinished **grid** story quest by episode order. 3) `again`: the finished story with the oldest `completedAt`, `storyMode: 'replay'`. Returns `null` when nothing applies.
- **Copy** (draft; final in the design step): title = the story's English title; subtitle — `continue` "Keep reading", `next` "A short story", `again` "Read it again". A story card shows a 48 dp cover thumbnail instead of the icon when the story has cover art.
- **Behavior.** Given a story card, **when** tapped: `continue`/`next` → `QuestPlayer { questId, episodeId, resume }` (`resume` only for `continue`); `again` → `StoryReader { storyId, level, mode: 'replay' }`. A `next`/`continue` card flips to the collected look when its quest completes **today** (the existing `completedToday`, `mission-builder.ts:121-124`); an `again` card is never collected and never scored.
- **Pinned all day** (F-HW-001 §3.2): the target story does not change after the plan is built; the reason line may refresh from the bookmark (a `next` card becomes "Keep reading" after the learner leaves mid-story).
- `home.story_card.shown` fires once per profile per day when a plan with a story card is first pinned.

### 3.8 Continue where you left off

- **Writing.** The reader (F-STORY-002) calls `useStoryStore.getState().setBookmark(profileId, storyId, { level, sceneIndex })` on every scene change (it writes only from scene 1 on) and reads `getBookmark` on mount to choose its first scene. This spec supplies both; F-STORY-002's wiring is PR 4.4b.
- **Clearing.** `ResultsScreen`, right after the single `recordQuestComplete` write (`ResultsScreen.tsx:59-86`, inside the `recordedRef` guard that PR #94 added), calls `clearBookmark(profile.id, storyId)` for a story quest. A bookmark whose quest is finished (for example on another device) is ignored by `storyStatus` and pruned on the next write.
- **Resuming.** `QuestPlayer` accepts `resume?: boolean` (additive route param, `navigation/types.ts:7`). With `resume` and a valid bookmark it begins at `resumeStepIndex(quest, bookmark)` — the `story-read` step, skipping the intro — by passing the index to `beginQuest(questId, episodeId, startStepIndex = 0)` (additive third parameter: the `Actions` signature at `quest-run-store.ts:26` and its implementation at `:53`). The reader then opens at `clampScene(bookmark, sceneCount)`. A bookmark that is missing, has a different `level`, or is unreadable falls back to step 0 / scene 0 silently.
- **Granularity (decision).** Scene-level, reading phase only. If the learner left during the check or the order step, the bookmark points at the last scene, so resuming takes one tap on Next to reach the questions; the short check and order steps are replayed rather than stored. The scored rounds of a run that is left are never saved (the existing leave sheet says so, `QuestPlayerScreen.tsx:78-88`).
- **Start over** (episode page) clears the bookmark, then opens the story at scene 0.
- `story.bookmark.resumed` fires when the reader opens on a restored scene.

### 3.9 Content access (D5)

New `apps/mobile/src/logic/content-access.ts`; if a F-VOC PR already added it, reuse and extend that file.

```ts
export type ContentKind = 'stage' | 'story' | 'vocab-topic';
export interface FreeContentRegistry {
  stages: ReadonlySet<string>;          // FREE_STAGE_KEYS = ['stage1']
  vocabTopics: ReadonlySet<string>;     // FREE_VOCAB_TOPIC_IDS = ['food', 'animals', 'colors', 'numbers']  (ids follow F-VOC-001)
  samplerStories: ReadonlySet<string>;  // every story whose shelf.sampler === true, built from the bundle
}
export function isFreeContent(kind: ContentKind, id: string, registry = defaultRegistry()): boolean;
export function isContentLocked(i: { kind: 'story' | 'vocab-topic'; id: string; tier: Tier; gatingEnabled: boolean; registry?: FreeContentRegistry }): boolean;
//   locked = gatingEnabled && tier === 'free' && !isFreeContent(kind, id)
```

- `isStageEntitled` (`logic/entitlement.ts:31-33`) becomes `tier === 'premium' || isFreeContent('stage', stageKey)`; behavior is identical for every stage × tier (golden test) — Stage gating stays exactly as it is today and is **not** behind the flag.
- With `contentGatingEnabled = false` (the launch default) `isContentLocked` is `false` for every story and topic: nothing is locked, no lock icon and no "Premium" pill is drawn. The intended free set — **Stage 1, vocab topics Food / Animals / Colors / Numbers, and the story sampler** — is data in this file and in the stories' `shelf.sampler`, ready to switch on.
- **Initial sampler** (a content decision recorded in each story's `shelf.sampler`; the code reads only the flag): six stories of `recommended_stage` 1 and ≤ 5 minutes — `seollal-new-year`, `hangeul-day`, `chuseok-ganggangsullae`, `sun-and-moon`, `sejong-new-letters`, `cheugugi-rain-gauge`. If the owner wants at least two Story Time tales in the sampler, the second must come from the story-mode design input's Wave A (호랑이와 곶감), because the research set has one stage-1 folk tale.
- Home never picks a locked story and `nextStoryAfter` skips them. The sampler membership is also what a future paywall copy ("6 free stories") will read.

### 3.10 Grid-only selectors (no regression for existing content)

`content/episodes.ts` gains `isGridEpisode(e)` (`e.placement !== 'shelf'`; an absent field is grid), `gridEpisodes(list)` and `shelfEpisodes(list)`; if F-STORY-005 landed first, reuse its helper. Applied at every grid consumer:

| Site | Change |
|---|---|
| `content/episodes.ts:212-214` `episodeFor` | ignores shelf episodes |
| `screens/journey/JourneyScreen.tsx:63` | `stageAvailability(stage.key, gridEpisodes(episodesAll))` |
| `logic/homework/mission-builder.ts:100-119` | `playableEpisodes` for the Journey cursor and the `explore` fallback = grid only |
| `screens/home/HomeScreen.tsx:103` | quest total = quests of grid episodes (the number stays 11 for today's content) |
| `logic/onboarding/first-quest.ts:21-23` | `firstQuestFor` filters to grid episodes |

`gating.ts`, `plan-derivation.ts`, the quest titles lookups and `ProgressSnapshot` are id-based and need no change; `canAssignQuest` treats a shelf quest as a Stage 1 quest (`gating.ts:35, 50`), so a plan could contain one once the catalog allows it (out of scope).

### 3.11 Telemetry

Append to the `TELEMETRY_EVENT_NAMES` array (`packages/content-schema/src/schemas/telemetry.ts`, lines 9-43 at `c939348`) and to the expected list in `packages/content-schema/src/__tests__/telemetry.test.ts` (lines 5-43; the Worker whitelist is the same list). **Worker first, app second** — an unknown name gets 422 and the client drops it (`platform/telemetry.ts:40-58`). Payloads carry ids and counts only.

| Event | Fired | Payload |
|---|---|---|
| `story.shelf.viewed` | a story section becomes visible (once per visit) | `{ section: 'story-time' \| 'culture', stories, started, finished }` |
| `story.opened` | a story is launched from any surface | `{ storyId, source: 'home' \| 'library' \| 'episode' \| 'results', mode: 'start' \| 'continue' \| 'restart' \| 'play-again' \| 'read-again' }` |
| `home.story_card.shown` | first time a plan with a story card is pinned that day | `{ storyId, reason: 'continue' \| 'next' \| 'again' }` |
| `story.bookmark.resumed` | the reader opens on a restored scene | `{ storyId, sceneIndex }` |
| `culture.note.viewed` | a note is expanded or deep-linked | `{ noteId, storyId }` |
| `story.locked.tapped` | a locked tile is tapped (gating on only) | `{ storyId }` |

`planOpenStory` builds the `story.opened` payload so every surface reports it the same way. Existing `quest.complete`, `card.unlocked`, `minigame.finished` are unchanged.

### 3.12 Accessibility, locale, offline, privacy

- Every tile, tab and button ≥ 64 dp; tabs use `tablist`/`tab` with selected state; tile labels carry title + state + duration; Korean text has `lang="ko"` / `accessibilityLanguage="ko-KR"`; romanization upright ≥ 16 sp, hidden-until-tap only when the D2 setting is on (default visible).
- No emoji; icons from the design-system set (`Icon/types.ts:1-20`: `library`, `lock`, `star`, `sparkle`, `play`, `replay`, `arrow-left`). Colour never the only cue (state lines are text).
- UI strings only from `shelf-copy.ts` (moves to `messages/en/learner.ts` with F-I18N-001); story and note text through the locale overlay (F-CNT-002). Section titles, "N found" and "about N min" use whole-sentence message functions, not suffix concatenation (audit I18N-08).
- Offline: story JSON and cover art are bundled; bookmarks are local; TTS may be missing — text is always visible.
- Privacy: bookmarks and found notes hold story ids only; no names or free text; telemetry as in §3.11; **no outbound links** from the learner surface (sources are text).
- Layout at 320×568, 375×667, 768×1024 and 844×390; 200 % text scale; reduced motion removes any fade.

### 3.13 Backend, sync, storage

No D1 migration, no API route, no `ProgressSnapshot` or `ProgressSummary` field. Added local key: `story:bookmarks:<profileId>` (IndexedDB on web). Bookmarks are not synced, not in `BackupFile`, not in rescue-code restore — a restored learner starts stories from scene 0, and finished stories are still known because quest progress syncs. Syncing bookmarks later needs a server schema first (zod strips unknown snapshot keys) and a merge rule (max scene index). The only shared-package change the Worker sees is the telemetry name list.

### 3.14 Behaviours (Given / When / Then)

| # | Given | When | Then |
|---|---|---|---|
| 1 | a new profile and 24 reviewed stories | Home builds today's plan | three cards: a `next` story (first unfinished shelf story by category then order), the first Journey quest (grid episodes only), a second story; the old "Meet the Letters · Story time" mislabel is gone |
| 2 | a learner leaves a story at scene 3 | they reload and open Home | the story card reads "Keep reading"; tapping it opens `QuestPlayer` with `resume`, skips the intro and the reader opens at scene 3 |
| 3 | a bookmark for level `read-along` and a `listen` quest | the story opens | the bookmark is ignored and the reader starts at scene 0 |
| 4 | a story finished on another device | this device hydrates | its bookmark is ignored by `storyStatus` and pruned on the next write |
| 5 | only the Cards section is available (no reviewed story) | Library opens | exactly today's gallery with no tab row |
| 6 | `contentGatingEnabled = false` | any story surface renders | nothing is locked and no "Premium" text exists anywhere in this feature; with the flag on, a free-tier learner sees a lock on a non-sampler tile and the tap opens the grown-up gate, or the paywall directly on a self-only device with no PIN |
| 7 | the learner has completed quests of two stories | Culture notes opens | only notes of those stories are listed, grouped under the five theme headings, with no locked placeholders and no count of what is missing |
| 8 | an unreviewed story (`review.language` is `draft`) | a production build indexes stories | it is absent from the shelf, Home and Culture notes; with `showUnreviewedStories` (dev/preview) it appears |
| 9 | a story with a shelf episode | `mission-builder` / `firstQuestFor` / Journey run | the shelf episode never becomes the Journey cursor, the first quest, a stage-availability input or the Home quest total |

## 4. Out of scope

- The reader and `StoryScene` (F-STORY-002); checks, Story Order and Results actions (F-STORY-003); volumes and multi-episode cells (F-STORY-005); episode-completion card awards and the Cards-section copy fix (F-STORY-006).
- Songs, "Level 0 lessons" replay, "this week's picks" / holiday calendar, My Playlist (blueprint 02 §3.2/§3.5), search, sort, favourites, sharing, downloads.
- Theme packs content (F-VOC-001..005) — only the section slot.
- Syncing bookmarks; resuming inside the check or order steps.
- Putting shelf quests in the teacher plan builder (F-PLAN-002 shared catalog; `apps/web/src/data/stage1-catalog.ts` is a Stage 1 mirror).
- Turning gating on, and any paywall copy (D5; payments are not live).
- Cover thumbnails on cards other than story cards; auto-opening the reader on resume (audit UX-17).

## 5. Tests

TDD; mobile vitest includes only `src/{logic,store,content,config,platform}/**/*.test.ts` (`apps/mobile/vitest.config.ts`), so screens are covered by Playwright.

| File | Level | Coverage focus | Target |
|---|---|---|---|
| `content-schema/src/__tests__/story.test.ts` (F-STORY-001's file; this spec adds the cases) | unit | `StoryShelfSchema` limits, defaults, invalid category, `shelf` strict (unknown key rejected) | 100 % |
| `content-schema/src/__tests__/telemetry.test.ts` | unit | new names, no duplicates | 100 % |
| `mobile/logic/__tests__/content-access.test.ts` | unit | flag off → nothing locked; flag on → sampler open, others locked for free, premium open; stage parity with the old `isStageEntitled` for 7 stages × 2 tiers; injected registry | 100 % |
| `mobile/logic/story/__tests__/story-index.test.ts` | unit | shelf vs grid, review gate and `showUnreviewed`, order/category, missing refs ignored, several entries per story | 100 % |
| `…/story-status.test.ts`, `bookmarks.test.ts`, `open-story.test.ts` | unit | states, level mismatch, finished elsewhere; schema parse failures → empty; set/clear/prune(20); `resumeStepIndex`, `clampScene`; route/params/event per surface and mode | 100 % |
| `…/story-pick.test.ts` | unit | `continue` > `next` > `again`; exclusions; locked skipped; empty; shelf before grid; tie-breaks; `nextStoryAfter` within a book, within a category, wrap, none | 100 % |
| `…/culture-notes.test.ts`, `library-sections.test.ts`, `shelf-copy.test.ts` | unit | found rule, theme grouping, missing story skipped; availability matrix incl. cards-only; banned words | 100 % |
| `mobile/store/__tests__/story-store.test.ts` | unit | hydrate per profile, corrupt JSON, write-before-hydrate merge, persist keys | lane ≥ 90 % |
| `mobile/store/__tests__/bootstrap.test.ts` | unit | story bookmarks hydrated with progress | — |
| `mobile/logic/homework/__tests__/mission-builder.test.ts` | unit | slot chain table; day one = story + quest + story; `explore` replaces the old mislabel (update the six `kind: 'story'` assertions at `:113, 136, 141, 217, 223, 233`); pinned target stable; reason refresh; collected flip; no banned word in `missionCopy` | 100 % of the file's branches |
| `mobile/content/__tests__/episodes.test.ts`, `logic/__tests__/journey.test.ts`, `logic/onboarding/__tests__/first-quest.test.ts` | unit | `gridEpisodes`, `episodeFor` ignores shelf, `stageAvailability` unchanged by shelf episodes, first quest never a shelf quest | — |
| `mobile/content/__tests__/content-integrity.test.ts` | integration | shelf episode conventions (§3.1), one quest each, `order ≥ 100`, sampler ids exist, every note has resolving `factIds` and ≥ 1 source, every shelf story has `shelf` and a cover scene | n/a |
| `design-system/src/__tests__/section-tabs-style.test.ts` | unit | selected/unselected tokens, min height | lane ≥ 85 % |
| `mobile/e2e/web/story-shelf.spec.ts` | e2e (Playwright) | day-one Home shows a story; start, leave at scene 3, reload, Home says "Keep reading", resume lands on scene 3, finish → Results → card + note found → Culture notes lists it; Library tabs and tiles; episode page variants; build with `EXPO_PUBLIC_CONTENT_GATING_ENABLED=true`: locked tile → PIN entry, flag off: no lock and no "Premium" text | — |
| `mobile/e2e/web/library-cards-only.spec.ts` | e2e | a build with no reviewed stories shows today's Library with no tabs | — |

Coverage lanes: `apps/mobile/src/logic` ≥ 90 % (this feature at 100 %), `packages/content-schema` 100 %, `packages/design-system` ≥ 85 %. Manual QA: VoiceOver/TalkBack across tabs and tiles; 200 % text; 320 dp width; offline with no voice.

## 6. Rollout

Ships dark: with no reviewed story in the bundle, `visibleSections` returns `['cards']`, Home builds no story card (the `explore` card replaces the old mislabel), and nothing else changes. The first reviewed story turns the feature on without a code change; `showUnreviewedStories` only widens it for dev and preview builds. `contentGatingEnabled` stays `false` until payments are live (owner decision). PR order (branches `feat/story-shelf-*`):

| # | PR | Depends on |
|---|---|---|
| 4.0 | `design(wireframe)`: the five wireframes above; briefs `23-library-stories.md`, `24-culture-notes.md`, `25-story-episode-detail.md`; update `design/wireframes/README.md`, `docs/blueprints/10-app-map.md` (A7 Library sections, screen table), `docs/specs/README.md` | F-STORY-001 ready |
| 4.1 | `refactor(mobile)`: grid-only selectors (§3.10) + tests; no visible change | F-STORY-001 PR 1.1b (episode fields) |
| 4.2 | `feat(mobile)`: `content-access.ts`, the two flags, `isStageEntitled` delegation, golden test | none |
| 4.3a | `feat(content-schema)` + `feat(mobile)`: the six telemetry names (+ exact-list test), `bookmarks.ts` + `story-store` + hydrate in `bootstrap` (the `shelf` field already exists: F-STORY-001 PR 1.1b) | F-STORY-001 PR 1.1b |
| 4.3b | `feat(mobile)`: story index / status / pick / open-story / culture-notes / library-sections / shelf-copy logic (pure, 100 %) | 4.2, 4.3a |
| 4.4a | `feat(mobile)`: Home story card — `mission-builder` (`explore`, `pickStoryForHome` wiring), `HomeScreen`, amend F-HW-001 §3.1/§9.2 | 4.1, 4.3b |
| 4.4b | `feat(mobile)`: resume — `QuestPlayer` `resume` param + `beginQuest(…, startStepIndex)`, reader bookmark wiring (`useReaderBookmark` from F-STORY-002 PR 2.6a), Results clears the bookmark, `story.bookmark.resumed` | 4.3a, 4.3b, F-STORY-002 PR 2.6a/2.6b |
| 4.5 | `feat(design-system)`: `SectionTabs`; `feat(mobile)`: Library sections shell + Story Time section + `StoryTile` | 4.3b, F-STORY-002 PR 2.3a (`StoryScene`), F-I18N-001 PR 4 (`KoreanText`) |
| 4.6 | `feat(mobile)`: `StoryEpisodeDetail` and the `EpisodeDetailScreen` branch | 4.3b, 4.5 |
| 4.7 | `feat(mobile)`: `CultureNotesScreen`, route, Culture section | 4.5 |
| 4.8 | `test(e2e)`: `story-shelf.spec.ts`, `library-cards-only.spec.ts` | 4.4a-4.7 |

F-STORY-003's Results "Next story" needs `nextStoryAfter` from PR 4.3b. PR 4.2 (`content-access.ts`) is the single place the free set is defined: F-QUEST-002 and F-VOC call it and define nothing of their own. The locked-tile path needs F-LEARN-001's `gateRequired` helper (its PR 2); until it exists the tile uses the current `PinEntry` route unconditionally.

## 7. Dependencies

Upstream:

- **F-STORY-001**: `Story`, `StoryShelfSchema`, `review` fields, `facts[]`/`sources[]`, `cultureNotes[]`, `coverSceneId`, `Episode.format` / `placement`, `MIN_VERIFICATION_PASSES`, the bundle (`storiesAll`, `storyById`). **F-STORY-002**: `StoryScene`, the `StoryReader` route `{ storyId, level, mode, sceneIndex? }`, reader calling `setBookmark`/`getBookmark` through `useReaderBookmark`. **F-STORY-003**: `storyIdOfQuest`, `levelOfQuest`, `recapWords`, the story quest skeleton, Results extras. **F-STORY-005**: `entriesForCell` and the `StoryFit` ordering of `pickedForYou` (§3.4 there).
- **PR #94** (merged: `decideCardAward`, `recordedRef`, first-try): Results clearing the bookmark sits in its single-write effect. **PR #95** (merged) already changed `HomeScreen` and `LibraryScreen` (`Screen edges`, profile entry): the new tab content uses `TAB_SCREEN_EDGES` (`HomeScreen.tsx:148`).
- Existing: `logic/entitlement.ts`, `store/tier-store.ts` (`effectiveTier`), `store/bootstrap.ts`, `platform/storage`, `content/stages.ts`, design-system `Card`, `Pill`, `StarRow`, `HeritageCardArt`, `HoyaBubble`, `Icon`.

Downstream: F-STORY-005 (reuses `gridEpisodes`), F-STORY-006, F-VOC-003 (registers `theme-packs`, reuses `content-access.ts`), F-PLAN-002 (catalog), F-RVW-001 (slot ③ owner when it ships).

Assumptions I could not verify (each with its fallback): F-VOC's topic ids (`food`, `animals`, `colors`, `numbers`) — adopt F-VOC-001's; (Closed at review 2: `review.language` / `review.culture` values `native-reviewed` / `culture-reviewed`, `cultureNotes[].factIds`, `shelf`, `Episode.placement` and the `StoryReader` params are all as written in F-STORY-001 §3.2 and F-STORY-002 §3.1.)

## 8. Decisions

Binding owner decisions and how this spec applies them:

| Id | Applied here |
|---|---|
| D1 | No age labels; learner levels only; the review field is called `advisory`, never `age…`, if F-STORY-001 keeps one; copy never says "for kids" |
| D2 | Titles and terms are Korean + romanization + gloss; hide-romanization honoured when the setting exists; strings via `shelf-copy.ts` / overlays |
| D3 | No fractions (counts like "N found"); a miss never exists on these screens; stars never shown as empty; encouraging subtitles |
| D4 | Stories and notes are bundled JSON; validator covers shipped content; notes are sourced (`factIds`) |
| D5 | One `isFreeContent`; gating flagged off; no "Premium" where nothing is enforced; sampler defined |
| D7 | Tiles and art are tokens-only SVG from F-STORY-002; no emoji, no raster, no external assets |
| D8 | Spec id F-STORY-004 |
| D9 | Shelf episodes sit outside the grid; Stage 5 stays one episode per cell; "Finishing an episode awards its cards" stays F-STORY-006's |
| D14 | Notes and stories exist on the shelf only with cited facts; unreviewed stories are hidden in production |

Decisions made in this spec:

1. **Library sections, not a fourth tab** (also the vocab design input's choice); the Cards section is untouched, and with no stories the Library is byte-for-byte today's.
2. **Shelf episodes use the existing episode machinery** (`QuestPlayer`, stars, cards, sync, plans) and open through the story variant of `EpisodeDetail`; Home goes straight to `QuestPlayer`.
3. **Story card beats replay in slot ①** when a story is in progress, and slot ③ prefers a story (amends F-HW-001 §9.2) — otherwise replays hide stories from active learners.
4. **Day one shows two stories and the first quest**; the alternative (one story, one quest, one "explore") was rejected because a second quest-like card would repeat ②.
5. **Bookmarks are scene-level, reading phase only, device-local** — no sync until a server schema exists.
6. **Culture notes are found, not stored**: derived from completed quests, so they sync for free; no locked placeholders.
7. **Sources are text on the learner surface, no links**, under "For grown-ups".
8. **Review gate by content status**, not by a feature flag, with a dev-only widening flag.
9. **Finished stories keep their shelf position** and show state; the Library never re-sorts by progress.
10. **`explore` replaces the mislabelled "Story time" episode card** instead of hiding it, so the three-card invariant holds when no story exists.
11. **Sampler membership is data on the story**; the code holds only the flag and the registry shape, so changing the free six is a content change.
12. **`isStageEntitled` delegates to `isFreeContent`** so there is exactly one free-set definition, with an identity golden test to prove no behavior change.
