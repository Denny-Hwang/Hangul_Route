# Words: the Library Words section, the topic picker and the topic tile (F-VOC-003 C-4)

Spec: `docs/specs/F-VOC-003-topic-picker-flashcards.md` T1, T8, §3.1 (flag, routes, entry), §3.3 (picker), §3.8 (accessibility, layout).
Wireframe: `design/wireframes/vocab/topics.md` A (Library entry, as built: the Words tab), B (picker), D (empty).
Code: `apps/mobile/src/screens/library/LibraryScreen.tsx` (the `theme-packs` section, "Words"), `apps/mobile/src/screens/vocab/{VocabTopicsScreen,TopicGrid,TopicTile,WordsSection}.tsx` (render only), `apps/mobile/src/screens/vocab/topic-data.ts` (the bundle binding); decisions in `apps/mobile/src/logic/vocab/{topics,topic-view}.ts` and `apps/mobile/src/logic/story/library-sections.ts` (100 % covered).
Components: `KoreanText` (`sm`), `Progress` (`bar`), `Heading`, `Body`, `Caption`, `Button`, `Card`, `Icon` (design system), `PictureArt` (app, F-VOC-002 W-7).
Screenshots: build with `EXPO_PUBLIC_VOCAB_TOPICS_ENABLED=1` and run `E2E_VOCAB_TOPICS=1 HR_SHOTS=1 playwright test vocab-topics` (Library tab), or the fixture bundle with `STORY_FIXTURES=1 HR_SHOTS=1 playwright test vocab-topics` (picker and topic page through `window.__hrVocabE2E`); PNGs land in `apps/mobile/e2e/web/__shots__/vocab-topics-*.png` (git-ignored).

## Where Words lives (T1)

F-STORY-004's section tabs landed before this row, so Words is the Library's reserved `theme-packs` section, titled **Words**, and the Words card of wireframe A is not built (T1: "the entry card is removed in the same PR if the tabs landed first"; §8 item 1).

- The section is offered when `flags.vocabTopicsEnabled` is on **and** the picker has at least one topic (`visibleTopics`, T8). With the flag off the Library is exactly what it was: no Words tab, no new spacing (behaviour 1).
- Words is a section of its own, so turning it on always gives at least two sections (Cards and Words): the tab row then shows even in a build with no reviewed story.
- A deep link opens it: `navigate('Main', { screen: 'Library', params: { section: 'theme-packs' } })`.
- The full-screen picker (`VocabTopics`) draws the same `TopicGrid`; it is the destination for entries outside the Library (F-VOC-005's Home card, F-PLAN-002 plan items).

## Frames

```
A  Library, Words tab (flag on)            B  Picker (stack screen)               D  Empty (dev builds only)
┌────────────────────────────────┐         ┌────────────────────────────────┐     ┌────────────────────────────────┐
│ Heritage Library               │         │ [<-]                           │     │ [<-]                           │
│ [Cards][Story Time][Culture]   │         │ Words                          │     │ Words                          │
│ [Words]                        │  <- tab │ Pick a topic you like.         │     │ ┌────────────────────────────┐ │
│ Pick a topic. Meet a few words │         │ ┌────────────┐ ┌────────────┐  │     │ │ Words are on their way.    │ │
│ at a time.                     │         │ │  [cover]   │ │  [cover]   │  │     │ │ [ BACK ]                   │ │
│ 24 collected                   │  <- count│ │ Food       │ │ Animals    │  │     │ └────────────────────────────┘ │
│ ┌────────────┐ ┌────────────┐  │         │ │ ~~ 음식 ~~  │ │ ~~ 동물 ~~  │  │     └────────────────────────────────┘
│ │  tile      │ │  tile      │  │         │ │ eumsik     │ │ dongmul    │  │
│ └────────────┘ └────────────┘  │         │ │ [=====---] │ │ [==------] │  │
│  ... same grid as B ...        │         │ │ 5 collected│ │ 2 collected│  │
└────────────────────────────────┘         │ └────────────┘ └────────────┘  │
                                           └────────────────────────────────┘
```

## The topic tile (`TopicTile`)

One button, top to bottom:

| Part | Look |
|---|---|
| Cover | `PictureArt` of the cover item's `visual`, `decorative` (the tile's name says the topic), `useMediaSize(96)` capped at the tile's inner width, centred |
| English title | `Body` semibold, the topic title in the UI language (`vocab-topic:<key>` overlay `title`, else `titleEn`) |
| Korean title | `KoreanText` `sm`, `titleKo.ko` with its romanization; no gloss line: the title right above it is its meaning in the UI language, so the meaning is not printed twice |
| Meter | `Progress variant="bar"`, `height = spacing.sm`, `max` = the topic's words, `value` = collected; no `label`; hidden from assistive technology (`accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`, `aria-hidden`), because `Progress` announces `now/max` |
| Count | `Body size="sm" weight="semibold" tone="secondary"`: "5 collected" (`learner.vocab.topics.collected`), a plain count, never "5 of 12", never a percent |

