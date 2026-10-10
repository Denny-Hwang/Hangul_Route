# Story / Reader, term gloss, end page and Sources (wireframe v1)

Spec: `docs/specs/F-STORY-002-story-reader.md` (§3.3 reader, §3.4 audio, §3.5 Korean on screen, §3.7 end page, §3.8 Sources), data in `F-STORY-001-story-schema-pipeline.md`
Audience: anyone learning Hangul, any age (CLAUDE.md §1). A learner who reads little can use every screen: the picture, a speaker button and big targets carry the meaning. No kids-only or adults-only framing.
Code (planned): `screens/story/StoryReaderView.tsx`, `screens/minigames/StoryReadGame.tsx`, `screens/story/StoryReaderScreen.tsx` (replay), `screens/story/StorySourcesScreen.tsx`, design-system `StoryScene`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko / rom / gloss ~~` taught Korean drawn with `KoreanText` (Korean + romanization + gloss), `( ) ( )` switch, `o o .` fill-only dots (filled = reached), `<art>` a `StoryScene` picture (4:3), `{chip}` an inline Korean term chip.

This file holds the screens and states below in one place (house style is one file per screen; split when promoted to `design/wireframes/story/`):

- A. Reader, Listen level (portrait)
- B. Reader, Read-along / Read level (order changes)
- C. Term gloss card (inline, under the narration)
- D. Korean line with word-by-word glosses (optional data)
- E. Reader, landscape / wide (native)
- F. Reader states: first scene with grown-up note, hide-romanization mode, muted, no Korean voice, art missing
- G. Culture note card and checkpoint (inline)
- H. End page
- I. Sources screen
- J. Sources: open-link gate and failure

All copy in boxes is placeholder or an English suggestion; final strings sit in `STORY_READER_COPY`.

## Scenario (Given-When-Then)

Given: the learner is on a story quest's reading step (or tapped "Read it again"), or a grown-up wants to know where a statement comes from
When: they go through the scenes one at a time, hear lines and Korean words, tap a word to see what it means, finish, and (grown-up) open Sources
Then: reading never scores, times or shames; every sound has its text; the picture, the narration, the Korean with romanization and the meaning are always together; Sources shows each claim with its citations and any corrections

## Screen goal

"Let me read this little story with Hoya, hear the Korean words, and know what they mean — and let a grown-up see exactly where every fact came from."

---

## A. Reader, Listen level (portrait)

```
┌──────────────────────────────────┐
│ [x]  o o o . . . . .   3 / 8  [Sources] │  <- Close | fill-only dots | page number | Sources
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
│ │ historians. Wherever the king│ │     tap -> gloss card (C)
│ │ met his officials ...  [spk] │ │  <- speaker reads narration, then Korean
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  ~~ 사관                      │ │  <- Korean block (KoreanText)
│ │     sagwan                    │ │     romanization always visible by default
│ │     royal historian ~~  [spk] │ │     gloss in the UI language; tap = hear
│ └──────────────────────────────┘ │
│  [ Did you know? ]  (only when the scene has a note)
│                                  │
│  ( ) Read to me   [ Back ]  [[ NEXT ]] │  <- pinned bottom bar; Next is the only big button
└──────────────────────────────────┘
```

- Dots only fill (furthest scene reached). "3 / 8" is a page number and may go down on Back.
- No timer, no score, no auto-advance. Read to me plays the scene once when it opens; it never turns the page.
- One Hoya on screen: in the picture. No speech bubble on top of it.
- Last scene: **Next** reads "Finish".
- The scene art has alt text (a one-sentence description); a screen reader hears "Scene 3 of 8", the description, then the narration.
- **Close** goes back to the quest step (nothing is lost; the place is remembered). No confirmation dialog.

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

- Same components, different order and emphasis. Romanization and gloss stay with the Korean (hide-until-tap is an opt-in, see F).

## C. Term gloss card (inline)

Opened by tapping an inline chip in the narration (or a word chip in D).

```
│ ┌──────────────────────────────┐
│ │ These officials were the     │
│ │ {사관 sagwan}, the royal ...  │  <- the tapped chip is marked
│ └──────────────────────────────┘
│ ┌──────────────────────────────┐
│ │ ~~ 사관                       │  <- gloss card appears right under the narration
│ │    sagwan                     │     (pushes content down; scrolls into view)
│ │    royal historian ~~   [spk] │
│ │                    [ Close ]  │
│ └──────────────────────────────┘
```

- Tapping the chip plays the word and opens the card; tapping it again, Close, Escape (web), changing scene or opening a question closes it. One card at a time.
- Not a floating popover: nothing to position, works at 200 % text and with screen readers (announced politely).

## D. Korean line with word-by-word glosses (only when the data has them)

```
│ ┌──────────────────────────────┐
│ │ ~~ [새] [동아줄을] [내려] [주세요] │  <- each word is a chip (tap = gloss card)
│ │    sae dongajureul naeryeo juseyo │
│ │    Please send down a new rope. ~~ [spk] │  <- whole-line gloss always shown
│ └──────────────────────────────┘
```

- No `words[]` in the data: the line is one tap target (plays the whole line); no invented breakdown.

## E. Reader, landscape / wide (native tablets and landscape phones)

```
┌──────────────────────────────────────────────────────────────┐
│ [x]  o o o . . . . .   3 / 8                        [Sources]│
│ ┌──────────────────────────┐ ┌─────────────────────────────┐ │
│ │                          │ │ narration card              │ │
│ │          <art>           │ │ Korean block                │ │
│ │                          │ │ [ Did you know? ]           │ │
│ └──────────────────────────┘ │ ( ) Read to me [Back][[NEXT]]│ │
│ [Traditional tale]           └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- Art left (up to 55 %), text and controls right. The web app keeps the single 480 px column from 600 px up.

