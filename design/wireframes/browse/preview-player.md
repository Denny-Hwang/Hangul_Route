# Browse/Preview-player — the learner's lesson inside a preview frame (wireframe v1)

Spec: `docs/specs/F-BROWSE-001-adult-content-browser.md` §4.7, §4.10, BD2, BD3
Audience: **parent or teacher** previewing; the lesson itself is the learner's screen, unchanged (anyone, any age).
Code (planned): `apps/mobile/src/screens/browse/PreviewFrame.tsx`, `screens/browse/PreviewQuestScreen.tsx` (renders `screens/quest/QuestPlayerView.tsx` with preview ports), the learner `screens/minigames/MinigameScreen.tsx`, `screens/story/StoryReaderScreen.tsx` (replay), F-VOC-003 flashcards (mode `'preview'`)
Notation: as `browse/home.md`. The lesson area is drawn only as a box: it is exactly the learner wireframes `quest/player.md`, `minigame/shell.md`, `story/reader.md`, `vocab/flashcards.md`.

## Scenario (Given-When-Then)

Given: a grown-up pressed [[ Preview this lesson ]] on an item page
When: the lesson runs
Then: every step, game, sound and Hoya line is what a learner gets, a thin strip says nothing is saved, and leaving or finishing never changes any learner's record

## Screen goal

"Play the lesson as a learner would." (secondary: leave the preview at any time)

## Box diagram

### A. Quest step (phone)

```
┌──────────────────────────────────┐
│ Preview. Nothing is saved.       │   preview strip: above the lesson's safe area,
│               [ Leave preview ]  │   not dismissable, announced once per screen
├──────────────────────────────────┤
│ [x]  (o)(o)(*)( )( )   Step 3/5  │   the learner quest header, unchanged position
│                                  │
│   ┌──────────────────────────┐   │
│   │                          │   │
│   │   learner step content   │   │   Discover pages / game / Check, exactly as
│   │   (quest/player.md,      │   │   the learner wireframes; amber nudges, Hoya
│   │    minigame/shell.md)    │   │   thinking pose; no red X
│   │                          │   │
│   └──────────────────────────┘   │
│                                  │
│      [[ learner's own CTA ]]     │   e.g. Continue / Check
└──────────────────────────────────┘
```

### B. Story (replay reader)

```
┌──────────────────────────────────┐
│ Preview. Nothing is saved.       │
│               [ Leave preview ]  │
├──────────────────────────────────┤
│  learner story reader, replay    │   story/reader.md; Read to me, term glosses,
│  mode (no bookmark, no rounds)   │   Sources, page turns all as the learner has them
└──────────────────────────────────┘
```

### C. Leave confirm

```
│ ┌──────────────────────────────┐ │
│ │ Leave this preview?          │ │   one line; nothing to lose, so no warning tone
│ │ [ Keep going ]  [ Leave ]    │ │
│ └──────────────────────────────┘ │
```

## Interaction points

- Everything inside the lesson -> the learner behaviour (answers counted in memory only, for the lesson's own flow)
- [ Leave preview ] -> C -> `browse/item` (no end screen)
- The lesson's own close [x] -> its own confirm (learner copy) -> `browse/item`
- Last step done -> `browse/preview-end` (replaces the learner Results screen)
- Speaking steps: hidden exactly when the learner app hides them (`voiceEchoEnabled` off at launch)

## Navigation graph

Enter from: `browse/item` [[ Preview this lesson ]] · `browse/preview-end` [ Preview again ] / [[ Next lesson ]]
Exit to: `browse/preview-end` · `browse/item`

## States

- **success**: A / B.
- **no Korean voice on the device**: the learner's text fallback (F-AUDIO-004 §3.8), unchanged.
- **offline**: works (bundled content); nothing to sync because nothing is written.
- **pass expired mid-lesson** (gate pass, 15 minutes): the lesson continues to its end; the next navigation shows `browse/access`.
- **error** (a step fails to render): learner `OopsScreen` with [ Back to the lesson page ].

## Data needs

- reads: bundle only; `quest-run-store` (memory only, this tab, reset on leave and finish); `audio-store`; the Show as setting (romanization, language) through `useRomanizationMode()` and the browse locale
- writes: none (storage fence: only `browse:*`, `device:audio` if the grown-up mutes, `telemetry:queue`)
- telemetry: `browse.preview_started` (on entry), `browse.preview_ended { reachedEnd: false }` on leave; learner events from the reused screens are dropped by the telemetry fence

## Open questions

- Should the strip collapse to an icon after the first screen on phones, to give the game more room? Default: no, it stays a single slim line; measure in beta on 320-wide screens.
