Status: ready

# F-BROWSE-001 — All lessons: parents and teachers see every lesson the way a learner does

**Scope**: `packages/content-schema` (`schemas/browse.ts`: targets, fragment codec, pass schema, scope response; exported content-id regexes; 5 telemetry names) · `packages/backend` (`adultCoveredAny` in `lib/entitlement.ts`, with F-BILL-002 §5.3's card set; `GET /api/entitlements/browse`; server-side payload allow-list for `browse.*` telemetry) · `apps/mobile` (a third root of the learner web build at `/browse`: `BrowseApp`, `screens/browse/`, `logic/browse/`, `platform/browse(.web).ts`; a storage write fence, a telemetry fence and a configurable telemetry queue key in `platform/`; extractions from `QuestPlayerScreen`, `JourneyScreen`, `CardDetailView`, the route `TrailRow`, every romanization call site and a navigation adapter for the reused story and minigame screens; one button on the in-app grown-up dashboard and one boot intent) · `apps/web` (the **Lessons** item in F-APP-001's adult navigation, `lib/console/browse-link.ts`, `browseEnabled()`, deep links from the plan builder, the roster revisit chips, the Learning Route summary page and the report action slot) · `packages/i18n` (`caregiver.browse`, `console.browse`) · wireframes `design/wireframes/browse/*.md`
**Owner**: solo dev
**Rollout**: Web PWA only (the primary channel). Every grown-up entry point sits behind `browseEnabled()` (`NEXT_PUBLIC_BROWSE=enabled`, console side, off by default), switched on only after BR-8 is deployed; the learner root `/browse` is reachable before that only by typing the URL, and then shows the Access screen. Stripe stays in sandbox; no price appears on any surface this spec adds. No D1 migration. PR order in §11.