- Fill `surface.paper`; border `borderWidth.base` in the **topic tint** (`colors.theme.*` or `colors.stage.stage2`, from the topic's `tint`): an accent only, never a text colour (`tokens.ts`, theme tints are fills). Pressed: `border.focus`. Radius `radii.lg`, padding `spacing.md`, gaps `spacing.sm`.
- `minHeight` is `touchTarget.child` (80); the tiles in a row stretch to the tallest.
- Accessible name: "Food. 5 words collected." (`learner.vocab.topics.tileA11y`), role button. The Korean chip and the meter sit inside the one button, so a screen reader reads the name only.
- Romanization follows the learner's setting with no reveal on the tile (the whole tile is one button, as on the story shelf): `romanizationMode = 'tap'` hides it here; the topic page offers the reveal.
- Tap: `vocab.topic_opened { topicKey, source: 'library' }`, then `VocabTopic { topicKey }`.

## Grid (`TopicGrid`)

- Columns by window width (§3.3): **1** below 360 dp, **2** from 360 to 767, **3** from 768. Gap `spacing.sm`; rows of equal cells (a short last row is padded so its tiles keep the same width). The grid's width is measured (`onLayout`), falling back to the content width on the first frame, as the story shelf does.
- Order is the topic `order` (F-VOC-001 §3.3), fixed; it never re-sorts by progress.
- Only `ready` and `shipped` topics whose every picture resolves (T8, V12): Food, Animals, Colors and Numbers today; the other eight stay `draft` until V-7. A dev build with `EXPO_PUBLIC_VOCAB_SHOW_DRAFTS=1` also lists `draft` and `preview` topics (C-3's `vocabShowDrafts`; release builds ignore it).

## The Library Words section (`WordsSection`)

- Under the tab row: the line "Pick a topic. Meet a few words at a time." (`learner.vocab.library.line`, `Body tone="secondary"`), then the count "24 collected" (`learner.vocab.library.collected`, `Body weight="semibold"`): the distinct collected words of the listed topics (a word filed under two topics counts once), never a fraction.
- Then the grid. The section uses the full width with no detail pane on every window, like Story Time and Culture (F-LAYOUT-001 §3.6).

## The picker screen (`VocabTopicsScreen`)

- A stack screen: `Screen scrollable` with all four safe-area edges (not `TAB_SCREEN_EDGES`), the reading width. Back top-left (`Icon arrow-left`, `a11y.goBack`, hit slop `spacing.md`), the title "Words" (`Heading level="title"`), the line "Pick a topic you like.", then the grid.
- Empty (no topic the picker can show; reachable only in a dev build with the flag on): a `Card` with "Words are on their way." and a secondary **Back** button. Never a blank screen.

## Locked topics (switch on only; never at launch)

Each tile asks `isContentLocked({ kind: 'vocab-topic', id, tier, gatingEnabled: gatingActive(flags, bundleOs()) })` (F-STORY-004 §3.9). With the switch off (production, D5) it is `false` for every topic. Food, Animals, Colors and Numbers are the free samplers (`FREE_VOCAB_TOPIC_IDS`, F-ENT-003 OD-4).

- Nothing is drawn for a locked topic: no lock glyph (F-ENT-003 OD-6: no lock on learner screens), no "Premium" pill, no price (D5). The closed look ("Not open yet" with the dotted ring) arrives with F-ENT-003's learner rows.
- The tap of a locked tile takes the route a locked story tile takes (`lockedStoryGate`: straight on for a learner who may open it, else behind the grown-up PIN) instead of opening the topic.

## Accessibility

- Every tile is a button >= 80 dp tall with its name and count in words. The meters are hidden from assistive technology; the counts are text.
- Back is a button named "Go back" in the top-left on both screens.
- 200 % text: the tiles grow; the grid keeps its columns (the tile has no fixed height), the page scrolls; nothing is clipped.
- No motion, no sound on these screens.

## Decisions taken while building

- **Words tab, not the card** (T1, §8 item 1): the tabs exist, so the section replaces the card in this PR. The tab label changes from the reserved "Theme packs" to **Words** (the one-word amendment T1 names), and `learner.vocab.library.open` / `.a11y` (the card's button and name) are dropped with the card.
- **No gloss line on the tile's chip**: the topic title is printed right above the chip in the UI language; a gloss line would print "Food" twice in a 150 dp tile.
- **Tile tint as the border**: the spec allows a fill or a border accent; a border keeps the paper fill under the cover picture, so a card-art cover and a WordArt cover sit on the same neutral tile (F-VOC-002 §3.11).
