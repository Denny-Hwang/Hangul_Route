# CardArt: one face for every card (component spec v1)

Spec: `docs/specs/F-STORY-006-card-award-model.md` §3.8 (Art, D7), PR 6.6 in §6 · wireframes: `design/wireframes/library/gallery.md` (collected slot art), `design/wireframes/library/card-detail.md` (ART 1:1 zone, "art missing for the id → Korean word fills the art zone"), `design/wireframes/results/extra-cards.md` (`[art]` 96 thumbnails with the rarity border), `design/wireframes/library/card-back-citation.md` (story-card front)
Code: `apps/mobile/src/logic/card-art.ts` (pure: which face, crop, plate and word geometry), `apps/mobile/src/components/CardArt.tsx` (paints it) · tests `apps/mobile/src/logic/__tests__/card-art.test.ts`, e2e `apps/mobile/e2e/web/card-art.spec.ts`
Lives in the app, not the design system: it reads the card catalogue and the story bundle, which `packages/design-system` does not know about.

## What it is

A card's face in a `size x size` square. Every screen that draws a card (Library tile, card page front, Results thumbnails) draws `CardArt` and never tests `supportedCardIds` itself, so a new card never needs a new drawing or a new branch in a screen.

## Which face (in order)

| Face | When | Square background | Content |
|---|---|---|---|
| Heritage drawing | the design system draws the id (`supportedCardIds`) | `surface.paper` | `HeritageCardArt` at `size` |
| Cover crop | a story card (`storyId`) whose story's cover scene has art (not `artPending`) | `theme[card.theme]` | `StoryScene` of the cover at width `size * 4/3` (so its 4:3 height is `size`), shifted left by `size / 6`: the centre of the scene fills the square. `variant` follows the story tile rule (`thumb` below the tile threshold). Its own fallback is the Korean word |
| Collection plate | a set card (`unlockedBy: set:<id>`) with member cards in the catalogue (`setId` equal to that rule, never another set card) | `surface.sunken` | a framed plate (inset `size * 0.03`, `radii.md`, `borderWidth.base` in `rarity[card.rarity]`, `surface.paper`) holding six square cells, three across and two down, centred (margin `size * 0.06`, gap `size * 0.03`, `radii.sm`); each member is its own `CardArt` (heritage drawing, cover crop or word); an empty cell is `surface.sunken` |
| Korean word | nothing above resolves (art not drawn yet, cover pending, members not bundled) | `theme[card.theme]` | `subtitleKo` (or the first letter of `titleEn` for a card with no Korean word), bold `sansKr`, `text.primary`, one line, `lang="ko"`; size `min(0.4 * size, 0.8 * size / glyphs)`, never below `typography.size.caption` (80 on the 200 card page for a two-syllable word, as before) |

An owned card therefore always has a face: no blank tile, no broken image.

## Props

| Prop | Type | Notes |
|---|---|---|
| `card` | `HeritageCard` | the (localised) card |
| `size` | number (dp) | side of the square |
| `accessibilityLabel` | string, optional | given: the square is one image with this name ("Card art for Kimchi"); absent: hidden from assistive technology (the Results thumbnails, where the banner says the card's name) |
| `style` | view style, optional | corner radius, border, position from the screen; size, background and clipping stay the face's own |

Call sites: Library tile (`radii.md`, labelled), card page front (200, `radii.xxl`, labelled; a locked card keeps its lock panel and never draws `CardArt`), Results `CardArtThumb` (96, `radii.lg`, `borderWidth.thick` in the rarity colour, decorative).

## Rules

- Tokens only; no raster, no emoji, no text inside pictures. The word face is the only text and it is the card's Korean word.
- No animation; nothing here reads the reduced-motion setting (the banners around it own their entrances).
- The text size is fixed by the square (`maxFontSizeMultiplier` 1): the full word, romanization and English title are always printed beside or below the face at the learner's text size.
- Showing a face never changes progress: an owned card stays owned whatever its face is.
