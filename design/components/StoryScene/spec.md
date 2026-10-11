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

## Library batch 1 (PR 2.3b)

The first settings and props, for the flagship stories (`sejong-new-letters`, `sillok-royal-historians`). Nothing is learner-visible yet: no story has an `art` description until the cluster PRs (2.10a-d).

| Group | Ids |
|---|---|
| Settings (`settings/*.ts`) | `scene:palace-courtyard`, `scene:palace-hall` (with a simplified sun, moon and five peaks screen behind the seat), `scene:village-lane` |
| People (`props/people.ts`) | `prop:fig-king`, `prop:fig-official`, `prop:fig-scholar`, `prop:fig-historian` (seated, writing), `prop:fig-villager`, `prop:fig-grandmother`, `prop:fig-child` |
| Writing (`props/writing.ts`) | `prop:desk-low`, `prop:writing-set` (brush, inkstone, ink stick), `prop:writing-lines` (paper with stroke rows, no letters) |
| Books (`props/books.ts`) | `prop:book-thread-bound` (Korean five-hole binding), `prop:books-case` (volumes stored flat), `prop:document-box` |

- People are faceless (a blank `surface.paper` oval outlined in `border.strong`); hair, hats and clothing carry who they are. Six figures name a `tintable` garment colour so one figure covers many people.
- Every item has an `accuracyNote`; every heritage artefact and every figure in historical dress has a `sourceRef` (Encyclopedia of Korean Culture, National Archives of Korea, Federation of Korean Cultural Centers), and the note says what is simplified and what the source does not show.
- Palette headroom: `scene:palace-hall` keeps to the tokens the court figures already use, so the king, officials and historian fit the 8-token scene palette (a registry test composes that scene). Its five peaks are a muted grey rather than mineral blue-green for that reason.
- Hoya palette exemption: Hoya is a character, not a prop. His pose palettes use 7 to 9 tokens (the shipped `Hoya.tsx` palette), over the 5-token prop cap (item rule `I-palette`); `checkItem` exempts a `hoya:<pose>` item that draws only that pose's palette from that one rule, and `registry.test.ts` asserts no library item needs it. The scene-level cap (rule R-S5, 8 tokens) leaves Hoya's palette out too (decision 15 in F-STORY-002 §8, 2026-10-11): it counts every token drawn by the setting and the other layers, a token Hoya shares with another item still counts through that item, and a colour a layer `tint` brings onto Hoya counts (`cappedPalette` in `rules.ts`).

## Contact sheet (PR 2.4)

The review surface for every picture, in `apps/web` (static export, `noindex`, linked only from `/design-preview`). Layout follows F-STORY-002 §3.9.6; tokens only.

- `/design-preview/scenes`: header counts (stories, scenes, with art, art pending, draft stories, errors, warnings), the review checklist, then one section per story file in `content/stories` (title in English and Korean, state, kind, origin, verification passes, file name, story-level lint findings). Each scene is a row of five cells: the picture at 320 x 240 (or the tinted fallback panel the reader shows, labelled "art pending" or "no art yet"), the brief verbatim, the narration with keyword chips (Korean, romanization, gloss) and the cited facts with their source titles, the layers table (ref, x, y, s, z) and the findings of `checkScene` and `lintStory`. A toggle switches to a 4-up grid of 160 x 120 thumbnails or to 96-wide sequence cards; both draw the thumb variant in the browser from the scene data.
- `/design-preview/scenes/library`: every setting and prop at full size, at 96 px and as the thumb variant (a prop alone on a blank canvas, scaled to fit), with kind, band, box, colour swatches, tintable token, shape count, bytes, alt, source link, accuracy note and `checkItem` findings; then the five Hoya poses, the `hoyaNodes` data port beside the shipped `Hoya.tsx` mirror (the shared `HoyaReference` component of `/design-preview`).
- A `card:` layer is drawn by the web renderer only as a dashed placeholder box, so its row also says in words "card:<id> — shown in the app" under the picture.
- At phone width nothing widens the page: the thumbnail grids wrap (from 4 or 8 cells' width up they keep the 4-up and 8-up layout) and the library's fixed-size drawings scroll inside their card.
- `/design-preview/components` has a `StoryScene` section (F-STORY-002 §5, the F-VR-001 surface): the worked-example palace hall at full 320, full 96 and thumb 96, and the tinted fallback panel at 320 and 96.
- Reviewers reach the sheet through the `web-export` artifact of the PR's "Web Console (static export)" run (unpack `web-export.tgz`, then `node apps/web/e2e/serve-out.mjs out`) or a local build; there is no per-PR preview URL.
- Code: pure view models in `apps/web/src/lib/scene-sheet/` (`read-stories.ts`, `sheet.ts`, `library.ts`, 100 % covered); pages `app/design-preview/scenes/page.tsx` and `scenes/library/page.tsx`; `components/design-preview/{SheetView,sheet-ui,HoyaReference}.tsx`; smoke `apps/web/e2e/scene-sheet.spec.ts`.

