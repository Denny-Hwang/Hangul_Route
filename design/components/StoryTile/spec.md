# StoryTile and the Story Time section (component spec v1)

Spec: `docs/specs/F-STORY-004-story-shelf-home-library.md` §3.3, §3.4, §3.12 and PR 4.5 in §6 · wireframe: `design/wireframes/library/stories.md` screens B (Story Time), G (locked tile), H (empty and error)
Code: `apps/mobile/src/screens/library/StoryTile.tsx` (tile), `StoryShelf.tsx` (hero + grid of one category), `LibraryScreen.tsx` (sections shell); pure view model `apps/mobile/src/logic/story/story-tile.ts` (`storyTileView`, `heroAction`, `storyTileColumns`, `shelfViewedPayload`, `storyTileCoverWidth`, `storyCoverVariant`, `lockedStoryGate`) and `library-sections.ts` (`librarySectionTabs`)
Reuses: `SectionTabs` (`design/components/SectionTabs/spec.md`), `StoryScene` (`design/components/StoryScene/spec.md`), `KoreanText` (`design/components/KoreanText/spec.md`), `StarRow`, `Button`, `Card`, `Icon`

## Library shell

```
 "Library"            (title row; the Cards section keeps its count line and pill here)
 (Cards) (Story Time)  <- SectionTabs, only when two or more sections are offered
 section body
```

- One section offered (no reviewed story in the bundle): exactly today's gallery, no tab row.
- Selected tab = `route.params.section` when offered, else Cards; switching is local state. A deep link param is read once and cleared.
- The section body is a `role="tabpanel"` named by the selected tab (`aria-labelledby`); the tabs point at it with `aria-controls`.
- Cards sits in the split pane and Story Time spans the window, so a switch remounts the tab row. The pressed tab takes keyboard and screen-reader focus again (`SectionTabs focusSelected`), so focus is never dropped on a switch.
- The Cards section keeps the two-pane gallery on wide windows (tabs in the master pane, F-LAYOUT-001 §3.6). Story sections use the full width with no detail pane on every window.
- Culture is offered once its section exists (PR 4.7); Theme packs stay reserved (F-VOC-003).

## Story Time section

```
 ┌ Picked for you ─────────────────────────┐
 │ [cover 4:3]   English title             │   stacked below 768 dp,
 │               ~~ ko / romanization ~~   │   cover left from 768 dp
 │               about 4 min               │
 │               [[ Start | Keep reading | Read it again ]]
 └─────────────────────────────────────────┘
 tiles in shelf.order (never re-sorted by progress)
```

- Hero: the `pickedForYou` story of the category; no hero when nothing applies. Its button opens the story directly through `planOpenStory` (`source: 'library'`); the hero card itself is not a button (no nested buttons). Button label read out as "`<cta>: <title>`".
- Columns by window width (`storyTileColumns`): 1 below 360 dp, 2 at 360-767, 3 at 768-1023, 4 from 1024. Equal cells; the last row is padded. No horizontal scroll.

## StoryTile anatomy

```
 ┌──────────────┐
 │ [cover 4:3]  │  StoryScene (thumb variant below a 240 dp cover); no art: theme tint + Korean title
 │ English title│  Body semibold
 │ ~~ ko ~~     │  KoreanText size sm (Korean + romanization together; see D2 below)
 │ [lock] state │  New | Keep reading | Finished + StarRow (stars >= 1 only) | Locked
 │ about N min  │  Caption muted
 └──────────────┘
```

## Tokens (no literals)

| Part | Token |
|---|---|
| Tile | `surface.paper` (locked: `surface.sunken`), `border.subtle` `borderWidth.base` (pressed: `border.focus`), `radii.lg`, padding `spacing.sm`, gap `spacing.sm`, min height `touchTarget.min` |
| Grid gap | `spacing.sm` |
| Fallback title | `typography.size.title`, stepping down to `typography.size.bodyLg` below a 240 dp cover (the usual 2-column phone tile); at most 3 lines, text scale capped at 1.3x so it stays inside the 4:3 box; `weight.bold`, `text.primary`, on `colors.theme[theme]` at the StoryScene fallback opacity |
| State line | `Body sm semibold`, `text.secondary`; lock `Icon` and `StarRow` at `spacing.lg` |
| Hero | `Card padding="md"`, heading `prompt`, cover at most 360 dp, `Button tone="primary" size="lg"` |

## Accessibility

- A tile is one button: "`<title>. <state>. About N minutes.`" (plus "N stars." for a finish with stars; nothing about stars for a 0-star finish). The cover is decorative.
- The state is always words; colour is never the only cue.
- Korean text carries `lang="ko"` / `accessibilityLanguage="ko-KR"`.
- Tiles reflow at 320 dp and 200 % text. The fallback title on the cover grows to 1.3x only (it is clipped by the fixed cover box otherwise); the `KoreanText` below carries the full title at the learner's text size.
- **Romanization (D2)**: shown with every Korean title by default. A profile set to hide romanization until a tap (`romanizationMode: 'tap'`) sees none on the shelf tiles or the hero: a tile is one button, so the shelf has no tap-to-reveal, and the reader reveals it.

## States

- **New / Keep reading / Finished**: from `storyStatus` (finished = quest completed; keep reading = bookmark at the same level).
- **Locked**: only when `contentGatingEnabled`, free tier, not in the sampler. Lock icon + "Locked"; tap sends `story.locked.tapped` and opens the grown-up gate (PIN, or the paywall directly on a self-only device with no PIN); the paywall is opened with `from: 'library'` on both paths. With the flag off (launch) nothing is locked and no "Premium" text exists.
- **Error**: a cover that does not resolve degrades to the tint + Korean title (StoryScene fallback); one broken story never blanks the shelf.
- **Empty**: a category with no playable story is not offered as a tab.
- **Tile tap before PR 4.6**: `EpisodeDetail { episodeId }` is the generic episode page until PR 4.6 adds the story variant. The Story Time section only appears once a reviewed shelf story is bundled, so the first reviewed shelf story must not ship before PR 4.6 merges.

## Telemetry

`story.shelf.viewed` `{ section, stories, started, finished }` once per visit: switching to the section, or the Library tab gaining focus with it shown. Coming back from a screen pushed over the tabs (a story, its episode page, the paywall or the PIN) is the same visit and is not counted again; `story.opened` from the hero through `planOpenStory`; `story.locked.tapped` `{ storyId }` (gating on only). Ids and counts only.
