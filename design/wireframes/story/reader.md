# Story / Reader: scenes, culture note, end page (wireframe v2)

Spec: `docs/specs/F-STORY-002-story-reader.md` (§3.3 reader, §3.4 audio, §3.5 Korean on screen, §3.6 progress, §3.7 checkpoints, culture notes, advisory and end page, §3.10 accessibility, §3.11 states), data in `F-STORY-001-story-schema-pipeline.md`
Audience: anyone learning Hangul, any age (CLAUDE.md §1). A learner who reads little can use every screen: the picture, a speaker button and big targets carry the meaning. No kids-only or adults-only framing. Grown-ups use the same screen; their one control (Sources) sits in the top bar, away from the reading controls.
Code: built (PRs 2.5-2.8): A, B, E, F1-F6, G1 and H in `apps/mobile/src/screens/story/StoryReaderView.tsx` (state, effects), `ReaderParts.tsx` (paint), `use-reader-audio.ts`, `use-reader-bookmark.ts`, `StoryReaderScreen.tsx` (replay route `StoryReader`), `screens/minigames/StoryReadGame.tsx` (quest host, `story-read` step); pure rules in `apps/mobile/src/logic/story/` (`reader-state`, `scene-view`, `scene-audio`, `audio-runner`, `reader-settings`, `reader-effects`, and from 2.8 `reader-extras` for the note card, the grown-up note and the end-page pictures, `reader-locale` for the story in the UI locale); picture `packages/design-system` `StoryScene`. Planned: G2 checkpoints in PR 2.9 (none of the 24 launch stories has one); the G1 "More in Culture notes" button appears once F-STORY-004 PR 4.7 passes `onOpenCultureNote`. Component spec: `design/components/StoryReaderView/spec.md`. Brief: `design/brief/screens/21-story-reader.md`.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko / rom / gloss ~~` taught Korean drawn with `KoreanText` (Korean + romanization + gloss), `( )` switch, `o o .` fill-only dots (filled = reached), `<art>` a `StoryScene` picture (4:3), `{chip}` an inline Korean term chip.

Promoted by F-STORY-002 PR 2.0 from the one-file draft. The panel letters are kept so references in code and specs still resolve:

- A. Reader, Listen level (portrait)
- B. Reader, Read-along / Read level (order changes)
- C, D. Term gloss card and Korean line with word glosses: **moved to `story/term-gloss.md`** (same letters)
- E. Reader, landscape / wide
- F. Reader states: grown-up note (built in 2.8), hide-romanization, muted, no Korean voice, art missing, story not found
- G. Culture note card (G1, built in 2.8) and checkpoint (G2, **planned**, PR 2.9)
- H. End page (the recap pictures built in 2.8)
- I, J. Sources screen and the open-link gate: **moved to `story/sources.md`** (same letters)

All copy in boxes is placeholder or an English suggestion; final strings live in `packages/i18n` (`learner.story.reader`, read with `useMessages`).

## Scenario (Given-When-Then)

Given: the learner is on a story quest's reading step, or tapped "Read it again" (Library, Home, episode page, Results)
When: they go through the scenes one at a time, hear lines and Korean words, tap a word to see what it means, and finish
Then: reading never scores, times or shames; every sound has its text; the picture, the narration, the Korean with romanization and the meaning are always together; the place is remembered if they leave

## Screen goal

"Let me read this little story with Hoya, hear the Korean words, and know what they mean."

One primary action per scene: **Next** (on the last scene **Finish**, on the end page **Continue** or **Done**). Secondary: Back, Read to me, the speakers.

---

## A. Reader, Listen level (portrait)

```
┌──────────────────────────────────┐
│ [x]  o o . . . . .   2 / 7  [Sources] │  <- Close | fill-only dots | page number | Sources
│                                  │
│ ┌──────────────────────────────┐ │
│ │                              │ │
│ │            <art>             │ │  <- StoryScene, 4:3, alt text = description
│ │                              │ │
│ └──────────────────────────────┘ │
│ [Traditional tale]               │  <- pill, only for tales (every scene)
│                                  │
│ ┌──────────────────────────────┐ │
│ │ These officials were the     │ │  <- narration card, large text
│ │ {사관 sagwan}, the royal      │ │     inline chip = Korean + romanization,
│ │ historians. Wherever the king│ │     tap -> gloss card (term-gloss.md C)
│ │ met his officials ...  [spk] │ │  <- speaker reads narration, then Korean
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  ~~ 사관                      │ │  <- Korean block (KoreanText)
│ │     sagwan                    │ │     romanization visible by default
│ │     royal historian ~~  [spk] │ │     gloss in the UI language; tap = hear
│ └──────────────────────────────┘ │
│  [ Did you know? ] [ Say it yourself ]   <- chips row, each only when it applies
│                                  │
│  ( ) Read to me   [ Back ]  [[ NEXT ]] │  <- pinned bottom bar; Next is the only big button
└──────────────────────────────────┘
```

- Dots only fill (furthest scene reached). "2 / 7" is a page number and may go down on Back.
- No timer, no score, no auto-advance. Read to me plays the scene once when it opens; it never turns the page.
- One Hoya on screen: in the picture. No speech bubble on top of it.
- Last scene: **Next** reads "Finish". Below a compact window height Next is one size smaller (still above the 64 floor) so the text keeps room.
- The scene art has alt text (a one-sentence description); a screen reader hears "Scene 2 of 7", the description, then the narration.
- **Close** goes back to the quest step (nothing is lost; the place is remembered). No confirmation dialog.
- The text area scrolls; the art, the top bar and the bottom bar do not.

## B. Reader, Read-along / Read level

```
│ [x]  o o o . . . .   3 / 7  [Sources]
│ ┌──────────────────────────────┐
│ │            <art>             │
│ └──────────────────────────────┘
│ ┌──────────────────────────────┐
│ │  ~~ 호랑이가 도망갔어요.       │  <- Korean line first, big
│ │     horangiga domanggasseoyo. │
│ │     The tiger ran away. ~~ [spk] │
│ └──────────────────────────────┘
│   In English:                      <- Read-along: full narration
│   The tiger got scared and ...     <- Read: one-line caption only
│  ( ) Read to me   [ Back ]  [[ NEXT ]]
```

- Same components, different order and emphasis. Romanization and gloss stay with the Korean (hide-until-tap is an opt-in, see F2).
- The 24 launch stories are all Listen level; B ships with the component so Stage 5 books need no UI work.

## E. Reader, landscape / wide

```
┌──────────────────────────────────────────────────────────────┐
│ [x]  o o . . . . .   2 / 7                          [Sources]│
│ ┌──────────────────────────┐ ┌─────────────────────────────┐ │
│ │                          │ │ narration card              │ │
│ │          <art>           │ │ Korean block                │ │
│ │                          │ │ [ Did you know? ]           │ │
│ └──────────────────────────┘ │ ( ) Read to me [Back][[NEXT]]│ │
│ [Traditional tale]           └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- Art left (up to 55 %), text and controls right, whenever the window is landscape and at least 700 wide (F-LAYOUT-001 `sideBySide`): tablets, landscape phones and the web PWA alike. A short portrait window stacks and scrolls.
- A page turn fades the art and the text only; the controls stay put (instant with reduced motion).

