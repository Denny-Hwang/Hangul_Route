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
| Collection plate | a set card (`unlockedBy: set:<id>`) whose award set (`awardWorld.sets`, the same list that awards it) lists member cards in the catalogue (never the set card itself or another set card) | `surface.sunken` | a framed plate (inset `size * 0.03`, `radii.md`, `borderWidth.base` in `rarity[card.rarity]`, `surface.paper`) holding six square cells, three across and two down, centred (margin `size * 0.06`, gap `size * 0.03`, `radii.sm`); each member is its own `CardArt` (heritage drawing, cover crop or word); an empty cell is `surface.sunken` |
| Korean word | nothing above resolves (art not drawn yet, cover pending, members not bundled) | `theme[card.theme]` | `subtitleKo` (or the first letter of `titleEn` when the Korean word is missing or blank, and `?` if both are blank, so the face is never empty), bold `sansKr`, `text.primary`, one line, `lang="ko"`; size `min(0.4 * size, 0.8 * size / glyphs)`, never below `typography.size.caption` (80 on the 200 card page for a two-syllable word, as before) |

An owned card therefore always has a face: no blank tile, no broken image.

## Props

| Prop | Type | Notes |
|---|---|---|
| `card` | `HeritageCard` | the (localised) card |
| `size` | number (dp) | side of the square |
| `accessibilityLabel` | string, optional | given: the square is an image with this name ("Card art for Kimchi"; `role="img"` on the web). It is never its own focus stop (no `accessible`): every labelled call site sits inside a button that already names the card, and a nested focusable view would be a second TalkBack stop on Android. Absent: hidden from assistive technology (the Results thumbnails, where the banner says the card's name) |
| `style` | `borderRadius`, `position`, `top`, `left` only | applied first, so size, background and clipping always stay the face's own. No border or padding: it would shrink the content box that the cover crop and the plate are laid out in (both are absolute layers sized from `size`). A frame goes on a wrapper around the face |

Call sites: Library tile (`radii.md`, labelled), card page front (200, `radii.xxl`, labelled; a locked card keeps its lock panel and never draws `CardArt`), Results `CardArtThumb` (a 96 wrapper with `radii.lg` and `borderWidth.thick` in the rarity colour, holding a 90 face, `96 - 2 * borderWidth.thick`, at `radii.lg - borderWidth.thick`; decorative).

## Rules

- Tokens only; no raster, no emoji, no text inside pictures. The word face is the only text and it is the card's Korean word.
- No animation; nothing here reads the reduced-motion setting (the banners around it own their entrances).
- The text size is fixed by the square (`maxFontSizeMultiplier` 1): the full word, romanization and English title are always printed beside or below the face at the learner's text size. On native a long word shrinks to fit (`adjustsFontSizeToFit`, down to half); on the web it is one line ending in an ellipsis below the caption floor. Card headwords today are at most four syllables, which fit at 96.
- Showing a face never changes progress: an owned card stays owned whatever its face is.

## Acceptance carried into 6.7 and 6.8

No shipping card resolves to the cover crop or the plate yet (story and set cards arrive in 6.7). When they land:

- an e2e (or a dev-only gallery) renders a story card's cover crop and a set card's plate (three and six members) at 90 inside `CardArtThumb` and at 200 on the card page, and asserts the cells' boxes stay inside the plate frame;
- the plate already reads `awardWorld.sets[].memberCardIds` and `awardWorld.cards` (6.6), so 6.7 only has to fill `awardWorld.sets` from `content/story-sets.ts`; its integrity test keeps each set's member list equal to the story cards that carry that `setId`.
