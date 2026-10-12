Status: ready

# F-BROWSE-001 — Browse lessons: paying parents and teachers see every lesson the way a learner does

**Scope**: `packages/content-schema` (`schemas/browse.ts`: targets, fragment codec, hand-off messages, access response; 5 telemetry names) · `packages/backend` (`GET /api/entitlements/browse`, `accountBrowseScope` in `lib/entitlement.ts`) · `apps/mobile` (a third root of the learner web build at `/browse`: `BrowseApp`, `screens/browse/`, `logic/browse/`, `platform/browse(.web).ts`, a storage write fence and a telemetry fence in `platform/`, small extractions from `QuestPlayerScreen`, `JourneyScreen`, `CardDetailView` and four romanization call sites; one button on the in-app grown-up dashboard) · `apps/web` (console entry button and hand-off `lib/console/browse-link.ts`, deep links from the plan builder and the roster revisit chips) · `packages/i18n` (`caregiver.browse`, `console.browse`) · wireframes `design/wireframes/browse/*.md`
**Owner**: solo dev
**Rollout**: Web PWA only (the primary channel). Behind no flag on the learner side (the root is unreachable until an entry point links to it); the console entry ships with BR-10. Stripe stays in sandbox; no price appears on any surface this spec adds. PR order in §11.