## F. Reader states

```
F1  First scene of a fresh read, story has a gentle note
│ ┌──────────────────────────────────┐
│ │ A note for grown-ups: this story │ [ Dismiss ]   <- one line, never blocks
│ │ mentions a war long ago.         │
│ └──────────────────────────────────┘
│ <art> ...

F2  Hide-romanization mode (opt-in, for reading practice)
│  ~~ 사관 ~~            <- romanization hidden, gloss still shown
│     royal historian      tap the word: it plays AND shows the romanization for this scene

F3  Muted
│  tap [spk]  ->  small line "Sound is off"   (text stays; no error)

F4  No Korean voice on this device
│  ~~ 사관 / sagwan / royal historian ~~   [ Say it yourself ]   <- chip instead of sound

F5  Art missing or still pending
│ ┌──────────────────────────────┐
│ │   (tinted panel, theme colour)│  <- never a broken image or an error box
│ └──────────────────────────────┘
```

## G. Culture note card and checkpoint (inline)

```
G1  Did you know?  (tapped)
│ ┌──────────────────────────────┐
│ │ Did you know?                │
│ │ Title                        │
│ │ Short body, 1-2 sentences.   │
│ │ ~~ term / rom / gloss ~~ [spk] │
│ │ [card art, when it has one]  │
│ │ [ More in Culture notes ]    │  <- only once that screen exists
│ │              [ Close ]       │
│ └──────────────────────────────┘

G2  Checkpoint question (0-2 per story; none in the launch stories)
│ Quick question                  
│ "What did the historians write down?"
│  ┌─────────────────────────┐
│  │ ( ) option               │   <- same choice cards as the checks (F-STORY-003)
│  └─────────────────────────┘
│  [ Skip ]                       <- always there; records nothing
```

- A wrong tap gets the amber "Try another", never red. A checkpoint scores only on the first try, in a quest, never in a replay.

## H. End page

```
┌──────────────────────────────────┐
│ [x]                              │
│        [Hoya cheering]           │
│          The End                 │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐     │  <- four small pictures from the story (decorative)
│  │ 1  │ │ 3  │ │ 5  │ │ 8  │     │
│  └────┘ └────┘ └────┘ └────┘     │
│  One version of a tale that is   │  <- tales only
│  told in many versions.          │
│                                  │
│  [[ CONTINUE ]]                  │  <- quest: next step.  Replay: "Done"
│  [ Read again ]  [ Sources ]     │
└──────────────────────────────────┘
```

## I. Sources screen (for grown-ups, reviewers and the curious)

