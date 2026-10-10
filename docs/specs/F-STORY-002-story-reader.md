Status: ready

# F-STORY-002 — Story reader, Sources screen and the SceneArt illustration system

**Scope**: `apps/mobile` (`logic/story/` reader logic, `screens/story/`, `screens/minigames/StoryReadGame.tsx`, `navigation/`, `platform/` audio adapter) · `packages/design-system` (`scene-art/` data + registry + renderers, `StoryScene`) · `packages/content-schema` (`MinigameKind` `story-read`, telemetry names) · `apps/web` (`/design-preview/scenes` contact sheet) · `scripts/` (art demand report)
**Owner**: solo dev
**Rollout**: Story mode phase 1, after F-STORY-001 (schema, content). Ships dark: no story is `ready` until content PRs land (F-STORY-001 §6). PR order in §6. **Start order (review 2)**: PR 2.2 (pure scene-art core) needs nothing; 2.1 and 2.5 need F-STORY-001 PR 1.1a/1.1b (and F-I18N-001 PR 1 for `readToMe`, merged as #100); 2.6a/2.6b need F-STORY-003 PR 3.2a (ref grammar) and F-I18N-001 PR 4 (`KoreanText`).
**Wireframes**: `design/wireframes/story/reader.md` · `story/sources.md` · `story/term-gloss.md` — drafted in one file, `wireframes/story-reader.md` (this PR set), promoted by PR 2.0

Parent / siblings: F-STORY-001 (schema, facts, sources) · F-STORY-003 (checks, Story Order v2, Results; `ChoiceCard`) · F-STORY-004 (shelf, bookmarks, Culture notes) · F-STORY-005 / -006 · F-AUDIO-004 (MP3, voice capability) · F-I18N-001 (`KoreanText`, `romanizationShown`, overlays) · F-CNT-002 (romanization) · F-LEARN-001 (level order, grown-up gate) · F-VR-001 (design-preview surface) · F-HOYA-001 · design input `story-mode.md` §2.5-2.6

---

## 1. Context

A learner opens a tale and reads or hears it scene by scene with Hoya, sees the Korean with its romanization and meaning, taps a word to hear it, and — for a grown-up who wants to trust what the app says — can open **Sources** and see exactly which citation stands behind every statement. This spec is that reader, that Sources screen, and the picture system that gives 182 launch scenes an illustration without a single raster file or emoji.

What exists on `main` (HEAD `c939348`; every line re-read at review 2):

- **No reader.** The only story mechanic is `StorySequenceGame` (text labels, no art, `screens/minigames/StorySequenceGame.tsx`; F-STORY-003 rewrites it). `MinigameScreen` switches on `scope.kind` and falls through to "This minigame is coming soon." for anything unknown (`screens/minigames/MinigameScreen.tsx:54-78`; the `case` list ends at `tap-respond`, `:74-75`). The route `Minigame: { questId, episodeId, stepIndex }` is the only way a game is entered from a quest (`navigation/types.ts:32-36`); a game ends with `markStepComplete()` then `onFinish()` which pops back (`MinigameScreen.tsx:30-39`).
- **Quest flow.** `QuestPlayerScreen` shows a step, launches a minigame, applies `consumePendingAdvance` on focus (`screens/quest/QuestPlayerScreen.tsx:36-60`), and scores only rounds reported through `useQuestRunStore.getState().answerRound(key, correct)` (`store/quest-run-store.ts:55-68`). A quest with 0 scored rounds is not completed; reading itself records none, which is why F-STORY-003's checks are scored and the reader records only optional checkpoints.
- **Audio.** `platform/audio.ts:26-40` `speak(text, { language: 'ko-KR' | 'en-US', rate, pitch, onDone })` with a module-level mute (`:8-17`); the web variant uses `speechSynthesis`, cancels before each utterance, picks a voice by exact then prefix match, and calls `onDone` immediately when sound is muted or there is no synthesiser (`platform/audio.web.ts:44-62`, the early return at `:47`). `playJamoSound(char, _audioRef)` **ignores `audioRef`** (`audio.ts:50-54`): no code plays an MP3 today (audit AUD-01); F-AUDIO-004 changes that.
- **Motion.** `useReducedMotion()` (`platform/motion.ts:7-25`) wraps `AccessibilityInfo`; `Hoya` already skips its pose pulse when reduced motion is on (`Hoya.tsx:253`, the `isReduceMotionEnabled` check).
- **Pictures.** `HeritageCardArt` draws 30 card pictures as `react-native-svg` JSX on a 200x200 viewBox with `colors.*` tokens only (`HeritageCardArt.tsx:1-11, 1220-1265`; `supportedCardIds` `:23-56`) — JSX, so it cannot be rendered by the Next.js web app, which imports only `@hangul-route/design-system/tokens` and hand-mirrors shapes as inline `<svg>` (`apps/web/src/app/design-preview/cards/page.tsx:1-8, 218-223`; `next.config.js` `transpilePackages`). `Hoya` is a **head-and-belly mascot** in a 128x128 viewBox drawn in JSX with five poses (`Hoya/types.ts:1`, `Hoya.tsx`). The design-system coverage config excludes `src/components/**` (`packages/design-system/vitest.config.ts:13`), so geometry that must be tested lives outside `components/`.
- **Tokens.** Colour tokens `packages/design-system/src/tokens.ts:21-103` (`brand`, `surface`, `text`, `feedback` incl. `danger` "RESERVED for parent/admin destructive only", `stage`, `theme`, `hoya`, `rarity`, `border`), `borderWidth` thin 1 / base 2 / thick 3 (`:206-210`), `touchTarget` min 64 / child 80 / hero 96 (`:198-202`), `motion.duration.base` 200, `typography.size` body 18 / bodyLg 20 / title 28 / display 36.
- **Icons**: `play pause speaker replay check close arrow-left arrow-right lock star card home journey library parent settings profile plus sparkle` (`Icon/types.ts:1-20`). `Progress` has a `dots` variant (`Progress/types.ts:1-9`); `Screen` scrolls by default and takes `edges` (`Screen/types.ts`); the PWA shell centres the app in a 480 px column from 600 px up (`apps/mobile/scripts/pwa-postbuild.mjs:46-48`), so a wide two-column layout only ever occurs on native tablets and landscape phones.
- **External links** exist once: `Linking.openURL(url)` in a try/catch on the Paywall (`screens/paywall/PaywallScreen.tsx:30-39`); the grown-up gate is `PinEntry { next }` with a fixed union (`navigation/types.ts:19-20`).

What the heritage research tells us about the reader and its art (24 stories, 182 scenes, counted at review 2 over the four `.final.json` files, saved in the repo by PR #104 as `content/stories/research/`):

| Fact | Count | Consequence |
|---|---|---|
| Scenes | 182 (7 or 8 per story, <= 45 words each) | Dots (<= 8) fit one row; art budget is sized for 182, not "about 150" |
| Narration contains an inline Korean term | 53 scenes / 81 tokens | Inline term chips are core, not an extra (F-STORY-001 §3.4) |
| Scene Korean | 155 single terms, 27 phrases | One Korean block, two shapes (word / line) |
| Illustration brief mentions Hoya | 103 of 182 | Hoya is a recurring cameo; the mascot must compose with scenery |
| Brief mentions writing, text, characters or an inscription | 44 | SceneArt has **no text primitive**; writing is drawn as strokes |
| Brief length | max 224 chars, mean 139 | A brief is enough for an illustrator but not machine-readable: authoring is manual (§3.9.8) |
| Folk tales | 2 (`sun-and-moon`, `pansori-tales`) | "Traditional tale" pill in the header (F-STORY-001 §3.5) |
| Sensitivity | 9 scenes in 5 stories mention a war, fire or loss | A quiet advisory note, never a gate |

## 2. User story

> As a learner at any reading level I want to go through a short story one picture at a time, hear it read to me if I like, tap a Korean word to hear it and see what it means, and carry on where I left off — so reading feels like looking at a picture book, not taking a test.

Companion stories:

- As a **grown-up, teacher or reviewer** I want a Sources button on every story that shows each statement's citations (title, publisher, date accessed, the supporting quote, the link) and any corrections, so I can check what my learner was told.
- As a **learner who cannot hear** (muted device, no Korean voice, deaf or hard of hearing) I want every sound to have its text on screen, and as a **screen-reader or switch user** I want the same reading order and big targets.
- As an **illustrator-developer** I want a constrained, token-only drawing kit and a contact sheet so I can author 182 scenes consistently and a reviewer can approve them in one place.

## 3. Acceptance criteria

### 3.1 Routes, kinds and entry points

- **New minigame kind** `story-read` (`MinigameKindSchema`, `schemas/minigame.ts:16-30`; additive; PR 2.1). `MinigameScreen` gains `case 'story-read': return <StoryReadGame scope={scope} onFinish={close} />;` (next to `:74`). The scope is `scope.story = { storyId, level }` (`StoryScope`, F-STORY-003 §3.1) resolved from refs of the form `minigame:story-read-<listen|along|read>-<slug>` by `storyScopeFor` (`logic/story/story-ref.ts`, **created by F-STORY-003 PR 3.2a**, which owns the ref grammar; this spec only consumes it and adds its own `story-read` test cases there). A ref whose story or level does not exist falls through to the existing "Minigame not found." screen with **Back to quest** (`MinigameScreen.tsx:50-52`).
- **New route `StoryReader: { storyId: string; level: StoryLevel; mode: 'replay'; sceneIndex?: number }`** in `RootStackParamList` and `navigation/root.tsx`: the standalone, **unscored, nothing-written** reader (F-STORY-004 "Read it again", F-STORY-003 Results "Read it again"). It renders the same view as the quest step.
- **New route `StorySources: { storyId: string; factId?: string; sceneIndex?: number }`** (§3.8).
- `PinEntry.next` gains the additive variant `'ExternalLink'` with an optional param `url?: string` (§3.8). `navigation/types.ts:19-20` is the only type to change.
- **Entry points** (this spec supplies the reader; the others are F-STORY-004's): quest step (`QuestPlayer` → `Minigame` → `StoryReadGame`), `StoryReader` replay, Library/Home/Episode "Read it again" (F-STORY-004). **Sources** is reachable from the reader's top bar, from the end page, and (F-STORY-004 §3.5 and §3.6 add the link) from the episode page and Culture notes.

### 3.2 Pure logic — `apps/mobile/src/logic/story/` (all 100 % covered)

| File | Exports | Behavior |
|---|---|---|
| `reader-state.ts` | `initReader(sceneCount, startIndex, checkpoints)`, `reduceReader(state, action)` → `{ state, effects }` | State: `{ index, furthest, phase: 'scene' \| 'checkpoint' \| 'end', checkpointId: string \| null, openTerm: string \| null, revealed: string[] }`. Actions: `next`, `back`, `goTo(i)`, `restart`, `tapTerm(id)`, `closeTerm`, `reveal(id)`, `resolveCheckpoint(correct)`, `skipCheckpoint`. `next` on the last scene → `phase: 'end'` and effect `finish-reading`; `next` on a scene with a `checkpointId` → `phase: 'checkpoint'`; `back` from `end` → the last scene; `furthest` only grows; `index` and `furthest` clamp to `[0, n-1]`; moving scenes clears `openTerm` and `revealed`. Effects: `{ type: 'scene-changed', index }` (bookmark + autoplay + announce), `{ type: 'answer', roundKey: 'cp:<id>', correct }`, `{ type: 'finish-reading' }` |
| `scene-view.ts` | `buildSceneView(story, level, index, ctx)` → `SceneView` | Pure view model: `{ sceneId, position, total, art, altEn, narrationParts: Array<{ text } \| { kw: Keyword }>, korean: { kind: 'word' \| 'line'; text: KoText; words?: KoText[] } \| null, captionEn, cultureNote \| null, checkpoint \| null, labels }`. Uses `parseNarration` and `sceneKorean` (F-STORY-001). Locale overlays (`localize*`, F-I18N-001 §3.6) are applied by the caller before this function; a missing overlay field is already the English text. Never throws: an unknown token renders its keyword's bare Korean (F-STORY-001 §3.4) |
| `scene-audio.ts` | `planSceneAudio(view, opts)` → `PlaySpec[]` | The steps are F-AUDIO-004 `PlaySpec`s (`text`, `audioRef?`, `language: SpeechLang`, `kind`, `source: 'story-reader'`, F-AUDIO-004 §3.5). `opts = { include: ('narration' \| 'korean')[] }`. Narration is split at `{kw}` tokens so each English chunk is an English step (`kind: 'narration'`) and each Korean term a Korean step (`kind: 'word'`, `spokenKo ?? ko`, `audioRef` first); the Korean block follows (`kind: 'word'` for a keyword, `'sentence'` for a line). The language of a narration step is the language of the text actually shown: if the overlay for the UI locale is missing and English is displayed, the step is `en-US`, never the UI locale. Rate and pitch are **not** set here: F-AUDIO-004 `speechParams(kind, level)` owns them |
| `audio-runner.ts` | `createAudioRunner(deps)` → `{ play(steps), stop(), isPlaying() }` | `deps.playPrompt` is F-AUDIO-004's `playPrompt(spec): Promise<'played' \| 'muted' \| 'unavailable'>`. The runner awaits each step in order, stops the chain on `muted` or `unavailable` for a Korean step (English steps that follow are skipped too: a half-read scene is worse than a text-only one), and uses a generation counter so a newer `play()` or `stop()` ends the old chain even though F-AUDIO-004 resolves a superseded prompt as `played` (§3.5 step 2 of that spec). Reports `{ status: 'played' \| 'muted' \| 'unavailable' }` to a callback. No React |
| `reader-settings.ts` | `readToMeDefault(level)`, `effectiveReadToMe(setting, level)` | Default **on** when `levelOrder(level) === 0` ("Pictures first", F-LEARN-001), else off. `level` is the profile's learner level id read through `levelOrder()`, never the raw id (D1) |
| `sources-view.ts` | `buildSourcesView(story)` → `SourcesView` | §3.8: corrections list, scene groups, fact cards with sources and approximations, "used in questions" facts, header counts. Deterministic, no I/O |
| `story-reader-copy.ts` | `STORY_READER_COPY` (`as const`, function messages for plurals) | Every UI string of §3.3-3.8; a unit test runs `scanLearnerCopy` (`logic/homework/banned-text.ts:30-37`) over all values. Moves to `messages/en/learner.ts` unchanged when `packages/i18n` ships (F-I18N-001) |

`StoryReadGame` and `StoryReaderScreen` are thin: they build `SceneView`s, run `reduceReader`, execute effects, and render. No business rule lives in a component.

### 3.3 The reader screen

Component tree: `screens/story/StoryReaderView.tsx` (props: `story`, `level`, `mode: 'quest' \| 'replay'`, `initialIndex`, `onSceneChange(index)`, `onAnswer(roundKey, correct)`, `onFinish()`, `onClose()`) hosted by `screens/minigames/StoryReadGame.tsx` (quest) and `screens/story/StoryReaderScreen.tsx` (replay route). `Screen tone="canvas" scrollable={false}` with an inner scroll area for text and the bottom controls pinned (the shell wireframe rule: a scrolling body, a pinned CTA; `Screen` is scrollable by default, `Screen/types.ts`, and the reader opts out because the art and the CTA must not scroll away).

**Portrait layout (top to bottom)**

1. **Top bar** (one row, each control >= `touchTarget.min` 64): Close `x` (`Icon close`) · fill-only dots `Progress variant="dots" value={furthest+1} max={n}` · position label "3 / 8" (`Pill`, a *position*, not a meter: it may go down on Back) · **Sources** (`Button tone="ghost" size="md"`, label from copy, `Icon library`).
2. **Scene art**: `StoryScene` (§3.9.9), 4:3, full width up to 480 dp, `accessibilityRole="image"`, label `art.altEn`. If the tale is traditional/adapted, the **"Traditional tale" pill** sits directly under the art on every scene (F-STORY-001 §3.5 T4).
3. **Narration card** (`Card`, text `typography.size.bodyLg`): English narration with inline term chips (§3.5). With Hoya in the picture there is no `HoyaBubble` (one Hoya per screen).
4. **Korean block** (`KoreanText`, F-I18N-001 §3.5): Korean at `title` size (a word) or `bodyLg` wrapped (a line), romanization upright >= 16 sp, gloss line, a speaker button (>= 64). Tapping the block plays the line; it is the tap target for tap-for-gloss on lines (§3.5).
5. **Chips row** (only when present): "Did you know?" (culture note, §3.7) and "Say it yourself" (when no Korean voice).
6. **Bottom bar** (pinned): **Read to me** toggle (a labelled switch, >= 64) · **Back** (secondary, disabled on scene 1) · **Next** (`size="hero"`, the one primary; label "Next", and "Finish" on the last scene).

**Level differences** (the same component; `level` only changes order and emphasis):

| Level | Order inside the card | Korean block |
|---|---|---|
| `listen` | art → narration → Korean keyword/line | one word (or one phrase) |
| `read-along` | art → Korean line → "In English" narration | a sentence built on a Stage 3 pattern |
| `read` | art → Korean line (display size) → one-line caption (`captionEn`) | a sentence of 3-8 words; romanization hide-until-tap honoured (§3.5) |

Heritage launch stories are all `listen` tier. The two other layouts ship with the component so F-STORY-005's Stage 5 content needs no UI work.

**Landscape / wide** (native tablets and landscape phones; width >= 700 dp and wider than tall): two columns — art left (<= 55 %), text and controls right; the top bar spans both. The web PWA keeps the 480 px column at >= 600 px (`pwa-postbuild.mjs:46-48`), so this is verified on native only.

**Given/When/Then**

- **Given** a story with 8 scenes, **when** the reader opens fresh in quest mode, **then** scene 1 shows, dots show 1/8 filled, position "1 / 8", **Back** is disabled, **Next** is enabled, the `scene-changed` effect runs (it writes no bookmark for scene 0, F-STORY-004 §3.1), and the screen reader announces "Scene 1 of 8" followed by the art description.
- **Given** a scene, **when** Next is tapped, **then** scene `index+1` shows with a 200 ms cross-fade (`motion.duration.base`), or instantly when `useReducedMotion()` is true; `furthest` updates; focus moves to the narration card; no auto-advance ever occurs, with or without Read to me (a child may be reading slowly; the reader never has a timer, D3).
- **Given** the last scene, **when** Next ("Finish") is tapped, **then** the end page shows (§3.7); in quest mode its primary button calls `markStepComplete()` then `onFinish()`; in replay mode its primary button is **Done** and nothing is written.
- **Given** the Close button, **when** tapped, **then** the reader goes back (`navigation.goBack()`): in quest mode to the quest step, which stays not-complete and can be played or skipped again from its launcher; in replay mode to the previous screen. Nothing is lost by leaving — reading records no score — so there is **no confirmation dialog**; the bookmark was already saved by the scene-change effect (the "Leave this quest?" confirm at `QuestPlayerScreen.tsx:81-93` belongs to the quest screen and is unchanged).
- **Given** the device back gesture or Android hardware back, **then** it behaves like Close.
- **Given** a story with fewer than 4 scenes in the tier, a missing tier for the requested level, or an unresolved story id, **then** the fallback screen shows one line, a **Back** button, and (quest mode) a **Continue** that calls `markStepComplete(); onFinish()` so a content error never traps a quest.

### 3.4 Listening: Read to me, speaker buttons and TTS

The reader plays sound only through F-AUDIO-004's single entry point `playPrompt(spec)` (voice ranking, rate, mute, clips, capability and the text fallback all live there). Until its PRs A-3/A-4a land, `logic/story/audio-port.ts` implements the same `playPrompt` signature over today's `speak` (`platform/audio.ts:26-40`, English `en-US` and Korean `ko-KR`) and returns `'played'` or `'muted'` only; PR 2.6a swaps the import when A-4a merges. No reader logic changes.

- Every piece of English narration and every Korean line has a speaker affordance: the Korean block's speaker plays the line (`audioRef` first, else TTS `ko-KR` with `spokenKo ?? ko`); the **narration speaker** (an `Icon speaker` button at the card's top-right) plays the narration then the Korean block (`planSceneAudio` with `include: ['narration', 'korean']`). A term chip plays that term only.
- **Read to me** (a switch in the bottom bar; persisted per profile as `ProfileSettings.readToMe?: boolean`, an **additive optional field** on the schema F-I18N-001 owns — `ProfileSettingsSchema` in `schemas/locale.ts` — added in PR 2.5 with its storage test, as F-I18N-001 §3.2 requires; absent ⇒ `readToMeDefault(level)`): when on, each scene plays its narration then its Korean line **once when it opens** (not when returning with Back). Changing scenes calls `stop()`. Browsers block audio before a gesture: a scene that opens by resume (no gesture yet) does not autoplay; the first tap anywhere in the reader calls F-AUDIO-004's `unlockAudio()` and, if Read to me is on, starts the current scene — F-AUDIO-004's `blocked` result is shown as its "Tap to hear" state, never as an error.
- **Mute** (F-AUDIO-004 `audio-store`, set from Profile): `playPrompt` returns `muted`; the speaker keeps its place, the Korean text, romanization and gloss are already on screen, and the shared prompt state offers **Turn sound on** (F-AUDIO-004 §3.8). No error is shown for being muted.
- **No Korean voice** (`canPlayKorean(getCapability())` is false, F-AUDIO-004 §3.4): the Korean block shows the shared text-fallback state and the **"Say it yourself"** chip (F-STORY-003 uses the same component) in place of the speaker's result; English narration still plays (the English voice exists). The reader never blocks on audio, and subscribes to `subscribeCapability` so the chip disappears when a voice pack arrives.
- **MP3 later (F-AUDIO-004 A-6/A-9, owner task T-017)**: `KoText.audioRef` and `scene.narrationAudioRef` are placed on the `PlaySpec` (`AudioRef` pattern `audio/story/<slug>/<file>.mp3`, `AUDIO_REF_PATTERN`, F-AUDIO-004 §3.2); `playPrompt` plays the clip when it is bundled and falls back to TTS when it is not. Recordings dropped into the repo need no reader change.
- Speed: owned by F-AUDIO-004 `speechParams` (narration 1.0, sentence 0.9, word 0.85, scaled by the profile's level); the reader passes `kind`, never a rate. English narration is read in `en-US` today; a Spanish overlay is read in `es-US` (`SpeechLang`, F-AUDIO-004 §3.2, `LOCALE_META[locale].speechLang`).
- Autoplay and Hoya: nothing animates with sound; there is no lip-sync.
- Telemetry for audio is F-AUDIO-004's (`audio.fallback_shown` with `source: 'story-reader'`, `audio.playback_failed`); the reader adds none (§3.12).

### 3.5 Korean on screen: romanization, tap-for-gloss, inline terms

Rules from D2 apply to every Korean string in the reader.

- **Always three things**: Korean, romanization, gloss in the UI language, drawn by `KoreanText` so the pattern matches every other taught-Korean surface (F-I18N-001 §3.5). `romanizationShown = romanizationShown(mode, revealed)` with `mode = profile settings romanizationMode` (default `'always'`). In `'tap'` mode (an opt-in for reading practice) the romanization of the Korean block and of term chips shows after the learner taps that item, and **stays shown for the rest of that scene** (`revealed` in reader state); the gloss is never hidden.
- **Inline term chips in narration**: `{kw:sagwan}` renders a chip inline: Korean + romanization (subject to the mode above). **Tapping a chip** opens the **gloss card** — an inline card directly under the narration (not a floating popover; no overlay positioning, works with screen readers and at 200 % text): Korean (title size), romanization, gloss, a speaker (64 dp hit area), and a Close button. The tap also plays the term. One gloss card is open at a time; it closes on Close, on tapping the chip again, on Escape (web), on moving scene, and when a checkpoint opens. Opening it fires nothing to the network.
- **Tap-for-gloss on a Korean line**: the line is one tap target that plays the whole line and reveals romanization in `'tap'` mode. When the line has `words[]` (F-STORY-001 §3.2.2; optional, none authored at launch), each word is its own chip that opens the same gloss card for that word, with the whole-line gloss still shown beneath. A line without `words[]` shows the whole-line gloss only — there is no invented word-by-word breakdown.
- Keyword chips keep their Korean in a `lang="ko"` node on web and `accessibilityLanguage="ko-KR"` on iOS (done by `KoreanText`).
- **No Hangul outside a `KoreanText`**: the view model guarantees it by construction (tokens), and a unit test renders every shipped scene's `SceneView` and asserts that every `{ text }` part is Hangul-free.

### 3.6 Progress, resume, completion and leaving

- **Fill-only progress** (dots) = `furthest + 1` of `n`; it never drops on Back (D3). The "3 / 8" label is a page number.
- **Bookmarks** are F-STORY-004's (device-local, per profile, scene-level, `story:bookmarks:<profileId>`). The reader exposes a seam: `useReaderBookmark(profileId, storyId, level)` returns `{ initialIndex, save(index) }`. In PR 2.6a it is a stub (`initialIndex: 0`, `save` no-op); F-STORY-004 PR 4.4 swaps in `useStoryStore`. The reader calls `save(index)` from the `scene-changed` effect in **quest mode only** and only for `index >= 1` (F-STORY-004 §3.1); replay mode never saves. `initialIndex` is clamped with F-STORY-004's `clampScene(bookmark, sceneCount)`; a bookmark for another `level` is ignored. When the reader opens on a restored scene it fires `story.bookmark.resumed` (name owned by F-STORY-004).
- **Resume landing**: scene `initialIndex` shows with `furthest = initialIndex`; the dots show scenes up to that one as read. (Earlier scenes were read on a previous visit; the meter is a fill, not an audit.)
- **Completion** (quest mode): end page → **Continue** → `markStepComplete(); onFinish()` (`MinigameScreen.close`, `:30-39`). The reader records **no rounds** itself unless the tier defines checkpoints (§3.7), so a story quest's score comes from F-STORY-003's check and sequence steps (>= 7 scored rounds).
- **Replay mode**: no `answerRound`, no `markStepComplete`, no bookmark write, no progress write. Checkpoints in replay are shown as a gentle "Try it" with feedback but unscored (they call a no-op `onAnswer`).
- **Leaving mid-story** (quest mode): Close returns to the quest step without completing it; the bookmark remains (F-STORY-004 §3.8). If the learner then leaves the quest, the existing quest-level confirm and discard apply (`QuestPlayerScreen.tsx:81-93`).
- **Re-entry after a content update**: `index` is clamped; if a scene was removed the learner lands on the nearest valid scene; a changed scene is simply the new text (F-STORY-001 §3.7 step 5).

### 3.7 Checkpoints, culture notes, advisory, end page

- **Checkpoints** (`tier.checkpoints`, 0..2; **none in the 24 launch stories**): after the scene that has `checkpointId`, Next opens an inline question card using F-STORY-003's shared pieces (`buildCheckView`, `ChoiceCard`, the same first-try and amber-nudge rules, §3.4 of that spec). The round key is `cp:<checkpointId>`, reported through `onAnswer` → `answerRound` (quest mode only). A **Skip** ghost button is always present and records nothing (a learner is never stuck). Because the components come from F-STORY-003 PR 3.3, this behaviour ships in PR 2.9 and the reader works without it before then (a tier with checkpoints but no support simply skips them with a development-only warning).
- **Culture note** (`scene.cultureNoteId`, 0..3 per story; none at launch): a "Did you know?" chip on that scene opens an inline note card: title, body (<= 220 chars), the term as `KoreanText` with a speaker, the card art when `cardId` has art (`supportedCardIds`, `HeritageCardArt.tsx:23-56`), and — only once F-STORY-004 PR 4.7 flips `CULTURE_NOTES_ROUTE_AVAILABLE` — a "More in Culture notes" button to `CultureNotes { noteId }`. Facts behind a note appear in Sources.
- **Advisory** (`review.advisory`, F-STORY-001 §3.6): on a fresh (not resumed) quest-mode open of scene 1, a one-line **"A note for grown-ups: …"** row (`advisoryNoteEn`) sits above the art with a Dismiss control; it never blocks and never shows again in that visit; it is always shown on the Sources screen. No age wording (D1).
- **End page** (`phase: 'end'`): "The End" heading; `Hoya pose="cheering"` (one Hoya, art is not shown here); a row of up to 4 thumbnails of `sequenceSceneIds` (`StoryScene variant="thumb"`, decorative, hidden from screen readers) as a recap; for traditional tales the `origin.retellingNoteEn` line ("one version of a tale told in many versions"); buttons: quest mode — **Continue** (primary), **Read again** (ghost → `restart`), **Sources** (ghost); replay — **Done** (primary), **Read again**, **Sources**. At most one primary, two ghosts.

### 3.8 Sources screen — `screens/story/StorySourcesScreen.tsx`

This is where "references are marked exactly" becomes visible. Everything on it is generated from the story JSON by `buildSourcesView`; nothing is hand-written per story.

**Header** (top to bottom):

1. Back button; the story title (`KoreanText`: Korean, romanization, English); the **"Traditional tale"** pill for `origin.type` traditional/adapted, with `origin.noteEn` and `origin.retellingNoteEn` beneath ("One version of a story told in many versions").
2. **Reference line**: `referenceDisplay` verbatim (e.g. "Sources: 국사편찬위원회 조선왕조실록 DB (태종실록 …); 국가유산청 …") — a headline only. The exact truth is the fact list below, which is why that line is never the only evidence.
3. **Checked line**: "Checked in <N> independent passes · last checked <date> · story version <contentVer>" from `verification` and `contentVer`. A record with `scope: 'cluster'` (the research set's cluster-level pass, F-STORY-001 §3.6) is shown as recorded; the copy does not claim more than the record says. An expandable **"How it was checked"** shows `verification.notes` (reference text; may contain Hangul).
4. **Gentle note for grown-ups** (`review.advisory`), if any.
5. **Corrections** (only if any erratum has `show: true`): newest first — date, `summaryEn`, and the fact it concerns. Absent otherwise (no empty heading).

**Body** — facts grouped by the first scene that cites them, in scene order (`SectionList`):

- Section header: "Scene 3" + the scene's `captionEn` (or its first six words).
- **Fact card**: the claim (`claimEn`), the Korean claim (`claimKo`, `lang="ko"`) under a "Korean" disclosure; a scope label — "What we know" (`documented`) or "What the tale says" (`in-the-tale`); a small "Updated" tag when `rev > 1` with the matching erratum's date; then **Sources (n)**, each source as: title · publisher · "accessed <date>" · the supporting quote or locator (`quoteOrLocator`) · the URL as plain selectable text · **Copy link** · **Open link**.
- **Approximations** under the fact: "About “almost 600 years”: 1443 to 2026 is 583 years, so the story rounds it." (`approximations[].text` + `rationaleEn`); time-relative ones add "This depends on today's date."
- A fact cited again in a later scene shows a one-line "See fact f3" row linking to the card instead of repeating it.
- Final section **"Used in questions and notes"**: facts referenced only by checks or culture notes.

**Open link** (a grown-up action): not for the learner. It runs `openGrownUps`-style gating — `PinEntry { next: 'ExternalLink', url }` (additive variant, §3.1) when F-LEARN-001's `gateRequired` says a PIN gate applies, and opens directly otherwise (a self-only device with no PIN). After the gate, `Linking.openURL(url)` in a try/catch exactly like the Paywall (`PaywallScreen.tsx:33-39`); on failure the screen shows "Open this link in a browser: <url>" and the text stays copyable. Only `https:` URLs from the story's own `sources[]` are ever passed (F-STORY-001 §3.3 C4 guarantees the scheme; the function re-checks and refuses anything else). `story.sources.link_opened` fires after a successful hand-off. **Copy link** needs no gate (a string).

- **Deep links**: `factId` scrolls to and highlights that card (a `borderWidth.base` `colors.border.focus` outline plus the heading "Highlighted", not colour alone); `sceneIndex` scrolls to that scene's section.
- **Counts** ("12 facts · 31 sources") are allowed here; this is not a learner result screen.
- **Offline**: fully offline (text only). **Open link** needs a connection; the failure message says so.
- **Locale**: UI strings through `STORY_READER_COPY`/overlays; `claimEn` may be translated by overlay (`facts.<id>.claim`); `claimKo`, source titles, publishers and quotes stay in their source language by design (they are citations).
- Heading levels and a list structure; every source block is one focusable group with a label "Source 2 of 3: <title>, <publisher>"; Korean nodes `lang="ko"`.

### 3.9 SceneArt — hand-authored SVG scenes from data, tokens only (D7)

#### 3.9.1 Principles

1. **Data in, drawing out.** A scene's picture is a small JSON description (`SceneArt`, §3.9.2) that names a background *setting* and up to 8 *layers* from a registry of hand-drawn items. The drawing code lives once, in the design system; the 182 scenes are data.
2. **Tokens only.** Every colour is a path into `colors` (`'theme.rites'`, `'hoya.fur'`); every stroke width a name from `borderWidth`; no hex, no `rgb()`, no gradient, no filter, no `<image>`, no `<text>`, no emoji, no raster, no external file (D7; CLAUDE.md §4). Enforced by TypeScript types (a `ColorToken` union) and by a source-scan test.
3. **One drawing source, two renderers.** Items are renderer-neutral node trees (§3.9.3); a react-native-svg renderer serves the apps and a plain-DOM renderer serves the Next.js contact sheet. The Next app cannot import react-native-svg (it imports only the `tokens` subpath today), so a JSX-only kit could not be reviewed on the web; data can.
4. **Accuracy is part of the picture.** A tale about a real object must not draw a different object. Heritage artefacts carry a `sourceRef` and a reviewer note (§3.9.10).
5. **Smaller than the story.** A bounded budget (§3.9.7) keeps 182 scenes light.

#### 3.9.2 Data model (shape lives in `packages/content-schema/src/schemas/scene-art.ts`, F-STORY-001 §3.2.3)

```ts
SceneArt = {
  setting: 'scene:<id>',                 // background set (registry)
  layers: ArtLayer[] (0..8),
  altEn: string (1..140),                // required screen-reader description
}
ArtLayer = { ref: 'hoya:<pose>' | 'prop:<id>' | 'card:<id>', x, y, s = 1, flip?, z?, tint? }
```

- Canvas **400 x 300** (4:3), origin top-left. `x,y` place the item's **anchor** (bottom-centre of its box) in canvas units; `s` scales (0.2-3); `flip` mirrors horizontally; `z` overrides the item's default depth band; `tint` swaps the item's one declared tintable colour for another token (e.g. clothing colour) and must be a legal `ColorToken`.
- `hoya:<pose>` is one of `idle cheering thinking reading waving` (`Hoya/types.ts:1`). `card:<id>` embeds an existing heritage card picture (`supportedCardIds`) **in the react-native renderer only** (§3.9.4); the 24 launch stories use none.
- Layers draw in band order `back → mid → front`, then in array order inside a band.
- Resolution of ids is checked in tests (§5): every `ref` and `setting` in every non-draft story exists in the registry; `altEn` is present.

#### 3.9.3 The primitive set (renderer-neutral, `packages/design-system/src/scene-art/types.ts`)

```ts
export type ColorToken = /* 'brand.primary' | 'surface.paper' | 'theme.rites' | 'hoya.fur' | ... every leaf of `colors`
                           except surface.overlay, surface.inkScrim and feedback.danger */;
export type StrokeToken = 'thin' | 'base' | 'thick';              // borderWidth.thin/base/thick = 1/2/3 canvas units
export const OPACITY_STEPS = [0.08, 0.15, 0.2, 0.35, 0.6, 0.85, 1] as const;
interface Paint { fill?: ColorToken | 'none'; stroke?: ColorToken; sw?: StrokeToken; o?: typeof OPACITY_STEPS[number]; d?: true /* detail: skipped in thumb variant */ }
export type Shape = Paint & (
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'path'; d: string }                                      // absolute M L H V C Q A Z only, <= 240 chars
  | { t: 'poly'; pts: Array<[number, number]> }                   // closed polygon, 3..16 points
  | { t: 'group'; tx?: number; ty?: number; s?: number; rot?: number; flip?: true; kids: Shape[] }
);
```

Rules: eight shape kinds and no more; **no text, image, gradient, pattern, clip, mask, filter, `use`, animation or event**. Linecap and linejoin are always round. Coordinates are multiples of 0.5. `group` is the only nesting and only one level deep inside an item. Colours resolve through `resolveColor(token): string` (reads `colors[group][name]`); an unknown token throws in tests and renders nothing in production.

```ts
export interface ItemDef {                 // a prop, a figure or a setting piece
  id: string;                              // 'prop:fig-historian' | 'scene:palace-hall'
  kind: 'figure' | 'object' | 'architecture' | 'nature' | 'furniture' | 'symbol' | 'setting';
  box: { w: number; h: number };           // local coordinates; anchor = (w/2, h)
  z: 'back' | 'mid' | 'front';
  tintable?: ColorToken;                   // the one colour a layer's `tint` replaces
  nodes: Shape[];
  alt: string;                             // contact-sheet label and default alt fragment
  sourceRef?: { title: string; publisher: string; url: string; accessed: string };   // required for heritage artefacts
  accuracyNote?: string;                   // what is simplified, for the culture reviewer
  horizonY?: number;                       // settings only
}
```

Pure functions in `scene-art/` (outside `components/`, so they count toward the 85 % design-system lane): `resolveScene(art, registry): ResolvedScene` (orders layers, applies anchor/scale/flip/tint, returns a flat transformed node list and `stats = { layers, shapes, colors: ColorToken[], bounds }`), `thumbVariant(nodes)` (drops `d` shapes and `thin` strokes), `paletteOf(item)`, `nodeCount`, `boundsOf`, `checkItem(item): Finding[]` and `checkScene(art, registry): Finding[]` (the rules of §3.9.5).

#### 3.9.4 Registry, Hoya, cards and renderers

- **Files** (all under `packages/design-system/src/scene-art/`): `types.ts`, `tokens-map.ts` (`resolveColor`, `ColorToken`), `resolve.ts`, `rules.ts`, `hoya.ts` (`hoyaNodes(pose): Shape[]`), `settings/*.ts`, `props/*.ts` (grouped: `people.ts`, `writing.ts`, `books.ts`, `architecture.ts`, `nature.ts`, `objects.ts`, `science.ts`, `festival.ts`, `food.ts`), `registry.ts` (`SCENE_ART_REGISTRY: Record<string, ItemDef>`, `hasItem(ref)`), `index.ts` (pure, no React, no react-native).
- **Hoya**: `hoyaNodes(pose)` is a **data port** of `Hoya.tsx`'s geometry (head 44 r, ears, stripes, belly, eyes per pose, mouth per pose, ThoughtCloud/CheerSparkles/Book accents) onto the same 128-unit box, preserving the contract in its header comment (thinking looks up-right, cheeks only in idle/cheering/waving, no sharp teeth). `Hoya.tsx` is **not** changed (it has animation and is used everywhere); a parity guard keeps the two honest: the contact-sheet library page shows `hoyaNodes(pose)` for all five poses next to the shipped component's reference image from the design-preview components page, and a test asserts the data port uses only tokens that `Hoya.tsx` uses (a text-scan of the two files). Refactoring `Hoya.tsx` to render from `hoyaNodes` is a recorded follow-up (§4).
- **Cards**: `card:<id>` is resolved by the **react-native renderer only**, by nesting `<HeritageCardArt>` as a sub-`Svg` at the layer's position (react-native-svg supports nested `Svg` with x/y/width/height). The web contact sheet shows a labelled placeholder box for card layers ("card:hangul-day — shown in the app"), because `HeritageCardArt` is JSX. Converting the 30 card drawings to data is out of scope (§4). Reserved for F-CARD-S5-001 key scenes.
- **Renderers**:
  - `components/StoryScene/StoryScene.tsx` (react-native-svg; maps `Shape` → `Rect/Circle/Ellipse/Line/Path/Polygon/G`), exported from the package index like the other components.
  - `scene-art/dom.tsx` (React DOM, 40 lines: maps `Shape` → `<rect>`, `<circle>`, … ; no react-native) exported through a new package subpath `"./scene-art": "./src/scene-art/index.ts"` and `"./scene-art/dom": "./src/scene-art/dom.tsx"` in `packages/design-system/package.json` (today's exports are `.`, `./tokens`, `./components/*`, lines 8-12). The web app imports only those subpaths, never the package root (the root pulls react-native).

#### 3.9.5 Composition rules (`rules.ts`; `checkItem`/`checkScene` are run by tests and by the contact sheet)

Item rules (R-I): at most **40 shapes** for a prop (setting: 60); at most **5 distinct colour tokens** per prop (setting: 6); every shape inside `box`; `d` (detail) shapes <= 50 % of an item; no `feedback.danger`, no `surface.overlay`/`inkScrim` (types forbid them); `brand.primary` (the dancheong vermilion, the only red) at most 15 % of an item's shapes; a face, where one exists (Hoya, animals), **smiles or is calm** — no frown, no teeth; **people are faceless by design** (a blank `surface.paper` oval with a `border.strong` outline, hair/hat/clothing carry identity), so no historical figure has an invented likeness and no ethnicity is encoded by a skin token; heritage artefacts (`kind: 'object'` with `heritage: true` in its tags) need `sourceRef` (§3.9.10); serialised size <= 3 KB (setting <= 6 KB).

Scene rules (R-S):

1. **Canvas and bands**: every layer lies within the canvas (the anchor within 0-400 x 0-300; the item's bounds may overhang by <= 20 units, e.g. a figure entering from the edge). Items draw in `back → mid → front`.
2. **Horizon**: the setting declares `horizonY`; upright items stand with their anchor `y >= horizonY` (feet on the ground) unless `kind` is `nature` sky/`symbol`.
3. **One focal point**: exactly one layer is the focus — the largest `mid` item or Hoya; it sits within the central third horizontally or on a third line; no two layers overlap more than 60 % of the smaller one's bounds unless one is `back`.
4. **Hoya**: at most one per scene, scale 0.5-1.1 (48-106 canvas units tall); placed in the lower 60 % of the canvas; never covering the focal artefact; a "peek" (partly hidden behind a `front` prop) is allowed.
5. **Palette**: <= 8 distinct colour tokens per scene (stage-5 cards use the same bound, F-CARD-S5-001), at least 2 of them from `surface.*`/`text.*` so the picture reads on `surface.canvas`; the focal item's dominant fill differs from the setting's ground fill.
6. **Legibility at thumb size**: the focal item is >= 25 % of the canvas height; the scene still reads after `thumbVariant` (>= 3 shapes remain in the focal item).
7. **No text in the image**: writing, inscriptions and books are drawn as stroke rows (`prop:writing-lines`) and blank pages; letter shapes appear only as drawn *shapes* in props such as `prop:jamo-g` (path geometry, with alt text), never as glyphs.
8. **Layers <= 8; resolved shapes <= 160** (full) and **<= 80** (thumb).
9. **Alt text**: `altEn` states what is shown and what it means in one sentence (<= 140 chars) — not "Hoya smiling" alone; it never contains Hangul (a `{kw:}`-free plain sentence), never starts with "Image of".
10. **No violence or fear** in depictions: no weapons pointed at figures, no fire shown consuming, no frightened faces (faces are blank or smiling anyway). A scene whose narration has an advisory (`war`, `loss`, `mild-peril`) shows the *setting and objects*, not the event.

#### 3.9.6 Contact-sheet review — `/design-preview/scenes` (and `/library`)

Extends the F-VR-001 surface (`docs/specs/F-VR-001-visual-regression-surface.md`); Next.js App Router, static export (`apps/web/next.config.js` `output: 'export'`). Server components read `content/stories/*.json` **at build time** with `node:fs` (path `path.resolve(process.cwd(), '../../content/stories')` from `apps/web`) and render with `scene-art/dom`; drafts are included (marked), so art can be reviewed before a story is `ready`.

- **`/design-preview/scenes`** — one section per story (title, state, kind, origin pill, verification passes), one row per scene with five cells: **[render 320x240] [brief]** (`artBrief` verbatim) **[narration with `{kw}` chips and the cited facts' claims + source titles]** (this is the claims audit F-STORY-001 C6 relies on: a reviewer reads narration and evidence side by side) **[layers table: ref, x, y, s, z]** **[findings from `checkScene` and `lintStory`]**. Toggle for a 4-up thumbnail grid (160 x 120) and a 96-wide "sequence card" size. Header counts: stories, scenes, with art, `artPending`, draft, findings (errors / warnings).
- **`/design-preview/scenes/library`** — every setting and prop at three sizes (full, 96, thumb variant) with id, kind, box, colour tokens used (swatches), shape count, bytes, `sourceRef` link, `accuracyNote`, and the five Hoya poses (`hoyaNodes`) beside the shipped Hoya reference for the parity check.
- **Review checklist** (printed on the page and pasted into every art PR): brief represented (deviations listed) · accuracy of artefacts and costume against `sourceRef` · palette and bands · focal point · readable at 96 px · smiles/faceless rule · no text/emoji/raster · alt text useful · no violence · budgets pass. The reviewer is the owner or the culture reviewer; approval is the PR approval plus, for each story, setting `review.culture` in F-STORY-001's file (that is the sign-off, F-STORY-001 §3.6).
- Preview deploys per PR already exist (`.github/workflows/preview-deploy.yml`), so reviewers open the PR's preview URL; art PRs include a screenshot of each cluster section.
- The pages are `noindex` and not linked from the landing page (as the existing design-preview pages).

#### 3.9.7 Bundle and performance budget

| Budget | Limit | Enforced by |
|---|---|---|
| Registry (all settings + props + Hoya), serialised JSON | <= 200 KB raw, <= 55 KB gzip | `scene-art/__tests__/budget.test.ts` (`zlib.gzipSync`) |
| Any prop / any setting | <= 3 KB / <= 6 KB; <= 40 / <= 60 shapes | `checkItem` |
| One scene description (`art`) in story JSON | <= 700 bytes; <= 8 layers | `checkScene`, counted in F-STORY-001's story budget |
| Scene art for the 182 launch scenes | <= 130 KB raw (mean 450 B x 182 = about 82 KB estimated) | `build-stories.mjs --report` (part of F-STORY-001's 1.0 MB) |
| Resolved shapes per scene | <= 160 full, <= 80 thumb | `checkScene` |
| Library or shelf grids | thumbnails use `variant="thumb"` and virtualised lists (`FlatList`) | F-STORY-004 uses `StoryScene variant="thumb"` |

Estimated library size (to be replaced by the measured demand report of PR 2.10): about **14 settings and 90 props** (including 12 figure archetypes) from a word-frequency pass over the 182 briefs — recurring subjects: Hoya (103 scenes), books and thread-bound books, brush/ink/paper/hanji, palace hall and courtyard, king and officials, historian, hanbok-wearing family and children, mountain, stone and bronze instruments, wooden woodblocks, festival items. At about 1 KB per prop that is about 100-120 KB raw, inside the 200 KB cap. `React.memo` on `StoryScene` by `art` identity; no animation inside art.

#### 3.9.8 How the ~180 scenes get illustrated (authoring pipeline)

The heritage files carry an `illustration` sentence per scene; the importer stores it as `artBrief` (F-STORY-001 §3.10). Turning it into `art` is manual authoring against a shared kit, one cluster at a time:

1. **Demand report** — `node scripts/art-demand.mjs [--src content/stories]` reads every scene's `artBrief`, matches it against `scripts/art-lexicon.json` (keyword → candidate `scene:`/`prop:` ids, grown as the library grows) and prints, per scene, the setting and props it wants, then the global list of **missing items by frequency**. It is a planning aid, not an authority; unmatched words are listed for a human.
2. **Library batch** — build the missing settings/props for the cluster first (each an `ItemDef` in `props/*.ts`), in the house style, with the contact-sheet library page open. Reuse before inventing: a "hanbok child" is one figure with a `tintable` garment, not six figures.
3. **Compose** — for each scene write `art`: choose the `setting`; list layers back to front (usually 1-2 back, 1-3 mid, 0-2 front, Hoya if the brief has him); set `x,y,s`; write `altEn`. Keep the brief: `artBrief` stays in the file as provenance.
4. **Check** — run `pnpm --filter @hangul-route/design-system test` (rules) and open `/design-preview/scenes`; fix findings.
5. **Deviation rule** — a brief may ask for something the kit cannot draw (a close-up of hands holding a brush, a crowd of 12). Simplify to what carries the meaning (a brush, an inkstone and sheets; four figures) and list the deviation in the PR; if the simplification would change a fact (e.g. the number of historians) say the number in the narration instead, never in the picture.
   Worked example (scene `s2` of `sillok-royal-historians`; ids are illustrative until the library batch exists). Brief: *"A Joseon palace hall: the king on a raised seat, officials kneeling in rows, and at the side a historian in official dress and a black hat writing with a brush on paper."* becomes

   ```json
   "art": {
     "setting": "scene:palace-hall",
     "layers": [
       { "ref": "prop:dais-screen",           "x": 200, "y": 150, "z": "back" },
       { "ref": "prop:fig-king-seated",       "x": 200, "y": 160 },
       { "ref": "prop:fig-officials-kneeling","x": 150, "y": 245 },
       { "ref": "prop:fig-historian-writing", "x": 335, "y": 250 }
     ],
     "altEn": "In a palace hall a king sits on a raised seat while officials kneel and a historian at the side writes with a brush."
   }
   ```

   The brief has no tiger, so there is no `hoya:` layer. `artBrief` stays beside `art` in the file.
6. **Review** — reviewer checklist (§3.9.6); `review.culture` is set only after the story's scenes pass.
7. **Cadence**: four art PRs, one per cluster (about 45 scenes each) — `records-joseon` (36 scenes, historians, palace, books), `hangul-printing` (44), `science-art-life` (43), `seasons-tales` (46, the festival and folk-tale props) — each a library batch plus scenes. Effort per cluster is an unverified estimate of 1-2 days for a developer authoring with Claude and reviewing on the contact sheet.

A scene may ship with `artPending: true` (F-STORY-001): the reader shows the tinted fallback (§3.9.9) with the narration, so a story is never blocked by a missing picture, but the shelf gate in F-STORY-004's integrity test lists pending scenes.

#### 3.9.9 `StoryScene` component

`packages/design-system/src/components/StoryScene/{StoryScene.tsx,types.ts,index.ts}`, exported from `src/index.ts`; tokens only; no business logic (it calls `resolveScene`).

```ts
interface StorySceneProps {
  art?: SceneArtLike;                 // structural twin of the content-schema type (design-system does not depend on content-schema)
  theme?: ThemeKey;                   // tint for the fallback
  variant?: 'full' | 'thumb';         // thumb drops detail shapes
  width?: number;                     // dp; height = width * 3 / 4
  fallback?: ReactNode;               // centred on the tint (e.g. the Korean title) — F-STORY-004 tile
  decorative?: boolean;               // true: hidden from assistive tech (recap thumbnails)
  accessibilityLabel?: string;        // default: art.altEn
  testID?: string;
}
```

- `art` absent, `artPending`, an unresolved `setting`, or a thrown resolve error → a rounded panel of `colors.theme[theme]` at opacity 0.15 with `fallback` centred; **never a broken image, never an error box**. Unresolved *layers* are skipped (the rest of the scene draws); in `__DEV__` a console-free warning is returned through `onResolveIssue?` for the screen to show a dashed `border.strong` outline.
- A compile-time assertion in `apps/mobile` (`const _check: SceneArtLike = {} as SceneArt;` in a test file) proves the two types stay assignable.

#### 3.9.10 Accuracy of what is drawn

- Heritage artefacts (rain gauge, sundial, water clock, woodblocks, metal type, books of the Annals, uigwe, Hunminjeongeum, the printing houses and archives) are `kind: 'object'` or `architecture` with `heritage` tag. Each needs a `sourceRef` (a museum or heritage-portal page showing the object — same citation shape as a fact source) and an `accuracyNote` (what is simplified). A test fails an artefact without them.
- Costume and architecture are period-labelled in `alt` (`"Joseon official's black hat"`); a culture reviewer checks them on the contact sheet. Where the sources do not support a detail the picture omits it (no invented inscriptions, seals or ranks).
- Hoya is a guide, not a participant in historical events: briefs that put him inside an event are drawn with him beside it (the narration already frames him as an observer).

### 3.10 Accessibility, reduced motion, text size, layout

- **Targets**: every control >= `touchTarget.min` 64; Next is `size="hero"`. Term chips and the Korean block have a 64 dp minimum hit area even when the glyphs are smaller.
- **Reading order** (screen reader and keyboard): top bar → art (label = `altEn`) → traditional-tale pill → narration (chips are buttons: "Korean word sagwan, royal historian. Double tap to hear") → Korean block → chips → Read to me → Back → Next. Scene change announces "Scene N of M" then the art description (`AccessibilityInfo.announceForAccessibility`; web: the narration heading takes focus with `tabIndex=-1`).
- **Keyboard (web)**: Right/Left arrows = Next/Back, Escape closes the gloss card or the leave sheet, Enter/Space activate buttons; visible focus ring `colors.border.focus` (>= 3:1, `tokens.ts` comment on `focus`). No key repeats advance past the last scene.
- **Colour is never the only cue**: current scene = dots + "3 / 8"; correct/hint states of checkpoints per F-STORY-003; a highlighted fact card = outline + word.
- **Reduced motion** (`useReducedMotion()`): scene swap is instant; no cross-fade, no art motion; Hoya's pose pulse is already skipped by the component. No parallax, no auto-advance, no shake, ever.
- **Text size**: all text uses `typography` tokens and scales with the OS font scale; verified at 200 %; the narration area scrolls, the bottom bar never leaves the screen; no fixed heights.
- **Layout verified at**: 320x568, 375x667, 768x1024, 844x390 (landscape), and the 480 px web column.
- **Sound is never required** (audio-plan rule "every sound has a visual backup", `docs/design/audio-plan.md`): all information is also text.
- **Language**: `lang`/`accessibilityLanguage` on every Korean node; English narration in the UI language when an overlay exists.
- No emoji anywhere in rendered output; icons only from the design-system set.

### 3.11 Offline, errors, empty states

| State | Behavior |
|---|---|
| Story or tier not found, < 4 scenes | one-line message, Back, and in quest mode Continue (§3.3) |
| Art missing or unresolved | tinted fallback panel with the narration; reading continues |
| TTS missing or muted | text only, shared fallback state and "Say it yourself" chip (F-AUDIO-004 §3.8); `audio.fallback_shown` is F-AUDIO-004's |
| `audioRef` file missing (future) | falls back to TTS; then to text |
| No network | the reader is fully offline (bundled JSON, SVG, TTS); Sources text works; **Open link** shows the offline message |
| Storage unreadable | bookmark seam returns scene 0 (F-STORY-004 never throws); Read to me default by level |
| Story updated while open | the open reader keeps its in-memory copy until closed |
| Sources: story without facts | cannot happen for a `ready` story (F-STORY-001 requires >= 1 fact); defensively shows "No sources are listed for this story." |

### 3.12 Telemetry

Append to the `TELEMETRY_EVENT_NAMES` array (`packages/content-schema/src/schemas/telemetry.ts`, lines 9-43 at `c939348`) and to the exact-list assertion in `packages/content-schema/src/__tests__/telemetry.test.ts` (lines 5-43); the Worker whitelist is the same list. **Deploy the Worker before the app release** (an unknown name returns 422 and the client drops it, `platform/telemetry.ts:40-58`). Payloads carry ids and counts only. Added to `TELEMETRY-NAMES.md` (3 new names, listed in `TELEMETRY-NAMES-2.md`; none collides with the existing 32, the 26 of review 1 or F-AUDIO-004's four `audio.*` names).

| Event | Fired | Payload |
|---|---|---|
| `story.read.finished` | the end page is reached (once per mount) | `{ storyId, level, mode: 'quest' \| 'replay', scenes, scenesSeen, linesPlayed, termsOpened }` |
| `story.sources.opened` | Sources screen mounts | `{ storyId, from: 'reader' \| 'end' \| 'episode' \| 'notes' \| 'scene', factId? }` |
| `story.sources.link_opened` | after the gate, on a successful hand-off | `{ storyId, factId }` |

Audio problems are reported by F-AUDIO-004 (`audio.fallback_shown`, `audio.playback_failed`) with `source: 'story-reader'`; the reader defines no audio event. `story.opened`, `story.bookmark.resumed` (F-STORY-004), `minigame.finished`, `quest.*` are unchanged and keep firing. No per-scene or per-tap event is defined (privacy and noise).

### 3.13 Storage, backend, sync

No D1 migration, no API route, no `ProgressSnapshot` field. One additive optional field in the local profile settings (`readToMe?: boolean` under `settings:${profileId}`, owned by F-I18N-001's schema). Bookmarks are F-STORY-004's key. The only shared-package changes the Worker sees are the telemetry name list and the `story-read` kind.

### 3.14 Behaviours of Sources, listening and art (Given / When / Then)

(The reader's own behaviours are the Given/When/Then lines of §3.3.)

| # | Given | When | Then |
|---|---|---|---|
| 1 | a story with one erratum of `show: true` | Sources opens | a "Corrections" section lists it newest first with its date and `summaryEn`; with no visible erratum there is no such heading |
| 2 | a fact cited by scenes 2 and 5 | Sources opens | the fact card sits under "Scene 2" and the "Scene 5" section shows only "See fact f3" linking to it |
| 3 | a device with a PIN and a source link | **Open link** is tapped | `PinEntry { next: 'ExternalLink', url }` opens first; after the gate `Linking.openURL(url)` runs; only on success `story.sources.link_opened` fires; on failure "Open this link in a browser: <url>" shows and the text stays copyable; a self-only device with no PIN opens it directly |
| 4 | the same screen | **Copy link** is tapped | the URL is copied with no gate |
| 5 | Read to me on, a scene opens after a tap | the scene appears | its narration then its Korean line play once; Back does not replay; changing scene stops the audio; nothing ever advances the scene |
| 6 | the browser blocks audio before any gesture (resume landing) | the reader opens | nothing plays, the first tap anywhere calls `unlockAudio()` and starts the current scene if Read to me is on |
| 7 | no Korean voice on the device | a scene with a Korean line opens | the text, romanization and gloss are shown, the speaker is replaced by the shared fallback state and "Say it yourself", English narration still plays |
| 8 | a scene with `art` absent or `artPending: true` | it renders | the tinted fallback panel with the narration shows; no broken image, no error box |
| 9 | an item `prop:` with no `sourceRef` that is tagged as a heritage artefact | `registry.test.ts` runs | it fails |
| 10 | a `{kw:id}` token whose keyword is missing from the bundle | `buildSceneView` runs | it does not throw; the bare Korean is shown, never the raw `{kw:…}` text |

## 4. Out of scope

- Checks UI, Story Order v2, Results extras (F-STORY-003); shelf, Home card, bookmark storage, Culture notes screen (F-STORY-004); Stage 5 volumes (F-STORY-005); episode card awards (F-STORY-006).
- Recorded audio and the Korean-voice capability check themselves (F-AUDIO-004): this spec calls them through a seam.
- Animated scenes (F-MOTION-012), full narration audio production (F-MOTION-013), branching choices, drag gestures, a "My Story" retell, word-by-word authored breakdowns (the schema field exists; none authored).
- Converting `HeritageCardArt`'s 30 drawings and the `Hoya` component to data, and refactoring `Hoya.tsx` to render from `hoyaNodes` (follow-up; parity guard in the meantime).
- Raster art, AI-generated images, emoji, third-party illustration packs, Lottie.
- A native content-advisory channel, in-reader feedback/report-an-error button (a mailto/support route is a follow-up; the correction process is F-STORY-001 §3.7).
- Translating the launch stories (overlays are supported; content is later).

## 5. Tests

TDD; mobile vitest only picks up `src/{logic,store,content,config,platform}/**/*.test.ts` (`apps/mobile/vitest.config.ts:21-27`) and design-system covers everything but `src/components/**` (`packages/design-system/vitest.config.ts:13`), so screens are covered by Playwright and geometry/rules live outside `components/`.

| File | Level | Coverage focus | Target |
|---|---|---|---|
| `mobile/logic/story/__tests__/reader-state.test.ts` | unit | init at 0 and mid-story; next/back clamp; furthest only grows; end page and back from end; checkpoint phase and skip; `tapTerm`/`closeTerm`/`reveal` cleared on scene change; effects order (`scene-changed` before `answer`); restart | 100 % |
| `…/scene-view.test.ts` | unit | token split; unknown token fallback; word vs line; levels; overlay field missing → English; `{ text }` parts Hangul-free for **every shipped story** | 100 % |
| `…/scene-audio.test.ts` | unit | narration split into en/ko `PlaySpec`s with the right `kind`; `spokenKo` and `audioRef` precedence; displayed-language rule (overlay missing → `en-US`); `include` options; jamo term; no `rate` set | 100 % |
| `…/audio-runner.test.ts` | unit | sequence chaining with a fake `playPrompt`; `stop()`; a newer `play()` ends the old chain even when the superseded prompt resolves `played`; `muted`/`unavailable` on a Korean step stops the rest; status reported | 100 % |
| `…/reader-settings.test.ts`, `sources-view.test.ts`, `story-reader-copy.test.ts` | unit | default by `levelOrder`; fact grouping by first scene, repeated-fact references, corrections order, approximations, "used in questions" bucket, counts; banned-word scan | 100 % |
| `design-system/src/scene-art/__tests__/resolve.test.ts` | unit | anchor/scale/flip/tint math; band ordering; bounds; thumb variant; unresolved ref skipped | lane >= 85 % (target 100 % for `scene-art/`) |
| `…/rules.test.ts` | unit | every R-I and R-S rule with a passing and failing item/scene (shape caps, colour caps, red share, focal point, Hoya count/scale/placement, band, canvas, alt text, thumb legibility) | same |
| `…/registry.test.ts` | unit | every registry entry passes `checkItem`; ids unique and well-formed; every heritage artefact has `sourceRef` + `accuracyNote`; `hoyaNodes` for 5 poses pass; every token resolves | same |
| `…/tokens-only.test.ts` | unit | source scan of `scene-art/**` for `#[0-9a-f]{3,8}`, `rgb(`, `hsl(`, `<text`, `<image`, emoji ranges; fails on any | same |
| `…/budget.test.ts` | unit | registry <= 200 KB raw / 55 KB gzip; per-item caps | same |
| `…/hoya-parity.test.ts` | unit | tokens used by `hoyaNodes` ⊆ tokens used by `Hoya.tsx`; five poses present | same |
| `content-schema/src/__tests__/story-content.test.ts` (F-STORY-001) + `mobile/content/__tests__/story-art.test.ts` | integration | every non-draft story's `setting` and `ref`s exist in `SCENE_ART_REGISTRY`; `checkScene` has no error for any scene; no scene without `altEn`; `artPending` count reported | n/a |
| `mobile/content/__tests__/scene-art-type.test.ts` | type | `SceneArt` (content-schema) assignable to `SceneArtLike` (design-system) | n/a |
| `mobile/logic/story/__tests__/telemetry-names.test.ts` | unit | the three names are in `TELEMETRY_EVENT_NAMES` | n/a |
| `content-schema/src/__tests__/telemetry.test.ts` | unit | exact list updated | 100 % |
| `apps/web` contact-sheet smoke (`apps/web/e2e/scene-sheet.spec.ts`) | e2e (Playwright) | `/design-preview/scenes` renders every fixture scene without a console error; counts match; library page lists five Hoya poses | — |
| `mobile/e2e/web/story-reader.spec.ts` | e2e (Playwright) | open a story from a quest step, read all scenes with Next, Back works, dots only fill, end page, Continue returns to the quest; Read to me toggle; mute → text only (fake `speechSynthesis` from F-AUDIO-004's test support); tap a term → gloss card with romanization and gloss, Escape closes; romanization hide-until-tap setting; Sources from the top bar lists facts, sources, "Open link" asks for the gate; reduced motion; 320x568 and 844x390 CTA visible; no emoji in the DOM | — |
| `mobile/e2e/web/story-reader-resume.spec.ts` | e2e | (after F-STORY-004 PR 4.4b) leave at scene 3, reopen at scene 3 | — |

E2E content: until real `ready` stories exist, the e2e build runs `node scripts/build-stories.mjs --include-fixtures` (adds `packages/content-schema/src/__fixtures__/story/valid.ready.json` with a `shelf` block to the generated module for that build only, not committed) — this flag is added to F-STORY-001's generator in PR 2.6b (unverified wiring with the existing `build:web` script, §7).

Coverage lanes (CLAUDE.md §6): `apps/mobile/src/logic` >= 90 % (this feature's `logic/story/` files at 100 %); `packages/design-system` >= 85 % (the new `scene-art/` pure code at 100 %; `components/**` is excluded by config); `packages/content-schema` 100 %. Visual regression: the contact sheet is the surface (F-VR-001); add the `StoryScene` fallback and three art sizes to `/design-preview/components`. Manual QA before ship: VoiceOver and TalkBack through three scenes, a gloss card and Sources; 200 % text; offline with no Korean voice; reduced motion; a 320 dp device.

## 6. Rollout

No feature flag: the reader and Sources screen render only for story quests and the replay route, and no story reaches them until F-STORY-004's shelf and F-STORY-001's content are in. Telemetry names deploy with the Worker first. PR order (branches `feat/story-reader-*`, `feat/scene-art-*`):

| # | PR | Depends on |
|---|---|---|
| 2.0 | `design(wireframe)`: promote `wireframes/story-reader.md` into `design/wireframes/story/{reader,sources,term-gloss}.md`; briefs `21-story-reader.md`, `26-story-sources.md`; component brief `components/story-scene.md` and `scene-art-style.md` (the §3.9.5 rules as a style guide); update `design/wireframes/README.md`, `docs/blueprints/10-app-map.md`, `docs/specs/README.md` | F-STORY-001 ready |
| 2.1 | `feat(content-schema)`: `story-read` kind, telemetry names (+ list test) | — |
| 2.2 | `feat(design-system)`: `scene-art/` core: types, tokens-map, resolve, rules, tests (budget/tokens-only/rules) | — (pure; can start now) |
| 2.3a | `feat(design-system)`: `hoya.ts` data port, `StoryScene` (RN renderer), `scene-art/dom.tsx`, package subpaths `./scene-art` and `./scene-art/dom`, the Hoya parity test | 2.2, F-STORY-001 PR 1.1a (`SceneArt` shape) |
| 2.3b | `feat(design-system)`: first library batch (3 settings, about 12 props) for the flagship stories, with `sourceRef` / `accuracyNote` on every artefact | 2.3a |
| 2.4 | `feat(web)`: `/design-preview/scenes` and `/library` + e2e smoke | 2.3a, F-STORY-001 1.7 (drafts to render) |
| 2.5 | `feat(mobile)`: `logic/story/` reader logic + copy + `ProfileSettings.readToMe` (additive, on the schema F-I18N-001 PR 1 merged as #100) + tests (100 %) | F-STORY-001 PR 1.1b |
| 2.6a | `feat(mobile)`: `StoryReaderView` (the pure-view-model-driven component), `StoryReaderScreen` (replay route), routes in `navigation/`, `useReaderBookmark` stub, `audio-port.ts` (swapped for F-AUDIO-004 A-4a when it merges), telemetry names + emit, e2e for the replay route | 2.1, 2.3a, 2.5, F-I18N-001 PR 4 (`KoreanText`) |
| 2.6b | `feat(mobile)`: `StoryReadGame`, `MinigameScreen` `story-read` case, the `--include-fixtures` generator flag, quest-mode e2e | 2.6a, F-STORY-003 PR 3.2a (ref grammar), F-STORY-001 PR 1.4 (generator) |
| 2.7 | `feat(mobile)`: `StorySourcesScreen`, `PinEntry` `'ExternalLink'`, sources telemetry, e2e | 2.5, 2.6a |
| 2.8 | `feat(mobile)`: culture-note chip and card, advisory row, end page recap | 2.6b |
| 2.9 | `feat(mobile)`: checkpoints inline | 2.6b, F-STORY-003 PR 3.3 (`ChoiceCard`) and 3.2b |
| 2.10a-d | `feat(art)`: per-cluster library batch + scene `art` for that cluster's six stories (data in `content/stories/*.json`), demand report script and lexicon in 2.10a | 2.3b, 2.4, F-STORY-001 1.7 |
| 2.11 | `refactor(design-system)` (optional, later): `Hoya.tsx` renders from `hoyaNodes` | 2.3a |

Cross-spec order: F-STORY-001 → F-STORY-002 (2.0-2.8) ∥ F-STORY-003 PR 3.0-3.3 → F-STORY-004 PR 4.4b (bookmark wiring) → 2.9, 2.10. PRs 2.1 and 2.5 can start as soon as F-STORY-001 PR 1.1a/1.1b is merged (2.2 needs nothing).

## 7. Dependencies

Upstream:

- **F-STORY-001**: `Story`/`Tier`/`Scene`/`sceneKorean`/`parseNarration`/`parseStory`/`facts`/`verification`/`errata`/`origin`/`review`, `SceneArt` shape, `ART_CANVAS`, `artBrief`, generator (the `--include-fixtures` flag is added by 2.6b). **F-QUEST-002 Q-1**: `KoTextSchema`. **F-STORY-003**: ref grammar and `StoryScope` (PR 3.2a), `ChoiceCard` (PR 3.3) and the check view for checkpoints (PR 3.2b). **F-STORY-004**: `useStoryStore`, `clampScene`, `story.opened`, `story.bookmark.resumed`, `CULTURE_NOTES_ROUTE_AVAILABLE`, the links to Sources.
- **F-I18N-001**: `KoreanText` (PR 4), `romanizationShown`, `ProfileSettings` (`readToMe` is added additively), overlays (`story:` row added by F-STORY-001 PR 1.3). **F-AUDIO-004**: `playPrompt`, `PlaySpec`, `speechParams`, `getCapability` / `canPlayKorean` / `subscribeCapability`, `unlockAudio`, the shared prompt-state fallback (PRs A-3, A-4a; the reader uses `logic/story/audio-port.ts` until then). **F-LEARN-001**: `levelOrder()`, `gateRequired`. **F-CNT-002**: romanization correctness of every Korean string the reader prints.
- Existing: `MinigameScreen`, `QuestPlayerScreen`, `useQuestRunStore`, `platform/{audio,motion,telemetry}`, `Screen`, `Button`, `Card`, `Pill`, `Progress`, `Icon`, `HeritageCardArt`, `Hoya`, `tokens`.

Downstream: F-STORY-003/004/005/006, F-CARD-S5-001 (key-scene art), F-VOC (picture refs), F-TCH-004.

**Assumptions I could not verify** (each with a stated fallback):

1. `react-native-web` 0.19's `Linking.openURL` opens a new tab with `noopener` (the Paywall relies on it, `PaywallScreen.tsx:35`, but the option was not read). Fallback: a `platform/external-link.ts` wrapper using `window.open(url, '_blank', 'noopener,noreferrer')` on web.
2. react-native-svg 15.8 nested `<Svg x y width height viewBox>` renders `HeritageCardArt` correctly inside a layer on iOS, Android and web. Fallback: skip `card:` layers (none are used at launch).
3. The cost of resolving and rendering about 100-160 SVG nodes per scene on a low-end Android device (the budget numbers are design limits, not measurements). Fallback: raise the thumb threshold, memoise per-scene resolved node lists, cap Library tiles per screen.
4. Whether `speechSynthesis` on iOS Safari plays a chain of awaited `playPrompt` calls without a fresh gesture for each. F-AUDIO-004 reports a refused utterance as `blocked`; fallback: the first tap of each scene starts the sequence and the learner taps the speaker.
5. That the contact-sheet page can read `../../content/stories` during `next build` in the Cloudflare/GitHub preview build (build working directory and monorepo layout). Fallback: a prebuild step copies the JSON into `apps/web/src/data/generated/` (the existing `stage1-cards.ts` mirror pattern).
6. The art authoring effort (1-2 days per cluster) and the library size estimate (14 settings, 90 props).
7. `--include-fixtures` wiring into the existing `build:web` script and Playwright setup (`apps/mobile/playwright.config.ts` was not read in detail).
8. The Hoya data port will look identical to the shipped component; the parity check is visual (contact sheet) plus the token-subset test, not pixel comparison.

## 8. Decisions

Binding owner decisions and how this spec applies them:

| Id | Applied here |
|---|---|
| D1 | No age labels in the reader or advisory; Read to me defaults come from `levelOrder`, never an age; copy never says "for kids"; Hoya's warmth, no nursery tone |
| D2 | Korean always with romanization + UI-language gloss via `KoreanText`; hide-until-tap honoured as an opt-in, gloss never hidden; Korean terms inside narration are tokens, never Hangul in prose; UI strings via `STORY_READER_COPY`/catalogue |
| D3 | Fill-only dots; no timer, no auto-advance, no score on reading; checkpoints use the amber nudge and skip; counts on Sources are not learner results |
| D4 | The reader consumes bundled JSON generated from `content/stories/`; Sources are built from the file's `facts[].sources[]` |
| D5 | The reader draws no lock or "Premium" anywhere |
| D6 | TTS now (through F-AUDIO-004's `playPrompt`, or the interim port) with a visible text fallback and a "Say it yourself" chip; `audioRef` / `narrationAudioRef` carried on the `PlaySpec` |
| D7 | Hand-authored SVG from data, tokens only, no emoji, no raster, no external assets; enforced by types and a source-scan test |
| D8 | Spec id F-STORY-002 |
| D13 | The reader prints romanization exactly as stored (F-CNT-002 owns correctness) |
| D14 | The Sources screen shows each statement's fact, sources, quote, access date and corrections; traditional tales are labelled |

Decisions made in this spec:

1. **The reader is a minigame kind (`story-read`) plus a standalone replay route**, so stars, cards, sync, plans and the leave flow work unchanged; reading records no round by itself.
2. **Inline gloss card, not a floating popover**: no overlay maths, works at 200 % text and with screen readers.
3. **SceneArt is data, not JSX**: one drawing source rendered by react-native-svg for the apps and plain DOM for the Next.js contact sheet, because the web app cannot import the RN components today; the data form also makes token-only, size and palette rules mechanical.
4. **Hoya is ported to data once (`hoyaNodes`) and the component is left alone** (animation, wide usage); parity is guarded by a token-subset test and a side-by-side page. Converting the component is a follow-up, not a prerequisite.
5. **People are faceless by design**: no invented likeness of historical persons and no skin-tone tokens; identity comes from costume and context.
6. **No text primitive**: writing is stroke rows, letters are shapes with alt text. Hangul never appears as a glyph in art.
7. **Heritage artefacts carry a `sourceRef` and an `accuracyNote`**: pictures are claims too.
8. **One tap = play and reveal** in hide-romanization mode; the reveal lasts the scene; the gloss is never hidden.
9. **Read to me plays once per scene opening** and never advances the scene; auto-play waits for a gesture on the web. All sound goes through F-AUDIO-004's `playPrompt`; the reader owns sequencing and the scene text, not voices, rates or fallbacks.
10. **Sources is reachable by anyone; opening a link is a grown-up action** behind the existing gate pattern, so a child cannot be sent to the open web from a story.
11. **The position label may fall; the meter may not**: "3 / 8" is a page number, the dots are the fill-only meter (D3).
12. **Checkpoints are optional and absent at launch**; the reader works without F-STORY-003's components and gains them in PR 2.9.
13. **`readToMe` is a per-profile local setting** added to the schema F-I18N-001 owns, with a level-based default.
14. **Art ships by cluster, with the contact sheet as the review surface**; `artPending` keeps text-only tiles legal but visible in reports.