## F. Reader states

```
F1  First scene of a fresh read, story has a gentle note
│ ┌──────────────────────────────────┐
│ │ A note for grown-ups: this story │ [ x ]   <- one quiet row (at most two lines on a short window), never blocks; [x] is a 64 dp Dismiss
│ │ mentions a war long ago.         │
│ └──────────────────────────────────┘
│ <art> ...

F2  Hide-romanization mode (opt-in, for reading practice)
│  ~~ 사관 ~~            <- romanization hidden, gloss still shown
│     royal historian      tap the word: it plays AND shows the romanization for this scene

F3  Muted
│  tap [spk]  ->  shared sound panel "Sound is off" [ Turn sound on ]   (text stays; no error)

F4  No Korean voice on this device
│  ~~ 사관 / sagwan / royal historian ~~   [ Say it yourself ]   <- chip instead of sound
│  English narration still plays (the English voice exists)

F5  Art missing or still pending
│ ┌──────────────────────────────┐
│ │   (tinted panel, theme colour)│  <- never a broken image or an error box
│ └──────────────────────────────┘

F6  Story, level or tier not found, or fewer than 4 scenes
│  one line: "This story is not ready to read yet."
│  [[ CONTINUE ]]  (quest mode only: marks the step done, so a content error never traps a quest)
│  [ Back ]
```

- F1 shows only on a fresh (not resumed) quest-mode open of scene 1, once per visit; it goes on Dismiss or the first page turn (a checkpoint opening counts). Below a compact window height it is clamped to two lines (a screen reader still reads it all). It is always repeated on the Sources screen. No age wording.
- F3 and F4 come from the one shared sound state (F-AUDIO-004 `PromptPanel`); the reader adds no error of its own.
- A browser that blocks sound before the first tap shows "Tap to hear" in the same panel; the first tap anywhere unlocks it.

## G. Culture note card (built) and checkpoint (planned, PR 2.9)

```
G1  Did you know?  (tapped)
│ ┌──────────────────────────────┐
│ │ Did you know?                │
│ │ Title                        │
│ │ Short body, 1-2 sentences.   │
│ │ ~~ term / rom / gloss ~~ [spk] │
│ │ [card art, when it has one]  │
│ │ [ More in Culture notes ]    │  <- only when the host passes onOpenCultureNote (F-STORY-004 PR 4.7)
│ │              [ Close ]       │
│ └──────────────────────────────┘

G2  Checkpoint question (planned, PR 2.9; 0-2 per story; none in the launch stories)
│ Quick question
│ "What did the historians write down?"
│  ┌─────────────────────────┐
│  │ ( ) option               │   <- the same ChoiceCard as the story checks (F-STORY-003)
│  └─────────────────────────┘
│  [ Skip ]                       <- always there; records nothing
```

