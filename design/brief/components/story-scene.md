# StoryScene

**A story's picture, drawn from data.** One 4:3 scene: a background setting and up to eight hand-drawn layers, tokens only, no text.

Spec: `docs/specs/F-STORY-002-story-reader.md` §3.9 (SceneArt), §3.9.9 (component) · component spec (props, states, tokens, library batches): `design/components/StoryScene/spec.md` · picture rules: `design/brief/illustrations/scene-art-style.md` · code (built): `packages/design-system/src/components/StoryScene/` over `src/scene-art/`

## 1. Context

`StoryScene` draws every picture of the 24 heritage stories (182 scenes) and their covers. It appears in:

- the story reader, full width of the reading column (`variant="full"`);
- the end page recap and Story Order cards (96 wide, `variant="thumb"`, decorative);
- the Library, Home and episode-page story tiles (cover, `variant="thumb"`);
- the contact sheet `/design-preview/scenes` (web, the same drawing list painted as DOM SVG) where every art PR is reviewed.

It has no copy and no business logic: callers pass the scene data and an already-localised label.

## 2. Layout

- Canvas 400 x 300 units, scaled to `width` (height = width x 3 / 4); rounded corners `radii.lg`.
- Layers draw in bands `back`, `mid`, `front`, then in array order inside a band. An item's anchor is its bottom-centre.
- `variant="thumb"` drops detail shapes and thin strokes, so a scene still reads at 96 wide.
- Fallback (art absent, pending or unresolvable): a rounded panel of `colors.theme[theme]` at opacity 0.15 with an optional centred `fallback` node (the shelf tile puts the Korean title there). Never a broken image, never an error box.

## 3. Variants and states

| Variant / state | Look |
|---|---|
| `full` | every shape, `borderWidth.base` outlines, detail shapes on |
| `thumb` | detail shapes and `thin` strokes dropped; at most 80 resolved shapes |
| fallback | theme tint panel at 0.15, optional centred node |
| unresolved layer | the layer is skipped, the rest draws; in development a dashed `border.strong` outline marks the scene for the reviewer |
| `decorative` | hidden from assistive technology (recap thumbnails) |

## 4. Accessibility

- Role image; label = the scene's `altEn` (one sentence that says what is shown and what it means, never "Image of", no Hangul) unless the caller passes a label.
- No motion inside the art; nothing animates with sound.
- Colour is never the only carrier of meaning: the narration says everything the picture shows.

## 5. Claude Design prompt

```prompt
Draw a reference sheet for Hangul Route's StoryScene: flat vector story pictures built
from simple shapes. Output: one 2000 x 1500 sheet.

Rules (follow exactly): 4:3 pictures on a 400 x 300 grid; only rectangles, circles,
ellipses, lines, smooth paths and polygons; round line caps; outlines in text.primary at
2 units; colours named by Hangul Route token (surface.canvas, surface.paper,
surface.sunken, theme.letters, theme.life, theme.rites, theme.nature, theme.crafts,
brand.primary used sparingly, hoya.fur, border.strong); at most 8 colours per picture
not counting Hoya's own palette; no text, letters, numbers or emoji in the picture; no
gradients, filters or photos. People are faceless: a blank paper oval with a border.strong
outline; hair, hats and clothing carry identity. Hoya the young tiger (smiling, never
showing teeth) may appear once, as an observer beside the action, never inside a
historical event.

Row 1: three full scenes: (a) a Joseon palace hall: a king on a raised seat, officials
kneeling, a historian writing at the side; (b) a mountain archive building among pines;
(c) a family courtyard at the Lunar New Year with Hoya watching from the left.
Row 2: the same three at 96 px wide in the thumb style (details removed), to prove they
still read.
Row 3: the fallback state: three rounded panels in theme.rites, theme.letters and
theme.nature at 15 % opacity, one with a centred Korean title 설날.

Anti-patterns: faces on people, frowns or teeth, red accents everywhere, text or signs
with letters, a crowded picture with no single focal point, Hoya taking part in a battle.
```

## 6. Acceptance checklist

- [ ] One clear focal point per scene, readable at 96 px
- [ ] Faceless people; Hoya smiles and appears at most once
- [ ] No text, glyphs, emoji, gradients or raster
- [ ] Token colours only; at most 8 per scene (Hoya's palette excepted)
- [ ] Fallback is a soft tint panel, never an error look

## 7. Output path

- `design/components/StoryScene/reference__v1__YYYY-MM-DD.png`