Parent / siblings: owner request of 2026-10-11, item 14 ("paying parents and teachers also get a separate section where they can browse the whole learning content exactly as the learner sees it, so they know what the students learn") · F-TCH-004 (the presenter: a second root of the learner build, `postMessage` hand-off from the console, isolation test; this spec copies those patterns and adds a third root) · F-ENT-001 (entitlements, coverage rules) · F-STORY-004 §3.9 (`logic/content-access.ts`, the single free-content registry) · F-STORY-002 §3.1 (the story reader's replay mode, which writes nothing) · F-QUEST-002 §3.12 (`MinigameHost`, `HostMode` already includes `'preview'`) · F-VOC-003 (topic page and flashcards) · F-ROUTE-001 §3.12 (grown-up views of the route) · F-PLAN-001 (plan builder) · F-I18N-001 (locales, `KoreanText`, rule 5) · F-LAYOUT-001 (portrait guard, panes).

Sibling specs written the same day from the same owner request (their F-ids are filled into this file by BR-0b once each merges; until then they are named by branch): the **persona app shell** (`docs/persona-app-shell`: adult sign-in and persona homes on app.hangulroute.com), **progress reports** (`docs/progress-reports`: parent and teacher reports with "went well / needs work"), **LEARNING ROUTE** (`docs/learning-route`: the renamed whole-route map), **billing in the app for every persona** (`docs/billing-in-app-all-personas`), **free plan to about day 2 and unlocked curriculum** (`docs/free-day2-unlocked-curriculum`), **feedback channel** (`docs/adult-feedback-channel`), **layered marketing site** (`docs/marketing-site-layered`).

---

## Decisions

Standing rules this spec implements (CLAUDE.md and owner): audience is anyone, any age, so no age wording on shared surfaces; child safety (parent gate, no ads, local-first, no child data leaves its place); anti-shame (no ranking, no learner-vs-learner comparison, no red X, meters only fill); UI strings through `packages/i18n` (English default, Korean and Spanish behind the review gate); design tokens only; no emoji; reading, listening and writing focus, speaking neither measured nor shown; Stripe Live, real prices and commercial claims stay off; no student name in any URL; D1 migrations additive only (this spec adds none); `CLASS_TRANSFER` stays off (this spec never touches it).

Decisions taken in this spec (BD = browse decision):

| # | Decision | Why |
|---|---|---|
| BD1 | **Browse is a third root of the learner web build at `app.hangulroute.com/browse`, chosen in `index.ts` before `App` mounts**, next to F-TCH-004's `/present`. `BrowseApp` hydrates only the audio settings and the device locale; it never calls `hydrateLearnerData`, never starts sync, the inbox or the plan derivation. | The lesson renderers (quest player, Discover, the 13 games, the story reader, card art, Hoya, stroke hint, audio) exist only in the learner bundle. A separate document means a browsing adult runs none of the learner boot (`App.tsx:36-86`), and no learner's profile is ever in memory. |
| BD2 | **The lessons are the learner's own renderers; the catalogue around them is adult-shaped.** Browse home reuses the learner Journey grid (drawn with every shipped cell open and nothing done), the story shelf tiles and the card art. Episode and item pages are new and say what each lesson teaches. Inside a lesson nothing differs from the learner's view except a preview strip on top and the end screen. | "Exactly as the learner sees it" matters where the learning happens. Around it, an adult needs answers a learner screen does not give: which letters, which words, which skills, how long, which card, where it sits on the route. |
| BD3 | **Preview never writes learner data, by construction and by fence.** (1) No learner store is hydrated (BD1). (2) The quest player runs with preview ports that start no session, record no result, award no card, and finish on a preview end screen instead of Results. (3) A storage write fence in `platform/storage(.web).ts` drops every write outside an allow-list. (4) A telemetry fence drops every event whose name is not a `browse.*` name. (5) A source-scan test forbids learner-store imports in browse code. | Defence in depth: one layer failing (a future game that writes, a refactor that forgets a port) still cannot reach a learner's record, a report, a streak or a card collection. |
| BD4 | **Access comes from a browse pass, never from a learner's tier.** Scopes: `full` (play every shipped lesson), `sampler` (play what a free learner can play; outline of the rest), `none` (an explanation and a way to sign in). The server decides the scope for an account (`GET /api/entitlements/browse`, §5.2); the console hands the pass to the browse tab by `postMessage` (§4.3). | The browse root has no Clerk session and must work offline once open. The server stays the source of truth for "is this adult paying"; the hand-off carries only the scope and an expiry. |
| BD5 | **The pass is client-trusted and unsigned** (owner decision OD-11, default). | Every lesson is already in the public learner bundle and playable by any learner today (`isStagePlayable = () => true`, F-ROUTE-001 OD-4); the learner tier itself is client-trusted with a 7-day grace (F-ENT-001). A signature would protect nothing that the bundle does not already give away. If lessons are ever delivered from the server, the pass becomes signed (§15). |
| BD6 | **Free adults get the sampler** (OD-2, default): they preview exactly what a free learner can play and see the outline (title, what it teaches, minutes, card) of everything else. The sampler is computed through the existing free-content registry, so when the free-plan sibling spec moves the boundary to "about day 2", browse follows with no change here. | A parent on the free plan should see the same boundary their child sees; the outline still answers "what will my child learn" (the owner's reason for item 14). |
| BD7 | **Deep links carry content ids only, in the URL fragment, and are stripped on load.** Reports, the Learning Route and the plan builder link with `#t=<target>&s=<source>`; a target is a stage key, an episode, quest, story, vocabulary topic, card or letter id, or one compatibility jamo character. No learner id, name, alias or summary value is ever part of a link. | A link from "needs work: ㄱ" must open the lesson that teaches ㄱ without saying whose report it came from. A fragment never reaches a server; `history.replaceState` removes it from the address bar (the F-TCH-004 §3.2 pattern). |
| BD8 | **The in-app grown-up gate is a second way in** (OD-5, default on, web only): on the learner app, after the PIN, the parent dashboard offers "Browse all lessons". It writes a one-time gate hand-off that lives until the gate session ends (at most 15 minutes, `PARENT_SESSION_MS`, `logic/profiles/session.ts:9`) and is deleted when the browse root reads it. | Many families use only the learner app. The PIN proves a grown-up; the device's cached tier proves coverage. A child who finds the tab later finds the hand-off gone. |
| BD9 | **No stars, no score, no card on the preview end screen.** It says what a learner gets at that point (stars from one to three, and the named card) and offers Preview again, the next lesson, or back to the outline. | An adult deliberately trying wrong answers must not be graded, and nothing must look earned. |

---

## 1. Context

Parents and teachers who pay want to know what their learners are learning (owner, 2026-10-11). Today they cannot see it:

- The grown-up console (`apps/web`, `/teach/*`) lists spaces, rosters, plans and billing. The only content it knows is ids and titles: the hand-kept Stage 1 catalogue (`apps/web/src/data/stage1-catalog.ts`) and the generated lecture catalogue (`apps/web/src/data/lecture-catalogue.generated.ts`, titles and ids). It cannot render a lesson.
- The web `/parent` pages are a demo on sample data (`apps/web/src/data/mock-family.ts`).
- The in-app parent dashboard (`apps/mobile/src/screens/parent/ParentDashboardScreen.tsx`, behind the PIN) shows lifetime counts per local profile, not content.
- The only way for an adult to see a lesson is to play it on a learner profile, which writes that learner's progress, earns cards and counts toward streaks and the roster summary.

Facts verified against `origin/main` at `ea9049e4` (2026-10-11):

**The learner bundle holds all content and every renderer**

- Content: `apps/mobile/src/content/index.ts:1-5` exports jamo, stages, heritage cards, episodes and quests; stories (`content/stories.ts`, `storyById :19`), vocabulary (`content/vocab.ts:5`, `vocabTopics`, `topicItems`), stroke skeletons (`content/jamo-strokes.ts`). Ids: `episode:<slug>`, `quest:<slug>` (`quests.ts:16`), `card:<slug>` (`schemas/heritage-card.ts:42`), `story:<slug>` (`schemas/story.ts:47` `StoryIdSchema`), `vocab-topic:<slug>` (`schemas/vocab.ts:136`), `jamo:<slug>` (`schemas/jamo.ts:12`); F-TCH-004 already exports the matching regexes from `schemas/lecture.ts:52-88`.
- Stage metadata a grown-up wants is already authored: `stages.ts:7-60` (`oneLinerEn`, `anchorSkillEn` per stage), episode `titleEn`, `subtitleEn`, `hoyaIntroEn`, `estimatedMinutes`, `status` (`schemas/episode.ts:16-31`), quest `titleEn` and `estimatedMinutes` (`schemas/quest.ts:52,84`).
- What a quest teaches: `questTeaches(quest)` lists the jamo its Discover step introduces and `teachingQuestFor(jamoId)` finds the quest that teaches a symbol (`logic/stage1/curriculum.ts:23-38`); `questJamo` maps quests to characters (`content/sync-context.ts:25`); `questSkills` maps a quest's games to read / listen / write and never to speaking (`logic/my-route/skills.ts:11-44`).
- Free content: `logic/content-access.ts:14-52`, `FREE_STAGE_KEYS = ['stage1']`, `FREE_VOCAB_TOPIC_IDS`, sampler stories, `isFreeContent(kind, id)`. Story and topic locks are off (`flags.contentGatingEnabled` false, `config/flags.ts:63,91`). Speaking games are off (`voiceEchoEnabled: false`, `config/flags.ts:87`).

**Where the learner screens write**

- `QuestPlayerScreen.tsx:60-77` calls `beginSession` / `endSession` on `progress-store` for the active profile and reads story bookmarks; `finishQuest` resets to `Results` (`:113-126`), and `ResultsScreen.tsx:77-80` records the quest, unlocks cards and records catch-up.
- The games report answers to `quest-run-store` (`store/quest-run-store.ts`), which is memory only (no persistence). `MinigameHost` (`screens/minigames/host.ts:10`) already defines `HostMode = 'quest' | 'check' | 'review' | 'vocab' | 'preview'`.
- With no active profile, the games and Discover fall back to `romanizationMode: 'always'` (`DiscoverStep.tsx:88-91`, `ListenPickGame.tsx:82-85`), and the story bookmark hook writes nothing (`use-reader-bookmark.ts:24-35`, `bookmarkTarget(null)`).
- The story reader's replay route writes nothing (`StoryReaderScreen.tsx:14-21`).
- Telemetry: `platform/telemetry.ts` `track()` sends any named event with an optional `profileId`; the Worker accepts only names in `TELEMETRY_EVENT_NAMES` (`packages/backend/src/routes/telemetry.ts:63`).
- Storage: `platform/storage.web.ts:21-27` `writeJson` / `removeKey` (IndexedDB, `hr:` prefix) is the only write path.

**Roots, offline and the console**

- `apps/mobile/index.ts` registers `App` only; F-TCH-004 PR 6 (not merged) adds the presenter root switch. The service worker precaches every built file and serves `/index.html` for any navigation (`scripts/pwa-postbuild.mjs:95,104`), so `/browse` loads offline once the app has been opened online; `skipWaiting: false` (`:106`).
- The console derives the learner app origin from `appUrl()` (`apps/web/src/lib/console/config.ts:68-82`); its header has a Billing button (`components/console/ui.tsx:101`). `GET /api/entitlements` lists the account's rows and those of spaces it owns (`packages/backend/src/routes/entitlements.ts:39-48`); coverage rules are `tierFromSpaces` and `classIsPro` (`packages/backend/src/lib/entitlement.ts:26-31,97-105`); roles per space kind are in `lib/can.ts:37-46`.
- The device tier is per learner, from the inbox with a 7-day grace (`store/tier-store.ts:56` `effectiveTier`).

## 2. Goals and non-goals

**Goals**

1. A paying parent or teacher can open every shipped lesson (quests, stories, vocabulary topics, cards) and play it exactly as a learner sees it.
2. Each lesson has a short "what this teaches" page: letters, words, skills (read, listen, write), minutes, the card it awards, where it sits on the route.
3. Nothing an adult does in Browse changes any learner's progress, cards, streak, plan readout, report or roster summary, on any device.
4. Reports, the Learning Route and the plan builder can open the exact lesson behind what they show (a needs-work letter opens the lesson that teaches it).
5. Free adults see the free plan's lessons in full and the outline of the rest; signed-out visitors see how to get in.
6. It works offline once open, in English, Korean and Spanish UI, with no child data in it.

**Non-goals**: authoring or editing content; assigning lessons (plans stay in the plan builder, F-PLAN-001); live view of a child's screen; scoring the adult; a search engine (a later phase, §14); native apps (OD-10); the level check (F-PLC-001) and review tests (F-RVW-001, not built) as browsable items.

## 3. User stories

> As a parent who bought the family plan, I want to open the lesson my child did today and play it myself, so I can talk about it at dinner, without changing my child's progress.
>
> As a teacher, I want to see what Stage 1 covers letter by letter before I plan the term, and to open the exact lesson behind "needs work: ㄴ" in my class report.
>
> As a parent on the free plan, I want to see what the free lessons are and what the rest of the route holds, before I decide anything.
>
> As a family that only uses the app on one tablet, I want to look through the lessons from the grown-up area after the PIN, without a separate account.

## 4. Detailed behaviour

### 4.1 Surfaces and routing

- **Root.** `apps/mobile/index.ts` registers `pickRoot(location)` from `platform/app-root(.web).ts`: `'presenter'` for `/present` and `/present/…` (F-TCH-004), `'browse'` for `/browse` and `/browse/…`, else `'learner'`. Native stub returns `'learner'`. Whichever of F-TCH-004 PR 6 and BR-6 lands first creates `app-root`; the other adds its branch (one line and one test case).
- **`BrowseApp`** mounts `GestureHandlerRootView`, `SafeAreaProvider`, `QueryClientProvider` (unused today, kept for parity), the error boundary (`OopsScreen`), `PortraitGuard` (the same phone-sideways rule as the learner app, F-LAYOUT-001 §3.4), its own native stack (`navigation/browse.tsx`, no tabs), and `PreviewFrame` (§4.7) around every screen. It does **not** mount `PwaBanners`, never calls `hydrateLearnerData`, `syncAll`, `registerInboxRefresh`, `rederiveAllLocal`, `setProgressPersistListener` or `bindAudioLevelToProfiles`. On boot it hydrates `audio-store` (mute, capability) and the device locale, applies the fences (§4.10), installs the audio gesture unlock, and calls `flushQueue()` for its own events.
- **Stack** (`BrowseStackParamList`): `BrowseHome { section?: 'journey' | 'stories' | 'words' | 'cards' }`, `BrowseEpisode { episodeId }`, `BrowseItem { kind: 'quest' | 'story' | 'vocab-topic'; id: string; focusJamoId?: string }`, `PreviewQuest { questId, episodeId }`, `Minigame` (the learner `MinigameScreen`, unchanged params), `StoryReader` (the learner replay route), `StorySources`, `CardDetail { cardId }` (modal), `PreviewEnd { kind, id, episodeId? }`, `BrowseAccess { reason }`.
- **Unknown path** under `/browse/…` shows Browse home. `document.title` is the fixed `caregiver.browse.documentTitle` ("Hangul Route lessons"), never an item title that could hint at a report.
- **Exit.** The header's [ Exit preview ] runs `window.close()` when the tab was opened by script (`window.opener` present), otherwise `location.assign` to the learner app root (`/`) for the gate source or to the console URL for the account source.

### 4.2 Who can open it: scopes

`BrowseScope = 'full' | 'sampler' | 'none'`.

- **Server rule** (`accountBrowseScope(db, accountId, now)` in `packages/backend/src/lib/entitlement.ts`, pure over the db reads): collect every live (not archived) space in which the account holds a membership with role `owner`, `caregiver`, `teacher` or `admin` (`db.membershipsOf('account', id)`). The scope is `full` when any of them is covered:
  - a family with an active `family_lifetime` (`tierFromSpaces`);
  - a class with its own active `group_license`, or under a school with an active `group_license` or `school_seat` (`classIsPro`);
  - a school with an active `group_license` or `school_seat` (a school admin);
  - or the account itself holds any active entitlement (legacy account-subject rows).
  Otherwise the scope is `sampler`. A signed-in adult with no space at all is `sampler`. `isEntitlementActive` (past-due grace, cancelled until expiry) applies unchanged.
- **Gate rule** (in-app, BD8): `full` when any profile on the device has `effectiveTier(profileId, now).tier === 'premium'`, else `sampler`.
- **No pass**: `none`.
- **What each scope may do** (`logic/browse/access.ts`, `itemAccess(item, scope, registry)`):

| Item | `full` | `sampler` | `none` |
|---|---|---|---|
| Quest (and its episode) | play | play when the free-content registry says a free learner can play it, else outline | nothing (Access screen) |
| Story | play | play when `isFreeContent('story', id)`, else outline | nothing |
| Vocabulary topic | play | play when `isFreeContent('vocab-topic', key)`, else outline | nothing |
| Heritage card | view front and back | view front and back (OD-7) | nothing |
| Episode or stage marked `preview` / not shipped | outline "Coming later" | same | nothing |

  For quests the registry is asked with the quest's stage (`isFreeContent('stage', quest.stage)`) until the free-plan sibling spec adds its quest-level kind to `content-access.ts`; `itemAccess` then calls that kind, and this table does not change. `flags.contentGatingEnabled` is **not** consulted: the sampler is about the adult's pass, not about learner gating.
- **Outline** means the item page with everything except the [[ Preview this lesson ]] button, which is replaced by the line "Included with a plan" and [ See plans ] (the app-host billing URL from the billing sibling spec; until it lands, `appUrl()`-relative console billing). No price, no "upgrade" pressure words (caregiver banned list), no countdown.

### 4.3 The browse pass

```ts
// apps/mobile/src/logic/browse/pass.ts (pure; injected clock and storage port)
interface BrowsePass { v: 1; scope: 'full' | 'sampler'; source: 'account' | 'gate'; expiresAt: string; uiLocale?: UiLocale }
```

**Account hand-off (console tab → browse tab)**, the F-TCH-004 §3.2 protocol with a different payload:

1. **Console** (`apps/web/src/lib/console/browse-link.ts`): the entry button (§4.11) first ensures `browseAccess` is loaded (`GET /api/entitlements/browse`, cached for the page). On click it runs `const w = window.open(url, 'hr-browse')` (a named window, so repeated clicks reuse one tab; no `noopener`). `url = ${appUrl()}/browse#${encodeBrowseFragment({ target, source })}`. A blocked pop-up shows "Allow pop-ups for this site to open lessons" and a plain link (the link opens Browse without a pass, which shows the Access screen's "Open from your account" line). If `GET /api/entitlements/browse` fails (network or 5xx), the button still opens Browse and the console answers with a `sampler` pass, showing beside the button "Could not check your plan. Showing free lessons." with [ Try again ] (fail closed to the free set, never to `full`).
2. **Browse** (`platform/browse.web.ts` `announceReady`): on load and on every `hashchange`, when `window.opener` exists, posts `{ ns: 'hangul-route.browse', v: 1, type: 'ready' }` to `window.opener` once per allowed origin (`BROWSE_PASS_ORIGINS`, §5.1, plus the build-time `EXPO_PUBLIC_CONSOLE_ORIGINS` list, bare origins only, F-TCH-004 amendment 7). It waits up to 3 s for a pass before rendering the Access screen; a pass arriving later replaces it.
3. **Console** answers only when `event.origin === new URL(appUrl()).origin`, `event.source === w`, and the message parses with `BrowseReadyMessageSchema`: `w.postMessage({ ns, v: 1, type: 'pass', scope, expiresAt, uiLocale }, appOrigin)`. `expiresAt = now + 7 days`. `targetOrigin` is the exact app origin, never `'*'`. When the account's scope is `sampler`, the console still sends a pass (scope `sampler`).
4. **Browse** accepts a pass only when `event.source === window.opener`, the origin is allowed, it parses with `BrowsePassMessageSchema` (strict), and `expiresAt` is in the future and at most 7 days and 1 hour ahead. Anything else is ignored silently (no error UI, no telemetry of the payload).
5. **Where it lives.** By default the pass is held in memory for the life of the tab (a reload re-announces and the console tab, if still open, answers again). The Browse home footer offers a switch, off by default: "Keep lessons on this device for 7 days, also offline" (OD-4). When on, the pass is written to `browse:pass`; turning it off, or [ Exit preview ] with "Forget this device" ticked, removes the key. An expired stored pass is removed on read.
6. **Same origin.** If the persona app-shell spec serves the console on `app.hangulroute.com`, the opener and the browse tab share an origin; the protocol is unchanged (origin checks still pass). If that spec moves adult sign-in into the Expo app itself, the pass is produced in-process by the same `issueBrowsePass(scope, now)` function and the root switch becomes a navigator branch; screens, fences and tests here do not change.

**Gate hand-off (learner app → browse, same tab)**

1. After the PIN, the parent dashboard shows [ Browse all lessons ] on web only (`Platform.OS === 'web'`). Pressing it writes `browse:handoff` `{ v: 1, scope, source: 'gate', expiresAt: <gate session end, at most now + 15 min> }` and runs `location.assign('/browse#s=gate')`.
2. `BrowseApp` reads `browse:handoff` once on boot, **deletes it immediately**, and holds the pass in memory until `expiresAt`. A reload after that finds nothing and shows the Access screen with "Open Browse again from the grown-up area".
3. When the gate pass expires during a preview, the current lesson continues to its end; the next navigation shows the Access screen.

**Access screen** (`BrowseAccess { reason: 'none' | 'expired' | 'waiting' }`): "Browse lessons is for grown-up accounts." with [ Sign in ] (the adult sign-in URL from the persona app-shell spec; until it lands, `${consoleUrl}/teach`) and "On a family tablet, open it from the grown-up area of the app." No lesson, title or card is shown.

### 4.4 Deep-link targets and the fragment

```ts
// packages/content-schema/src/schemas/browse.ts
type BrowseTarget =
  | { kind: 'stage'; stage: StageKey }
  | { kind: 'episode'; id: string }      // /^episode:[a-z0-9-]+$/
  | { kind: 'quest'; id: string }        // /^quest:[a-z0-9-]+$/
  | { kind: 'story'; id: string }        // StoryIdSchema
  | { kind: 'vocab-topic'; id: string }  // LECTURE_VOCAB_TOPIC_ID_RE
  | { kind: 'card'; id: string }         // /^card:[a-z0-9-]+$/
  | { kind: 'jamo'; id: string }         // LECTURE_JAMO_ID_RE
  | { kind: 'char'; char: string };      // LECTURE_REVISIT_CHAR_RE: one compatibility jamo, as ProgressSummary.needsPractice holds it
type BrowseSource = 'nav' | 'report' | 'route' | 'plan' | 'roster' | 'gate' | 'direct';
```

- **Fragment** `#t=<target>&s=<source>`. Content ids already start with their kind, so an id target is written as the id itself (`t=quest:stage1-letters-q1`, `t=jamo:nieun`, `t=vocab-topic:food`); the two others are `t=stage:stage1` and `t=char:<encodeURIComponent(char)>` (`t=char:%E3%84%B4` for ㄴ). The source is `s=<BrowseSource>`; `t` may be absent (Browse home). `encodeBrowseFragment` / `decodeBrowseFragment` are pure, total and reject anything else (`{ ok: false, reason: 'empty' | 'bad_target' | 'bad_source' | 'too_long' }`, at most 256 characters). The regexes are imported from `schemas/lecture.ts` and `schemas/story.ts`, not copied.
- **On load** the browse root reads the fragment, then calls `history.replaceState(null, '', '/browse')` before first paint. A bad fragment opens Browse home (no error page) and nothing is logged beyond `browse.opened { source: 'direct' }`.
- **Resolution** (`logic/browse/target.ts`, `resolveTarget(target, bundle)`, pure over an injected bundle):
  - `stage` → `BrowseHome { section: 'journey' }` scrolled to that stage row;
  - `episode` → `BrowseEpisode`; `quest`, `story`, `vocab-topic` → `BrowseItem`; `card` → `CardDetail` over Browse home (Cards);
  - `jamo` → `teachingQuestFor(id)`; found → `BrowseItem { kind: 'quest', id, focusJamoId: id }`; not found (a batchim or a letter no shipped quest teaches yet) → Browse home (Journey) with the note "This letter is practiced across Stage 1.";
  - `char` → the jamo whose `char` matches and whose `kind` is not `batchim` (the F-TCH-004 §3.3 rule 3 lookup), then as `jamo`;
  - an id the bundle does not know → Browse home with "This lesson is not in this version of the app yet." (a newer console can link to content an older cached app lacks).
- **Access applies after resolution**: a `none` scope always lands on the Access screen; a sampler outline item opens its item page in outline form.

### 4.5 Browse home

One screen with a section switch (wireframe `browse/home.md`): **Journey**, **Stories**, **Words**, **Cards**, in the learner app's order. Every section is the learner's own visual, in the browse state (every shipped item open, nothing done, no stars, no "new" sparkle, no locks drawn on learner visuals; sampler outline items carry a small "Outline" tag drawn by browse, never a lock).

- **Header**: [ Exit preview ] (left, the one fixed back position), title "Browse lessons", [ Show as ] (§4.9). Under it the scope line: full "All lessons are open to preview." / sampler "Free lessons open to preview. Others show what they teach." Then the preview strip (§4.7).
- **Journey**: a short route intro (the seven stages in order, one line each from `stages.ts` `oneLinerEn`, localised; shipped / "A taste" / "Coming later" as the Journey shows them), then the grid from `JourneyGrid` (extracted from `JourneyScreen`, BR-5) with cell state `open` for every cell that has a shipped episode, `later` otherwise. A cell → `BrowseEpisode`. On regular and wide windows the grid and the episode outline sit in two panes as the learner Journey does (F-LAYOUT-001 §3.7).
- **Stories**: the story shelf tiles (`StoryTile`) for every entry of `defaultStoryIndex()` (the review gate of F-STORY-004 applies; the dev-only unreviewed widening is not honoured), grouped as the Library groups them (`library-sections.ts`). A tile → `BrowseItem { kind: 'story' }`.
- **Words**: one row per vocabulary topic (`vocabTopics`): topic title in the UI language, word count, three sample words (`KoreanText`, romanization, gloss). A row → `BrowseItem { kind: 'vocab-topic' }`.
- **Cards**: the gallery of every heritage card, all face up (no silhouettes, no "earn" hints). A card → `CardDetail` in preview state (§4.7).
- **States**: loading (one frame while the pass resolves; the 3 s "waiting" line after 1 s), Access (no pass), offline (works; a quiet "Offline" chip), a stage or section with nothing shipped shows "Coming later" rows, never an empty screen.

### 4.6 Episode outline and item page

**Episode outline** (`browse/episode.md`): episode title, subtitle and Hoya's intro line as the learner episode page shows them; "About N minutes" (sum of quest `estimatedMinutes`); then the quests in `questIds` order. Each quest row: title, the letters it introduces (`questTeaches`, `KoreanText` chips with romanization), skills chips (read / listen / write from `questSkills`; speaking is never listed), minutes, and [ Open ] → `BrowseItem`. A story episode lists its stories instead. Reward cards of the episode as thumbnails (tap → `CardDetail`). An episode with `status: 'preview'` or no quests reads "Coming later" with no rows to open.

**Item page** (`browse/item.md`), one template for quest, story and topic:

- Title, kind label ("Lesson", "Story", "Words"), "About N minutes".
- **What this teaches** (`logic/browse/facts.ts`, `itemFacts(item, bundle)`):
  - quest: letters introduced (from Discover), syllables and words practiced (from the step scopes: `scope.syllables`, `scope.cardPairs`, Discover `word` items), each with romanization and a gloss in the UI language; skills; the step list as the learner sees it in the player's progress dots ("Meet the letters", "Practice", "Check", "Card"), named by `questStepLabel`;
  - story: level(s) offered, number of scenes, key words (`{kw:}` tokens resolved through F-STORY-001), the Sources link (`StorySources`);
  - topic: every word with romanization, gloss and picture (`PictureArt`).
- **On the Learning Route**: "Stage 1 · Letters · lesson 2 of 3" (stage, theme, position in the episode) with [ See on the route ] → Browse home Journey at that cell.
- **The card it awards** (quest: `rewardCardId`): thumbnail and title.
- **Focus line** when opened for a letter (`focusJamoId`): "Taught here: ㄴ (n)" at the top, the chip highlighted in the letters row.
- **Primary action** [[ Preview this lesson ]] (play scope) → the preview player; outline scope shows "Included with a plan" and [ See plans ] instead (§4.2).
- Secondary: [ Present this ] when the presenter root exists (F-TCH-004 PR 6) and the scope is `full`: builds a one-block deck (`{ kind: 'quest' | 'story' | 'vocab', … }`, `source: 'catalogue'`, title = the item title when it passes `LECTURE_TITLE_RE`, else the English title) and opens `/present#d=…` in a new tab; no picker (`picker: null`).

### 4.7 Preview mode: playing a lesson as the learner sees it

- **Preview strip** (`PreviewFrame`): a slim strip on top of every browse screen, including inside games: "Preview. Nothing is saved." and, inside a lesson, [ Leave preview ] (returns to the item page). It is not dismissable, sits outside the lesson's own layout (the lesson's own header and close control keep their positions), uses an existing neutral surface and text token pair (no new colour), and is announced once per screen to screen readers (§7).
- **Quest**: `PreviewQuestScreen` renders `QuestPlayerView` (extracted from `QuestPlayerScreen` in BR-5; the learner screen becomes the view plus learner ports, with no behaviour change) with **preview ports**:

```ts
interface QuestPlayerPorts {
  start(questId: string, episodeId: string): number;   // returns the start step; learner: questStartStep + beginSession; preview: 0, no session
  end(): void;                                          // learner: endSession; preview: nothing
  finish(outcome: QuestOutcome): void;                  // learner: reset to Results; preview: replace with PreviewEnd
  leave(): void;                                        // learner: episodeReturn; preview: back to BrowseItem
  track(event: TelemetryEvent): void;                   // learner: platform track; preview: nothing (the fence would drop it anyway)
}
```

  `quest-run-store` is used as it is (memory only, in this separate document) and reset on leave and on finish. Every step kind runs as in the learner app, including Discover (romanization from §4.9), the Check, the games (the nine that call `quest-run-store`, and Listen & Pick / Pic-Word Match through their host in mode `'preview'`), and story steps (`StoryReadGame` gets no profile, so no bookmark is read or written). Speaking games follow the learner flag (`voiceEchoEnabled`, off at launch): when off, the step is skipped exactly as the learner app skips it (OD-12).
- **Story**: the learner `StoryReader { mode: 'replay' }` route, unchanged (it writes nothing), opened at scene 0 of the level the adult picks on the item page (default: the lowest level the story has). Story checks and the order game are previewed through the story's quest when the item page offers [ Preview the questions ] (a `PreviewQuest` of the story quest).
- **Vocabulary topic**: until F-VOC-003's topic page and flashcards ship, the item page's word list is the preview (every word with audio through `playPrompt`, romanization, gloss, picture). When they ship, [[ Preview this lesson ]] opens the F-VOC-003 flashcards with the `MinigameHost` in mode `'preview'` (answers counted in memory only; the vocabulary progress slice of F-VOC-005 is never written).
- **Card**: `CardDetail` renders `CardDetailView` with `state: 'preview'` (BR-5 adds the prop): front and back as an earned card looks, no "earned on" date, no earn hint, no share action (F-CARD-003 share writes nothing, but a shared image of an unearned card would look earned).
- **Audio** is the learner's (F-AUDIO-004 public surface; the first tap unlocks audio). Mute writes `device:audio`, the device-wide mute (F-AUDIO-004 AD7), the same trade-off F-TCH-004 §8 records.
- **Errors**: a lesson that fails to render shows the learner `OopsScreen` with [ Back to the lesson page ]; nothing is retried automatically.

### 4.8 Preview end

`PreviewEnd { kind, id, episodeId? }` (`browse/preview-end.md`) replaces the learner Results screen:

- "That is the whole lesson." and Hoya (`cheering` pose, as Results).
- "At this point a learner sees 1 to 3 stars and collects:" + the card thumbnail and title (quest with `rewardCardId`); a story: "A learner can read it again any time."
- No stars, no score, no accuracy, no card animation, no "new card" banner (BD9).
- Actions: [[ Next lesson ]] (the next quest in the episode, else the first quest of the next shipped cell, else hidden), [ Preview again ], [ Back to the lesson page ].
- Leaving a preview early ([ Leave preview ] or the lesson's own close and its confirm) returns to the item page without the end screen.

### 4.9 "Show as" and language

A bottom sheet from the header (`browse/show-as.md`), memory only for the tab unless the keep switch (§4.3) is on, in which case it is stored in `browse:prefs`:

- **Romanization**: (o) always shown / ( ) hidden until tap. Applied through the new `useRomanizationMode()` hook (BR-5) that returns the browse setting under `BrowseSettingsProvider` and the active profile's setting elsewhere; the four call sites that read `useLocaleStore().byProfile[activeId].romanizationMode` today (`DiscoverStep.tsx:88`, `ListenPickGame.tsx:82`, `PicWordMatchGame`, `StoryReaderView.tsx:173`) move to the hook.
- **Language**: English / Español / 한국어 endonym chips (the locales F-I18N-001 has shipped; hidden locales are not offered). Default: the pass's `uiLocale`, else the device locale. Changing it re-renders lessons in that UI locale (glosses through the content overlays, F-I18N-001 §3.6); the persisted device locale is not written.
- No level or age choice: lessons look the same for every learner (CLAUDE.md §1).

### 4.10 Never writes: isolation, storage fence, telemetry fence

- **Storage write fence** (`platform/storage.ts` and `.web.ts`): `setWriteFence(allow: ((key: string) => boolean) | null)`. While a fence is set, `writeJson` and `removeKey` for a key the predicate rejects resolve without touching storage and call the fence observer (a test seam; production observer does nothing; no `console.*`). `BrowseApp` sets `BROWSE_WRITABLE_KEYS`: `browse:pass`, `browse:prefs`, `browse:handoff` (removal only), `device:audio`, `telemetry:queue`. Reads are not fenced, but browse code reads only `browse:*`, `device:audio` and the device locale key (unit test: a `readJson` spy during boot and a full preview sees only those keys).
- **Telemetry fence** (`platform/telemetry.ts`): `setTelemetryFence(allow: ((name: string) => boolean) | null)`. While set, `track()` returns `false` for a rejected name before validation, notification, network or queueing. `BrowseApp` allows only `BROWSE_EVENT_NAMES` (§9). Learner events emitted by reused screens (`quest.check_completed`, `minigame.finished`, story events) are therefore never queued or sent from Browse.
- **Isolation test** (`logic/browse/__tests__/browse-isolation.test.ts`, source scan like F-TCH-004's): files under `screens/browse/**`, `logic/browse/**`, `navigation/browse.tsx`, `BrowseApp.tsx` and `platform/browse*` may not import `store/progress-store`, `profile-store`, `sync-store`, `plan-store`, `membership-store`, `tier-store`, `account-store`, `story-store`, `store/bootstrap`, `screens/results/*` or `screens/quest/QuestPlayerScreen` (they use `QuestPlayerView`). The gate hand-off writer lives in the learner app (`screens/parent/`) and is not under that scan. Failures name file and line.
- **What preview never does**, each pinned by a test (§10): start or end a session; record a quest, stars or accuracy; unlock or catch up a card; write a story bookmark; write vocabulary progress; touch homework or plan readouts; change `streakDays`, `minutesLast7d` or any `ProgressSummary` field; queue a sync; send any learner telemetry event; read any `progress:*`, `profile*` or `account*` key.
- **Reports and streaks**: preview cannot count toward them because both are computed from the learner's snapshot (F-SYNC-001 §3.4) and the snapshot is never written from Browse.

### 4.11 Entry points

All entries build the URL with `buildBrowseUrl(appUrl, { target?, source })` from `schemas/browse.ts` and, on the console, open it through `openBrowse()` (§4.3). Placement (wireframe `browse/entry-points.md`):

1. **Console header** (today's `ConsoleShell`, next to Billing, `ui.tsx:101`): [ Lessons ] → Browse home (`source: 'nav'`). When the persona app-shell spec lands, the same `BrowseEntryButton` sits in its adult navigation for parent and teacher homes; it is never in any learner navigation.
2. **Reports** (progress-reports sibling): every "needs work" and "went well" letter chip and every lesson row is a link: a letter → `{ kind: 'char', char }` (the report holds characters) or `{ kind: 'jamo', id }`; a lesson → `{ kind: 'quest', id }` (`source: 'report'`). The report spec owns the chip; this spec owns the target grammar and the open function.
3. **Learning Route, grown-up views only** (LEARNING ROUTE sibling, F-ROUTE-001 §3.12 R-9a console strip and R-9b in-app read-only page): each stage row gets [ Preview lessons ] → `{ kind: 'stage', stage }`, each cell row → `{ kind: 'episode', id }` (`source: 'route'`). The learner's own route view never shows these (a learner plays, not previews).
4. **Plan builder** (`/teach/space/plan`, F-PLAN-001): each item row gets a small [ Preview ] → `{ kind: 'quest' | 'episode', id }` (`source: 'plan'`).
5. **Roster revisit chips** (`/teach/space`, `classRollup().revisit`, up to three characters): each chip → `{ kind: 'char', char }` (`source: 'roster'`). The chip text stays the character; no learner name is attached.
6. **In-app grown-up area** (learner app, after the PIN, web only): [ Browse all lessons ] on the parent dashboard (`source: 'gate'`, §4.3).
7. **Never** from the marketing site, from any learner screen, from the paywall, or in an email.

A console entry is shown to every signed-in adult; a `sampler` account sees the same button (the sampler is still useful, BD6). The button carries no price and no "Premium" word.

### 4.12 Offline and the PWA

- Browse is the learner bundle, so it is precached with it (`pwa-postbuild.mjs:95`); `/browse` loads through `navigateFallback` (`:104`) after the app has been opened online once on that device. The persona app-shell spec's service-worker denylist (for console paths on the app host) must not list `/browse` (recorded in §12).
- With a pass in memory, a lesson keeps working when the network drops. With the keep switch on, Browse opens offline for 7 days. The console hand-off needs the console online.
- No update applies during a preview: Browse does not mount `PwaBanners` and never calls `__hrApplyUpdate`; a waiting update applies the next time the learner app's own banner applies it.
- The service worker's `navigateFallback` already serves `/browse` (no change to `pwa-postbuild.mjs`).

### 4.13 Free plan, subscribers and the registry

- The sampler is defined only through `logic/content-access.ts` (BD6). Browse adds no list of its own; `access.test.ts` asserts that `itemAccess` for every bundled item agrees with the registry.
- Subscribers' learners see everything unlocked (free-plan sibling spec); a `full` pass shows the same everything. Neither the learner's tier nor the learner's configured curriculum changes what Browse shows; Browse marks no "assigned" or "in your plan" state (that would need learner data).

### 4.14 Native apps

Browse is web only (OD-10). Native builds have no `/browse` root (`pickRoot` native stub), the in-app [ Browse all lessons ] button is hidden off web, and console links open the web app in the browser. A native Browse is a later phase (§14).

## 5. Data and API (additive)

### 5.1 `packages/content-schema/src/schemas/browse.ts` (exported from `src/index.ts`, appended)

```ts
export const BROWSE_MESSAGE_NS = 'hangul-route.browse' as const;
export const BROWSE_PASS_MAX_MS = 7 * 24 * 60 * 60_000;            // a pass lives at most 7 days
export const BROWSE_FRAGMENT_MAX = 256;
export const BrowseScopeSchema = z.enum(['full', 'sampler', 'none']);
export const BrowseSourceSchema = z.enum(['nav', 'report', 'route', 'plan', 'roster', 'gate', 'direct']);
export const BrowseTargetSchema = z.discriminatedUnion('kind', [ /* §4.4, every member .strict(), regexes imported */ ]);
export const BrowseReadyMessageSchema = z.object({ ns: z.literal(BROWSE_MESSAGE_NS), v: z.literal(1), type: z.literal('ready') }).strict();
export const BrowsePassMessageSchema = z.object({
  ns: z.literal(BROWSE_MESSAGE_NS), v: z.literal(1), type: z.literal('pass'),
  scope: z.enum(['full', 'sampler']),
  expiresAt: z.string().max(40).regex(LECTURE_CREATED_AT_RE),       // ISO date-time with a zone
  uiLocale: UiLocaleSchema.optional(),
}).strict();                                                         // no account id, email, space or learner field can ride along
export const BrowseAccessSchema = z.object({
  scope: z.enum(['full', 'sampler']),
  source: z.object({ kind: z.enum(['family', 'class', 'school', 'account']), spaceId: z.string().nullable() }).nullable(),
}).strict();
export const BROWSE_PASS_ORIGINS = ['https://hangulroute.com', 'https://www.hangulroute.com', 'https://app.hangulroute.com', 'http://localhost:3000'] as const;
export function encodeBrowseFragment(f: { target?: BrowseTarget; source: BrowseSource }): string;
export function decodeBrowseFragment(raw: string): { ok: true; target: BrowseTarget | null; source: BrowseSource } | { ok: false; reason: 'empty' | 'bad_target' | 'bad_source' | 'too_long' };
export function buildBrowseUrl(appUrl: string, f: { target?: BrowseTarget; source: BrowseSource }): string;   // `${origin}/browse#…`
```

`BrowseAccess.source` names a space id the account can already see on its own console (never a learner); the console uses it for one line ("Included with your family plan"). It is never put in the pass message.

### 5.2 Worker: `GET /api/entitlements/browse`

- Mounted on the existing `entitlementRoutes` (`routes/entitlements.ts`), so no `app.ts` change. `requireAccount`; returns `ok(c, BrowseAccess)` from `accountBrowseScope(db, account.id, new Date())` (§4.2). 401 for no session, as the other entitlement routes.
- Reads only: memberships, spaces, entitlements. No migration, no new table, no write. CORS unchanged (the console origins are already allowed, `lib/cors.ts`).
- The existing `GET /api/entitlements` is unchanged.

### 5.3 Device storage keys (all new, all without person data)

| Key | Shape | Written by | Lifetime |
|---|---|---|---|
| `browse:handoff` | `{ v: 1, scope, source: 'gate', expiresAt }` | learner app parent dashboard (after the PIN) | deleted by the browse root on first read; ignored after `expiresAt` |
| `browse:pass` | `BrowsePass` | browse root, only when the keep switch is on | removed on switch off, on "Forget this device", or when expired |
| `browse:prefs` | `{ v: 1, romanization: 'always' \| 'tap', uiLocale?: UiLocale }` | browse root, only when the keep switch is on | as `browse:pass` |

Corrupt values read as absent (`readJson` already returns `null` on bad JSON; the shapes are parsed with zod and dropped on failure).

### 5.4 Console client

`apps/web/src/lib/console/api.ts` gains `browseAccess(): Promise<Result<BrowseAccess>>` (lenient parse: an unknown `scope` reads as `sampler`). `lib/console/browse-link.ts` (pure parts unit-tested) holds `openBrowse(target, source)`, the window registry and the `ready` → `pass` answer.

## 6. i18n

- Browse chrome lives in `packages/i18n` `caregiver.browse` (grown-up surfaces in the learner app, F-I18N-001 §3.4 rule 2), one sub-object per screen group: `home`, `section`, `episode`, `item`, `facts`, `preview`, `end`, `showAs`, `access`, `keep`, `errors`, plus `documentTitle`. Console strings in `console.browse` (`entry`, `popupBlocked`, `accessLine`). The in-app dashboard button in `caregiver.dashboard.browse`.
- English first; Korean and Spanish behind the F-I18N-001 review gate; the length budgets (§3.11 of F-I18N-001) cover every `cta` and `pill`; Spanish wraps to two lines in the header buttons.
- **No Hangul in an `en` or `es` message** (rule 5): the focus line "Taught here: ㄴ (n)" is a template whose letter and romanization come from content and render through `KoreanText` with `lang="ko"`. Taught Korean always carries romanization and a gloss in the UI language (CLAUDE.md §1); a missing overlay falls back to English (F-I18N-001 §3.6).
- Every new string is checked against the caregiver and console banned lists (`packages/i18n/src/banned.ts`, `apps/web/src/lib/console/banned-text.ts`): no "kids", no age range, no "Premium", "upgrade now", "unlock", "fail", "wrong", "behind".
- Proposed English (final in the dictionary): section title "Browse lessons"; strip "Preview. Nothing is saved."; scope lines (§4.5); outline "Included with a plan" / [ See plans ]; access "Browse lessons is for grown-up accounts."; keep switch "Keep lessons on this device for 7 days, also offline"; end "That is the whole lesson."; console button "Lessons".

## 7. Accessibility

- Every browse screen has one `accessibilityRole="header"` title; the preview strip is a `status` region announced once on screen focus ("Preview. Nothing is saved."), not on every render.
- Inside lessons accessibility is the learner app's (no change). The strip never covers the lesson's close control or the game's targets (it sits above the lesson's safe area).
- Targets at least `touchTarget.min` (the learner floor) on browse screens; body text at the charter floor (18).
- Lists use real headings per section and per episode; the Journey grid keeps the learner grid's labels ("Stage 1, Letters: Meet the Letters, open"); outline items say "Outline only" in their label.
- Korean through `KoreanText` (`lang="ko"`, romanization adjacent, never colour-only); skills chips have text, not icons only.
- Keyboard: all browse actions reachable with Tab / Enter / Space; Escape closes the Show as sheet and the card modal; focus returns to the opener.
- Reduced motion: browse adds no animation; lessons follow the learner rules.
- Contrast of the strip pair is pinned by the existing design-system contrast test (no new token).

## 8. Privacy and child safety

- **No child data in Browse.** The browse root never reads a learner key (§4.10), never knows a learner's name, level, progress, tier or plan, and shows no "your child did this" state. Report and route links carry content ids only (BD7).
- **The pass carries no person data**: scope, expiry and an optional UI locale. No account id, email, space name or learner id is in the message, in storage or in telemetry.
- **Origins**: the browse tab accepts a pass only from `window.opener` on an allowed first-party origin; the console answers only the window it opened, on the exact app origin. Neither page may be served with `Cross-Origin-Opener-Policy: same-origin` (it would cut `window.opener`; F-TCH-004 §3.2 step 6 records the same constraint).
- **Shared family devices**: the gate pass is one-time and short (BD8); the account pass is memory-only unless an adult turns the keep switch on (OD-4); [ Exit preview ] offers "Forget this device". A child who opens `/browse` without a pass sees only the Access screen. A child who reaches a kept pass sees lessons that save nothing; no purchase, account or settings surface is reachable from Browse.
- **No ads, no third-party scripts, no external links** other than the existing story Sources links (which keep their own grown-up rules, F-STORY-002 §3.8).
- **Anti-shame**: Browse shows no learner data, so it can rank or compare no one; the preview end shows no score; games keep their amber nudges; no red X; no copy that frames a learner as behind.
- **Prices**: none on any Browse or entry surface; [ See plans ] goes to the billing page, which owns its own sandbox rules.
- **COPPA posture**: Browse collects nothing from anyone. Adult telemetry carries no `profileId` and no account identifier (§9).

## 9. Telemetry (Worker first)

Five names in the new `browse.` namespace (no existing name starts with `browse.`; checked against `TELEMETRY_EVENT_NAMES` on `ea9049e4` and the sections of `docs/roadmap/TELEMETRY-NAMES-2.md`). BR-1 adds them to `TELEMETRY_EVENT_NAMES` and its exact-list test and adds a section (the next free letter at merge time) to `TELEMETRY-NAMES-2.md`; the Worker deploys on merge, before BR-6 (the first sender). Every event is sent **without `profileId`**; payloads carry content ids, codes, booleans and rounded counts only.

| Name | Payload | When |
|---|---|---|
| `browse.opened` | `{ source: BrowseSource, scope: 'full' \| 'sampler' \| 'none', passFrom: 'opener' \| 'kept' \| 'gate' \| 'none', offlineReady: boolean }` | the browse root has resolved its pass (or given up after 3 s) |
| `browse.item_viewed` | `{ kind: 'episode' \| 'quest' \| 'story' \| 'vocab-topic' \| 'card', itemId: string, access: 'play' \| 'outline' }` | an episode outline, item page or card opens |
| `browse.preview_started` | `{ kind: 'quest' \| 'story' \| 'vocab-topic', itemId: string }` | [[ Preview this lesson ]] |
| `browse.preview_ended` | `{ kind, itemId, reachedEnd: boolean, minutes: number }` (minutes rounded down, capped at 60) | the preview end screen, or leaving a preview early |
| `browse.outline_tapped` | `{ kind: 'quest' \| 'story' \| 'vocab-topic' }` | a sampler adult presses [ See plans ] on an outline item |

`itemId` is a content id (a quest, story, topic, episode or card id), never a person id. The telemetry fence (§4.10) guarantees that these are the only events Browse can send. The console has no telemetry client and sends none.

## 10. Tests

| File | Level | Covers |
|---|---|---|
| `packages/content-schema/src/__tests__/browse.test.ts` | unit, 100 % | every target kind round-trips through the fragment codec; bad kind, bad id, two jamo chars, a 257-character fragment, unknown source; `pass` message strictness (extra `accountId`, `email`, `learnerId` keys rejected; `expiresAt` without a zone rejected); `buildBrowseUrl` uses the app origin only; `BrowseAccessSchema` |
| `packages/content-schema/src/__tests__/telemetry*.test.ts` (extend) | unit | the five names in the exact list |
| `packages/backend/src/__tests__/entitlements-browse.test.ts` (+ the `test:sqlite` run) | unit / integration, 90 % | family owner with lifetime = full; second caregiver in that family = full; teacher of a class under a licensed school (not owner) = full; school admin with a seat contract = full; free class teacher = sampler; account with no spaces = sampler; archived covered space = sampler; past-due inside grace = full, after grace = sampler; cancelled before expiry = full; learner memberships never count; 401 without a session; no write happens (db spy) |
| `apps/mobile/src/platform/__tests__/storage-fence.test.ts`, `telemetry-fence.test.ts` | platform | fenced write and remove do nothing for a rejected key and work for an allowed key; clearing the fence restores writes; a fenced `track` returns `false` and neither queues nor notifies listeners |
| `apps/mobile/src/platform/__tests__/app-root.test.ts` | platform | `/`, `/browse`, `/browse/x`, `/present`, `/presenter` (learner), `/browsex` (learner); native stub |
| `apps/mobile/src/logic/browse/__tests__/access.test.ts` | unit, 100 % | the §4.2 table; sampler agrees with `isFreeContent` for every bundled quest, story and topic; cards always viewable; `none` blocks everything; `contentGatingEnabled` has no effect |
| `.../target.test.ts` | unit, 100 % | each target to its screen; `jamo` with and without a teaching quest; `char` lookup skips batchim; unknown id falls to home with the note; `none` scope lands on Access |
| `.../facts.test.ts` | unit, 100 % | letters from Discover in page order; words with romanization and gloss; skills never include speaking; minutes; reward card; route position; a story's levels and keywords; a topic's words |
| `.../catalogue.test.ts` | unit, 100 % | grid cell states (open / later) from the bundle; every shipped episode reachable; story index honours the review gate; topic rows |
| `.../pass.test.ts` | unit, 100 % | accept only from opener + allowed origin + schema + future expiry within 7 days and 1 hour; ignore everything else silently; memory by default; keep switch writes and removes `browse:pass`; expired stored pass removed on read; gate hand-off read once then deleted; gate expiry |
| `.../browse-isolation.test.ts` | unit | forbidden imports (§4.10) fail with file and line |
| `apps/mobile/src/screens/quest/__tests__/quest-player-ports.test.tsx` | unit | learner ports keep today's behaviour (session begin and end, Results reset, leave route); preview ports start no session, finish on `PreviewEnd`, leave to the item page, and call no store writer (spies on `progress-store`) |
| `apps/mobile/src/screens/browse/__tests__/*.test.tsx` | unit | home sections render from a fixture bundle; outline items show "Included with a plan" and no Preview button; the strip is present on every browse screen; Show as switches romanization in Discover; Access screen shows no content |
| `apps/mobile/e2e/web/browse.spec.ts` (new, Playwright) | e2e | seed a learner profile with progress through the existing fixtures, read the full IndexedDB key/value set; open `/browse#s=gate` after writing a gate hand-off; preview a full Stage 1 quest (Discover, games, Check) to the end screen, a story, and a card; then assert the key/value set is identical except the allowed `browse:*` keys and the telemetry queue holds no non-`browse.*` event; the address bar lost the fragment; `document.title` is fixed; reload shows the Access screen (hand-off consumed); offline reload with the keep switch on still opens |
| `apps/mobile/e2e/web/browse-handoff.spec.ts` (new) | e2e | a routed `http://localhost:3000` opener page opens `/browse#t=quest:stage1-letters-q2&s=report` with `window.open(…, 'hr-browse')`, answers `ready` with a `full` pass: the item page opens; a second open with another target reuses the tab (`hashchange`); a pass from another origin or a non-opener window is ignored; a `sampler` pass shows outline for a Stage 2 quest; no request URL, `page.url()` or title contains anything but content ids |
| `apps/web/src/lib/console/__tests__/browse-link.test.ts` | unit, 90 % | answers `ready` only for its own window and the app origin, with the exact `targetOrigin`; pass contains only scope, expiry and locale; pop-up blocked path; URL built for each entry source |
| `apps/web/src/lib/console/__tests__/copy.test.ts`, `packages/i18n/src/__tests__/caregiver-messages.test.ts` (extend) | unit | new strings pass the banned lists, length budgets and rule 5 |
| Manual (listed in the PR) | manual | iPad Safari and a Chromebook: open from the console, preview a quest with the sound on and off, no-Korean-voice text fallback, keep switch offline; Korean and Spanish UI read-through once those locales ship |

Coverage: `packages/content-schema` 100 %, `packages/backend` 90 %, `apps/mobile` logic 90 % (100 % for `logic/browse/*`), platform 70 %, `apps/web` verification logic 90 %.

## 11. PR breakdown (dependency order)

Each PR is one reviewable change with its tests (S < 300 changed lines, M < 700). UI PRs link their design mock (`design/screens/…`, the owner's manual step, CLAUDE.md §5) and attach screenshots.

| PR | Content | Size | Depends on |
|---|---|---|---|
| BR-0 | `docs`: this spec, `design/wireframes/browse/*.md` (8 files), wireframe index rows | S | none |
| BR-0b | `docs`: `docs/blueprints/10-app-map.md` rows (a Browse root row, the screens of §4.1, the entry edges of §4.11), sibling F-ids filled in, F-TCH-004 §3.1 note that `index.ts` picks among three roots | S | BR-0, the persona app-shell spec merged |
| BR-1 | `feat(content-schema)`: `schemas/browse.ts` + codec + messages + access schema + `BROWSE_PASS_ORIGINS` + 5 telemetry names + `TELEMETRY-NAMES-2.md` section + tests | S | none |
| BR-2 | `feat(backend)`: `accountBrowseScope` + `GET /api/entitlements/browse` + tests (memory and sqlite) | S | BR-1 |
| BR-3 | `feat(mobile)`: storage write fence, telemetry fence, `platform/app-root` (or its browse branch if F-TCH-004 PR 6 is in) + tests | S | BR-1 |
| BR-4 | `feat(mobile)`: pure `logic/browse/{access,target,facts,catalogue,pass,session}.ts` + `browse-isolation.test.ts` | M | BR-1 |
| BR-5 | `refactor(mobile)`: `QuestPlayerView` + `QuestPlayerPorts`; `JourneyGrid` out of `JourneyScreen`; `CardDetailView` `state` prop; `useRomanizationMode()` and its four call sites. No behaviour change: the learner e2e suite stays green and `quest-player-ports.test.tsx` pins today's learner behaviour | M | none |
| BR-6 | `feat(mobile)`: `BrowseApp`, `navigation/browse.tsx`, `PreviewFrame`, Access screen, `platform/browse.web.ts` (route, fragment strip, `announceReady`, message listener, `hashchange`), fences applied at boot, `browse.opened`; `browse.spec.ts` (gate path, key-set equality, first cases) | M | BR-3, BR-4, BR-5, BR-1 deployed |
| BR-7 | `feat(mobile)`: Browse home (Journey, Stories, Words, Cards), episode outline, item page, Show as sheet, keep switch; `browse.item_viewed`, `browse.outline_tapped` | M | BR-6 |
| BR-8 | `feat(mobile)`: `PreviewQuestScreen` with preview ports, learner `MinigameScreen` / `StoryReader` / `StorySources` / `CardDetail` in the browse stack, `PreviewEnd`; `browse.preview_started`, `browse.preview_ended`; e2e: a full quest, a story and a card write nothing | M | BR-7 |
| BR-9 | `feat(mobile)`: vocabulary topic item page with the full word list and audio; flashcard preview through the `'preview'` host when F-VOC-003's screens exist | S | BR-7 (flashcards: F-VOC-003 screens) |
| BR-10 | `feat(web)`: `api.browseAccess`, `lib/console/browse-link.ts`, [ Lessons ] in `ConsoleShell`, `console.browse` strings; `browse-handoff.spec.ts` | M | BR-1, BR-2 (useful after BR-6) |
| BR-11 | `feat(web)`: [ Preview ] on plan builder rows and links on the roster revisit chips | S | BR-10 |
| BR-12 | `feat(mobile)`: [ Browse all lessons ] on the parent dashboard (web only, gate hand-off writer) and [ Preview lessons ] rows on the grown-up read-only route page | S | BR-6; route rows after F-ROUTE-001 R-9b / the LEARNING ROUTE sibling's read-only page |
| BR-13 | `feat(mobile)`: [ Present this ] on the item page (one-block deck to `/present`) | S | BR-7, F-TCH-004 PR 6 |
| (sibling) | Report chips link through `buildBrowseUrl` / `openBrowse` | — | the progress-reports spec's report PRs, BR-10 |

BR-1, BR-3, BR-4 and BR-5 can run in parallel. Merge BR-1's `telemetry.ts` and `src/index.ts` edits serially with other specs' name PRs (append only). BR-6 ships no entry point; the root is reachable only by typing the URL until BR-10 or BR-12.

**Shared files** (expect mechanical rebases): `packages/content-schema/src/index.ts`, `schemas/telemetry.ts` and its exact-list test, `docs/roadmap/TELEMETRY-NAMES-2.md` (BR-1) · `apps/mobile/index.ts`, `platform/app-root*` (BR-3; F-TCH-004 PR 6) · `platform/storage*.ts`, `platform/telemetry.ts` (BR-3) · `screens/quest/QuestPlayerScreen.tsx`, `screens/journey/JourneyScreen.tsx`, `screens/library/CardDetailView.tsx`, `DiscoverStep.tsx`, `ListenPickGame.tsx`, `PicWordMatchGame.tsx`, `StoryReaderView.tsx` (BR-5; any open quest or layout PR) · `screens/parent/ParentDashboardScreen.tsx` (BR-12; F-ROUTE-001 R-9b, the reports sibling) · `apps/web/src/components/console/ui.tsx`, `lib/console/api.ts` (BR-10; persona app-shell, billing sibling) · `packages/backend/src/routes/entitlements.ts`, `lib/entitlement.ts` (BR-2; billing sibling) · `design/wireframes/README.md` (BR-0; every sibling).

## 12. Dependencies

- **Upstream (hard)**: none for BR-0 to BR-8 beyond this spec's own order. F-TCH-004 PR 6 for BR-13. F-VOC-003 screens for flashcard preview in BR-9.
- **Upstream (soft)**: the persona app-shell spec (adult navigation that hosts the entry button, the adult sign-in URL for the Access screen, and the console host; Browse works with the console on hangulroute.com today); the billing sibling (the app-host billing URL for [ See plans ]); the free-plan sibling (the quest-level free kind in `content-access.ts`; until then the sampler is stage-based, which matches today's registry).
- **Constraints recorded for siblings**: the service-worker navigation denylist for console paths must not include `/browse`; neither the console pages nor `/browse` may set `Cross-Origin-Opener-Policy: same-origin`; the reports and LEARNING ROUTE specs link only through `buildBrowseUrl` and `openBrowse` and never put a learner identifier in a target.
- **Downstream**: search and filters (§14); native Browse; server-delivered premium content (would switch the pass to signed, §15).

## 13. Owner decisions (each with the default this spec builds)

| # | Question | Default (built unless the owner says otherwise) | Alternatives |
|---|---|---|---|
| OD-1 | Who gets the full Browse? | Any signed-in adult with an owner, caregiver, teacher or admin role in a covered space (family lifetime, licensed class, class under a licensed school, licensed school), decided by the server (§4.2). | Only space owners; only the purchaser. |
| OD-2 | What do free adults see? | The sampler: play what a free learner can play, and the outline of everything else, with "Included with a plan" and [ See plans ] (no price). | Nothing (Access screen only); everything (no paid difference). |
| OD-3 | What do signed-out visitors see? | Only the Access screen: an explanation and [ Sign in ]. No lesson, title or card. | The sampler without sign-in. |
| OD-4 | Is the pass kept on the device? | Memory for the tab by default; an adult can turn on "Keep lessons on this device for 7 days, also offline". | Always kept 7 days; never kept. |
| OD-5 | Open from the in-app grown-up area? | Yes, on web, after the PIN; the hand-off is one-time and ends with the gate session (at most 15 minutes); full when any profile on the device is covered. | No in-app entry (console only). |
| OD-6 | What does the preview end show? | No stars, no score, no card animation; a sentence saying what a learner gets, with the card's name and picture. | Show stars from the adult's answers. |
| OD-7 | Cards in the sampler | All cards viewable front and back (they are already public on the landing page). | Only cards of free lessons. |
| OD-8 | Name of the section | "Browse lessons" (page), "Lessons" (console button), strip "Preview. Nothing is saved." | "Lesson library", "Course preview". |
| OD-9 | [ Present this ] | Shown with a full pass once the presenter ships, for parents and teachers alike. | Teachers only; not shown. |
| OD-10 | Native apps | Web only for now; console links open the web app. | Build the native Browse with the apps. |
| OD-11 | Signed pass? | Unsigned, client-trusted (BD5). | A Worker-signed pass verified in the app (needs a key pair and a dashboard secret). |
| OD-12 | Speaking games in preview | Follow the learner flag (off at launch), so the preview is exactly what learners get. | Always show them in preview. |

## 14. Out of scope (this spec)

- Search, filters by letter or skill, "recently previewed" lists.
- Showing any learner's state in Browse (done, assigned, in the plan): Browse is learner-free by design; reports show learner state and link here.
- Assigning from Browse (plans stay in the plan builder).
- The level check, review tests, homework lists and Home as browsable surfaces.
- Native apps; a Chromecast or TV app (the presenter covers the TV case).
- Editing content, teacher notes on lessons, printable worksheets (F-TCH-003).

## 15. Unverified assumptions and risks

- **The F-TCH-004 root switch** is not merged; if PR 6 changes its shape, BR-3 adapts `app-root` (one module).
- **`window.opener` on iOS home-screen PWAs**: a console opened as an installed app and a Browse tab in Safari are separate contexts; the hand-off may not reach. The fallback is the Access screen and the keep switch; the in-app gate entry covers the family tablet case.
- **Named window reuse** (`window.open(url, 'hr-browse')`) and `hashchange` on fragment-only navigation are standard but are covered by the handoff e2e on Chromium and WebKit only.
- **`QuestPlayerView` extraction** touches the most-used learner screen; BR-5 is a pure refactor gated by the full learner e2e suite and the ports test, and lands before any browse UI.
- **Unsigned pass** (BD5): a technically skilled person can forge a pass from a local page served at `http://localhost:3000` (an allowed origin for development) and preview every lesson without paying. Today every lesson is already playable in the learner app for free, so nothing is lost; if `localhost:3000` must leave the production list, it moves to the build-time `EXPO_PUBLIC_CONSOLE_ORIGINS` for development builds only (owner call; default keeps parity with `LECTURE_CONSOLE_ORIGINS`). If paid content is ever served from the Worker, OD-11 flips to a signed pass.
- **Free boundary drift**: the sampler relies on the free-plan sibling adding its quest-level kind to the registry; if it adds a separate list instead, `access.test.ts` (sampler equals registry for every item) fails and the owner is asked.
- **Vocabulary practice**: F-VOC-003 is ready but its screens are not on `main`; until they land the topic preview is the word list.
- **Telemetry volume**: `browse.item_viewed` fires per page open; at expected adult volumes this is small. If it is noisy the Worker can sample it; no client change.