```
┌──────────────────────────────────┐
│ [<]  Sources                     │
│  ~~ 호야, 사관을 만나다 ~~        │  <- story title: Korean / romanization / English
│  Hoya Meets the Royal Historians │
│  [Traditional tale]  (tales only)│
│  One version of a story told in many versions.
│                                  │
│  Sources: 국사편찬위원회 ...; 국가유산청 ...   <- the one-line headline (never the only proof)
│  Checked in 3 independent passes · last checked 2026-10-10 · story version 1
│  [v] How it was checked          <- expands the reviewers' notes
│  A note for grown-ups: ...       <- only when the story has one
│                                  │
│  Corrections                     <- only when there are any
│   2026-11-02  We corrected ...  (fact f4)
│  ───────────────────────────     │
│  Scene 2 · A palace hall         │
│  ┌──────────────────────────────┐│
│  │ What we know                 ││
│  │ Historians attended wherever ││  <- the claim, in plain words
│  │ the king met his officials...││
│  │ [v] Korean                   ││  <- the same claim in Korean
│  │ Sources (2)                  ││
│  │ • 실록은 누가 기록했을까       ││  <- title
│  │   국가기록원 · accessed 2026-10-09
│  │   "사관은 경연, ... 항상 참석하여..."   <- the supporting quote
│  │   https://theme.archives.go.kr/...      <- link as plain text
│  │   [ Copy link ] [ Open link ]            <- Open = grown-up action
│  │ • (second source)            ││
│  └──────────────────────────────┘│
│  About "almost 600 years": 1443 to 2026 is 583 years, so the story rounds it.
│  Scene 5 · uses fact f3 (see above)
│  ───────────────────────────     │
│  Used in questions and notes     │
│  ...                             │
└──────────────────────────────────┘
```

- Reached from the reader's top bar, the end page, the episode page and Culture notes; a link from one scene can jump to its fact (`Scene n` section scrolled in, the fact outlined and labelled "Highlighted").
- "What we know" = documented facts. "What the tale says" = what a traditional tale tells, not history.
- A fact that was corrected shows an "Updated" tag with the date.

## J. Open link: grown-up gate and failure

```
J1  [ Open link ]  ->  (device has a PIN or is shared)  ->  PIN entry screen  ->  browser
                   ->  (self-only device, no PIN)       ->  browser directly
J2  Could not open (offline or blocked)
│  Open this link in a browser:
│  https://...                     <- stays selectable
│  [ Copy link ]
```

- A child cannot reach the open web from a story. Copying a link needs no gate.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Next / Back | tap, Right / Left arrow | change scene (cross-fade, or instant with reduced motion) |
| Korean block | tap | play the line; in hide-romanization mode also reveal the romanization for this scene |
| Inline chip / word chip | tap | play the word and open the gloss card |
| Narration speaker | tap | read the narration, then the Korean line |
| Read to me | switch | on: each scene plays once when it opens; persisted per profile |
| Did you know? | tap | culture note card |
| Sources | tap | Sources screen (scrolled to the scene when opened from a scene) |
| Close x / back gesture | tap | back to the quest step or the previous screen |
| Escape (web) | key | close the gloss card or note card |
| Open link | tap | grown-up gate, then browser |

## Navigation graph

Entry: Quest player (reading step, via Minigame) · Library / Home / Episode page "Read it again" (replay route) · Results "Read it again".
Exit: quest step (Continue) · previous screen (Done) · Sources and back · Culture notes (later) · Pin entry (Open link).

## Data needs

- Story JSON bundled in the app (`storyById`): tier scenes, keywords, art, facts, sources, verification, errata, origin, review.
- Profile: level (for the Read to me default), `romanizationMode`, `readToMe`.
- Local: bookmark seam (device-local; F-STORY-004). No network, no new storage key.
- Audio: TTS now; `audioRef` MP3 later (F-AUDIO-004).

## Open questions

1. Should a long-press on the Korean block offer "slower speech"? (not in v1)
2. Should Sources show the Korean claim by default for Korean-UI users? (default stays collapsed)
3. A "Report a mistake" entry on Sources (a mailto or support route) is deliberately left out of v1; the owner decides whether to add it with the correction process.
4. Recap pictures on the end page: first/last scenes or the four Story Order scenes (spec chooses the four Story Order scenes).
