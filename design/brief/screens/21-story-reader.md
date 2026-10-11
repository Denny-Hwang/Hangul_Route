# Screen 21 — Story reader

**One scene at a time: the picture, the words, the Korean and what it means, always together.**

Spec: `docs/specs/F-STORY-002-story-reader.md` §3.3-3.7, §3.10 · wireframes: `design/wireframes/story/reader.md` (A, B, E-H), `story/term-gloss.md` (C, D) · component spec: `design/components/StoryReaderView/spec.md` · code (built): `apps/mobile/src/screens/story/StoryReaderView.tsx`, `ReaderParts.tsx`

## 1. Context

- **Who**: anyone learning Hangul, at any age. A learner who reads little uses the picture, the speaker buttons and the big Next button; a fluent reader reads the narration. Grown-ups use the same screen; their one control (Sources) sits in the top bar.
- **Where**: the reading step of a story quest (Story time, Culture and the heritage stories on the Journey), and the unscored "Read it again" replay from the Library, Today, the episode page and Results.
- **Why**: the stories carry Korean culture and history with sourced facts. The reader has to feel like a calm picture book, never like a test: no timer, no score, no auto-advance, nothing that goes red.

## 2. Layout

Portrait (top to bottom), the art and both bars fixed, the text area scrolling:

1. **Top bar** (one row, every control at least `touchTarget.min`): Close (`Icon close`) · fill-only dots (`Progress variant="dots"`) · position pill "2 / 7" · Sources (ghost button with `Icon library`).
2. **Scene art**: `StoryScene`, 4:3, full width of the reading column. Under it, for traditional tales only, the "Traditional tale" `Pill`.
3. **Narration card** (`Card`, `typography.size.bodyLg`): English narration with inline Korean term chips; a speaker in the top-right corner.
4. **Korean block** (`KoreanText`): Korean at `title` size (a word) or `bodyLg` (a line), romanization upright, gloss line, a speaker.
5. **Chips row** (only when they apply): "Did you know?" and "Say it yourself".
6. **Bottom bar** (pinned): Read to me switch · Back (secondary) · **Next** (`size="hero"`, the only large button; "Finish" on the last scene).

Variants to draw: Listen level (A), Read-along level (B, the Korean line first), the term gloss card open under the narration (C), landscape two columns with the art left at up to 55 % (E), the grown-up note row on scene 1 (F1), the art fallback panel (F5), the end page (H).

## 3. Visual style

- Canvas `surface.canvas`; cards `surface.paper` with the `card` shadow; the gloss card and the culture note card are `Card tone="sunken"` so they read as "extra", not as a new page.
- Text `text.primary`; secondary lines `text.secondary`; the page number pill `neutral`.
- Term chips: `brand.primaryLight` fill, `brand.primary` outline, Korean `text.primary`. The selected chip adds the `border.focus` ring.
- Next: `brand.primary` fill, `text.onPrimary` label. Back and the ghost buttons follow `components/button.md`.
- Fill-only dots: reached dots `brand.primary`, the rest `border.subtle`. Never a red state anywhere on this screen.
- Spacing from `spacing.*` only; the reading column is `layout.maxWidth.reading` on wide windows.
- Mood: quiet picture book on hanji paper. Hoya appears only inside the scene art (one Hoya per screen); the end page shows `Hoya pose="cheering"`.

## 4. Exact copy

UI strings come from `packages/i18n` (`learner.story.reader`); English shown:

- Top bar: **"Sources"**, position **"2 / 7"**
- Bottom bar: **"Read to me"**, **"Back"**, **"Next"**, **"Finish"**
- Pills and chips: **"Traditional tale"**, **"Did you know?"**, **"Say it yourself"**
- Gloss card: **"Close"**; hide-romanization mode: **"Show how to say it"**
- Grown-up note: **"A note for grown-ups:"** + the story's advisory line, **"Dismiss"**
- End page: **"The End"**, **"Continue"** (quest) or **"Done"** (replay), **"Read again"**, **"Sources"**
- Not available: **"This story is not ready to read yet."**, **"Continue"**, **"Back"**

Story text (narration, Korean, romanization, gloss) comes from the story data; use the sample from `content/stories/sillok-royal-historians.json` scene 2 for the mock (narration with the chip 사관 · sagwan · royal historian).

## 5. Reference

Text references only: a calm picture book page; museum audio-guide card (a short label beside an object); the existing Episode detail and Card detail screens for card and pill treatment; `design/brief/illustrations/scene-art-style.md` for the picture.

## 6. Claude Design prompt

```prompt
Design the Story Reader screen for Hangul Route, a Korean-learning app used by
learners of every age. Output: one sheet of portrait phone frames (390 x 844) plus one
landscape tablet frame (1180 x 820).

Use the Hangul Route design tokens by name (do not invent colours): canvas surface.canvas,
cards surface.paper with the "card" shadow, extra cards surface.sunken, text text.primary and
text.secondary, primary button brand.primary with text.onPrimary label, focus ring
border.focus, subtle lines border.subtle. Body text 18 minimum; narration 20; Korean word 28.
Every tappable control at least 64 tall; the primary button is the largest element.

Frame 1 (Listen level, scene 2 of 7, the sample story has 7 scenes):
- Top bar: close icon left, a row of 7 dots with 2 filled, a small pill "2 / 7", a ghost
  button "Sources" with a book icon on the right.
- A 4:3 picture card: a flat vector palace hall with a faceless historian writing at the side,
  tokens-only colours, no text in the picture.
- Pill "Traditional tale" is NOT shown (this story is history).
- Narration card: "These officials were the [chip: 사관 sagwan], the royal historians.
  Wherever the king met his officials, a historian was there, writing down what they saw and
  heard." with a speaker icon in the card's top-right corner. The chip is a small rounded pill with Korean over romanization.
- Korean block: 사관 (large), "sagwan" (upright, smaller), "royal historian" (gloss), speaker.
- Bottom bar pinned: a labelled switch "Read to me", a secondary "Back", a large "Next".

Frame 2: the same scene with the term gloss card open directly under the narration card
(sunken card: 사관 / sagwan / royal historian, speaker, "Close"); the chip shows a focus ring.

Frame 3 (Read-along level): the Korean sentence first and large (호랑이가 도망갔어요. /
horangiga domanggasseoyo. / The tiger ran away.), then "In English:" and two lines of
narration below.

Frame 4: the end page: Hoya the tiger cheering, heading "The End", four small scene
thumbnails in a row, a large "Continue", ghost buttons "Read again" and "Sources".

Frame 5 (landscape tablet): the picture on the left (55 %), narration, Korean block and the
bottom bar on the right; the top bar spans both columns.

Anti-patterns: any timer, score, percent or red colour; a speech bubble over the picture;
two Hoyas on one screen; Korean without romanization and gloss; emoji; text drawn inside
the picture; a floating popover for the gloss.
```

## 7. Acceptance checklist

- [ ] Next is the only large button; Back and the switch are secondary
- [ ] Dots only fill; the page number is a pill, not a meter
- [ ] Every Korean string has romanization and a gloss beside it
- [ ] The gloss card sits inline under the narration (no popover)
- [ ] No timer, no score, no red, no emoji
- [ ] One Hoya per screen (inside the picture, or cheering on the end page)
- [ ] Landscape frame puts the picture left and keeps the controls in the right column
- [ ] Token names only; every control at least 64 tall

## 8. Output path

- `design/screens/story/reader__v1__YYYY-MM-DD.png`
