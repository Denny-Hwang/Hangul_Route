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

## Library batch 2: records-joseon (PR 2.10a)

Settings and props for `sillok-royal-historians`, `sillok-mountain-archives`, `seungjeongwon-ilgi-every-day`, `ilseongnok-daily-reflection`, `uigwe-royal-birthday` and `joseon-records-today`, and the `art` of their 45 scenes: 48 items, 6 settings and 42 props. With batch 1 the registry holds 9 settings, 55 props and the 5 Hoya poses, 108.7 KB raw / 25.7 KB gzip serialised (budget 200 / 55).

| Group | Ids |
|---|---|
| Settings | `scene:hanji-backdrop` (close-ups, horizon 152), `scene:hanok-room`, `scene:countryside` (two colours, to leave palette room), `scene:mountains`, `scene:mountain-stream`, `scene:modern-room` |
| People | `prop:fig-officials-kneeling` (seen from behind), `prop:fig-king-seated`, `prop:fig-writer-seated`, `prop:fig-artisan`, `prop:fig-dancer`, `prop:fig-modern`, `prop:fig-worker`, `prop:fig-researcher` |
| Books and records | `prop:books-stack`, `prop:book-bundle`, `prop:book-chest-open`, `prop:books-airing`, `prop:book-open-entry`, `prop:uigwe-open`, `prop:book-geojunggi`, `prop:banchado-strip`, `prop:paper-stack`, `prop:papers-loose`, `prop:sheet-cursive`, `prop:print-sheet`, `prop:type-tray` |
| Nature, buildings | `prop:horse`, `prop:pine-tree`, `prop:flat-rock`, `prop:sago-archive` (door tintable), `prop:fortress-gate`, `prop:fortress-wall`, `prop:night-window` |
| Objects, ceremony | `prop:oil-lamp`, `prop:tablet`, `prop:weather-signs`, `prop:signpost`, `prop:archive-shelf`, `prop:craft-wood`, `prop:craft-embroidery`, `prop:craft-painting`, `prop:palanquin` (the 1795 gagyo), `prop:procession-row`, `prop:feast-table`, `prop:bead-curtain`, `prop:silk-bolts`, `prop:ceremony-goods` |

- Heritage artefacts and buildings carry a `sourceRef` to the page that shows them (Encyclopedia of Korean Culture, National Archives, National Heritage Portal, Annals DB); every item has an `accuracyNote` saying what is simplified. `checkItem` rule `I-heritage` holds heritage objects and buildings (§3.9.10) to both. Every figure in historical dress has a `sourceRef` and says `Joseon` in its `alt`; people of today say `of today` (a registry test checks both).
- Palette headroom drove several choices: the countryside is two tokens, the palanquin roof is drawn near black, the procession wears the attendants' yellow, the dancer's hair is dark brown.
- Deviations from the briefs (all in the PR): no close-up hands; the king shown front-on; the 1404 fall not drawn (advisory scene, setting and objects only, §3.9.5 R-S10); fewer people than the narration counts (the narration keeps the numbers); one palanquin (the source supports Lady Hyegyeong's); no ox cart (the sources do not say how the Annals were carried); Lady Hyegyeong behind a curtain (as the 1795 feast picture shows); the four books share one cover colour; `ilseongnok-daily-reflection` s3 (a split scene in the brief) is split by the room's centre post, the king in one bay and Hoya apart in the other, so Hoya stays beside the moment, not in it (F-STORY-002 §3.9.10).

## Library batch 3: hangul-printing (PR 2.10b)

Settings and props for `sejong-new-letters`, `shapes-of-hangeul`, `hangeul-day`, `jikji-metal-type`, `tripitaka-koreana` and `janggyeong-panjeon`, and the `art` of their 46 scenes: 27 items, 1 setting and 26 props. The registry now holds 10 settings, 81 props and the 5 Hoya poses, 144.8 KB raw / 34.4 KB gzip serialised (budget 200 / 55).

| Group | Ids |
|---|---|
| Setting | `scene:temple` (a mountain temple, horizon 196) |
| People | `prop:fig-monk`, `prop:fig-monk-seated` (Goryeo: dark robe, red gasa; nuns alike), `prop:fig-carver` (Goryeo white ramie robe, black head cloth) |
| Books and printing | `prop:book-open` (the Haerye book), `prop:woodblock`, `prop:woodblock-shelves` |
| Letter diagrams | `prop:speech-g`, `prop:speech-nm`, `prop:organ-stones`, `prop:ribbon-trails`, `prop:stick-dot`, `prop:stroke-sparks` |
| Buildings | `prop:janggyeong-hall`, `prop:panjeon-plan`, `prop:hall-section`, `prop:temple-site`, `prop:museum-building` |
| Sky, nature, objects | `prop:glow-burst`, `prop:full-moon`, `prop:night-sky`, `prop:leafy-tree` (crown tintable: blossom, summer, autumn), `prop:breeze`, `prop:museum-case`, `prop:calendar-page`, `prop:blank-sheet`, `prop:blank-tiles` (14 + 10) |

- Every heritage artefact and building carries a `sourceRef` to a page that was opened for this batch (Encyclopedia of Korean Culture, National Heritage Portal) and an `accuracyNote`. Figures in Goryeo dress say `Goryeo` in `alt`; the registry test now accepts Joseon, Goryeo or hanbok as the period label.
- The letter diagrams draw the speech organs the Haerye names (encykorea, 28 jamo) and never a glyph: the app shows the letters. The ribbon trails are the one place a letter-like shape is drawn (one, two and three strokes for n, d, t), as shapes with alt text (§3.9.5 rule 7).
- Accuracy choices: Goryeo monks wear the black jangsam and red gasa the entry gives for Goryeo, not the later grey; the carvers are not monks, because the source does not say who they were; no pagoda at Heungdeoksa (no pagoda site was found); the woodblock shows one of its two carved faces; the windows of the hall differ in size, but which row is larger on which wall is not given, so only the difference is drawn; the floor layers name materials, not an order.
- Deviations from the briefs (all in the PR): no close-up hands (the carver figure and the type frame carry the action); no inset in `tripitaka-koreana` s1; no fans, streamers or flag in `hangeul-day` s1 and no rope in s5; Hoya stands for bowing in `hangeul-day` s7; no globe in `jikji-metal-type` s7 and no arched windows in s6; a room of today instead of a street in `sejong-new-letters` s7; no mouse and beetle in `janggyeong-panjeon` s6; `sejong-new-letters` s5 drops the brush to keep the scene palette at 8.
