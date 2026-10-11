# StoryScene (component spec v1)

Spec: `docs/specs/F-STORY-002-story-reader.md` §3.9 (SceneArt) and PR 2.3a in §6 · wireframe: `design/wireframes/story/reader.md` (notation `<art>`) · the picture rules (composition, palette, accuracy) are §3.9.5 and §3.9.10
Code: `packages/design-system/src/components/StoryScene/` (`StoryScene.tsx` paint, `types.ts`, `index.ts`) over the pure `packages/design-system/src/scene-art/` (`draw.ts`, `story-scene-model.ts`, `registry.ts`, `hoya.ts`); the same drawing list is painted for the web contact sheet by `scene-art/dom.tsx`

## What it is

A story scene's picture, drawn from a small data description (`SceneArt`: a background setting, up to 8 layers, a screen-reader sentence). It is a 4:3 picture with no text, no raster and no emoji: every colour is a `colors.*` token and every stroke a `borderWidth` step. The component has no copy and no business logic; the reader, the shelf tile and the recap pass it already-localised labels.

## Props

| Prop | Type | Notes |
|---|---|---|
| `art` | `SceneArtLike?` | The scene description. Absent or `null`: the fallback panel |
| `theme` | `ThemeKey?` | Tint of the fallback panel. Default `letters` |
| `variant` | `'full' \| 'thumb'` | `thumb` drops detail shapes and hairline strokes. Library grids and recap thumbnails use it |
| `width` | `number?` | dp; height is `width * 3 / 4`. Default 320. Invalid values read as the default |
| `fallback` | `ReactNode?` | Centred on the fallback tint (for example the Korean title on a shelf tile) |
| `decorative` | `boolean?` | True: hidden from assistive technology (recap thumbnails) |
| `accessibilityLabel` | `string?` | Default `art.altEn` |
| `onResolveIssue` | `(issues) => void` | Called when the setting or a layer did not resolve. No logging |
| `testID` | `string?` | |

## States

| State | Looks like | Assistive technology |
|---|---|---|
| Picture | the setting, then layers back to front (`back`, `mid`, `front`), cards where `card:<id>` layers sit | `image`, named by `accessibilityLabel` or `art.altEn` |
| Fallback (no `art`, or the setting does not resolve, or the data is malformed) | rounded panel of `colors.theme[theme]` at opacity 0.15 with `fallback` centred. Never a broken image, never an error box | an `image` only when a label was given |
| Layer unresolved | that layer is skipped, the rest draws; in development the picture gets a dashed `border.strong` outline | unchanged |
| Decorative | as picture or fallback | hidden |

## Tokens (no literals)

| Part | Token |
|---|---|
| Shape fills and strokes | any `colors.*` leaf except `surface.overlay`, `surface.inkScrim`, `feedback.danger` |
| Stroke width | `borderWidth.thin / base / thick` (1 / 2 / 3 canvas units), round caps and joins |
| Opacity | the steps 0.08, 0.15, 0.2, 0.35, 0.6, 0.85, 1 |
| Panel radius | `radii.lg` |
| Fallback tint | `colors.theme[theme]`, opacity 0.15 |
| Development outline | `borderWidth.base`, `colors.border.strong`, dashed |

## Hoya in a picture

`hoya:<pose>` layers (`idle cheering thinking reading waving`) draw a data port of the shipped `Hoya` component on the same 128-unit box (`scene-art/hoya.ts`). The component is unchanged; `hoya-parity.test.ts` keeps the two honest (the port may only use tokens the component uses). Differences, none visible at scene sizes: limbs are filled outlines (strokes are 1 to 3 units), numbers are multiples of 0.5, the waving hand sits one unit in so it stays inside the box. One Hoya per scene (rule R-S4), so the reader shows no `HoyaBubble` over a picture that has him.

## Heritage cards

A `card:<id>` layer draws the existing `HeritageCardArt` picture in a square of 80 canvas units (scaled by the layer's `s`) with its bottom-centre on the layer point. Only the react-native renderer draws it; the web contact sheet draws a dashed `border.strong` placeholder titled "card:<id> - shown in the app". The 24 launch stories use no card layers.

## Accessibility

- The reader names the picture with `art.altEn` (one sentence, no Hangul, never starts with "Image of"); the scene number is announced by the screen around it.
- No colour carries meaning alone; pictures never contain text, so nothing needs a Korean label inside them.
- No animation inside art; nothing here reads the reduced-motion setting.

## Checklist for this PR set

Registry holds only Hoya in PR 2.3a, so no story picture is drawn yet and nothing is learner-visible. Settings and props arrive with PR 2.3b and the cluster batches; each is reviewed on the contact sheet (PR 2.4) against the checklist in F-STORY-002 §3.9.6.