- G1 opens under the chips row (pushes content down) and scrolls into view. It shares the one inline-card slot with the gloss card: opening G1 closes a gloss card, and Close, a second chip tap, Escape, a term chip or a page turn closes G1. The open chip shows an underline and reports expanded.
- G2 (planned, PR 2.9; until then a tier with checkpoints skips them): a wrong tap gets the amber "Try another", never red. A checkpoint scores only on the first try, in a quest, never in a replay (a replay shows "Try it" with feedback, unscored).

## H. End page

```
┌──────────────────────────────────┐
│ [x]                              │
│        [Hoya cheering]           │
│          The End                 │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐     │  <- up to four small pictures: the Story Order scenes
│  │ 1  │ │ 3  │ │ 5  │ │ 8  │     │     (decorative, hidden from screen readers)
│  └────┘ └────┘ └────┘ └────┘     │
│  One version of a tale that is   │  <- tales only
│  told in many versions.          │
│                                  │
│  [[ CONTINUE ]]                  │  <- quest: next step.  Replay: "Done"
│  [ Read again ]  [ Sources ]     │
└──────────────────────────────────┘
```

- One Hoya (cheering), the art is not shown here. At most one primary and two ghosts.
- The pictures are at most `useMediaSize(120)` wide (64 below a compact window height); on a short landscape window they sit beside Hoya in one row so Continue stays on screen.
- Back from the end page returns to the last scene.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Next / Back | tap, Right / Left arrow (web) | change scene (cross-fade, or instant with reduced motion); focus moves to the narration |
| Korean block | tap | play the line; in hide-romanization mode also reveal the romanization for this scene |
| Inline chip / word chip | tap | play the word and open the gloss card (`story/term-gloss.md`) |
| Narration speaker | tap | read the narration, then the Korean line |
| Read to me | switch | on: each scene plays once when it opens (not on Back); remembered per profile |
| Did you know? | tap | culture note card (G1) |
| Sources | tap | `story/sources` (scrolled to the scene when opened from a scene) |
| Close x / back gesture / Android back | tap | back to the quest step (not complete) or the previous screen; the place is remembered |
| Escape (web) | key | close the gloss card or the note card |
| Finish | tap | end page (H) |
| Continue / Done | tap | quest: step complete, next step. Replay: back, nothing written |
| Read again | tap | scene 1 of the same story, same mode |

## Navigation graph

Enter from: `quest/player` reading step (via the `Minigame` route, `story-read` kind) · `library/stories`, `home/story-time-card`, `episode/detail-story` and `results/celebrate-story` "Read it again" (replay route `StoryReader`) · a resumed quest (`QuestPlayer { resume }`, opens on the bookmarked scene)
Exit to: `quest/player` next step (Continue) · the previous screen (Done, Close) · `story/sources` and back · `story/culture-notes` (G1, once available)

## States

- **success**: A, B, E as drawn; H at the end.
- **empty / bad data**: F6 (never a dead end in a quest).
- **error**: F5 art fallback; F3 / F4 sound fallbacks; a storage read that fails starts at scene 1 with Read to me at its level default.
- **loading**: none to see; the story is bundled and renders on the first frame.
- **offline**: fully offline (bundled JSON, SVG, device speech).
- **small phone (320 x 568), landscape (844 x 390), 200 % text**: the text area scrolls, the bottom bar never leaves the screen, no fixed heights.
- **reduced motion**: scene swap is instant; nothing auto-advances, ever.
- **story updated while open**: the open reader keeps its copy until closed; a removed scene lands on the nearest valid one next time.

## Data needs

- reads: the bundled story (`storyById`, with locale overlays applied): tier scenes, keywords, art, culture notes, checkpoints, origin, review advisory; profile settings `readToMe` (default on for the "Pictures first" level), `romanizationMode`; the bookmark (`story:bookmarks:<profileId>`, F-STORY-004) for the first scene
- writes: the bookmark from scene 2 on, quest mode only; checkpoint answers through `answerRound` (quest mode only); `markStepComplete` on Continue; nothing in replay
- audio: F-AUDIO-004 `playPrompt` (device speech now, bundled clips when they exist)
- telemetry: `story.read.finished`, `story.bookmark.resumed` (ids and counts only); audio fallbacks are F-AUDIO-004's

## Open questions

1. Should a long-press on the Korean block offer "slower speech"? Not in v1; the level already slows word and sentence speech.
2. Recap pictures on the end page: decided and built in 2.8, up to four Story Order scenes (`sequenceSceneIds`; a scene with pending art is left out, and the row hides when a picture would be under half a touch target).
3. Should the explanation of a checkpoint be read aloud after an answer? Default: only on the speaker tap (same as F-STORY-003).
