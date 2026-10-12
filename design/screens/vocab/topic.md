# Words: the topic page and the word wall (F-VOC-003 C-4)

Spec: `docs/specs/F-VOC-003-topic-picker-flashcards.md` T7, T8, §3.4 (topic page), §3.8 (accessibility, layout), §3.10 behaviours 2 and 9.
Wireframe: `design/wireframes/vocab/topic-detail.md` C (topic page) and D (not found, not hydrated).
Code: `apps/mobile/src/screens/vocab/{VocabTopicScreen,WordWall}.tsx` (render only); decisions in `apps/mobile/src/logic/vocab/{wall,suggest,topic-view,caps}.ts` (100 % covered).
Components: `KoreanText` (`sm` header, `xs` wall: the tier this row adds, `design/components/KoreanText/spec.md`), `Progress` (`dots` or `bar`), `HoyaBubble`, `Heading`, `Body`, `Button`, `Icon` (design system), `PictureArt` (app; `mono` for the silhouette, this row).
Screenshots: the fixture bundle (`STORY_FIXTURES=1 HR_SHOTS=1 playwright test vocab-topics`) opens the page through `window.__hrVocabE2E.openTopic(key)` and collects words with `collect(ids)`; PNGs in `apps/mobile/e2e/web/__shots__/vocab-topic-*.png` (git-ignored).

## Frames

```
C  Topic page (5 of the words collected)          D  Not found                       D  Not hydrated
┌────────────────────────────────┐                ┌────────────────────────────────┐  same page: 0 collected,
│ [<-]                           │                │ [<-]                           │  every tile a silhouette,
│ Food                           │  <- display    │ Topic not found                │  the activities still work
│ ┌──────┐                       │                │ [ BACK ]                       │
│ │ 음식 │  eumsik                │  <- KoreanText └────────────────────────────────┘
│ └──────┘                       │
│ o o o o o . . . . . . .        │  <- dots, hidden from screen readers
│ 5 collected                    │  <- the count, in words
│ (Hoya idle) "Hungry? Let's     │  <- once per topic per session
│  name some tasty things..."    │
│                                │
│ [[ LEARN ]]                    │  <- the suggested activity is the primary button
│ Meet a few words with pictures.│
│ [ SPEED ROUND ]                │
│ Learn 3 words first            │  <- below the option count it opens Learn
│                                │
│ ┌──────┐ ┌──────┐ ┌──────┐     │  <- the word wall, file order, never re-sorted
│ │[pic] │ │[pic] │ │ ░░░░ │     │     collected: picture + Korean (xs chip)
│ │┌───┐ │ │┌───┐ │ │      │     │     new: soft silhouette, no Korean
│ ││사과│ │ ││우유│ │ └──────┘     │
│ │└───┘ │ │└───┘ │              │
│ │sagwa │ │uyu   │              │
│ └──────┘ └──────┘              │
│  ... 12 tiles, 3 a row ...     │
└────────────────────────────────┘
```

## Layout, top to bottom