Parent / siblings: owner request of 2026-10-11, item 14 ("paying parents and teachers also get a separate section where they can browse the whole learning content exactly as the learner sees it, so they know what the students learn") · F-TCH-004 (the presenter: a second root of the learner build and its isolation test; this spec adds a third root) · F-ENT-001 (entitlements, coverage rules) · F-STORY-004 §3.9 (`logic/content-access.ts`, the free-content registry, D5) · F-STORY-002 §3.1 (the story reader's replay mode, which writes nothing) · F-QUEST-002 §3.12 (`MinigameHost`, `HostMode`) · F-VOC-003 (topic page and flashcards) · F-ROUTE-001 (grown-up views of the route, `TrailRow`) · F-PLAN-001 (plan builder) · F-I18N-001 (locales, `KoreanText`, rule 5) · F-LAYOUT-001 (portrait guard, panes).

Sibling specs of the same owner request (wave 2026-10-11), each read for this revision and named by its F-id:

| Sibling | What this spec takes from it |
|---|---|
| **F-APP-001** persona app shell | the console served on `app.hangulroute.com` (B2), so the hand-off is same origin and same tab; `ADULT_NAV` in `lib/console/shell-nav.ts` (the **Lessons** item); `/browse` reserved in `LEARNER_ROOTS`; the root chooser order; `hr:shell:lastPersona`; the grown-up lock and its idle rule; the boot intent module |
| **F-ENT-003** free plan, all of Stage 1 (OD-1) | `questAccess` / `isQuestOpen` and Browse's adapter `browseQuestOpen` (E3-2, F-ENT-003 §3.3), and the one switch read as the effective switch `gatingActive(flags, bundleOs())` (never the raw `flags.contentGatingEnabled`); the learner word "Not open yet" (`learner.access.notOpen`) and the dotted ring, never a lock glyph (F-ENT-003 §3.7, §3.11, OD-6); grown-up text "Opens with the Family Plan or a Group License" [BY] and the button **Open billing** (F-ENT-003 §3.11; both §6.4 lines adopted here) |
| **F-BILL-002** billing for every persona | §5.3's card set (which space a payment covers) and the billing page, whose path it never spells: F-APP-001's `APP_ROUTES.billing` (`/account/billing`); F-BILL-002 exposes no paying-grown-up flag of its own (its amendment B1), so `accountBrowseScope` is the only such rule |
| **Learning Route** amendment to F-ROUTE-001 (`AMENDMENTS-ROUTE-LEARNING-ROUTE.md`) | the Route tab and the learner tab order (Today · Route · Journey · Library); the adult summary page `/teach/space/route` (LR-7, LR-8); `TrailRow` (R-3) |
| **F-REPORT-001** progress reports | the insight action slot on the learner report ("Preview" for `questId`, RP-7a) and the letter chips |
| **F-SITE-002** layered marketing site | the `SITE_CLAIMS.browseAsLearner` line, flipped by BR-14 only |
| **F-FEEDBACK-001** feedback channel | nothing shared; Browse never shows notes |

---

## Decisions

Standing rules this spec implements (CLAUDE.md and owner): audience is anyone, any age, so no age wording on shared surfaces; child safety (parent gate, no ads, local-first, no child data leaves its place, verifiable parental consent before personal data is linked); anti-shame (no ranking, no learner-vs-learner comparison, no red X, meters only fill); UI strings through `packages/i18n` (English default, Korean and Spanish behind the review gate); design tokens only; no emoji; reading, listening and writing focus, speaking neither measured nor shown; Stripe Live, real prices and commercial claims stay off; no student name in any URL; D1 migrations additive only (this spec adds none); `CLASS_TRANSFER` stays off (this spec never touches it).

Decisions taken in this spec (BD = browse decision):

| # | Decision | Why |
|---|---|---|
| BD1 | **All lessons is a third root of the learner web build at `app.hangulroute.com/browse`**, chosen by F-APP-001's root chooser before `App` mounts (order: `/present`, `/browse`, grown-up bounce, app). `BrowseApp` hydrates only the audio settings and the device locale (in memory); it never calls `hydrateLearnerData`, never starts sync, the inbox or the plan derivation, and never clears F-APP-001's grown-up unlock. | The lesson renderers (quest player, Discover, the games, the story reader, card art, Hoya, stroke hint, audio) exist only in the learner bundle. A separate document means a browsing adult runs none of the learner boot (`App.tsx:36-86`), and no learner's profile is ever in memory. |
| BD2 | **The lessons are the learner's own renderers; the catalogue around them is adult-shaped.** Home reuses the learner's Learning Route trail, Journey grid and Library tiles in learner order. Episode and item pages are new and say what each lesson teaches. Inside a lesson nothing differs from the learner's view except the preview strip and the end screen. Browse mirrors the **free-plan state** of a learner (when the pass is `sampler` and the switch is on) and only that state: it never shows any learner's own plan, Next marker, progress or tier. | "Exactly as the learner sees it" matters where the learning happens. Around it, an adult needs answers a learner screen does not give: which letters, which words, which skills, how long, which card, where it sits. |
| BD3 | **Preview never writes learner data, by construction and by fence.** (1) No learner store is hydrated (BD1). (2) The quest player runs with preview ports that start no session, record no result, award no card, and finish on a preview end screen. (3) A storage write fence drops every write outside an allow-list. (4) A telemetry fence drops every event whose name is not a `browse.*` name, and Browse uses its own telemetry queue key. (5) A source-scan test forbids learner-store imports in browse code. | Defence in depth: one layer failing (a future game that writes, a refactor that forgets a port) still cannot reach a learner's record, a report, a streak or a card collection. |
| BD4 | **Access comes from a browse pass, never from a learner's tier.** Scopes: `full` (every shipped lesson opens), `sampler` (exactly what a free learner can open), `none` (the Access screen). The server decides an account's scope (`GET /api/entitlements/browse`, built on `adultCoveredAny` with F-BILL-002 §5.3's card set, §5.2). The pass reaches Browse **in the same tab, through `sessionStorage`** on the app origin (§4.3). | The browse root has no Clerk session and must work offline once open. F-APP-001 serves the console on the same origin, so no cross-origin messaging, no pop-up and no opener are needed. `sessionStorage` survives a reload and dies with the tab. |
| BD5 | **The pass is client-trusted and unsigned** (OD-11, default) while `flags.contentGatingEnabled` is off. | With the switch off every lesson is open to every learner (F-ENT-003 golden "switch off: all open"), so a pass guards nothing. The learner's own access tier is client-trusted too (F-ENT-003 OD-11). When the owner turns the switch on, OD-11 is asked again (§15). |
| BD6 | **Sampler equals what a free learner can open, through the same predicates and the same switch.** Lessons: F-ENT-003 `browseQuestOpen('sampler', gatingEnabled)` (its adapter over `questAccess` for a free learner with no finished quest, §3.3), with `gatingEnabled = gatingActive(flags, bundleOs())`, the effective switch, read once at boot; stories and word topics: `isContentLocked` with the same effective switch (a story quest and its episode follow the learner's story rule `storyLockFor`). With the switch off, sampler and full are identical: no closed item, no closed caption, no dotted ring, no [ Open billing ], no `browse.plans_tapped`. | A free parent must see the boundary their learner sees, and never a limit that does not exist (F-ENT-003 D5; standing rule: no commercial claims until the owner says). |
| BD7 | **Deep links carry content ids only, in the URL fragment, and are stripped on load.** Reports, the Learning Route and the plan builder link with `#t=<target>&s=<source>`; a target is a stage key, an episode, quest, story, vocabulary topic, card or letter id, or one compatibility jamo character. No learner id, name, alias or summary value is ever part of a link. | A link from "needs work: ㄱ" must open the lesson that teaches ㄱ without saying whose report it came from. A fragment never reaches a server; `history.replaceState` removes it from the address bar. |
| BD8 | **The in-app grown-up gate is a second way in** (OD-5, default on, web only): after the PIN, the parent dashboard offers [ Open all lessons ]. It writes a gate pass in the same tab that expires after 15 idle minutes (refreshed on browse navigation) and 60 minutes at most. | Many families use only the learner app. The PIN proves a grown-up; the device's cached access tier proves coverage. |
| BD9 | **No stars, no score, no card on the preview end screen.** It says what a learner gets at that point and offers the next lesson, Preview again, or back to the lesson page. | An adult deliberately trying wrong answers must not be graded, and nothing must look earned. |
| BD10 | **No cross-origin hand-off is built.** The console entry (BR-10) waits for F-APP-001's adult frame on the app host; on any other origin the **Lessons** item is not shown. Until then the in-app gate entry (BR-12a) is the way in. | Removes the opener, the 3-second wait, the pop-up dependency and the forgeable `postMessage` origin list, and keeps owner item 12 (hangulroute.com is intro only). |

---

## 1. Context

Parents and teachers who pay want to know what their learners are learning (owner, 2026-10-11). Today they cannot see it:

- The grown-up console (`apps/web`, `/teach/*`) lists spaces, rosters, plans and billing. The only content it knows is ids and titles: the hand-kept Stage 1 catalogue (`apps/web/src/data/stage1-catalog.ts`) and the generated lecture catalogue (`apps/web/src/data/lecture-catalogue.generated.ts`). It cannot render a lesson.
- The web `/parent` pages are a demo on sample data (`apps/web/src/data/mock-family.ts`); F-APP-001 A-5b replaces them.
- The in-app parent dashboard (`apps/mobile/src/screens/parent/ParentDashboardScreen.tsx`, behind the PIN) shows lifetime counts per local profile, not content.
- The only way for an adult to see a lesson is to play it on a learner profile, which writes that learner's progress, earns cards and counts toward streaks and the roster summary.

Facts verified against `origin/main` at `ea9049e4` (2026-10-11):

**The learner bundle holds all content and every renderer**

- Content: `apps/mobile/src/content/index.ts:1-5` exports jamo, stages, heritage cards, episodes and quests; stories (`content/stories.ts`, `storyById :19`), vocabulary (`content/vocab.ts:5`, `vocabTopics`, `topicItems`), stroke skeletons (`content/jamo-strokes.ts`). Ids: `episode:<slug>` (`schemas/episode.ts:17`, inline regex), `quest:<slug>` (`schemas/quest.ts:79`, inline), `card:<slug>` (`schemas/heritage-card.ts:42`, inline), `story:<slug>` (`schemas/story.ts:47` `StoryIdSchema`), `vocab-topic:<slug>` and `jamo:<slug>` (exported as `LECTURE_VOCAB_TOPIC_ID_RE`, `LECTURE_JAMO_ID_RE`, `schemas/lecture.ts:52-56`), one compatibility jamo (`LECTURE_REVISIT_CHAR_RE`, `:56`). The episode, quest and card regexes are not exported today.
- Stage metadata a grown-up wants is authored: `stages.ts:7-60` (`oneLinerEn`, `anchorSkillEn`), episode `titleEn`, `subtitleEn`, `hoyaIntroEn`, `estimatedMinutes`, `status` (`schemas/episode.ts:16-31`), quest `titleEn` and `estimatedMinutes` (`schemas/quest.ts:52,84`).
- What a quest teaches: `questTeaches(quest)` and `teachingQuestFor(jamoId)` (`logic/stage1/curriculum.ts:23-38`); `questJamo` (`content/sync-context.ts:25`); `questSkills` maps games to read / listen / write and never to speaking (`logic/my-route/skills.ts:11-44`).
- Free content: `logic/content-access.ts:14-66`, `FREE_STAGE_KEYS = ['stage1']`, `FREE_VOCAB_TOPIC_IDS`, sampler stories, `isFreeContent`, `isContentLocked` (false unless `gatingEnabled`). `flags.contentGatingEnabled` is off (`config/flags.ts:63,91`); F-ENT-003 makes it the one switch for grid quests too and keeps it off until Stripe Live. Speaking games are off (`voiceEchoEnabled: false`, `config/flags.ts:87`).

**Where the learner screens write or navigate**

- `QuestPlayerScreen.tsx:60-77` calls `beginSession` / `endSession` on `progress-store` and reads story bookmarks; `finishQuest` resets to `Results` (`:113-126`); `ResultsScreen.tsx:77-80` records the quest, unlocks cards and records catch-up.
- The games report answers to `quest-run-store` (memory only). `MinigameHost` (`screens/minigames/host.ts:10`) defines `HostMode = 'quest' | 'check' | 'review' | 'vocab' | 'preview'`; `MinigameScreen` sets `'quest'` or `'check'`, and the header draws the "Quick check" dots only for `'check'`.
- Ten files read `useLocaleStore().byProfile[…].romanizationMode` or receive it through props: `quest/DiscoverStep.tsx`, `minigames/ListenPickGame.tsx`, `minigames/PicWordMatchGame.tsx`, `minigames/StoryCheckGame.tsx`, `minigames/StorySequenceGame.tsx`, `story/StoryReaderView.tsx`, `story/CheckpointCard.tsx`, `story/StoryWordRecap.tsx`, `library/StoryShelf.tsx`, `components/LanguageCard.tsx`. With no active profile they fall back to `'always'`.
- `StorySourcesScreen` decides with `gateOpensDirectly()` and navigates to `PinEntry` → `ExternalLink` or falls back to `Main`/`Home` (`:36`, `:174`, `:183`); `StoryReaderScreen` falls back to `Main`. Both are typed against `RootStackParamList`.
- The story reader's replay route writes nothing (`StoryReaderScreen.tsx:14-21`); the bookmark hook writes nothing without a profile (`use-reader-bookmark.ts:24-35`).
- Telemetry: `platform/telemetry.ts` keeps one queue at `QUEUE_KEY = 'telemetry:queue'` (`:38`); every successful `track()` starts a flush; `flushQueue()` (`:98`) sends whatever the queue holds, including learner events with a `profileId`. The Worker accepts only names in `TELEMETRY_EVENT_NAMES` (`packages/backend/src/routes/telemetry.ts:63`) and keeps any payload.
- Storage: `platform/storage.web.ts:21-27` `writeJson` / `removeKey` (IndexedDB, `hr:` prefix) is the only write path; `requestPersistence()` (`:36`) calls `navigator.storage.persist()`.

**Roots, offline and the console**

- `apps/mobile/index.ts` registers `App` only; F-TCH-004 PR 6 and F-APP-001 A-6 add the root chooser (`platform/app-root*.ts`). The service worker precaches every built file and serves `/index.html` for any navigation (`scripts/pwa-postbuild.mjs:95,104`), so `/browse` loads offline once the app has been opened online. F-APP-001 A-2 adds a navigation denylist for grown-up prefixes only; `/browse` is a learner root and stays served.
- F-APP-001 serves the console on the app host (B2), registers adult navigation in `lib/console/shell-nav.ts` (`ADULT_NAV`, items hidden when their page is not built) and keeps a per-tab unlock in `sessionStorage` (`hr:grownup:unlock`, 15 idle minutes).
- Coverage: `tierFromSpaces` and `classIsPro` (`packages/backend/src/lib/entitlement.ts:26-31,97-105`); F-BILL-002 adds no paying-grown-up flag (its amendment B1: `adultAccess` removed, this spec owns the rule). Roles per space kind: `lib/can.ts:37-46`. `requireAccount` upserts an account row on a first sign-in (`lib/access.ts`).
- The device's per-learner tier: `store/tier-store.ts:56` `effectiveTier`; F-ENT-003 adds `accessTier` (last server word wins).

## 2. Goals and non-goals

**Goals**

1. A paying parent or teacher can open every shipped lesson (quests, stories, vocabulary topics, cards) and play it exactly as a learner sees it.
2. Each lesson has a short "what this teaches" page: letters, words, skills (read, listen, write), minutes, the card it awards, where it sits on the Journey.
3. Nothing an adult does in All lessons changes any learner's progress, cards, streak, plan readout, report or roster summary, on any device.
4. Reports, the Learning Route and the plan builder can open the exact lesson behind what they show.
5. Free adults see exactly what their learner can open; signed-out visitors see how to get in, with an action that fits how they arrived.
6. It works offline once open, in English, Korean and Spanish UI, with no child data in it, and a first-time adult understands the page at a glance on a phone.

**Non-goals**: authoring or editing content; assigning lessons (plans stay in the plan builder); live view of a child's screen; scoring the adult; search (§14); native apps (OD-10); the level check and review tests as browsable items; previewing a plan in its own order (OD-13, later).

## 3. User stories

> As a parent who bought the family plan, I open **Lessons** from my home on app.hangulroute.com, find the lesson my child did today and play it myself, so I can talk about it at dinner, without changing my child's progress.
>
> As a teacher, I want to see what Stage 1 covers letter by letter before I plan the term, and to open the exact lesson behind "practice next: ㄴ" in my class report.
>
> As a parent on the free plan, I want to see the lessons my learner can open and what the rest of the route holds, in the same words my learner sees.
>
> As a family that only uses the app on one tablet, I want to look through the lessons from the grown-up area after the PIN, without a separate account.

## 4. Detailed behaviour

### 4.1 Surfaces and routing

- **Root.** F-APP-001's `pickRoot(location)` (`platform/app-root(.web).ts`) returns `'presenter'` for `/present…`, `'browse'` for `/browse` and `/browse/…` (`isLearnerRoot`, `LEARNER_ROOTS`), `'grown-up-bounce'` for grown-up paths, else `'app'`. Native stub returns `'app'`. Whichever of F-TCH-004 PR 6, F-APP-001 A-6 and BR-3 lands first creates `app-root`; the others add their branch (one line and one test case each).
- **`BrowseApp`** mounts `GestureHandlerRootView`, `SafeAreaProvider`, the error boundary (`OopsScreen`), `PortraitGuard` (F-LAYOUT-001 §3.4), `BrowseSettingsProvider` (§4.9), its own native stack (`navigation/browse.tsx`, no tabs) and `PreviewFrame` (§4.7) around lesson screens. It passes `documentTitle={{ formatter: () => messages.caregiver.browse.documentTitle }}` to `NavigationContainer`, so React Navigation never writes a route name or item title into `document.title`.
- **What it never does**: mount `PwaBanners`; call `hydrateLearnerData`, `syncAll`, `registerInboxRefresh`, `rederiveAllLocal`, `setProgressPersistListener`, `bindAudioLevelToProfiles` or `requestPersistence` (the last only when the keep switch is turned on, §4.12); remove `hr:grownup:unlock` (F-APP-001 §3.9 clears it on a learner `App` boot only). On boot it hydrates `audio-store`, calls `locale-store.hydrate([])` (no profile ids), applies the fences and the browse telemetry queue (§4.10), installs the audio gesture unlock, resolves the pass (§4.3) and flushes only its own queue.
- **Stack** (`BrowseStackParamList`): `BrowseHome { section?: 'route' | 'journey' | 'library' }`, `BrowseEpisode { episodeId }`, `BrowseItem { kind: 'quest' | 'story' | 'vocab-topic'; id: string; focusJamoId?: string }`, `PreviewQuest { questId, episodeId }`, `Minigame` (the learner `MinigameScreen` through the navigation adapter, §4.7), `StoryReader` (the learner replay route through the adapter), `StorySources` (through the adapter, copy-only links), `CardDetail { cardId }` (modal), `PreviewEnd { kind, id, episodeId? }`, `BrowseAccess { reason, source }`.
- **Unknown path** under `/browse/…` shows home. `document.title` is the fixed `caregiver.browse.documentTitle` ("Hangul Route lessons").
- **Close.** Catalogue screens (home, episode, item) carry [ Close ] in the one fixed back position of home. It goes back through `history.back()` when the tab came to `/browse` from a same-origin page (`document.referrer` on the app origin), else `location.assign` to the persona home for an account pass (`/parent` or `/teach/home` from `hr:shell:lastPersona`, else `APP_ROUTES.signIn`) or to `/` for a gate pass. Inside a lesson the control is [ Leave preview ] (§4.7).

### 4.2 Who can open what: scopes

`BrowseScope = 'full' | 'sampler' | 'none'`.

- **Server rule** (`accountBrowseScope(db, accountId, now)` in `packages/backend/src/lib/entitlement.ts`): `full` if and only if `adultCoveredAny(db, accountId, now)` is true, else `sampler`. `adultCoveredAny` is the only paying-grown-up rule (F-BILL-002 amendment B1). It is true when any space in which the account holds an `owner`, `caregiver`, `teacher` or `admin` membership is covered, by F-BILL-002 §5.3's card set:
  - a live family with an active `family_lifetime` (the yearly Family Plan; the key keeps its historical name, `AMENDMENTS-BILLING-FAMILY-YEARLY.md` [BY]) (`tierFromSpaces`);
  - a live class with its own active `group_license`, or under a **live** school with an active `group_license` or `school_seat` (`classIsPro`; a class whose parent school is archived is not covered through that school);
  - a live school with an active licence, for every school-level membership including `teacher`;
  - an archived space the viewer pays for that still holds an active group licence (as F-BILL-002 counts it);
  - or an active account-subject row (legacy).
  `isEntitlementActive` (past-due grace, cancelled until expiry) applies unchanged. A signed-in adult with no space is `sampler`. Learner memberships never count.
- **Gate rule** (in-app, BD8): `full` when any profile on the device has premium access (`accessTier(profileId, now) === 'premium'`, F-ENT-003 E3-2, merged in #390), else `sampler`.
- **No active pass**: `none`.
- **What each scope may open** (`logic/browse/access.ts`, `itemAccess(item, scope, gatingEnabled, { bundle })`; `gatingEnabled` is the effective switch `gatingActive(flags, bundleOs())` over `flags.contentGatingEnabled` (F-ENT-003 E3-2), read once at boot; `bundle` is the one `BrowseBundle` the root builds):

| Item | `full` | `sampler` | `none` |
|---|---|---|---|
| Quest (and its episode) | open | a lesson: open when `browseQuestOpen('sampler', gatingEnabled)(questId)` (F-ENT-003 §3.3: `isQuestOpen` for a free learner with no finished quest), else closed; a story quest: as its story entry (Story row); an episode is closed only when none of its quests opens | Access screen |
| Story | open | open when the learner's story rule opens it for a free learner (`storyLockFor`: `isContentLocked({ kind: 'story', id, tier: 'free', gatingEnabled })`, and for a Stage 5 book entry also the stage), else closed | Access screen |
| Vocabulary topic | open | open when `!isContentLocked({ kind: 'vocab-topic', … })`, else closed | Access screen |
| Heritage card | front and back | front and back (OD-7) | Access screen |
| Episode or stage marked `preview` / not shipped | "Coming later" | same | Access screen |

  - **Switch off** (production today and until the owner turns on Stripe Live): every row of the `sampler` column is "open". Sampler and full render identically; no closed caption, no dotted ring, no [ Open billing ] and no sampler scope line can appear (`access.test.ts` golden: "switch off: sampler opens every bundled item").
  - **F-ENT-003 E3-2 merged before BR-4** (#390), so `itemAccess` calls F-ENT-003's own adapter `browseQuestOpen('sampler', gatingEnabled)` for lessons and never `isQuestOpen` directly: a later change to what grown-ups may open lands in that one function, which F-ENT-003 tests against `questAccess` (its §3.3, §6.3). Stories and topics use `isContentLocked`; a story quest and its episode follow the story's index entry through the learner's `storyLockFor` (a shelf entry: the story's sampler mark; a book entry: also the stage, so a free learner's Stage 5 book stays closed), never the lesson rule (a story quest is not a grid lesson, so `browseQuestOpen` would call it open).
- **Closed** (only possible with the switch on and a sampler pass) means the item page with everything except the [[ Preview this lesson ]] button. In its place the grown-up line of F-ENT-003's glossary (§3.11) for a context Browse cannot know: **Opens with the Family Plan or a Group License** [BY] (a new `caregiver.browse` key), and, for an account pass that is not kept and not a fallback, the adult-only [ Open billing ] under it (F-BILL-002's label; the billing page, `APP_ROUTES.billing` on the app host; Browse never spells the path). The learner's own visuals keep the learner's marks: the Journey grid draws a closed cell exactly as the learner Journey draws it, with the **dotted ring** and the label "{episode}: not open yet. Opens the lesson page." (`a11y.access.notOpen`, F-ENT-003 §3.7; never a lock glyph, OD-6), and story and topic tiles show the learner tile's **Not open yet** state (`learner.access.notOpen`) with the dotted ring. Those learner keys are F-ENT-003's (E3-5 to E3-7) and are read by reference, never copied. No price, no "Premium", no "upgrade", no countdown, and never "route" as an access word (F-ENT-003 §3.11).

### 4.3 The browse pass

```ts
// packages/content-schema/src/schemas/browse.ts
export const BROWSE_PASS_SESSION_KEY = 'hr:browse:pass';            // sessionStorage, app origin, per tab
export const BrowsePassSchema = z.object({
  v: z.literal(1),
  scope: z.enum(['full', 'sampler']),
  source: z.enum(['account', 'gate']),
  issuedAt: z.number().int().nonnegative(),                          // ms epoch
  seen: z.number().int().nonnegative(),                              // last browse navigation (gate idle rule)
  fallback: z.literal(true).optional(),                              // account scope check failed; sampler for at most 1 hour
  uiLocale: UiLocaleSchema.optional(),
}).strict();                                                          // no account id, email, space or learner field can ride along
```

The v1 shape is frozen. A precached app can run an older reader for a long time (Browse mounts no update banner, §4.12), and that reader removes any pass it cannot parse; new data therefore goes in a sibling key (as §14 sketches for a plan order), never in a new field or a `v: 2`.

`passActive(pass, now)` (`logic/browse/pass.ts`, pure, injected clock): `issuedAt` at most 1 minute in the future; then

| Source | Active while |
|---|---|
| `gate` | `now - seen < BROWSE_GATE_IDLE_MS` (15 min, `PARENT_SESSION_MS`) and `now - issuedAt < BROWSE_GATE_MAX_MS` (60 min) |
| `account` | `now - issuedAt < BROWSE_ACCOUNT_MAX_MS` (12 h), or `< BROWSE_FALLBACK_MAX_MS` (1 h) when `fallback` |

Browse refreshes `seen` on every browse navigation, at most once a minute (the F-APP-001 unlock rule).

**Account hand-off (console page → `/browse`, same origin, same tab)**

1. The **Lessons** item (`ADULT_NAV`, `persona: 'both'`, `href: '/browse'`, `enabled: browseEnabled() && location.origin === new URL(appUrl()).origin`) and every console deep link call `openBrowse(target, source)` in `apps/web/src/lib/console/browse-link.ts`.
2. `openBrowse` reads the account scope (`api.browseScope()` → `GET /api/entitlements/browse`, cached for the page). It writes `BrowsePass { scope, source: 'account', issuedAt: now, seen: now, uiLocale: <console locale> }` to `sessionStorage[BROWSE_PASS_SESSION_KEY]` through a try/catch wrapper, then `location.assign(buildBrowseUrl(location.origin, { target, source }))`.
3. **Scope check fails** (network or 5xx): the console does not navigate. It shows beside the control "Could not check your plan." with [ Try again ] and [ Open free lessons ]; the second writes a `sampler` pass with `fallback: true` (1 hour, never kept). Fail closed to the free set, never to `full`. With the switch off the fallback changes nothing visible.
4. **`sessionStorage` unavailable** (blocked site data): the console does not navigate and shows "Your browser blocked this page's storage, so lessons cannot open here."
5. Browse boot reads the key (`platform/browse.web.ts`, try/catch; unreadable means absent), parses it with `BrowsePassSchema` (anything else is ignored silently and removed), checks `passActive`, and keeps the key for reloads. Nothing waits: the pass is read synchronously before first paint.

**Gate hand-off (learner app → `/browse`, same tab)**

1. After the PIN, the parent dashboard shows [ Open all lessons ] on web only (`Platform.OS === 'web'`). `openBrowseFromGate()` (`platform/browse-handoff.web.ts`, learner app, outside the browse isolation scan) writes `BrowsePass { scope: <gate rule>, source: 'gate', issuedAt: now, seen: now, uiLocale: <learner UI locale> }` to the same `sessionStorage` key, synchronously, then `location.assign('/browse#s=gate')`.
2. The pass survives a reload and dies with the tab or after 15 idle minutes. When it expires during a preview, the current lesson continues to its end; the next navigation shows the Access screen, unless an active kept pass is on this device (Keep on this device, below): that pass then decides and the expired gate pass is removed (`resolvePass`).
3. **Boot intent** (BR-12b, extends F-APP-001's `logic/shell/boot-intent.ts`): `/?gate=browse` (no other parameter) opens `PinEntry { next: 'BrowseLessons' }` over the learner start screen; a correct PIN (or `gateOpensDirectly`) calls `openBrowseFromGate()`; cancel lands on the learner home and writes nothing. The intent is removed from the address with `history.replaceState`. `safeNextPath` is not involved (it accepts grown-up paths only and stays unchanged).

**Keep on this device** (OD-4). The home footer offers, for account passes that are not a fallback only, a switch off by default: "Keep lessons on this device for 7 days, also offline". When on, `{ v: 1, scope, keptAt }` is written to IndexedDB `browse:pass` and Lesson display settings to `browse:prefs`, and `requestPersistence()` is called once. The switch keeps only a pass that is still active (`keptPassFor` returns `null` otherwise): a tab left open past its 12 hours cannot turn the switch on into 7 new days. Browse reads a kept pass only when the tab has no active session pass: an active session pass decides; an expired one gives way to an active kept pass and is removed (a tab restored after its pass ran out gets in exactly as a new tab would, which keeps the offline promise); with no active kept pass the expired session pass stays, for the Access screen's source. A kept pass counts as an account pass with source `kept` for the rules below. Turning the switch off removes both keys. An expired kept pass is removed on read. A gate pass never offers the switch.

**Access screen** (`BrowseAccess { reason: 'none' | 'expired'; source: 'account' | 'gate' | 'unknown' }`). Title: **This page is for parents and teachers.** No lesson, title or card is shown. The source is the expired pass's source, else `account` when `hr:shell:lastPersona` holds a persona code (read allow-listed, §4.10), else `unknown`.

| Source | Line | Primary | Secondary |
|---|---|---|---|
| `gate` (expired) | "Your time in the grown-up area ended." | [[ Back to the grown-up area ]] → `/?gate=browse` (PIN, then a fresh gate pass) | [ Back to the app ] → `/` |
| `account` | "Open lessons again from your account." | [[ Open lessons from my account ]] → `/parent` or `/teach/home` (by `lastPersona`) | [ Sign in ] → `APP_ROUTES.signIn` |
| `unknown` | "On a family device, open them from the grown-up area. Parents and teachers can also open them from their account." | [[ Back to the grown-up area ]] → `/?gate=browse` | [ Sign in ] → `APP_ROUTES.signIn` |

Every account target is a grown-up page behind Clerk and F-APP-001's grown-up lock (PIN or fresh sign-in on a device with learner profiles), so a child on a shared tablet cannot reach billing or account pages through this screen. Until BR-12b ships, the gate primary is [[ Back to the app ]] with the line "Then open the grown-up area again."

### 4.4 Deep-link targets and the fragment

```ts
// packages/content-schema/src/schemas/browse.ts
type BrowseTarget =
  | { kind: 'stage'; stage: StageKey }
  | { kind: 'episode'; id: string }      // EPISODE_ID_RE
  | { kind: 'quest'; id: string }        // QUEST_ID_RE
  | { kind: 'story'; id: string }        // StoryIdSchema
  | { kind: 'vocab-topic'; id: string }  // LECTURE_VOCAB_TOPIC_ID_RE
  | { kind: 'card'; id: string }         // CARD_ID_RE
  | { kind: 'jamo'; id: string }         // LECTURE_JAMO_ID_RE
  | { kind: 'char'; char: string };      // LECTURE_REVISIT_CHAR_RE: one compatibility jamo, as ProgressSummary.needsPractice holds it
type BrowseSource = 'nav' | 'report' | 'route' | 'plan' | 'roster' | 'gate' | 'direct';
```

- BR-1 exports `EPISODE_ID_RE`, `QUEST_ID_RE` and `CARD_ID_RE` from `schemas/episode.ts`, `quest.ts` and `heritage-card.ts` (additive; the schemas use the constants, same values) and `lecture.ts` imports them, so each regex exists once.
- **Fragment** `#t=<target>&s=<source>`. An id target is the id itself (`t=quest:stage1-letters-q1`, `t=jamo:nieun`, `t=vocab-topic:food`); the two others are `t=stage:stage1` and `t=char:<encodeURIComponent(char)>`. `t` may be absent (home). `encodeBrowseFragment` / `decodeBrowseFragment` are pure, total and reject anything else (`{ ok: false, reason: 'empty' | 'bad_target' | 'bad_source' | 'too_long' }`, at most 256 characters).
- **On load** the root reads the fragment, then calls `history.replaceState(null, '', '/browse')` before first paint. A bad fragment opens home and nothing is logged beyond `browse.opened { source: 'direct' }`. A later `hashchange` (a second console link while the tab is open) is read the same way.
- **Resolution** (`logic/browse/target.ts`, `resolveTarget(target, bundle)`, pure):
  - `stage` → `BrowseHome { section: 'journey' }` scrolled to that stage row;
  - `episode` → `BrowseEpisode`; `quest`, `story`, `vocab-topic` → `BrowseItem`; `card` → `CardDetail` over home (Library);
  - `jamo` → `teachingQuestFor(id)`; found → `BrowseItem { kind: 'quest', id, focusJamoId: id }`; not found → home (Journey) with the note "This letter is practiced across Stage 1.";
  - `char` → the jamo whose `char` matches and whose `kind` is not `batchim`, then as `jamo`;
  - an id the bundle does not know → home with "This lesson is not in this version of the app yet.".
- **Access applies after resolution**: no active pass always lands on the Access screen; a closed sampler item opens its item page in closed form.

### 4.5 Home

One screen (wireframe `browse/home.md`), layered so a first-time adult understands it at a glance on a phone:

1. **Header**: [ Close ] (left), title **All lessons**, [ Lesson display ] (§4.9).
2. **One how-to line**: "Tap a lesson to see what it teaches, then play it. Nothing is saved."
3. **Scope line**, only for a sampler pass with the switch on: "Your learner's free lessons are open. The others show what they teach." With a fallback pass: "Showing free lessons. We could not check your plan." No scope line otherwise.
4. **Pointer line**, account passes only: "To see how your learner is doing, open your home page." linking to the persona home (no learner identifier).
5. **Section control**: one single-row segmented control in the learner's order: **Route** · **Journey** · **Library**. Route is present only while `flags.myRouteEnabled` is on (the same flag as the learner's Route tab, Learning Route LR-4); then it is the default section, else Journey is.
6. The section.

Every section is the learner's own visual in the browse state: nothing done, no stars, no "new" sparkle, no Next marker, no "In your plan" ring; closed items only as §4.2 describes.

- **Route**: the Learning Route trail (`TrailRow`, F-ROUTE-001 R-3, extracted for reuse in BR-5b) in a no-progress state: seven stage rows with the stage name, its one-liner (`oneLinerEn`, localised) and the availability word the learner trail uses ("A taste", "Coming later"); no here tag, no goal tag, no pips filled, no route card. A stage row → Journey at that stage.
- **Journey**: when the Route section is absent, one collapsed line "7 stages, from letters to your own words" with an expander that lists the stage one-liners. Then `JourneyGrid` (extracted from `JourneyScreen`, BR-5b) with every cell that has a shipped episode `open` (or `closed`, §4.2), `later` otherwise. A cell → `BrowseEpisode`. On regular and wide windows the grid and the episode outline sit in two panes as the learner Journey does (F-LAYOUT-001 §3.7).
- **Library**: the learner Library's groups in the order of its registry (`LIBRARY_SECTIONS` in `library-sections.ts`, the learner's tab order): **Cards** (every heritage card face up, no silhouettes, no earn hints), **Story Time** and **Culture** (the `StoryTile` shelf for the shelf entries of the reviewed story index, in shelf order; the review gate applies, the dev-only widening is not honoured), then **Words** in the slot F-VOC-003 registers as "Words" (`theme-packs`, its T1: one row per topic: title, word count, three sample words with `KoreanText`, romanization and gloss). `browseLibrary` returns the groups in that order and BR-7 draws them as they come. A group with nothing in this build is left out, as the learner Library leaves out its tab; Cards always stays, so the Library is never empty. A learner Culture tab can also hold only that learner's found culture notes: that is learner state, so it is not a Browse group. A tile or row → `BrowseItem`; a card → `CardDetail` in preview state.
- **States**: Access (no active pass), offline (works; a quiet "Offline" chip next to the title), a stage with nothing shipped shows a "Coming later" row, never an empty screen (a Library group with nothing is left out, above); not-in-this-version line (§4.4).

### 4.6 Episode outline and item page

**Episode outline** (`browse/episode.md`): episode title, subtitle and Hoya's intro line as the learner episode page shows them; "About N minutes" (sum of quest `estimatedMinutes`); the quests in `questIds` order. Each row: title, the letters it introduces (`questTeaches`, `KoreanText` chips with romanization; a taste quest shows its first three words instead), skills chips (read / listen / write; speaking never), minutes, and [ Open ] → `BrowseItem`. A closed row carries the grown-up caption **Opens with the Family Plan or a Group License** (§4.2) and [ Open ] still opens its page. A story episode lists its stories. Reward cards as thumbnails (tap → `CardDetail`). An episode with `status: 'preview'` or no quests reads "Coming later".

**Item page** (`browse/item.md`), one template for quest, story and topic:

- Title, kind label ("Lesson", "Story", "Words"), "About N minutes".
- **What this teaches** (`logic/browse/facts.ts`, `itemFacts(item, bundle)`):
  - quest: letters introduced, syllables and words practiced (from every Discover item, a letter's example word and each word item, then the step scopes), each with romanization and a gloss in the UI language; skills; the step list named by `questStepLabel` ("Meet the letters", "Practice", "Check", "Card");
  - story: level(s) offered, number of scenes, key words, [ See the sources ] (`StorySources`, copy-only links in Browse, §4.7);
  - topic: every word with romanization, gloss and picture (`PictureArt`).
- **Where it sits**: "Stage 1 · Letters · lesson 2 of 3" with [ See on the Journey ] → home, Journey, at that cell. A lesson and a Stage 5 book's story quest sit in their grid episode, with their place in it; a shelf story's own quest sits where its story does, the story's home cell (`homeCellOf`, F-STORY-005 §3.2), with no lesson position ("Stage 3 · Life"), because its shelf episode is not a grid cell (`QuestPlace` kinds `episode` and `story-home`).
- **The card it awards** (quest `rewardCardId`): thumbnail and title.
- **Focus line** when opened for a letter: "Taught here: ㄴ (n)" at the top, the chip marked in the letters row (shape and label, never colour only).
- **Primary action** [[ Preview this lesson ]] when open; closed state per §4.2.
- Secondary: [ Present this ] when the presenter root exists (F-TCH-004 PR 6) and the scope is `full` (BR-13).

### 4.7 Preview mode: playing a lesson as the learner sees it

- **Preview strip** (`PreviewFrame`): on lesson screens and the preview end screen only: "Preview. Nothing is saved." and, inside a lesson, [ Leave preview ] (back to the item page). Not dismissable; outside the lesson's own layout; an existing neutral surface and text token pair; announced once per screen (§7).
- **Quest**: `PreviewQuestScreen` renders `QuestPlayerView` (extracted from `QuestPlayerScreen` in BR-5a; no learner behaviour change) with preview ports:

```ts
// apps/mobile/src/logic/quest-flow/quest-player-ports.ts (as shipped in BR-5a)
interface QuestPlayerPorts {
  start(questId: string, episodeId: string): number | null; // learner: questStartStep + beginSession, null with no active profile (no run, no end); preview: 0, no session
  end(): void;                                              // learner: endSession; preview: nothing
  finish(result: QuestFinish): void;                        // learner: reset to Results; preview: reset quest-run-store, replace with PreviewEnd
  leave(): void;                                            // learner: episodeReturn; preview: back to BrowseItem (the view resets quest-run-store first)
  track(event: QuestPlayerEvent): void;                     // learner: platform track with the active profile id; preview: nothing
}
interface QuestFinish extends QuestOutcome { retries: number } // retries ride along for telemetry, never scored
type QuestPlayerEvent = Omit<TelemetryEvent, 'profileId'>;     // the view never names a person; the ports add who, if anyone
```

  `quest-run-store` is used as it is (memory only, in this document) and reset on leave and finish. The view resets it on Leave; on finish the run is still in the store when `finish` is called (the learner's Results reads it), so the preview `finish` port resets it itself. Every step runs as in the learner app: Discover, the Check, the games and story steps (`StoryReadGame` gets no profile, so no bookmark). Games run in the learner's own host modes (`'quest'`, `'check'`), so the header, the "Quick check" dots and every nudge are what the learner sees. Speaking steps follow `voiceEchoEnabled` (OD-12).
- **Navigation adapter** (BR-5c). `MinigameScreen`, `StoryReaderScreen` and `StorySourcesScreen` take their exits through a small adapter (`onBack`, `onOpenLink`, `onHome` props with learner defaults that keep today's routes). In the browse stack: back → the previous browse screen; home → `BrowseHome`; `StorySources` shows **Copy link** only (no Open, no `PinEntry`, no `ExternalLink`), because there is no PIN in Browse and `gateOpensDirectly()` would be true. A test asserts that no browse-stack screen dispatches a route the browse stack does not register.
- **Story**: the learner `StoryReader { mode: 'replay' }` route (it writes nothing), opened at scene 0 of the level picked on the item page (default: the lowest). [ Preview the questions ] runs the story's quest as a `PreviewQuest`.
- **Vocabulary topic**: until F-VOC-003's screens ship, the item page's word list is the preview (audio through `playPrompt`). When they ship, [[ Preview this lesson ]] opens the F-VOC-003 flashcards with `MinigameHost` mode `'preview'` (the only use of that mode here; the F-VOC-005 vocabulary progress slice is never written).
- **Card**: `CardDetailView` with `state: 'preview'` (BR-5c): front and back as an earned card looks, no "earned on" date, no earn hint, no share action.
- **Audio** is the learner's; the first tap unlocks it. Mute writes `device:audio` (F-AUDIO-004 AD7, the trade-off F-TCH-004 §8 records).
- **Errors**: a lesson that fails to render shows `OopsScreen` with [ Back to the lesson page ].

### 4.8 Preview end

`PreviewEnd { kind, id, episodeId? }` (`browse/preview-end.md`) replaces the learner Results screen:

- "That is the whole lesson." and Hoya (`cheering`).
- "At this point a learner sees 1 to 3 stars and collects:" + the card thumbnail and title; a story: "A learner can read it again any time."
- No stars, no score, no accuracy, no card animation (BD9).
- Actions: [[ Next lesson ]] (the next quest in the episode, else the first quest of the next shipped cell, catalogue order; a closed next lesson opens its page in closed form; else hidden), [ Preview again ], [ Back to the lesson page ].
- Leaving early ([ Leave preview ] or the lesson's own close and confirm) returns to the item page without the end screen.

### 4.9 Lesson display and language

A bottom sheet from the header (`browse/show-as.md`, titled **Lesson display**), memory only for the tab unless the keep switch is on (then `browse:prefs`):

- **Romanization**: (o) always shown / ( ) hidden until tap, through `useRomanizationMode()` (BR-5c): the browse setting under `BrowseSettingsProvider`, the active profile's setting elsewhere. All ten call sites of §1 move to the hook; a source-scan test forbids reading `byProfile[…].romanizationMode` directly under `screens/` and `components/`.
- **Language**: endonym chips of the shipped locales (hidden locales are not offered). Default: the pass's `uiLocale`, else the device locale. Applied through an in-memory override: `locale-store` gains `setSessionLocale(locale)`, which sets the active UI locale in memory only (no `device:settings` write, no learner event; today's `setDeviceLocale(locale, source)` persists). The persisted device locale is never written; a `?lang=` hand-off that `hydrate` would persist is dropped by the write fence.
- No level or age choice: lessons look the same for every learner.

### 4.10 Never writes: isolation, fences, separate telemetry queue

- **Storage write fence** (`platform/storage.ts` and `.web.ts`): `setWriteFence(allow: ((key: string) => boolean) | null)`. While set, `writeJson` and `removeKey` for a rejected key resolve without touching storage and call the fence observer (a test seam; production observer does nothing). `BROWSE_WRITABLE_KEYS`: `browse:pass`, `browse:prefs`, `browse:telemetry-queue`, `device:audio`. Reads are not fenced, but browse code reads only `browse:*`, `device:audio`, the device locale key and `shell:lastPersona` (unit test: a `readJson` spy during boot and a full preview sees only those keys). `sessionStorage` is touched only for `BROWSE_PASS_SESSION_KEY`.
- **Telemetry queue key** (`platform/telemetry.ts`): `configureTelemetryQueue(key)`; `BrowseApp` sets `browse:telemetry-queue` before any `track` and flushes only that key. The learner queue `telemetry:queue` is never read, rewritten or sent from Browse, so a learner tab and a Browse tab never overwrite each other.
- **Telemetry fence**: `setTelemetryFence(allow: ((name: string) => boolean) | null)`. While set, `track()` returns `false` for a rejected name before validation, listeners, network or queueing. `BrowseApp` allows only `BROWSE_EVENT_NAMES` (§9); learner events from reused screens are dropped.
- **Isolation test** (`logic/browse/__tests__/browse-isolation.test.ts`, source scan): files under `screens/browse/**`, `logic/browse/**`, `navigation/browse.tsx`, `BrowseApp.tsx` and `platform/browse*` may not import `store/progress-store`, `profile-store`, `sync-store`, `plan-store`, `membership-store`, `tier-store`, `account-store`, `story-store`, `vocab-run-store` (it records vocabulary progress), `placement-run-store`, `profile-removal`, `store/bootstrap`, the `store` barrel, `screens/results/*` or `screens/quest/QuestPlayerScreen`. A relative path is resolved against the importing file (a nested `screens/browse/<sub>/` file is checked by where its import lands, not how it is spelled), and the whole source is read at once (a formatted `import(` or `vi.mock(` whose path sits on the next line is found). `logic/browse/*` and `platform/browse*` must also not reach `store/`, `screens/`, `components/` or `navigation/` through any chain of imports. Browse screens reuse learner renderers that import stores (`audio-store`, `quest-run-store`, the games), so they are not walked transitively: the ports, the two fences and the e2e key-set check guard them (BD3). The gate writer (`platform/browse-handoff.web.ts`) is called from `screens/parent/` and is not under the scan. Failures name file and line.
- **What preview never does**, each pinned by a test (§10): start or end a session; record a quest, stars or accuracy; unlock or catch up a card; write a story bookmark; write vocabulary progress; touch homework or plan readouts; change `streakDays`, `minutesLast7d` or any `ProgressSummary` field; queue a sync; read, rewrite or send the learner telemetry queue; read any `progress:*`, `profile*` or `account*` key.
- **Reports and streaks** are computed from the learner's snapshot (F-SYNC-001 §3.4), which Browse never writes.

### 4.11 Entry points

All entries build the URL with `buildBrowseUrl(origin, { target?, source })`. Console entries call `openBrowse(target, source)` (§4.3) and render only while `browseEnabled()` is true and the console runs on the app origin. Placement (wireframe `browse/entry-points.md`):

1. **Adult navigation** (F-APP-001 `ADULT_NAV`): **Lessons** for both personas → home (`source: 'nav'`). Never in any learner navigation.
2. **Reports** (F-REPORT-001): the insight action slot of the learner report shows [ Preview ] for an insight's `questId` (`{ kind: 'quest', id }`), and each letter chip links as `{ kind: 'char', char }` (`source: 'report'`). F-REPORT-001 owns the slot and the chips; this spec owns the target grammar and `openBrowse`. The in-app report (RP-9, behind the PIN) uses `openBrowseFromGate` with the same targets.
3. **Learning Route, grown-up views only**: on the adult summary page (`/teach/space/route`, LR-8), each stage row gets [ Preview lessons ] → `{ kind: 'stage', stage }` (`source: 'route'`); on the in-app read-only page (R-9b, behind the PIN) the same rows use the gate hand-off. The learner's own Route tab never shows them.
4. **Plan builder** (`/teach/space/plan` and `/parent/space/plan`): each item row gets a small [ Preview ] → `{ kind: 'quest' | 'episode', id }` (`source: 'plan'`).
5. **Roster revisit chips** (`classRollup().revisit`, up to three characters): each chip → `{ kind: 'char', char }` (`source: 'roster'`). No learner name is attached.
6. **In-app grown-up area** (learner app, after the PIN, web only): [ Open all lessons ] on the parent dashboard (`source: 'gate'`).
7. **Never** from the marketing site (F-SITE-002 may describe the feature behind `browseAsLearner`, never link to it), from any learner screen, from the paywall or Plan screen, or in an email.

A sampler account sees the same controls (BD6). No control carries a price or the word "Premium".

### 4.12 Offline and the PWA

- Browse is the learner bundle, precached with it (`pwa-postbuild.mjs:95`); `/browse` loads through `navigateFallback` (`:104`) after the app has been opened online once on that device. F-APP-001's denylist lists grown-up prefixes only and must not list `/browse`.
- With an active pass a lesson keeps working when the network drops. With the keep switch on, Browse opens offline for 7 days. The account hand-off needs the console, which is online-only.
- **Trade-off recorded**: a teacher's first visit to `/browse` installs the learner service worker and its precache, like any first visit to the app host. Browse does not ask for persistent storage (no Firefox prompt) unless the adult turns on the keep switch.
- No update applies during a preview: Browse does not mount `PwaBanners`; a waiting update applies the next time the learner app's banner applies it. No change to `pwa-postbuild.mjs`.

### 4.13 Free plan, subscribers and plans

- The sampler is defined only through F-ENT-003's `browseQuestOpen('sampler', gatingEnabled)` (its adapter over `questAccess`) and F-STORY-004's `isContentLocked` (through the learner's `storyLockFor` for story entries), all with the effective switch `gatingEnabled = gatingActive(flags, bundleOs())` read once at boot, never the raw `flags.contentGatingEnabled` (BD6; E3-2's scan forbids that read outside `config/flags.ts`). `access.test.ts` asserts, for every bundled item and both switch states, that `itemAccess(item, 'sampler', switch)` equals what a new free learner gets.
- A `full` pass equals what a subscriber's learner gets: everything open, no access marker.
- Browse marks no Next, no "In your plan" and no kept state: those need learner data. A plan's own order is previewed row by row from the plan builder today; previewing a whole plan in order is OD-13 (later).

### 4.14 Native apps

Web only (OD-10). Native builds have no `/browse` root (native `pickRoot` stub), the in-app [ Open all lessons ] button is hidden off web, and console links exist only on the web console.

## 5. Data and API (additive)

### 5.1 `packages/content-schema/src/schemas/browse.ts` (exported from `src/index.ts`, appended)

```ts
export const BROWSE_FRAGMENT_MAX = 256;
export const BROWSE_PASS_SESSION_KEY = 'hr:browse:pass';
export const BROWSE_GATE_IDLE_MS = 15 * 60_000;
export const BROWSE_GATE_MAX_MS = 60 * 60_000;
export const BROWSE_ACCOUNT_MAX_MS = 12 * 60 * 60_000;
export const BROWSE_FALLBACK_MAX_MS = 60 * 60_000;
export const BROWSE_KEEP_MS = 7 * 24 * 60 * 60_000;
export const BrowseScopeSchema = z.enum(['full', 'sampler', 'none']);
export const BrowseSourceSchema = z.enum(['nav', 'report', 'route', 'plan', 'roster', 'gate', 'direct']);
export const BrowseTargetSchema = z.discriminatedUnion('kind', [ /* §4.4, every member .strict(), regexes imported */ ]);
export const BrowsePassSchema = /* §4.3 */;
export const BrowseKeptPassSchema = z.object({ v: z.literal(1), scope: z.enum(['full', 'sampler']), keptAt: z.number().int().nonnegative() }).strict();
export const BrowseScopeResponseSchema = z.object({ scope: z.enum(['full', 'sampler']) }).strict();
export function encodeBrowseFragment(f: { target?: BrowseTarget; source: BrowseSource }): string;
export function decodeBrowseFragment(raw: string): { ok: true; target: BrowseTarget | null; source: BrowseSource } | { ok: false; reason: 'empty' | 'bad_target' | 'bad_source' | 'too_long' };
export function buildBrowseUrl(origin: string, f: { target?: BrowseTarget; source: BrowseSource }): string;   // `${new URL(origin).origin}/browse#…`
```

No message schemas and no origin list: the hand-off is same origin (BD10).

### 5.2 Worker

- **`GET /api/entitlements/browse`**, mounted on the existing `entitlementRoutes`; `requireAccount`; returns `ok(c, { scope })` from `accountBrowseScope` (§4.2). 401 without a session. Reads only memberships, spaces and entitlements; no migration, no table, no write besides `requireAccount`'s first-sign-in upsert. CORS unchanged.
- **`adultCoveredAny(db, accountId, now)`** in `lib/entitlement.ts`, the rule behind this route (F-BILL-002 exposes no flag of its own, amendment B1). It reads the spaces with one `getSpaces` call (and one for their parent schools) and each space's entitlement rows once, so its D1 reads grow by one per space, not four.
- **`browse.*` telemetry on the server** (`routes/telemetry.ts`): for a name starting with `browse.` the Worker drops any `profileId` and keeps only the §9 payload keys with their shapes (enums, content-id regexes, `minutes` an integer 0-60, booleans); anything else in the payload is dropped before storage. The transfer events' server-side allow-list is the precedent. Deployed before BR-6.
- `GET /api/entitlements` is unchanged.

### 5.3 Device storage

| Key | Where | Shape | Written by | Lifetime |
|---|---|---|---|---|
| `hr:browse:pass` | `sessionStorage` (per tab) | `BrowsePass` | console `openBrowse`; learner `openBrowseFromGate` | the tab, and §4.3 expiry |
| `browse:pass` | IndexedDB | `BrowseKeptPass` | Browse, only when the keep switch is on | 7 days; removed on switch off or when expired |
| `browse:prefs` | IndexedDB | `{ v: 1, romanization: 'always' \| 'tap', uiLocale?: UiLocale }` | Browse, only when the keep switch is on | as `browse:pass` |
| `browse:telemetry-queue` | IndexedDB | the telemetry queue shape | Browse's telemetry client | until flushed |

Corrupt values read as absent and are removed (zod parse, drop on failure). None holds person data.

### 5.4 Console client

`apps/web/src/lib/console/api.ts` gains `browseScope(): Promise<Result<{ scope }>>` (lenient: an unknown scope reads as `sampler`). `lib/console/browse-link.ts` holds `openBrowse(target, source)`, the session-pass writer (try/catch) and the fallback; `lib/console/config.ts` gains `browseEnabled()` (`NEXT_PUBLIC_BROWSE === 'enabled'`, the `lectureModeEnabled()` pattern). Because F-APP-001 builds the console inside the learner Worker's build, the variable is set on the `hangul-route-app` build (owner step, BR-14).

## 6. i18n

- Browse chrome lives in `packages/i18n` `caregiver.browse` (one sub-object per screen group: `home`, `section`, `episode`, `item`, `facts`, `preview`, `end`, `display`, `access`, `keep`, `errors`, plus `documentTitle`). Console strings in `console.browse` (`checkFailed`, `tryAgain`, `openFree`, `storageBlocked`, `preview`, `previewLessons`); the navigation label is `console.shell.nav.lessons` (F-APP-001 §3.15: siblings add their own `nav.*` keys). The in-app button in `caregiver.dashboard.browse`. The grown-up closed caption "Opens with the Family Plan or a Group License" [BY] is a new `caregiver.browse` key (`item.closed`, F-ENT-003 §3.11's context-unknown line) and the button label **Open billing** is `caregiver.browse.item.openBilling` (F-BILL-002's label); the learner marks on reused learner visuals (`learner.access.notOpen`, `a11y.access.notOpen(title)`) are F-ENT-003's keys, read by reference, never copied.
- **One name everywhere**: navigation **Lessons**, page title **All lessons**, in-app button **Open all lessons**, deep-link buttons **Preview** / **Preview lessons**, strip **Preview. Nothing is saved.**, exits **Close** (catalogue) and **Leave preview** (inside lessons), sheet **Lesson display**. The word "Browse" appears in no UI string.
- English first; Korean and Spanish behind the F-I18N-001 review gate; length budgets cover every `cta` and `pill`; Spanish wraps to two lines in header buttons.
- **No Hangul in an `en` or `es` message** (rule 5): the focus line is a template whose letter and romanization come from content through `KoreanText` with `lang="ko"`. Taught Korean always carries romanization and a gloss in the UI language.
- Every new string passes the caregiver and console banned lists: no "kids", no age range, no "Premium", "upgrade now", "unlock", "fail", "wrong", "behind".
- Proposed English (final in the dictionary): title "All lessons"; how-to "Tap a lesson to see what it teaches, then play it. Nothing is saved."; sampler scope "Your learner's free lessons are open. The others show what they teach."; fallback "Showing free lessons. We could not check your plan."; pointer "To see how your learner is doing, open your home page."; strip "Preview. Nothing is saved."; access title "This page is for parents and teachers."; keep "Keep lessons on this device for 7 days, also offline"; end "That is the whole lesson."; console nav "Lessons"; check failed "Could not check your plan." / "Try again" / "Open free lessons".

## 7. Accessibility

- Every browse screen has one `accessibilityRole="header"` title; the preview strip is a `status` region announced once on screen focus, not on every render.
- The section control is a `radiogroup` with text labels; arrow keys move; it never wraps to a second row at 320 wide (three segments).
- Inside lessons accessibility is the learner app's. The strip never covers the lesson's close control or the game's targets.
- Targets at least `touchTarget.min`; body text at the charter floor (18).
- Lists use real headings per section and per episode; the Journey grid keeps the learner grid's labels: a closed cell reads "{episode}: not open yet. Opens the lesson page." (`a11y.access.notOpen`), as the learner's does; a closed item page and outline row read the grown-up caption (§4.2).
- Korean through `KoreanText` (`lang="ko"`, romanization adjacent, never colour-only); skills chips have text.
- Keyboard: all actions reachable with Tab / Enter / Space; Escape closes the Lesson display sheet and the card modal; focus returns to the opener.
- Reduced motion: Browse adds no animation. Contrast of the strip pair is pinned by the existing contrast test (no new token).

## 8. Privacy and child safety

- **No child data.** The browse root never reads a learner key (§4.10), never knows a learner's name, level, progress, tier or plan, and shows no "your child did this" state. Links carry content ids only (BD7).
- **The pass carries no person data**: scope, source, two timestamps, an optional fallback marker and an optional UI locale. No account id, email, space or learner id in storage or telemetry.
- **Same origin, same tab**: no `postMessage`, no `window.opener`, no pop-up, no origin list (BD10). A pass written by another site cannot reach `sessionStorage` on the app origin.
- **Shared family devices**: the gate pass ends after 15 idle minutes (BD8); the account pass lives only in its tab unless an adult turns the keep switch on (OD-4). A child who opens `/browse` without a pass sees only the Access screen, whose account actions go to pages behind Clerk and F-APP-001's grown-up lock.
- **Billing reachability, stated exactly**: [ Open billing ] appears only for an account pass that is not kept and not a fallback, and only with the switch on; it opens the billing page, which F-APP-001's grown-up lock and F-BILL-002's step-up protect. With a gate pass or a kept pass no purchase, account or settings surface is reachable from Browse, and story sources offer Copy link only.
- **No ads, no third-party scripts, no external links** (story sources are copy-only in Browse).
- **Anti-shame**: no learner data, so no ranking or comparison; no score on the preview end; games keep their amber nudges; no red X.
- **Prices**: none on any Browse or entry surface.
- **COPPA posture**: Browse collects nothing from anyone; its telemetry carries no `profileId` and no account identifier, enforced on the client and the server (§5.2, §9).

## 9. Telemetry (Worker first)

Five names in the new `browse.` namespace (no existing name starts with `browse.`; checked against `TELEMETRY_EVENT_NAMES` on `ea9049e4`, `docs/roadmap/TELEMETRY-NAMES-2.md`, and the sibling specs' new rows: `shell.*`, `access.*`, `route_map.*`, `report.*`, `billing.*`, notes). BR-1 adds them to `TELEMETRY_EVENT_NAMES` and its exact-list test and adds a section (the next free letter at merge time) to `TELEMETRY-NAMES-2.md`; BR-2 adds the server allow-list; both deploy before BR-6, the first sender. Every event is sent **without `profileId`**.

| Name | Payload | When |
|---|---|---|
| `browse.opened` | `{ source: BrowseSource, scope: 'full' \| 'sampler' \| 'none', passFrom: 'account' \| 'kept' \| 'gate' \| 'none', offlineReady: boolean }` | the root resolved its pass |
| `browse.item_viewed` | `{ kind: 'episode' \| 'quest' \| 'story' \| 'vocab-topic' \| 'card', itemId: string, access: 'open' \| 'closed' }` | an episode outline, item page or card opens |
| `browse.preview_started` | `{ kind: 'quest' \| 'story' \| 'vocab-topic', itemId: string }` | [[ Preview this lesson ]] |
| `browse.preview_ended` | `{ kind, itemId, reachedEnd: boolean, minutes: number }` (rounded down, capped at 60) | the preview end screen, or leaving early |
| `browse.plans_tapped` | `{ kind: 'quest' \| 'story' \| 'vocab-topic' }` | [ Open billing ] on a closed item (switch on only; the event keeps its name) |

`itemId` is a content id, never a person id. The console has no telemetry client and sends none.

## 10. Tests

| File | Level | Covers |
|---|---|---|
| `packages/content-schema/src/__tests__/browse.test.ts` | unit, 100 % | every target kind round-trips; bad kind, bad id, two jamo chars, a 257-character fragment, unknown source; `BrowsePassSchema` strictness (extra `accountId`, `email`, `learnerId`, `spaceId` rejected; negative or fractional timestamps rejected); `buildBrowseUrl` keeps only the origin; kept-pass and scope-response schemas; the exported id regexes equal the schema regexes |
| `packages/content-schema/src/__tests__/telemetry*.test.ts` (extend) | unit | the five names in the exact list |
| `packages/backend/src/__tests__/entitlements-browse.test.ts` (+ `test:sqlite`) | unit / integration, 90 % | family owner with an active Family Plan = full; family owner whose Family Plan was cancelled = full until its period end, then not [BY]; caregiver in that family = full; teacher of a class under a licensed school = full; school-level `teacher` in a licensed school = full; school admin with a seat contract = full; class under an **archived** licensed school = sampler; free class teacher = sampler; no spaces = sampler; archived covered family = sampler; past-due inside grace = full, after = sampler; cancelled before expiry = full; learner memberships never count; 401 without a session; with a **seeded existing account**, no write happens (every `Db` call the route makes is on an explicit reader list); a teacher of 30 classes under one school reads each space once; **parity**: for every coverage fixture, scope is `full` iff `adultCoveredAny` |
| `packages/backend/src/__tests__/telemetry-browse.test.ts` | unit | a `browse.*` event loses its `profileId` and unknown payload keys; bad shapes are dropped; other names unchanged |
| `apps/mobile/src/platform/__tests__/storage-fence.test.ts`, `telemetry-fence.test.ts` | platform | fenced write and remove do nothing for a rejected key and work for an allowed key; clearing restores writes; a fenced `track` returns `false` and neither queues nor notifies; with `configureTelemetryQueue('browse:telemetry-queue')`, learner-queued events in `telemetry:queue` are untouched and unsent after boot, a preview and a flush |
| `apps/mobile/src/platform/__tests__/app-root.test.ts` | platform | `/`, `/browse`, `/browse/x`, `/present`, `/browsex` (app), grown-up path (bounce), order; native stub |
| `apps/mobile/src/platform/__tests__/browse-session.web.test.ts` | platform | session pass read and write with throwing `sessionStorage`; corrupt JSON removed; gate writer writes before `location.assign` |
| `apps/mobile/src/logic/browse/__tests__/access.test.ts` | unit, 100 % | the §4.2 table; **switch off: sampler opens every bundled item**; switch on: sampler equals a new free learner (`browseQuestOpen('sampler', true)`, checked against `questAccess` with no completions; `storyLockFor` and `isContentLocked`) for every bundled quest, story and topic, and the free lessons are a real subset; a Stage 5 book's story quest and the book stay closed under a sampler pass while the same story's shelf quest opens; cards always viewable; `none` blocks everything |
| `.../target.test.ts` | unit, 100 % | each target to its screen; `jamo` with and without a teaching quest; `char` skips batchim; unknown id → home with the note (a missing character is picked from the bundle, so new letters never break it); no pass → Access |
| `.../facts.test.ts` | unit, 100 % | letters in Discover order; words with romanization and gloss from Discover and every game scope (Pic-Word boards, Listen & Pick answers read by their builder first, dialogue lines, Story Order labels, a story step's recap words), each once; skills never include speaking; minutes; reward card; "Where it sits" position, and a shelf story's quest at its story's home cell; a story's levels and keywords; a topic's words; a taste quest's first three words. Expectations are read from the bundle; the few named content anchors sit in one block labelled to change with the content |
| `.../catalogue.test.ts` | unit, 100 % | grid cell states (open / closed / later) from the bundle, the scope and the switch, and an openable episode with no quest left drawn later; every shipped episode reachable; Route rows with no progress; story index honours the review gate; Library group order equals the learner Library registry (Words in the `theme-packs` slot) |
| `.../pass.test.ts` | unit, 100 % | `passActive` for gate (idle refresh, 14:59 / 15:00 idle, 60-minute ceiling, a `seen` more than a minute ahead is no pass), account (12 h), fallback (1 h), future `issuedAt`; kept pass only for an active account non-fallback pass, read only without an active session pass, removed when expired or on switch off; Access source from the expired pass, else `lastPersona`, else unknown |
| `.../browse-isolation.test.ts` | unit | forbidden imports (§4.10) fail with file and line, by the path an import resolves to and across wrapped lines; the import walk from `logic/browse` and `platform/browse*` |
| `apps/mobile/src/logic/quest-flow/__tests__/quest-player-ports.test.ts` | unit | learner ports keep today's behaviour (BR-5a), and the view's start / Leave / finish rules (`runQuestStart`, `runQuestLeave`, `runQuestFinish`); BR-6 adds the preview-port cases here: preview ports start no session, finish on `PreviewEnd`, leave to the item page, call no store writer (spies on `progress-store`); games keep host modes `'quest'` / `'check'` |
| `apps/mobile/src/screens/__tests__/romanization-hook-scan.test.ts` | unit | no file under `screens/` or `components/` reads `byProfile[…].romanizationMode` directly |
| `apps/mobile/src/navigation/__tests__/browse-routes.test.ts` | unit | no browse-stack screen (including the adapted `MinigameScreen`, `StoryReader`, `StorySources`) dispatches a route `BrowseStackParamList` lacks; `StorySources` in Browse renders Copy link and no Open |
| `apps/mobile/src/screens/browse/__tests__/*.test.tsx` | unit | home layers in order; one-row section control; Route present only with `myRouteEnabled`; with the switch off no closed caption, dotted ring, scope line or [ Open billing ] anywhere; with the switch on and a sampler account pass the grown-up caption and [ Open billing ], and the dotted ring (never a lock glyph) on closed Journey cells and tiles; with a gate or kept pass no [ Open billing ]; the strip only on lesson and end screens; Access actions per source; Lesson display switches romanization in Discover and story checks; `document.title` fixed via the formatter; `locale-store.hydrate` called with `[]` and the device locale never written |
| `apps/mobile/e2e/web/browse.spec.ts` (new, Playwright) | e2e | seed a learner profile with progress and a non-empty learner telemetry queue; read the full IndexedDB key/value set; open the learner app, pass the PIN, press [ Open all lessons ]; preview a full Stage 1 quest to the end screen, a story and a card; assert the key/value set is identical except the allowed `browse:*` keys, the learner queue is byte-identical, and the browse queue holds only `browse.*` events; the address bar lost the fragment; `document.title` is fixed; reload keeps the pass (same tab); a new tab on `/browse` shows Access; after 15 idle minutes (clock moved) Access offers Back to the grown-up area; offline reload with the keep switch on (account pass) still opens |
| `apps/mobile/e2e/web/browse-account.spec.ts` (new) | e2e | on the merged build (F-APP-001 A-3) with the dev auth bridge and route mocks: **Lessons** in the adult frame opens `/browse` in the same tab with a `full` pass; a report-style link `#t=quest:stage1-letters-q2&s=report` opens the item page; [ Close ] returns to the console page; `browseScope` failure shows Try again and Open free lessons; no request URL, `page.url()` or title contains anything but content ids |
| `apps/web/src/lib/console/__tests__/browse-link.test.ts` | unit, 90 % | pass written with scope, source, timestamps and locale only; fallback pass on check failure; storage-blocked path; URL built per entry source; item hidden when `browseEnabled()` is false or the origin is not the app origin |
| `apps/web/src/lib/console/__tests__/copy.test.ts`, `packages/i18n/src/__tests__/caregiver-messages.test.ts` (extend) | unit | new strings pass the banned lists, length budgets and rule 5; no UI string contains "Browse" |
| Manual (listed in the PR) | manual | iPad Safari (tab discarded and restored keeps the pass), an installed iOS PWA (Lessons from the frame, same window), a Chromebook: preview a quest with sound on and off, the no-Korean-voice fallback, keep switch offline; Korean and Spanish read-through once shipped |

Coverage: `packages/content-schema` 100 %, `packages/backend` 90 %, `apps/mobile` logic 90 % (100 % for `logic/browse/*`), platform 70 %, `apps/web` verification logic 90 %.

## 11. PR breakdown (dependency order)

Each PR is one reviewable change with its tests (S < 300 changed lines, M < 700). UI PRs link their design mock (`design/screens/…`, the owner's manual step, CLAUDE.md §5) and attach screenshots.

| PR | Content | Size | Depends on |
|---|---|---|---|
| BR-0 | `docs`: this spec, `design/wireframes/browse/*.md` (8 files), wireframe and spec index rows | S | none |
| BR-0b | `docs`: `docs/blueprints/10-app-map.md` rows (the `/browse` root, the screens of §4.1, the entry edges of §4.11); amendment notes in F-APP-001 (§6.4 row: Lessons item, `gate=browse` boot intent, `/browse` never clears the unlock), F-REPORT-001 (action slot wording) and F-TCH-004 §3.1 (three roots) | S | BR-0, F-APP-001 merged |
| BR-1 | `feat(content-schema)`: `schemas/browse.ts` (targets, codec, pass and kept-pass schemas, scope response, constants) + exported `EPISODE_ID_RE`, `QUEST_ID_RE`, `CARD_ID_RE` used by `lecture.ts` + 5 telemetry names + `TELEMETRY-NAMES-2.md` section + tests | S | none |
| BR-2 | `feat(backend)`: `adultCoveredAny`, `accountBrowseScope`, `GET /api/entitlements/browse`, server allow-list for `browse.*` telemetry + tests (memory and sqlite) | S | BR-1 |
| BR-3 | `feat(mobile)`: storage write fence, telemetry fence, `configureTelemetryQueue`, `platform/app-root` browse branch (or the module if first), `platform/browse(.web).ts` session-pass reader + tests | S | BR-1 |
| BR-4 | `feat(mobile)`: pure `logic/browse/{access,target,facts,catalogue,pass}.ts` + `browse-isolation.test.ts`; lessons through F-ENT-003's `browseQuestOpen` (E3-2 merged first) | M | BR-1 |
| BR-5a | `refactor(mobile)`: `QuestPlayerView` + `QuestPlayerPorts`; `quest-player-ports.test.ts` pins today's learner behaviour | M | none |
| BR-5b | `refactor(mobile)`: `JourneyGrid` out of `JourneyScreen` (cell states incl. `closed` when F-ENT-003's glyph exists); `TrailRow` usable without a learner model | S | none (`TrailRow` part: F-ROUTE-001 R-3 #317 merged) |
| BR-5c | `refactor(mobile)`: `CardDetailView` `state` prop; `useRomanizationMode()` and all ten call sites + scan test; navigation adapter for `MinigameScreen`, `StoryReaderScreen`, `StorySourcesScreen` (learner defaults unchanged); `locale-store.setSessionLocale` (memory only) | M | none |
| BR-6 | `feat(mobile)`: `BrowseApp`, `navigation/browse.tsx`, `PreviewFrame`, Access screen (actions per source), boot pass resolution, fragment strip and `hashchange`, fences and browse queue at boot, `documentTitle` formatter, `browse.opened`; `browse.spec.ts` first cases (gate pass written by a test helper) | M | BR-3, BR-4, BR-5a, BR-5b, BR-5c; BR-1 and BR-2 deployed |
| BR-7 | `feat(mobile)`: home (header, how-to, scope and pointer lines, Route · Journey · Library), episode outline, item page ("Where it sits"), Lesson display sheet, keep switch; `browse.item_viewed`, `browse.plans_tapped` | M | BR-6 |
| BR-8 | `feat(mobile)`: `PreviewQuestScreen` with preview ports, adapted `Minigame` / `StoryReader` / `StorySources` / `CardDetail` in the browse stack, `PreviewEnd`; `browse.preview_started`, `browse.preview_ended`; e2e: a full quest, a story and a card write nothing | M | BR-7 |
| BR-9 | `feat(mobile)`: vocabulary topic item page with the full word list and audio; flashcard preview through the `'preview'` host when F-VOC-003's screens exist | S | BR-7 (flashcards: F-VOC-003 screens) |
| BR-10 | `feat(web)`: `api.browseScope`, `lib/console/browse-link.ts`, `browseEnabled()`, the **Lessons** `ADULT_NAV` item (`console.shell.nav.lessons`), `console.browse` strings; `browse-account.spec.ts` | M | BR-2 deployed, F-APP-001 A-5a (adult frame) and A-3 (console on the app host) |
| BR-11 | `feat(web)`: [ Preview ] on plan builder rows, links on the roster revisit chips, [ Preview lessons ] on the Learning Route summary stage rows, [ Preview ] in the report action slot — each behind `browseEnabled()` | S | BR-10; LR-8 and F-REPORT-001 RP-7a for their rows |
| BR-12a | `feat(mobile)`: [ Open all lessons ] on the parent dashboard (web only, `openBrowseFromGate`) and [ Preview lessons ] rows on the in-app read-only route page (R-9b) and the in-app report (RP-9) | S | BR-8 merged; R-9b / RP-9 for their rows |
| BR-12b | `feat(mobile)`: `gate=browse` boot intent, `PinEntry { next: 'BrowseLessons' }`, Access "Back to the grown-up area" | S | BR-12a, F-APP-001 A-6 |
| BR-13 | `feat(mobile)`: [ Present this ] on the item page (one-block deck to `/present`) | S | BR-7, F-TCH-004 PR 6 |
| BR-14 | `chore`: `browseEnabled()` default on (owner sets `NEXT_PUBLIC_BROWSE=enabled` on the `hangul-route-app` build first), `SITE_CLAIMS.browseAsLearner: true` with its copy test (F-SITE-002 hand-off) | S | BR-8 deployed, BR-10, BR-11, owner check once (OD-14) |

BR-1, BR-3, BR-4, BR-5a, BR-5b and BR-5c can run in parallel. Merge BR-1's `telemetry.ts` and `src/index.ts` edits serially with other specs' name PRs (append only). BR-6 ships no entry point; the root is reachable only by typing the URL until BR-12a (after BR-8) or BR-14.

**Shared files** (expect mechanical rebases): `packages/content-schema/src/index.ts`, `schemas/telemetry.ts` and its exact-list test, `docs/roadmap/TELEMETRY-NAMES-2.md`, `schemas/{episode,quest,heritage-card,lecture}.ts` (BR-1) · `packages/backend/src/routes/{entitlements,telemetry}.ts`, `lib/entitlement.ts` (BR-2; F-BILL-002 B-4) · `apps/mobile/index.ts`, `platform/app-root*` (BR-3; F-TCH-004 PR 6, F-APP-001 A-6) · `platform/storage*.ts`, `platform/telemetry.ts` (BR-3) · `screens/quest/QuestPlayerScreen.tsx` (BR-5a), `screens/journey/JourneyScreen.tsx`, `screens/my-route/TrailRow.tsx` (BR-5b; F-ENT-003 E3-4/E3-5, Learning Route LR-4/LR-5) · `screens/library/CardDetailView.tsx`, the ten romanization files, `MinigameScreen.tsx`, `StoryReaderScreen.tsx`, `StorySourcesScreen.tsx`, `store/locale-store.ts` (BR-5c) · `screens/parent/ParentDashboardScreen.tsx`, `logic/shell/boot-intent.ts` (BR-12; F-APP-001 A-6/A-7, R-9b, RP-9) · `apps/web/src/lib/console/{shell-nav,api,config}.ts` (BR-10; F-APP-001, F-BILL-002) · `design/wireframes/README.md`, `docs/specs/README.md` (BR-0; every sibling).

**BR-5b as shipped (PR #366), notes for later rows**: the Journey grid now lives in `logic/journey-grid.ts` (cell states, `JourneyCellState` is `'open' | 'later'`) and `components/JourneyGrid.tsx` (drawing); `JourneyScreen.tsx` only wires the learner marks. F-ENT-003 E3-4/E3-5 add the `closed` cell state and its mark there (`JourneyCellState` and `JourneyGrid`), not in `JourneyScreen.tsx`: the dotted ring, never a lock glyph (F-ENT-003 OD-6); the `journey-grid.ts` doc comment that still says "lock glyph" and "opens with the full route" is corrected in that PR. Each stage row of the grid carries `testID="journey-stage-<stage>"` and an optional `onStageLayout(stage, y)`, which BR-7 uses for "stage row → Journey at that stage" and the `stage` deep-link target. `StageRowItem` takes `expandable={false}` for All lessons (no expanded state, never opens in place); BR-7 adds the rendered check (no `aria-expanded`, no panel with `open` true) and decides whether the merged "Coming later" row (`LaterRowItem`) needs the same option, recording the choice here.

**BR-2, BR-3 and BR-4 as reviewed (PRs #389, #391, #393), notes for later rows**:
- BR-4's `buildBrowseBundle` applies the story review gate (F-STORY-004 D14) on every path: an unreviewed story's own quest and its shelf episode (or an openable book episode with no reviewed story) are not in `BrowseBundle`, and an episode's `questIds` lists kept quests only. `quest:` and `episode:` targets for them resolve to the not-in-this-version note; `itemAccess` says "Coming later".
- Sampler: a story quest and its episode follow the story's index entry through the learner's own `storyLockFor` (`isContentLocked` with the bundle's own free set, `freeContentRegistryFor`; a Stage 5 book entry also needs its stage, so a free learner's book stays closed while the same story's shelf quest opens); lessons follow F-ENT-003's adapter `browseQuestOpen('sampler', gatingEnabled)` (§3.3). E3-2 (#390) merged before BR-4, so BR-4 calls it directly; no later row calls `isQuestOpen` for Browse, so the grown-up rule cannot drift from the learner's. `FreeQuestOpen` takes a quest id, the adapter's own shape, and stays a test seam. BR-6's boot reads the effective switch `gatingActive(flags, bundleOs())` once and passes it as `gatingEnabled`, never the raw flag (E3-2's scan forbids `.contentGatingEnabled` outside `config/flags.ts`).
- `resolvePass` returns `removeSession` and `removeKept`; BR-6's boot removes what they name (§4.3, kept-pass precedence). `keptPassFor(pass, now)` returns `null` for a pass that is no longer active, so BR-7's keep switch writes nothing for an expired pass.
- `itemFacts` reads every game scope a lesson plays (§4.6): card pairs, Build a Letter syllables, every Pic-Word board word, the answer of each Listen & Pick round (a word or picture round as a word, a round whose options are one final apart as a syllable, a sound-to-symbol round not at all, since the letters row has it; wrong options never), each dialogue line with its right reply, Story Order labels, and for a story step the recap words of its level (`recapWords`) from the bundle's reviewed story. Korean with no romanization is left out; the same Korean with or without a closing mark is listed once.
- `BrowseBundleInput.canRender` (F-VOC-003 T8) defaults to every picture; BR-9 passes the same check the learner topic picker uses once F-VOC-003's picker ships. `itemAccess` takes its bundle (`context.bundle` is required, no hidden default), so BR-6 builds one `BrowseBundle` at boot and passes the same instance to access, the catalogue, targets and facts.
- "Where it sits" is `QuestPlace`, a union: `{ kind: 'episode', stage, theme, episodeId, position, count }` for a lesson or a book's story quest, and `{ kind: 'story-home', stage, theme, storyId }` for a shelf story's own quest (the story's home cell, no lesson position). BR-7 writes "lesson n of m" only for the first, and [ See on the Journey ] goes to `stage`/`theme` for both.
- `browseJourneyRows` draws an open cell `later` whenever `itemAccess` says "Coming later" for its episode (an openable episode with no quest left in the bundle), with the learner Journey's `disabled` rule, so the grid and the outline agree.
- `browseLibrary` returns the ordered groups (`BrowseLibraryGroup[]`: `cards`, `story-time`, `culture`, `words`) of §4.5; BR-7 renders them in that order.
- Listen & Pick rounds are read by their builder first (`lp:sym` a letter, `lp:syl` a syllable or, when built with a meaning, that word with its gloss, `lp:word` and `lp:pic` a word); only hand-written rounds fall back to their shape.
- `passActive` also bounds a gate pass's `seen` (at most a minute ahead of the clock), so a clock that ran ahead cannot switch off the idle rule.
- The isolation test also walks the import graph from `logic/browse/*` and `platform/browse*`: neither reaches `store/`, `screens/`, `components/` or `navigation/` through any chain. Its direct scan resolves each relative import against the importing file and reads the whole source, and also forbids `vocab-run-store`, `placement-run-store` and `profile-removal` (§4.10). BR-3 adds a scan that no module outside browse code sets a fence or the queue key.
- Sizes: BR-2 about 630, BR-3 about 920 and BR-4 about 2,490 changed lines (after its second review), over this table's S and M budgets; tests are about 70 %, 70 % and 61 % of them (a fixture for every coverage case, every target kind, both switch states). Recorded for the owner; no split was made.

## 12. Dependencies

- **Upstream (hard)**: F-APP-001 A-3 and A-5a for the console entry (BR-10); F-APP-001 A-6 for the boot intent (BR-12b); F-TCH-004 PR 6 for BR-13; F-VOC-003 screens for flashcard preview (BR-9).
- **Upstream (soft)**: F-ENT-003 E3-2 (`browseQuestOpen` and `gatingActive`, merged in #390) and its Journey glyph (E3-4/E3-5; until then no closed cell can exist because the switch is off); Learning Route LR-4 (`flags.myRouteEnabled` Route section) and LR-8 (summary rows); F-ROUTE-001 R-3 #317 (`TrailRow`); F-REPORT-001 RP-7a / RP-9 (report links).
- **Constraints recorded for siblings**: F-APP-001's service-worker denylist must not include `/browse`; F-APP-001's unlock clearing runs on a learner `App` boot only, never on the `/browse` root; F-APP-001's boot intent gains the `gate=browse` kind (BR-12b, additive); F-BILL-002 exposes no paying-grown-up flag (its amendment B1), so this spec's `accountBrowseScope` is the only one; the reports and Learning Route pages link only through `buildBrowseUrl` / `openBrowse` and never put a learner identifier in a target. The billing path is settled: F-BILL-002 reads F-APP-001's `APP_ROUTES.billing` (`/account/billing`) and has no `BILLING_PATH`; [ Open billing ] imports `APP_ROUTES.billing` and never spells the path.
- **Downstream**: search and filters (§14); plan-order preview (OD-13); native Browse; a signed pass when the switch is turned on (OD-11).

## 13. Owner decisions (each with the default this spec builds)

| # | Question | Default (built unless the owner says otherwise) | Alternatives | Gates |
|---|---|---|---|---|
| OD-1 | Who gets the full set? | Any signed-in adult for whom `adultCoveredAny` is true, by F-BILL-002 §5.3's card set (owner, caregiver, teacher or admin of a covered space), decided by the server. | Only space owners; only the purchaser. | BR-2 |
| OD-2 | What do free adults see? | Exactly what a free learner can open. With the switch off (today) that is every lesson; with it on, the rest shows what it teaches with "Opens with the Family Plan or a Group License" [BY] (the learner's dotted ring on the Journey and tiles) and, from an account, [ Open billing ] (no price). | Nothing (Access screen only). | BR-4, BR-7 |
| OD-3 | What do visitors without a pass see? | Only the Access screen, with the action that fits how they arrived (grown-up area, account, or both). | A sampler without sign-in. | BR-6 |
| OD-4 | Is the pass kept on the device? | For the tab (survives reload); an adult can turn on "Keep lessons on this device for 7 days, also offline" for an account pass. | Always kept 7 days; never kept. | BR-7 |
| OD-5 | Open from the in-app grown-up area? | Yes, on web, after the PIN; the pass ends after 15 idle minutes (60 minutes at most); full when any profile on the device is covered. | No in-app entry. | BR-12a |
| OD-6 | What does the preview end show? | No stars, no score, no card animation; a sentence saying what a learner gets. | Show stars from the adult's answers. | BR-8 |
| OD-7 | Cards for free adults | All cards viewable front and back (already public on the landing page). | Only cards of open lessons. | BR-7 |
| OD-8 | Names | Nav "Lessons", page "All lessons", in-app "Open all lessons", strip "Preview. Nothing is saved.", exits "Close" / "Leave preview", sheet "Lesson display". | "Lesson library", "Course preview". | BR-6, BR-7, BR-10 |
| OD-9 | [ Present this ] | Shown with a full pass once the presenter ships, for parents and teachers alike. | Teachers only; not shown. | BR-13 |
| OD-10 | Native apps | Web only for now. | Build the native version with the apps. | — |
| OD-11 | Signed pass? | Unsigned and client-trusted while the switch is off; asked again on the day the owner turns `contentGatingEnabled` on. | A Worker-signed pass verified in the app (a key pair and a dashboard secret). | the switch flip |
| OD-12 | Speaking games in preview | Follow the learner flag (off at launch). | Always show them. | BR-8 |
| OD-13 | Preview a whole plan in its order | Later (§14): today each plan row has its own [ Preview ]; [[ Next lesson ]] follows catalogue order. | Now: "Preview this plan" passes an ordered, capped list of content ids and Next follows it. | — |
| OD-14 | When do grown-ups get the entry? | After BR-8 is deployed and the owner opens Lessons once on the app host (then BR-14 flips the default and the site claim). | Earlier, in-app gate only. | BR-14 |

## 14. Out of scope (this spec)

- Search, filters by letter or skill, "recently previewed" lists.
- Showing any learner's state (done, assigned, in the plan, Next): Browse is learner-free; reports and the Learning Route show learner state and link here.
- Previewing a plan in its own order (OD-13). Sketch for later: the plan builder writes an ordered list of at most 24 content ids into the session pass's sibling key, and [[ Next lesson ]] follows it; a plan is space data, not learner data, so BD7 holds.
- Assigning from Browse; the level check, review tests, homework lists and Home as browsable surfaces; editing content; printable worksheets (F-TCH-003); native apps; a TV app (the presenter covers the TV case).

## 15. Unverified assumptions and risks

- **Root chooser shape**: F-TCH-004 PR 6 and F-APP-001 A-6 are not merged; if their shape changes, BR-3 adapts one module.
- **`sessionStorage` lifetime**: kept across reloads and same-tab navigations on every target browser; iPad Safari restores it with a discarded tab (manual check in the PR list). If a browser drops it, the Access screen offers the right way back (§4.3).
- **Unsigned pass** (BD5, OD-11): anyone can write `sessionStorage` on the app origin through developer tools. With the switch off nothing is lost (every lesson is open to every learner). When the owner turns the switch on, a determined person could preview closed lessons, exactly as they could already edit their learner's cached tier; the owner is asked then whether to sign the pass.
- **Console on the app host**: the console entry depends on F-APP-001 M1 to M3; until then only the in-app gate entry exists.
- **`QuestPlayerView` extraction** touches the most-used learner screen; BR-5a is a pure refactor gated by the learner e2e suite and the ports test, and lands before any browse UI.
- **Free boundary drift**: if F-ENT-003 changes `questAccess`, `access.test.ts` (sampler equals a new free learner for every item) catches it.
- **Vocabulary practice**: F-VOC-003's screens are not on `main`; until they land the topic preview is the word list.
- **Telemetry volume**: `browse.item_viewed` fires per page open; small at adult volumes; the Worker can sample it with no client change.

## Review log

- 2026-10-11: written (BR-0) from the owner's item 14 and the current-system maps.
- 2026-10-11: revised after two reviews (one "changes requested", one "approve with changes") and a read of every sibling spec of the wave (F-APP-001, F-ENT-003, F-BILL-002, the Learning Route amendment, F-REPORT-001, F-SITE-002, F-FEEDBACK-001). Applied:
  - **Blocker (sampler ignored the switch)**: BD6, §4.2, §4.13 now use F-ENT-003 `isQuestOpen` and `isContentLocked` with `flags.contentGatingEnabled`; switch off means sampler equals full, no closed caption, no [ See plans ], no `browse.plans_tapped`; golden test added; OD-2 rewritten.
  - **Cross-tab `postMessage` hand-off**: replaced by a same-origin, same-tab pass in `sessionStorage` (BD4, BD10, §4.3); the Lessons item registers in F-APP-001's `ADULT_NAV`. The reviewer's "keep `postMessage` as a transitional fallback while the console is on hangulroute.com" is **not** taken: the console entry waits for F-APP-001's adult frame on the app host instead, which removes the forgeable origin list (the second review's `localhost:3000` finding) and keeps owner item 12. Message schemas and `BROWSE_PASS_ORIGINS` are deleted.
  - **Access screen dead ends**: actions chosen by source (gate, account, unknown), new title "This page is for parents and teachers.", `gate=browse` boot intent (BR-12b), `lastPersona` read allow-listed; account targets sit behind Clerk and the grown-up lock (also answers the second review's "Sign in without the PIN").
  - **Closed wording**: the learner's "Opens with the full route" (read from F-ENT-003's key) and the learner Journey lock glyph; [ See plans ] only under it, account passes only; BD2 states Browse mirrors only the free-plan state.
  - **Learning Route naming**: item block "Where it sits" with [ See on the Journey ]; home gains a Route section in learner order (Route · Journey · Library) behind the learner's own flag; entry 3 now names the LR-8 summary page.
  - **Telemetry queue shared with learners**: `configureTelemetryQueue`, `browse:telemetry-queue`, learner queue untouched (test and e2e reworded).
  - **Entry before `/browse` exists**: `browseEnabled()` flag; BR-10 waits for BR-2 deployed and F-APP-001; BR-12a waits for BR-8; BR-14 flips the default after BR-8 is deployed.
  - **Child-safety edges**: [ See plans ] hidden for gate and kept passes; story sources copy-only in Browse; §8 rewritten to state billing reachability exactly.
  - **Reused screens navigating to missing routes**: navigation adapter (BR-5c) and a route test; games keep host modes `'quest'` / `'check'`; `'preview'` only for F-VOC-003 flashcards.
  - **Minors applied**: gate pass idle-based with a 60-minute ceiling; one coverage helper shared with F-BILL-002 plus a parity test; naming made consistent (OD-8); one-row section control, collapsed stage intro, how-to line, strip only inside lessons; fallback pass 1 hour, never kept, with Try again before navigating; pointer line to the persona home; all ten romanization call sites plus a scan test; server-side `browse.*` payload allow-list; backend no-write test seeds an existing account; `documentTitle` formatter; exported id regexes; in-memory locale override and `hydrate([])`; archived parent school and school-level teacher cases; BR-5 split into 5a / 5b / 5c; service-worker install and persistence trade-off recorded.
  - **Minors resolved by the redesign, not applied as written**: `setWriteFence({ write, remove })` and "await the hand-off write before navigating" (no removal-only key and no IndexedDB hand-off remain; the `sessionStorage` write is synchronous and tested to happen before navigation); "upgrade the open Browse tab after Try again" (Try again now runs in the console before Browse opens).
  - **Minor recorded as an owner decision instead**: preview a plan in its order (OD-13, default later, with a sketch in §14).
- 2026-10-11: BR-5a as shipped (PR #362): §4.7's port sketch updated to the code. `start` may return `null` (no active profile: no run, no `end`), `finish` takes `QuestFinish` (the outcome plus retries for telemetry), and `track` takes the event without `profileId` (the learner port adds it). The ports test lives at `logic/quest-flow/__tests__/quest-player-ports.test.ts`. The preview `finish` port must reset `quest-run-store` itself.
- 2026-10-12: two reviews of BR-2, BR-3 and BR-4 (#389, #391, #393). Applied here: F-BILL-002 amendment B1 (no `adultAccess.coveredAny`; `adultCoveredAny` is the only paying-grown-up rule) in the scope line, the sibling table, BD4, §1, §4.2, §5.2, §10, §11, §12 and OD-1; §4.3 an expired session pass gives way to an active kept pass; §4.3 the v1 pass shape is frozen; §11 notes for later rows and the three PR sizes. Not taken: applying a waiting service-worker update on browse boot (§4.12 keeps updates out of Browse; the frozen pass shape removes the risk that prompted it).
- 2026-10-12: Codex review of #393 and #394. Applied: the keep switch keeps only an active pass (§4.3, §10 `pass.test.ts`, `keptPassFor`); "What this teaches" reads every game scope, not only card pairs and Build a Letter syllables (§10 `facts.test.ts`, §11 note; §4.6 unchanged, it already said "from the step scopes"); lessons go through F-ENT-003's adapter `browseQuestOpen`, never `isQuestOpen` directly (§4.2, §4.13, §10, §11 BR-4 row and note, §12), which BR-4 now calls because E3-2 (#390) merged first; [ See plans ] uses `APP_ROUTES.billing`, the path F-BILL-002 settled on, instead of a `BILLING_PATH` that does not exist (sibling table, §4.2, §12).
- 2026-10-12: two reviews of BR-4 and these notes (#393, #394), and F-ENT-003 §6.4. Applied: both F-ENT-003 §6.4 lines for this spec. BD6, §4.2, §4.13 and the sibling table read the effective switch `gatingActive(flags, bundleOs())` through `browseQuestOpen` and `isContentLocked`, never the raw flag; the gate rule is `accessTier` only (E3-2 merged). The closed wording follows F-ENT-003 §3.11 and OD-6 (§4.2, §4.6, §6, §7, §10, OD-2, the `browse/home`, `browse/item` and `browse/episode` wireframes): learner visuals keep the learner's dotted ring and "Not open yet" (`learner.access.notOpen`, by reference), never a lock glyph; the grown-up caption is "Opens with the Family Plan or a Group License" [BY] (a new `caregiver.browse` key; "Opens with the full route" and `learner.access.quest.closedCaption` are gone, since that key does not exist and "route" is never an access word); [ See plans ] is [ Open billing ] (§4.2, §6, §8, §9, §10, §12; the event `browse.plans_tapped` keeps its name). §4.3 gate hand-off step 2: an active kept pass decides when the gate pass expires. §4.5: Library groups in the learner registry order (Cards, Story Time, Culture, then Words in the `theme-packs` slot), an empty group left out, found culture notes not shown (learner state). §4.6: words from every Discover item (a letter's example word too); "Where it sits" for a shelf story's quest is the story's home cell. §4.10: three more forbidden stores, imports resolved by path, wrapped imports read. §4.2 and §11: a story quest and its episode follow `storyLockFor` (a Stage 5 book stays closed for a sampler). §10 and §11 notes for the BR-4 fixes (required bundle, `QuestPlace` kinds, later cells, Library groups, Listen & Pick by builder, future `seen`). Not taken: walking `screens/browse/**` transitively for store imports (the reused learner renderers import stores by design; the ports, fences and e2e key-set check guard them, BD3).
