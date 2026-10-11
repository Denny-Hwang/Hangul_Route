# StoryReaderView (component spec v1)

Spec: `docs/specs/F-STORY-002-story-reader.md` §3.3-3.7 and §3.10, PRs 2.6a and 2.8 in §6 · wireframe: `design/wireframes/story/reader.md` screens A (listen), B (read-along / read), C (term gloss card), D (Korean line with words), E (wide), F (states, F1 grown-up note), G1 (culture note card), H (end page) · layout: `docs/specs/F-LAYOUT-001-responsive-layout.md` §3.6 (`sideBySide`) · Korean content: `design/components/KoreanText/spec.md` · picture: `design/components/StoryScene/spec.md` · sound fallback: `design/components/PromptPanel/spec.md`
Code: `apps/mobile/src/screens/story/StoryReaderView.tsx` (state and effects), `ReaderParts.tsx` (paint), `use-reader-audio.ts` (F-AUDIO-004 wiring), `StoryReaderScreen.tsx` (replay route), `use-reader-bookmark.ts` (seam); every rule is pure and tested in `apps/mobile/src/logic/story/` (`reader-state`, `scene-view`, `scene-audio`, `audio-runner`, `reader-settings`, `reader-effects`)

## What it is

One story, one scene at a time: the picture, the narration with its Korean terms inline, the Korean line with romanization and meaning, and big Back / Next buttons. Reading never scores, never times and never turns the page by itself. The same view serves the replay route (`mode="replay"`, writes nothing) and, from PR 2.6b, the quest step (`mode="quest"`).

## Props

| Prop | Type | Notes |
|---|---|---|
| `story` | `Story \| undefined` | Undefined, a missing tier or fewer than 4 scenes: the one-line fallback |
| `level` | `'listen' \| 'read-along' \| 'read'` | Changes order and emphasis only |
| `mode` | `'quest' \| 'replay'` | End page primary is Continue (quest) or Done (replay); replay never saves or scores |
| `initialIndex` | `number` | Clamped; a bookmark or the route's `sceneIndex` |
| `onSceneChange(index)` | | Bookmark seam: quest mode, scene 2 on (`planSceneChange`) |
| `onAnswer(roundKey, correct)` | | Checkpoints (`cp:<id>`), quest mode only; the card is PR 2.9 |
| `onFinish()` | | End page primary; the fallback's Continue (quest) |
| `onClose()` | | Close, the back gesture, the fallback's Back. No confirmation: nothing is lost |
| `onOpenSources?(from, sceneIndex)` | | PR 2.7. Without it no Sources button is drawn |
| `narrationLangs?` | `SpeechLang[]` | PR 2.8: the narration voice of each scene by index (`readerStory`): the UI locale's when its overlay is shown, else `en-US` (also the default for a missing entry) |
| `onOpenCultureNote?(noteId)` | | PR 2.8: "More in Culture notes" (`CultureNotes { noteId }`, F-STORY-004 PR 4.7). Without it the button is not drawn |

## Anatomy (portrait, `reading` column)

```
 [x]      o . . . .        [1 / 5]        <- Close 64 | fill-only dots | page number (Pill)
 +--------------------------------+
 |            <StoryScene>        |       <- 4:3, at most 42 % of the body height, alt = altEn
 +--------------------------------+
         [Traditional tale]                <- tales only
 +--------------------------------+
 | Long ago, King [세종] wanted   (spk) |   <- narration card: one paragraph, KoreanText chips inline,
 |                sejong          |          the scene speaker 64 at the corner
 +--------------------------------+
 +--------------------------------+
 |  [세종] Sejong / King Sejong … (spk) | <- gloss card (only when a chip is open): its speaker 64, Close
 +--------------------------------+
            [세종]      (spk)               <- Korean block: KoreanText, tap = hear + reveal; its speaker 64
            Sejong
            King Sejong the Great
 +--------------------------------+
 | No sound? Read it here.        |       <- PromptPanel without Korean (it is right above)
 +--------------------------------+
 [Say it yourself]                         <- only without a Korean voice
 ------------------------------------------ pinned
 (o ) Read to me
 [ Back ]  [[        Next        ]]
```

Only the text area scrolls: the picture and the bottom bar never scroll away (spec §3.3, `Screen scrollable={false}`).

## Layout by window (F-LAYOUT-001)

| Window | Layout |
|---|---|
| Portrait, any width | Stacked in the `reading` column (720 cap). Picture width = min(column, `useMediaSize(480)`, 42 % of the body height x 4/3) |
| `sideBySide` (landscape and width >= 700; 844x390, 1180x820) | `Screen width="full"`: picture left (at most 55 % of the body and never taller than the body), text and the bottom bar right; the top bar spans both. A page turn fades the picture and the text only; the bottom bar stays put |
| Window height < `layout.compactHeight` (640; 320x568, landscape phones) | Next is `size="lg"` (80) instead of `hero` (96) so the text keeps room; both are over the 64 floor. The end page steps down the same way (F-STORY-002 PR 2.6b): its primary (Continue / Done) is `lg`, Hoya is `touchTarget.min` (64) instead of 128 and the spacing is tighter, so the primary stays fully on screen at 844x390 without scrolling |

Every scene opens at the top of its text: the text scroll goes back to the top on each page turn (native and web).

The bottom bar wraps: Back and Next stay together and the Read to me switch takes its own line when the row is narrow.

## Level order (spec §3.3)

| Level | Under the picture |
|---|---|
| `listen` | narration card, then the Korean block (word or phrase, KoreanText `sm`) |
| `read-along` | Korean line first, then "In English" and the narration |
| `read` | Korean line (KoreanText `md`), then "In English" and the one-line caption |

## States

