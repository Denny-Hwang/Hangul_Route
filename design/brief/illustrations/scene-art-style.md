# Scene art: style guide for story pictures

**How a story picture is composed.** The rules of F-STORY-002 §3.9.5 and §3.9.10 in plain words, for whoever authors or reviews a scene.

Spec: `docs/specs/F-STORY-002-story-reader.md` §3.9 (the source of truth: §3.9.5 composition rules, §3.9.7 budgets, §3.9.8 authoring pipeline, §3.9.10 accuracy) · component: `design/brief/components/story-scene.md`, `design/components/StoryScene/spec.md` (library batches listed there) · code: `packages/design-system/src/scene-art/` (`rules.ts` runs every rule below as `checkItem` / `checkScene`) · review surface: `/design-preview/scenes` and `/design-preview/scenes/library`

---

## 1. What a scene is

A scene is data, not a drawing file: a background **setting** (`scene:<id>`) plus up to **8 layers**, each a registry item (`prop:<id>`, `hoya:<pose>`, or `card:<id>` in the app only) placed by its anchor (bottom-centre) at `x, y` on a **400 x 300** canvas, with an optional scale (0.2 to 3), mirror, depth band and one tint. Every scene also has `altEn`, one sentence for screen readers.

The audience is anyone learning Hangul, at any age. The pictures are calm, flat and geometric, in the family of the heritage card art (`heritage-card-art.md`): friendly, never babyish, never a sticker sheet.

## 2. Items (props, figures, settings)

| Rule | In plain words |
|---|---|
| Shapes | Eight kinds only: rectangle, circle, ellipse, line, path (absolute commands, at most 240 characters), polygon (3 to 16 points), and one level of group. No text, image, gradient, pattern, clip, mask, filter, `use`, animation or event. Round caps and joins. Coordinates in steps of 0.5. |
| Size | A prop has at most **40 shapes** and **3 KB**; a setting at most **60 shapes** and **6 KB**. Every shape stays inside the item's box. Detail shapes are at most half of an item. |
| Colour | Token paths only (`theme.rites`, `surface.paper`). At most **5 colours** per prop, **6** per setting. Never `feedback.danger`, `surface.overlay` or `surface.inkScrim` (the types forbid them). `brand.primary`, the dancheong vermilion and the only red, on at most 15 % of an item's shapes. |
| Outline | `borderWidth` steps only: `thin` 1, `base` 2, `thick` 3 canvas units. |
| Faces | A face (Hoya, an animal) smiles or is calm: no frown, no teeth. |
| People | Faceless by design: a blank `surface.paper` oval with a `border.strong` outline. Hair, hats and clothing carry identity. No historical figure gets an invented likeness, and no skin token encodes ethnicity. |
| Reuse | Reuse before inventing: one "hanbok child" figure with a tintable garment, not six figures. |
| Heritage artefacts | A real object or building (rain gauge, sundial, water clock, woodblocks, metal type, the Annals, uigwe, Hunminjeongeum, printing houses, archives) carries a `sourceRef` (a museum or heritage-portal page showing it) and an `accuracyNote` (what is simplified). No invented inscriptions, seals or ranks. |
| Costume and architecture | Period-labelled in the item's alt (`Joseon official's black hat`); the culture reviewer checks them on the library page. |

Hoya is a character, not a prop: his five poses keep the fixed palette of `Hoya.tsx` (7 to 9 tokens) and are exempt from the colour cap. Every other rule applies to him.

## 3. Scenes

1. **Canvas and bands**: anchors inside 0-400 x 0-300; an item may overhang the edge by at most 20 units (a figure entering the frame). Draw order `back`, `mid`, `front`.
2. **Horizon**: the setting declares a horizon; upright items stand with their feet at or below it (sky items and symbols excepted).
3. **One focal point**: exactly one focus, the largest `mid` item or Hoya, inside the central third or on a third line. Two layers overlap at most 60 % of the smaller one unless one is `back`.
4. **Hoya**: at most one per scene, scale 0.5 to 1.1, in the lower 60 % of the canvas, never covering the focal artefact. A peek from behind a front prop is fine. Hoya is a guide, not a participant: a brief that puts him inside a historical event is drawn with him beside it.
5. **Palette**: at most **8 colours** per scene, not counting Hoya's own palette (a colour a tint brings onto him does count). At least 2 from `surface.*` / `text.*`, so the picture reads on `surface.canvas`; the focal item's main fill differs from the ground.
6. **Thumb legibility**: the focal item is at least a quarter of the canvas height and still has at least 3 shapes after the thumb variant drops details.
7. **No text in the image**: writing and books are stroke rows (`prop:writing-lines`) and blank pages. A letter shape appears only as drawn geometry inside a prop (path shapes, with alt text), never as a font glyph.
8. **Budgets**: at most 8 layers; at most 160 resolved shapes (80 in the thumb variant); the scene description at most 700 bytes.
9. **Alt text**: one sentence, at most 140 characters, saying what is shown and what it means; never "Image of", never Hangul.
10. **No violence or fear**: no weapon pointed at a figure, no fire consuming anything, no frightened face. A scene whose narration carries a grown-up advisory (war, loss, mild peril) shows the setting and objects, not the event.

## 4. When the kit cannot draw the brief

Each scene keeps its `artBrief` sentence as provenance. If the brief asks for something the kit cannot draw (a close-up of hands, a crowd of twelve), draw what carries the meaning (a brush, an inkstone and sheets; four figures) and list the deviation in the art PR. If the simplification would change a fact (the number of historians), the narration says the number, never the picture.

A scene may ship with `artPending: true`: the reader shows the tinted fallback with the narration, so a story is never blocked by a missing picture, and the shelf integrity test lists pending scenes.

## 5. Review checklist (printed on the contact sheet, pasted into every art PR)

- Brief represented (deviations listed)
- Accuracy of artefacts and costume against `sourceRef`
- Palette and bands
- One focal point
- Readable at 96 px
- Smiles and faceless rule
- No text, emoji or raster
- Alt text useful
- No violence
- Budgets pass (`checkItem` / `checkScene`, `budget.test.ts`)

The reviewer is the owner or the culture reviewer; a story's sign-off is `review.culture` in its file (F-STORY-001 §3.6).

## 6. Prompt: compose one scene with Claude Code

```prompt
Compose the `art` for scene <sceneId> of content/stories/<slug>.json for Hangul Route
(F-STORY-002 §3.9.8). Brief: <the scene's artBrief>.

Follow design/brief/illustrations/scene-art-style.md exactly: pick one setting from
packages/design-system/src/scene-art/registry.ts, list at most 8 layers back to front,
anchor items with feet on or below the setting's horizon, one focal point in the central
third, Hoya at most once (beside any historical event, scale 0.5-1.1, lower 60 %), at
most 8 colours not counting Hoya's palette, no text in the picture. Write altEn as one
sentence (<= 140 characters, no Hangul, not "Image of"). If an item is missing, add it to
the right props/*.ts file within its budget (<= 40 shapes, <= 5 colours, token paths only,
sourceRef + accuracyNote for a heritage artefact). Run
`corepack pnpm --filter @hangul-route/design-system test`, open /design-preview/scenes,
and list every deviation from the brief in the PR.
```