1. **Back** top-left (`Icon arrow-left`, "Go back", the same place as every stack screen).
2. **Title**: `Heading level="display"`, the topic title in the UI language (overlay `title`, else `titleEn`).
3. **Korean title**: `KoreanText` `sm`, no gloss (the title above is the meaning). Romanization per the learner's setting (`romanizationShown(mode, revealed)`); in reading practice (`'tap'`) a ghost button **Show sound** under it reveals the romanization for this visit (`learner.vocab.cards.showSound`, the flashcards' word for the same reveal, F-I18N-001 §3.5.3).
4. **Meter**: `Progress variant="dots"` (`max` = the topic's words, `value` = collected) when the row fits the content width (12 x 12 + 11 x `spacing.sm` = 232 dp for 12 words), else `variant="bar"`; either one is hidden from assistive technology. Then the count "5 collected" (`learner.vocab.topic.collected`, `Body weight="semibold"`), a plain count, never "5 of 12", never what is left.
5. **Hoya**: `HoyaBubble tone="idle"` with the topic's Hoya line in the UI language (overlay `hoyaIntro`, else `hoyaIntroEn`), **once per topic per app session** (a second visit in the same session shows no bubble).
6. **Activities** (T7), in this order, each a `Button size="lg"` (80 dp, `touchTarget.child`) full width with its one line (`Body size="sm" tone="secondary"`) under it:
   - **Learn**: "Meet a few words with pictures." Always available.
   - **Speed round**: "Catch the words you know." From as many collected words as the level has options (3 for Pictures first, 4 otherwise); below that the button stays and its line says "Learn 3 words first" (the words still to learn, never the threshold) and it opens Learn: never a dead end.
   - **Match**: "Match each word to its picture." Only when Pic-Word Match is in the build **and** 3 words are collected; before that it is not drawn (it has no "learn first" line of its own).
   - The suggested one (`suggestActivity`: Learn while words are new and the topic had no session today, or below the option count; otherwise Speed round; never Match) is `tone="primary"`, the others `tone="secondary"`.
7. **Word wall** (`WordWall`): every word of the topic in file order (`topicItems`), never re-sorted, never a lock, never a count of what is left.

## The word wall

| Tile | Look | Screen reader |
|---|---|---|
| collected | `PictureArt` (`decorative`) above a `KoreanText` `xs` chip with its romanization (per the setting, no reveal on the wall); no gloss line (the picture carries the meaning, F-I18N-001 §3.5.4; the flashcard shows the gloss) | one element: "Korean: 사과, sagwa, apple" (`a11y.koreanItem`); a button once the flashcards exist |
| new | the same picture as a **silhouette**: `PictureArt mono` on `surface.sunken` (WordArt in `border.strong`, F-VOC-002 W8); card art and swatches have no silhouette, so they show the plain sunken tile (§8 item 4) | one element: "Not collected yet"; not a button; no Korean (no spoilers) |

- Picture side: the tile's inner width, at least 64 and at most 96 dp (§3.4: "PictureArt at 64-96").
- **Columns**: as many as fit a tile of 88 dp (the `xs` chip of a three-syllable word, 74 dp, and its romanization at `caption` size, about 77 dp for "geomeunsaek", plus the tile's chrome), at least 1 and at most 4, from the measured grid width; at large text the minimum grows with the font scale (up to 2x), so the grid drops columns instead of clipping. That is **3 on a 320 to 400 dp phone and 4 from a 376 dp grid** (a 408 dp window, tablets). Gap `spacing.sm`; a short last row keeps the tile width.
- A collected tile opens its flashcard on the back face (`VocabCards { topicKey, chunk: <the chunk that holds it>, startId }`), at the learner's chunk size. Tap target: the whole tile (>= 64 dp).

## Activities and tiles before their screens exist

The topic page launches four screens that later rows add: the flashcards (C-5), the Speed Round (F-VOC-004 S-5), Match (C-6). A button or tile is drawn as a button only when its screen is in the build (`VOCAB_SCREENS` in `logic/vocab/caps.ts`; a test ties each entry to the route registered in `navigation/root.tsx`), so a build never shows a button that goes nowhere. This build (C-4) has none of them yet: the page shows the header, the meter, Hoya and the wall, and the wall's tiles are not buttons. C-5 switches Learn and the tiles on, S-5 the Speed round, C-6 Match; each by registering its route and setting its entry.

## States

| State | What shows |
|---|---|
| first visit, nothing collected | 0 collected, every tile a silhouette, Hoya's line; Learn is the suggestion |
| some collected (fewer than the option count) | dots and count; Learn is primary; Speed round says "Learn N words first" |
| 4+ collected, a session today or every word collected | Speed round is primary |
| topic not found (unknown key, a draft key in a release build, a topic with a picture that does not resolve) | "Topic not found" and a secondary **Back** button (`learner.vocab.topic.notFound`, `.back`) |
| progress not hydrated or unreadable | the page as for nothing collected; nothing is written here |

## Accessibility

- Back, the activity buttons and the collected tiles are buttons; each activity >= 80 dp, each tile and the reveal >= 64 dp.
- The meter is hidden; the count is text ("5 collected"). No "n of m" and no percentage anywhere (D3, behaviour 10).
- The Korean header is one element ("Korean: 음식, eumsik, Food"); the reveal is a separate button named "Show sound".
- 200 % text: the wall drops columns, the page scrolls (`Screen scrollable`), nothing is clipped.
- Reduced motion: nothing animates on this page.
- No sound plays on this page.

## Decisions taken while building

- **Activities above the wall.** The wireframe draws them under the wall and asks for a sticky bar at large text. Twelve tiles are three to four rows (about 500 dp on a 320 x 568 phone), so under the wall every activity starts below the fold, and a sticky bar of three 80 dp buttons with their lines would cover half the screen. Above the wall, Learn is on the first screen at every size and the collection follows.
- **`KoreanText` `xs` for the wall.** The `sm` chip (28 dp Hangul) is about 114 dp wide for a three-syllable word, wider than any wall tile on a phone. `xs` draws 18 dp Hangul (the body floor) on a tighter chip with a 14 dp romanization: about 74 dp for 바나나 or 검은색.
- **Wall columns from the fit, not from 360 dp.** At a 360 dp window four tiles are 76 dp each, narrower than the `xs` chip and the romanization of words like 검은색 (geomeunsaek), which would be clipped or broken mid-word. The wall therefore has 3 columns on phones and 4 where four tiles fit (grid >= 376 dp), and fewer at large text.
- **Match hidden until available**: Match has no "learn first" line; drawing it as a dead button would break "never a dead end", and the Speed round's line already tells the learner what to do.
- **Not found covers hidden topics**: a key that is not in the picker (a draft topic in a release build, a topic whose pictures do not all resolve) is "Topic not found", so a half-empty topic can never be opened (T8, behaviour 3).