| State | Look |
|---|---|
| Scene | as above; Back disabled on scene 1; Next reads "Finish" on the last scene |
| Term open | the chip gets a `borderWidth.thick` `brand.secondaryDark` underline; the gloss card sits under the narration (or under the line for a word chip) and scrolls into view. Closes on Close, a second tap, Escape, a scene change |
| Hide-until-tap (`romanizationMode: 'tap'`) | chips and the block show no romanization until tapped; the reveal lasts the scene; the gloss never hides |
| Muted | PromptPanel "Sound is off." + Turn sound on; no error |
| No Korean voice | PromptPanel "No Korean voice on this device." + How to add a voice; the "Say it yourself" pill; Read to me and the scene speaker read the English only. The pill follows the device (`sayItYourselfShown`), and an English-only play never reports to the Korean prompt slot, so hearing the English hides none of this. While the voice check is still running, a Korean step that turns out unavailable is skipped and the English carries on |
| Blocked (web, before a gesture) | a scene opened by resume waits; the first tap anywhere unlocks and starts it when Read to me is on |
| Art missing / pending | StoryScene's tinted panel; reading continues |
| Grown-up note (PR 2.8) | On a fresh quest-mode open of scene 1 of a story with an advisory (`advisoryNote`): one `Card tone="sunken"` row under the top bar, above the art, "A note for grown-ups: ..." (body size, `text.secondary`; clamped to two lines below `layout.compactHeight` so a 140-character note leaves the art and text room, the full note still read by a screen reader and always shown in Sources) and a 64 dp Dismiss (`Icon close`, named "Dismiss"). It never blocks; it goes on Dismiss or the first page turn (`advisoryAfter`; a checkpoint opening counts, `advisoryInPhase`) and does not come back in that visit. Dismiss moves focus to the narration region (web). Not in replay, not on a resume |
| Culture note (PR 2.8) | A scene with `cultureNoteId` gets the "Did you know?" chip in the chips row (`Button tone="secondary" size="md"`, `Icon sparkle`; open = the chip's `borderWidth.thick` `brand.secondaryDark` underline and `expanded` / `aria-expanded`). It opens the inline note card under the chips (`Card tone="paper" elevation="flat"`): "Did you know?" (`Caption`), the title (`Heading prompt`), the body, the term as `KoreanText` with its 64 dp speaker, the card art when the card has art (`supportedCardIds`; `useMediaSize(128)`, 96 below `layout.compactHeight`; hidden from screen readers), "More in Culture notes" only with `onOpenCultureNote`, and Close. It shares the one inline-card slot with the gloss card (`note:<id>`), so it closes on Close, a second tap, Escape, a term chip, a page turn; it scrolls into view inside the text area |
| End page | Hoya cheering, "The End", up to four small Story Order pictures (`recapScenes`: `StoryScene variant="thumb"`, decorative, hidden from screen readers; a scene with pending art is left out), the retelling note for tales, one primary (Continue / Done) and the ghost Read again (and Sources from PR 2.7). No bottom bar. Pictures: at most `useMediaSize(120)` wide (64 below `layout.compactHeight`) and never wider than the row allows (`recapLayout`; under half a touch target the row is hidden; the first frame uses the window width); on a short landscape window they sit beside Hoya in one row so Continue stays on screen |
| Fallback | "This story is not ready to read yet." + Back (+ Continue in quest mode) |

## Tokens (no literals)

| Part | Token |
|---|---|
| Surfaces | `Screen tone="canvas"`, `Card tone="paper"` (`elevation="card"` narration, `flat` gloss and caption) |
| Narration text | `typography.size.bodyLg`, `leading.relaxed`, `colors.text.primary` |
| Open chip underline | `borderWidth.thick`, `colors.brand.secondaryDark` |
| Speaker button | 64 x 64 (`touchTarget.min`), `radii.pill`, `borderWidth.base` `brand.secondary`, `Icon speaker` `brand.secondaryDark`; pressed `brand.secondaryLight` |
| Read to me switch | track `spacing.xxxl` wide, on `brand.secondary` / off `surface.sunken`, border `brand.secondaryDark` / `border.strong`, knob `surface.paper`; the whole row is one 64 target |
| Dots | `Progress variant="dots"` height `spacing.sm`, `brand.primary` filled; hidden from screen readers (the labelled page number speaks) |
| Page turn | opacity 0 to 1 over `motion.duration.base` (200 ms); instant with reduced motion |
| Gaps | `spacing.sm` / `md` / `lg` |

## Accessibility

- Every control at least 64 x 64; Next is the one primary.
- The page number is a group labelled "Scene N of M" (not "three slash five"); the dots are hidden from screen readers.
- Reading order: top bar, grown-up note, picture (label = alt text), tale pill, narration (a region named "Scene N of M"; chips are buttons "Korean word sejong, King Sejong. Double tap to hear."), Korean block ("Korean: 세종, Sejong, King Sejong the Great"), fallback panel (polite live region), chips ("Did you know?", a button that reports expanded or collapsed), the note card (a region named by the note title, polite live region), Read to me (`role="switch"`, checked state), Back, Next.
- A page turn announces "Scene N of M. <alt text>" and moves focus to the narration region (web `tabIndex=-1`).
- Keyboard (web): Right / Left turn the page, Escape closes the gloss card or the note card; repeats are ignored. The keys work only while the reader is the focused screen and the voice-help sheet is closed.
- Colour is never the only cue: the page number goes with the dots, the open chip has an underline and the card.
- No emoji, no Hangul outside `KoreanText`, no timer, no auto-advance.

## Copy

`learner.story.reader` and `learner.story.end` in `packages/i18n` (moved unchanged from PR 2.5's `STORY_READER_COPY`). Audio lines are `learner.audio` (PromptPanel).
