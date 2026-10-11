Status: ready

# F-VOC-002 — WordArt: hand-authored SVG word pictures from data, with design tokens only

**Scope**: `packages/design-system` (`src/word-art/` pure data, builders, resolver and tests; `components/WordArt/` thin renderer; 12 new `colors.vocab.*` tokens; a pure `card-ids.ts` extraction) · `design/tokens/colors.v1.md` · `design/brief/illustrations/word-art.md` (new brief) · `apps/web` (`/design-preview/word-art` contact sheet) · `apps/mobile` (`screens/minigames/PictureArt.tsx` binding, shared with F-QUEST-002)
**Owner**: solo dev
**Rollout**: after F-VOC-001's schema (needs the key list); art lands in four topic batches (§6). Nothing is user-visible until F-VOC-003 flips `flags.vocabTopicsEnabled`.
**Wireframes**: none of its own (the art is the content of the screens in `wireframes/vocab-topics.md`, `vocab-flashcards.md`, `vocab-speed-round.md`); the contact sheet is a design-preview page, not a learner screen.

Parent / siblings: F-VOC-001 (items, `visual` refs, counts) · F-QUEST-002 §3.1 and §3.11 (`PictureRefSchema`, `PictureArt`) · F-CARD-001 and `design/brief/illustrations/heritage-card-art.md` §3 (the illustration language this system reuses) · F-PREV-001 / F-VR-001 (design-preview surface) · F-VR-003 (screenshot diff) · F-DES-001 (token drift) · F-HOYA-001 · F-I18N-001 §3.5.4 (the picture is the primary meaning carrier for pre-readers) · design input `design-inputs/topic-speed-quiz.md` §2

---

## Decisions

Binding owner decisions this spec implements: **D1** (any age: the art is friendly and geometric, never "baby" and never "for kids") · **D4** (the key list is derived from the validated vocabulary JSON) · **D7** (hand-authored SVG, design tokens only, no emoji, no raster, no external assets) · **D8** (spec id).

| # | Decision | Why |
|---|---|---|
| W1 | **A glyph is plain data**: an ordered list of shapes on a `0 0 100 100` viewBox, every colour a **token path string** (`'vocab.red'`, `'text.primary'`), never a hex. One resolver turns tones into values at render time. | CLAUDE.md §4 (no colour literals); the data is testable in node, which `components/**` is not (`packages/design-system/vitest.config.ts:13` excludes it from coverage); the web contact sheet and the app render the **same** data. This is the `Icon` glyph pattern (`components/Icon/glyphs.ts:12-33`) extended to colour. |
| W2 | **Glyphs are written with builder functions** (`circle`, `blob`, `curve`, `leaf`, ...), not raw path strings; the builders are pure and return plain shapes. | A prototype built while writing this spec measured about 600 bytes of builder source per glyph against about 900 bytes of expanded data, so the bundle carries the compact form and the data is expanded once at load. |
| W3 | **One new token group, `colors.vocab`** (12 content colours), separate from `feedback.*`. `feedback.danger` stays reserved for adult destructive actions (`tokens.ts:58`); `vocab.red` is a *content red*, never used for feedback, with an import guard (§3.4). | The Colors topic needs red, black and the others that no token has; they must not be mistaken for failure colours (anti-shame, CLAUDE.md §1). |
| W4 | **Colour is never the only cue.** Every colour swatch carries an object, every picture option has an accessible name, and the `colors.vocab` palette is designed with a colour-blindness check (§3.4). | Roughly 1 in 12 men cannot tell some of these pairs apart; the prototype's own simulation puts red/brown at a distance of 2.4 under protanopia. |
| W5 | **Reuse HeritageCardArt where it fits** — 13 launch words use `card:*` art (F-VOC-001 §3.4); the rule and its exit are in §3.11. | 13 fewer drawings; the card art is already reviewed; no copy. |
| W6 | **No text inside art**: no Hangul, no Latin letters, no digits (counting is dots), no emoji. | A letter in a picture can give away or contradict the word and breaks the romanization checks; digits break the "no numbers" rule for pre-readers. |
| W7 | **Budget**: all WordArt source (`src/word-art/**`, tests excluded) is at most **120 KB raw and 30 KB gzipped**, enforced by a test. | The JS bundle is about 2.0 MB raw today (`apps/mobile/dist` index bundle, 1,987,079 bytes per the design input); extrapolating the prototype gives about 80 KB raw and 20 KB gzipped, so the budget leaves 50 % headroom. |
| W8 | **Silhouette mode is part of the contract** (`mono` tone): the same data drawn in one tone, used for "not collected yet" tiles and as a contrast check in review. | The word wall (F-VOC-003) shows a soft silhouette for words not yet met; no second asset. |

---

## 1. Context

- **There is no raster art and no audio in the repo.** The only graphics are code-drawn SVG: 30 Heritage card arts (`packages/design-system/src/components/HeritageCardArt/HeritageCardArt.tsx`, 200 x 200 viewBox, a faint theme-tinted background rectangle from the `Frame` helper at 8 % opacity `:65-73`, dispatcher `:1220-1266`), Hoya (`components/Hoya/Hoya.tsx`, drawn as RN `<Circle>`/`<Ellipse>` JSX `:281-308`, i.e. **code, not data**), and one-colour icons (`components/Icon/glyphs.ts:12-33`, data, 24 x 24, single colour by design, `design/brief/components/icon-set.md:46`). Emoji are forbidden in rendered output (`docs/launch/gallery-spec.md:161`, `design/launch/02-ph-gallery-5-slides.md:370`).
- **The card art is JSX, not data.** It can be rendered but not inspected, tinted per tone, put in silhouette, size-checked or contact-sheeted by a test; each card also draws its own faint theme-tinted background (`Frame`, `:65-73`) that the caller cannot remove, and it draws a generic fallback for an unknown id (`:1205-1213`), so "is this id drawn?" must be asked of `supportedCardIds` (`:21-56`), which today lives in a file that imports `react-native-svg` and so cannot be imported in a node test.
- **Colours the Colors topic needs do not exist**: `tokens.ts:21-103` has brand, surface, text, feedback (danger reserved `:58`), stage, theme, hoya, rarity and border groups; no red that is not a failure colour, no black, no pink, no brown, no purple. Adding a colour needs both `tokens.ts` and `design/tokens/colors.v1.md`: `tokens-parity.test.ts:8-48` fails on any key present in one and not the other.
- **Web preview shows card art by re-drawing it**: `apps/web/src/app/design-preview/cards/page.tsx` "mirrors apps/mobile shapes via inline web SVG" (its header comment). A data glyph needs no second drawing; both surfaces call one string renderer (§3.7).
- **Design input recommendation** (`topic-speed-quiz.md` §2): a four-tier plan (reuse card art; WordArt data; generated visuals; emoji as a dev placeholder). This spec adopts tiers 1-3 and drops tier 4 (D7). The input estimated 8-12 minutes per glyph and "about 110 new glyphs"; F-VOC-001's final lists need **95 hand-authored + 4 helper props** (fewer, because the Colors, Numbers and Body topics are generated and 13 words reuse card art).
- **Prototype evidence** (a throwaway prototype, not in the repo, built and rendered while writing this spec so the numbers below are measured, not guessed): 25 hand-authored glyphs (food, animals, school, travel, sports, nature, hanbok) and 19 generated ones (colour swatches, counts, body parts) were written with the builders of §3.2 and rendered on a contact sheet at 160, 96, 64, 48 and 32 px plus a silhouette. Results: hand glyphs average **914 bytes** as expanded JSON, **about 600 bytes** of builder source each, 15 KB of source gzipping to 3.5 KB; builders, resolver and renderer 13 KB, 4.7 KB gzipped with the three generators; generated glyphs 1.1-3.9 KB each. All 25 read clearly at 48 px; the faces smile; the silhouette reads for animals and vehicles and is weakest for thin objects (pencil, banana).

**What this spec does.** (1) The glyph data model, the tone vocabulary and the 12 colour tokens. (2) The primitive set and composition rules. (3) The three generated families (colour swatches with an object cue, counts, body parts) and the people builder for Family. (4) The renderer, accessibility and silhouette mode. (5) The registry, the key list and its tests. (6) The contact-sheet review surface. (7) The process for authoring 99 hand glyphs, with a one-line brief per glyph.

Terms. **Glyph**: the data for one picture. **Tone**: a colour named by token path. **Key**: the part of a `word:<key>` ref after `word:`. **Prop**: a helper glyph used inside another (the colour objects), never a vocabulary picture.

## 2. User story

> As someone who cannot read Hangul yet — a young child, or an adult on day one — I want each word to come with a clear, friendly picture, so that I learn the meaning from the picture and the sound together, without translating in my head.

Companion stories:

- As a **designer reviewer**, I want every picture on one contact sheet at five sizes, in colour and in silhouette, so that I can approve or reject a batch without installing the app.
- As a **colour-blind learner**, I want the Colors topic to teach me with objects and names as well as colours.
- As a **developer**, I want a missing or misspelled picture to fail a test, never to reach a learner as a blank tile.
- As an **author of the next topic**, I want a short, checkable recipe and a brief per word, so that a glyph takes minutes, not hours.

## 3. Acceptance criteria

### 3.1 Data model (`packages/design-system/src/word-art/types.ts`, pure TypeScript, no React)

```ts
export type WordArtTone = /* closed union of 'group.key' strings generated from `colors`, see §3.3 */ string;

export interface WordArtPaint { f?: WordArtTone; s?: WordArtTone; sw?: number; o?: number }   // fill, stroke, stroke width, opacity

export type WordArtShape =
  | ({ t: 'circle';  x: number; y: number; r: number } & WordArtPaint)
  | ({ t: 'ellipse'; x: number; y: number; rx: number; ry: number } & WordArtPaint)
  | ({ t: 'rect';    x: number; y: number; w: number; h: number; r?: number } & WordArtPaint)
  | ({ t: 'path';    d: string } & WordArtPaint);

export type WordArtGlyph = readonly WordArtShape[];                 // painted in order, viewBox 0 0 100 100

export type WordArtStatus = 'draft' | 'review' | 'approved';     // §3.10 contact-sheet state; the owner marks 'approved'
export interface WordArtMeta {
  family: WordArtFamily; status: WordArtStatus;
  maxTones?: number;      // allowlist above 4 fill tones (§3.3); needs `reason`
  bboxWaived?: boolean;   // C2 waiver; needs `reason`
  reason?: string;        // why a waiver is granted (a test requires it with either waiver)
  reserved?: boolean;     // key exists for v1.1, unused at launch
}
export type WordArtFamily = 'food'|'animal'|'family'|'school'|'nature'|'travel'|'sport'|'culture'|'science'|'color'|'count'|'body'|'prop';
```

- Short field names (`f`, `s`, `sw`, `o`) are deliberate (W2): the data is expanded in memory, never shipped as JSON, so size is the builders' source size.
- **Path grammar** (`word-art/path.ts`: `parsePath`, `isWordArtPath`, `formatNumber`, shared by the `path()` builder, the renderer and the tests): absolute commands `M L H V C Q A Z` only, numbers with at most one decimal, no relative commands, no `S`/`T`. (A pure `placePath` can then translate and scale any glyph, which composed glyphs use, §3.6; a test parses every path against this grammar.)
- **Stroke and corners**: strokes use round caps and joins (the renderer sets them; the data cannot override); the data carries `sw` only.
- **Opacity** `o` is 0.1-1; opacity is for shadows and highlights only (a 0.18 ground shadow, a 0.55 highlight), never to build a colour (no mixing by overlay).
- **No gradients, no filters, no clip paths, no masks, no text, no images, no `<use>`**: the shape union cannot express them (compile-time) and the test suite re-checks the data.

### 3.2 Primitives and builders (`word-art/builders.ts`, pure, 100 % covered)

Every builder returns a `WordArtShape` (or a list) and rounds coordinates to one decimal.

| Builder | Signature (paint last) | Used for |
|---|---|---|
| `circle(x, y, r, paint)` · `ellipse(x, y, rx, ry, paint)` · `rect(x, y, w, h, r, paint)` | | bodies, heads, eyes, plates, frames |
| `path(d, paint)` | | the escape hatch for hand-written curves; must obey §3.1 grammar |
| `poly(points, paint, round?)` | polygon with quadratic corner rounding | ears, roofs, wings, buses |
| `blob(points, paint)` | smooth closed Catmull-Rom curve through points | fruit, bread, clouds, bodies |
| `curve(points, paint)` | smooth open curve | smiles, stems, whiskers, noodles |
| `leaf(x1, y1, x2, y2, halfWidth, paint)` | pointed oval | leaves, petals, wings |
| `arc(cx, cy, r, a0, a1, paint)` | open circular arc | smiles, waves, rainbows |
| `line(x1, y1, x2, y2, paint)` | | whiskers, rays, legs |
| `drop(cx, top, bottom, width, paint)` | water drop | water, rain, milk |
| `star(cx, cy, outerR, innerR, points, paint, round?)` | | stars, sparkles, splats |
| `groundShadow(cx?, y?, rx?)` | flat ellipse, `hoya.furDark` at opacity 0.18 | standing objects only |
| `face(x, y, scale, options)` | two eyes, a smile, optional cheeks; **always a smile** | every animal and figure with a face |

`face()` exists so "every face smiles" (heritage-card-art.md §3) is a property of the builder, not of review: it has no frown or neutral option (a test asserts the mouth is a downward-curved arc, i.e. a smile).

### 3.3 Tones and colours

**Tone vocabulary.** `WordArtTone` is the union of `'<group>.<key>'` for every key of `colors` (`tokens.ts:21-103`) in the groups **brand, surface (canvas, paper, sunken), text, feedback (success, `successDark`, nudge, info and their Light variants), theme, stage, hoya, border, vocab** (the list is generated from `colors` minus the exclusions, so a token added later joins it) — and **not** `feedback.danger`, `feedback.dangerLight`, `surface.overlay`, `surface.inkScrim`, or any `rarity.*` (rarity colours carry card-rarity meaning). `word-art/tones.ts` exports:

```ts
export const WORD_ART_TONES: readonly WordArtTone[]            // generated from `colors` at module load, minus the exclusions
export function resolveTone(tone: WordArtTone): string          // the hex/rgba from tokens.ts; throws on an unknown tone (a test, never a runtime path)
export function isWordArtTone(s: string): s is WordArtTone
```

A glyph fails the tone test when any `f` or `s` is not in `WORD_ART_TONES`.

**Outline rule.** The default outline is `text.primary` at `sw` 3 (main outline) or 2 (detail). It is *not* counted as a tone. A small detail **filled** with `text.primary` (the eyes `face()` draws, pupils, wheels, a nose) is part of the same ink and is not counted either; otherwise every face would cost a tone.

**Tone budget.** At most **4 fill tones** per glyph (plus the outline ink and the optional ground shadow; only the shadow tone `hoya.furDark` below opacity 0.5 is exempt as the shadow, and a faint fill in any other tone still counts), per heritage-card-art.md §3 ("3-5 colours"). The registry may allowlist a higher number per key with `maxTones` and a reason (the rainbow needs 6; a swatch with a sticker needs 5).

### 3.4 The twelve `colors.vocab.*` tokens (`tokens.ts`, `design/tokens/colors.v1.md`)

New group `vocab`, added to `tokens.ts` between `rarity` and `border` and documented in `colors.v1.md` in the same PR (`tokens-parity.test.ts:8-48` enforces both). **Candidate values from the prototype** (final values are a design review decision; the rule below is what must hold):

| Token | Candidate | Token | Candidate |
|---|---|---|---|
| `vocab.red` | `#D83A34` | `vocab.skyBlue` | `#8FD0F5` |
| `vocab.orange` | `#F28C28` | `vocab.brown` | `#8B5A2B` |
| `vocab.yellow` | `#F6D32D` | `vocab.gray` | `#9E9E9E` |
| `vocab.green` | `#3FA34D` | `vocab.white` | `#FFFFFF` |
| `vocab.blue` | `#2F6BD0` | `vocab.black` | `#1F1A17` |
| `vocab.purple` | `#8E44AD` | `vocab.pink` | `#F58FB5` |

**What the review checks** (measured on the candidates, CIE Lab with a CIEDE2000 distance, colour-vision simulation by the Machado matrices, severity 1.0):

- **Normal vision**: the closest pair is skyBlue/gray at 21.1 (distinct).
- **Protanopia**: red/brown 2.4 and orange/green 5.8 collapse; **deuteranopia**: blue/purple 5.0, pink/gray 6.8, red/green 6.3; **tritanopia**: orange/pink 7.6. So **colour alone cannot carry the Colors topic** (W4): every swatch is paired with an object (§3.6.1), and the quiz never offers two swatches whose colours collapse under one of these simulations *as the only difference* — F-VOC-004's distractor policy reads `COLOR_CONFUSION_PAIRS` (below) and never puts such a pair in one question.
- **Non-text contrast**: `yellow`, `skyBlue`, `white`, `pink`, `orange`, `gray` are below 3:1 against `surface.canvas` (1.4, 1.6, 1.1, 2.1, 2.3, 2.5). Every swatch is therefore drawn with the 3-pixel `text.primary` outline (15.2:1 on canvas, recomputed in review), which carries the shape boundary; fills are never relied on for the edge.
- **Not alarm-red**: `vocab.red` is **close to** `feedback.danger` (`#C84B3D`): CIEDE2000 distance 3.4 (recomputed in review), a just-noticeable difference, not a clear one. So the *hue* does not keep the two apart; the guard test does: it forbids any file outside `src/word-art/` and `components/WordArt/` from reading `colors.vocab` or `'vocab.'` tones (a source scan test, like F-CNT-002's coverage check), so a content red can never become a feedback colour. The design review may move `vocab.red` further from `danger` (for example towards `#E0463C`) without a spec change.

```ts
export const COLOR_CONFUSION_PAIRS: readonly (readonly [string, string])[] = [
  ['vocab:ppalgansaek','vocab:galsaek'], ['vocab:juhwangsaek','vocab:choroksaek'], ['vocab:paransaek','vocab:borasaek'],
  ['vocab:bunhongsaek','vocab:hoesaek'], ['vocab:ppalgansaek','vocab:choroksaek'], ['vocab:juhwangsaek','vocab:bunhongsaek'],
];   // item-id pairs; the test recomputes the list from the tokens with the Lab / Machado code and fails when the constant is stale
```

(The contrast and simulation helpers live in `word-art/color-science.ts` and are test-only utilities; the shipped constant is data in `word-art/color-confusion.ts`, exported from the `./word-art` entry so F-VOC-004's question builder can read it without importing React.)

### 3.5 Composition rules (every hand glyph; each is checked by a test or the review checklist, §3.11)

| # | Rule | Check |
|---|---|---|
| C1 | ViewBox `0 0 100 100`; shape coordinates within `-6..106` (strokes may touch the edge); nothing is clipped | test: coordinates, path parse |
| C2 | The subject's bounding box covers **60-70 %** of the width or height, centred (heritage-card-art.md §3) | test: bbox from shapes (paths use their control points, an upper bound), tolerance +-10 %, per-key waiver with a reason |
| C3 | Rounded geometric primitives; outline 3 for the main silhouette, 2 for details; **no outline thinner than 2** | test: `sw` in {2, 3} (generated families may use 1.5 for dots) |
| C4 | At most 4 fill tones (§3.3) | test |
| C5 | A face always smiles; use `face()` | test (builder) + review |
| C6 | A standing object has a `groundShadow` | review |
| C7 | A shape count of at most **32** (hand glyphs) / **48** (generated) | test |
| C8 | Distinct: no two keys have identical data | test (like `glyphs.test.ts`'s "glyphs differ") |
| C9 | **Readable at 48 px and in silhouette**: the contact sheet shows both; the reviewer rejects a glyph that is only identifiable by colour or by a detail thinner than 3 px at 100 | review |
| C10 | No Hangul, Latin letter, digit or emoji drawn (W6); signs, boards and covers use marks, not characters | review + a source scan of `word-art/**` for `[가-힣A-Za-z]` outside identifiers is *not* feasible; the review checklist owns it |
| C11 | A culturally specific subject follows the brief for that key (§3.12) and the card art's style (`heritage-card-art.md` §4) | review, owner sign-off |
| C12 | People are **neutral geometric figures**: no skin-tone fills (faces use `surface.paper` with outline), hair and clothing carry the cues, no real-person likeness, no stereotyped costume beyond the brief | review |

### 3.6 Generated families

All are pure functions in `word-art/generated/*.ts`, return a `WordArtGlyph`, and register under their keys.

**3.6.1 Colour swatches with an object cue** — `word:color-red` ... `word:color-black` (12). `swatch(colorKey, objectGlyph)`: a rounded square (`rect`, radius 14, fill `vocab.<colour>`, outline `text.primary` 3) filling the viewBox with margin 6, plus the **object** drawn as a sticker (the object's own glyph scaled to 55 % and translated to the lower right, with a `surface.paper` halo made by drawing each shape again behind with a wide paper stroke). Objects (source: existing glyphs or props):

| Colour | Object (key) | Colour | Object (key) |
|---|---|---|---|
| red | apple (`word:food-apple`) | skyBlue | cloud (`word:nature-cloud`) |
| orange | tangerine (`word:prop-tangerine`) | brown | bear (`word:animal-bear`) |
| yellow | banana (`word:food-banana`) | gray | elephant (`word:animal-elephant`) |
| green | leaf (`word:prop-leaf`) | white | milk (`word:food-milk`) |
| blue | water drop (`word:food-water`) | black | crow (`word:prop-crow`) |
| purple | grapes (`word:prop-grapes`) | pink | flower (`word:nature-flower`) |

(The prototype generated `red+apple`, `yellow+banana`, `white+milk` and `brown+bear`: 1.3-2.6 KB each; the swatch reads at 48 px.) An object must be **recognisable without its own colour** (it has an outline and a shape), because under the confusion pairs of §3.4 the object, not the fill, tells apart red from brown.

**3.6.2 Counts** — `word:count-0, 1..10, 20` (12). `count(n)`: a **ten-frame** (a 2 x 5 grid of cells, `rect` cells with a `border.strong` outline) with `n` filled dots (`circle`, first five `brand.primary`, next five `brand.secondary`, the convention of ten-frames); 20 draws two frames; 0 draws one empty frame. No numerals (W6). Dot positions fill left to right, top row first, so `7` is five and two. 1.1-3.9 KB measured (`count(20)` is 42 shapes, hence the 48-shape limit).

**3.6.3 Body parts** — `word:body-eye, nose, mouth, ear, head, face, hand, arm, leg, foot, belly, tooth` (12). `bodyPart(part)`: a friendly **neutral figure** (a round head, simple torso and limbs in `hoya.fur` and `surface.paper`, smiling, **not** the Hoya component, which is JSX) plus a highlight ring (`ring(cx, cy, r)`: a `brand.secondary` stroked circle with a paper halo) at a fixed anchor: head/face views (eye, nose, mouth, ear, tooth, face) zoom on the head, whole-body views (head, hand, arm, leg, foot, belly) show the full figure. Anchors are data (`BODY_ANCHORS`), tested for being inside the viewBox. 1.1-1.7 KB each measured.

**3.6.4 People (Family)** — `figure(options)`: `{ height, hair: 'long'|'short'|'bun'|'none'|'grey', clothes: WordArtTone, accessory?: 'glasses'|'cane'|'blanket' }`, returning shapes for a neutral standing figure (C12). The 12 Family glyphs are compositions of one or more figures; **sibling words** show the speaker (smaller, with a `marker`: a small `brand.secondary` dot above the head) next to the older sibling; hair length distinguishes the speaker's side (long vs short), a convention noted on the card back (F-VOC-001 §3.6). The four sibling glyphs differ by figure pair, which the distinctness test (C8) checks.

### 3.7 Renderer, accessibility and modes

**Pure render list** (`word-art/render.ts`, 100 % covered): `toRenderList(glyph, { mono?: WordArtTone }): RenderShape[]` resolves every tone to a value and fills the defaults (`strokeWidth`, `linecap: 'round'`, `linejoin: 'round'`, `opacity`); `mono` paints every fill **and** stroke in that one tone (silhouette, W8) and drops `o` below 0.5 (so a highlight does not vanish). `glyphToSvgString(glyph, { size, mono? }): string` builds a standalone `<svg viewBox="0 0 100 100" ...>` string for the web preview, tests and golden files.

**React Native component** `components/WordArt/WordArt.tsx` (+ `types.ts`, `index.ts`, exported from `src/index.ts`; excluded from coverage like every component, so it only maps `toRenderList` output onto `react-native-svg` `<Svg>`, `<Circle>`, `<Ellipse>`, `<Rect>`, `<Path>`):

```ts
export interface WordArtProps {
  artKey: string;                 // the part after 'word:'
  size: number;
  mono?: boolean;                 // silhouette in border.strong
  accessibilityLabel?: string;    // required unless decorative
  decorative?: boolean;           // hides from assistive tech (a flashcard whose Korean line already names it)
  testID?: string;
}
```

- **Unknown key** renders `null` and the caller (`PictureArt`) falls back to the text tile of F-QUEST-002 §3.11 (never a blank, never the generic card fallback); the key list test (§3.9) makes this unreachable for shipped data.
- **Accessibility.** The glyph is `role="image"` with `accessibilityLabel` = the item's localized gloss when it is the *only* carrier of meaning (a picture option in a question, F-QUEST-002 §3.14: "picture options excepted: their label is the gloss"); `decorative` when the same card already has a `KoreanText` line with the gloss (flashcard front and back). A colour swatch's label includes the object ("red, like an apple" is **not** used: the label is the gloss only, so it cannot leak the answer in a Korean-word-to-picture question; the *object* is visible to the sighted learner).
- **No motion in the art.** There are no animated parts; any pop-in or flip belongs to the caller and respects `useReducedMotion` (`platform/motion.ts:7-25`).
- **Sizes.** The art is requested at 48 (quiz option in a dense layout, tested minimum), 64, 96 (`touchTarget.hero`, `tokens.ts:198-202`), 160 (flashcard) and larger; it is vector, so no per-size assets.

**Web**: `apps/web/src/app/design-preview/word-art/page.tsx` renders `glyphToSvgString` (server component, no client JS), see §3.10.

### 3.8 Budget (W7) and measurement

- **Planned content** (F-VOC-001 §3.4 counts): 95 hand glyphs + 4 props = 99 hand glyphs; 36 generated (12 + 12 + 12); 13 card-art reuses (no new art).
- **Estimate** (from the prototype's per-item numbers): hand glyphs 99 x about 600 B = about 60 KB source; core, builders, resolver, renderer and the four generators about 20 KB; registry about 5 KB; total about **85 KB raw, about 20 KB gzipped**.
- **Test** `word-art/__tests__/budget.test.ts` sums the byte size of every file under `src/word-art/` excluding `__tests__`, and its gzip size (Node `zlib`), and fails above 120 KB raw / 30 KB gzip. The measured numbers go in each PR description. If the budget is ever approached, the glyph files can be split per topic and loaded lazily (Metro and Next both support dynamic `import()`), which needs no change to the data model.
- **Draw cost**: a glyph is at most 32 shapes (hand) or 48 (generated); `toRenderList` output is memoised per `(key, mono)`; a 12-tile topic grid draws 12 glyphs, a 4-option question 4.

### 3.9 Registry and key tests

`word-art/registry.ts`:

```ts
export const WORD_ART: Readonly<Record<string, { glyph: WordArtGlyph; meta: WordArtMeta }>>   // keys WITHOUT the 'word:' prefix
export const WORD_ART_KEYS: readonly string[]
export function getWordArt(key: string): WordArtGlyph | undefined
export function wordArtKeyOf(ref: string): string | null        // 'word:food-apple' -> 'food-apple'; null for 'card:*'
```

Key grammar: `^(food|animal|family|school|nature|travel|sport|culture|science|color|count|body|prop)-[a-z0-9-]+$`.

Files: `glyphs/{food,animal,family,school,nature,travel,sport,culture,science,prop}.ts` (hand glyphs, `Record<string, WordArtGlyph>` each), `generated/{color,count,body,figure}.ts`, `color-confusion.ts` (`COLOR_CONFUSION_PAIRS`, exported for F-VOC-004), `registry.ts` (merges them, builds the meta, throws at import on a duplicate or malformed key, on a key filed under another family's source — `buildRegistry` takes `[family, glyphs]` pairs — and on meta for a key with no glyph — a unit test imports it). The registry is deeply frozen, every shape included, so no caller can repaint the shared data. `color-science.ts` is test-only and is not exported from the entry.

`packages/design-system/package.json` `exports` gains `"./word-art": "./src/word-art/index.ts"` (a pure entry with **no** React or react-native import) so logic and tests in other packages can use the data without pulling `react-native-svg`.

`packages/design-system/src/components/HeritageCardArt/card-ids.ts` (new, pure) holds `supportedCardIds` (moved from `HeritageCardArt.tsx:21-56`; the component re-exports it, so `LibraryScreen.tsx:16` and every other consumer are unchanged).

**Cross-package key test** `word-art/__tests__/vocab-keys.test.ts` (reads `content/vocab/*.json` with `node:fs`):

- every item `visual` of the form `word:<key>` has `<key>` in `WORD_ART_KEYS`;
- every item `visual` of the form `card:<id>` is in `supportedCardIds`;
- every `WORD_ART_KEYS` entry of family other than `prop` is used by exactly one item, or is flagged `meta.reserved` — **checked per topic file that exists**: while a topic's JSON has not been merged (F-VOC-001 V-2b..V-6b), the glyphs of its families are checked for validity only (tones, grammar, bbox), so the system PRs W-1b/W-1c and the art batches may land before the data they will serve;
- every `prop` key is referenced by a colour generator;
- **while the art lags the data** (amended at W-1b: F-VOC-001 merged `food`, `animals`, `colors` and `numbers` before any batch, leaving 42 `word:` visuals without a glyph): the test keeps an `AWAITING_ART` map from each family to the PR that draws it (W-3 food, color, count; W-4 animal, body; W-5 family, school, nature; W-6 travel, sport, culture, science). For a served family it pins how many visuals are still missing, so a misspelled key in a topic file raises the count and fails at once; a family whose count reaches 0 must leave the map. A batch PR deletes its families from the map, which turns on the full first rule for them; a topic PR that serves a family in the map pins its count. Until the last batch, behaviour 1 holds for every family outside the map;
- the `COLOR_CONFUSION_PAIRS` constant matches the recomputed list (§3.4).

### 3.10 The contact-sheet review surface (`/design-preview/word-art`)

New server-rendered page `apps/web/src/app/design-preview/word-art/page.tsx` (F-PREV-001's pattern; linked from `/design-preview` (`apps/web/src/app/design-preview/page.tsx:105` shows how `/design-preview/cards` is linked):

- A card per key: the glyph at **160 px on `surface.canvas`**, a row at **96, 64, 48 and 32 px** on `surface.paper`, `surface.sunken` and `surface.canvas` backgrounds, and the **silhouette** (`mono: 'border.strong'`) at 64; under it the key, the shape count, and the byte size (`JSON.stringify(glyph).length`), plus the Korean word, its romanization and the English gloss read from the generated web catalog `apps/web/src/data/vocab-catalog.ts` (F-VOC-001 §3.7; **not** inline literals, so F-CNT-002's class C scan has nothing to register).
- Filters by family (`?topic=food`), a "rejected / needs work / approved" marker driven by `meta.status` in the registry (`'draft' | 'review' | 'approved'`), and a totals line: glyph count, raw bytes, gzip bytes, against the budget.
- A **colour-vision strip** per key (CSS filters are not allowed in art, but the preview page is not art): the same SVG under protanopia, deuteranopia and tritanopia simulations produced by SVG `feColorMatrix` filters **on the preview page only**, so a reviewer can see the Colors topic under the confusion pairs.
- Visual regression: the page is added to F-VR-003's screenshot list (`topic` pages at 1280 px) when that surface lists pages; until then the maintainer diffs it by hand like `/design-preview/cards` (F-VR-001).
- The page imports from `@hangul-route/design-system/word-art` only (no react-native); it is part of the static `out/` export, so it works on the Cloudflare Pages preview of every PR.

### 3.11 Reuse of HeritageCardArt, and its exit

**Rule.** A vocabulary word uses `card:<id>` when (a) the card's subject **is** the word, (b) it reads at 96 px and 64 px on the contact sheet (the faint tint background is part of the art, `HeritageCardArt.tsx:65-73`), and (c) the owner accepts it. The 13 launch reuses (F-VOC-001 §3.4):

| Word | `card:` ref | Word | `card:` ref |
|---|---|---|---|
| 밥 | `card:rice` | 달 | `card:moon` |
| 김치 | `card:kimchi` | 책 | `card:book` |
| 김밥 | `card:kimbap` | 한복 | `card:hanbok` |
| 호랑이 | `card:tiger` | 설날 | `card:seollal` |
| 산 | `card:mountain` | 추석 | `card:chuseok` |
| 바다 | `card:sea` | 윷놀이 | `card:yutnori` |
| | | 가야금 | `card:gayageum` |

**Mixing in one question.** Card art and WordArt look different (card art is a 200 x 200 scene with a faint tint behind it). `PictureArt` draws **both** inside the same neutral tile (`surface.paper`, `border.subtle`, same padding) and F-VOC-004's distractor policy prefers options of the same picture family as the answer, so a tint or style difference never identifies the answer.

**Exit.** If review on the contact sheet rejects a card art at 64 px (the F-QUEST-002 §9 assumption 4 about card art recognisability), the item's `visual` becomes a new `word:<family>-<name>` key and a glyph is authored for it: a data change in F-VOC-001's JSON plus one glyph; no schema change. The budget (W7) already has 50 % headroom for up to 13 such glyphs.

### 3.12 Authoring process for 99 glyphs

**Brief** `design/brief/illustrations/word-art.md` (new; written in PR W-1c, CLAUDE.md §5 "design in design/"): the style contract (§3.1-§3.5 in plain language), the **one deliberate deviation** from `heritage-card-art.md` §3 ("no red except dancheong orange"): content reds, blacks and pinks come from `colors.vocab` **only inside WordArt**, and the per-glyph briefs below.

**Per-glyph recipe** (the same for every key):
1. Sketch on a 100 x 100 grid: pick the subject's most recognisable silhouette (side view for animals' bodies, front view for faces, three-quarter for objects).
2. Write the glyph with builders in the family file; start with the silhouette `blob`/`poly` in the main tone, add at most three detail shapes, then the outline pass (`sw` 3) and details (`sw` 2), then `face()` and `groundShadow`.
3. Run `pnpm --filter @hangul-route/design-system test` (tone, grammar, bbox, count, distinct tests) and open `/design-preview/word-art?topic=<family>`.
4. Mark `status: 'review'` in the registry meta; the reviewer (the owner) marks `approved` or leaves comments in the PR.

**Batches** (one PR each; dependency order, §6): W-3 Food (9) + Colors (12 generated) + Numbers (12 generated) + the 4 props **+ the four glyphs the colour swatches draw from later families** (`animal-bear`, `animal-elephant`, `nature-cloud`, `nature-flower`, §3.6.1: they are authored here, counted in their own families and skipped in their later batch, because a swatch cannot be registered while its object is missing); W-4 Animals (the other 9) + Body (12 generated); W-5 Family (12) + School (11) + Nature (the other 7); W-6 Travel (12) + Sports (12) + K-Culture (7) + Science (12). (W-1 and W-2 are the system and the contact sheet, no vocabulary art.) The free-set topics Food, Animals, Colors and Numbers are therefore complete after W-4. **Effort**: the design input estimated 8-12 minutes per glyph; the prototype's glyphs were produced at about that pace. 99 glyphs is about 16-20 hours of authoring plus review time; the generated families add about 3 hours.

**Review checklist** (the owner, per batch, recorded in the PR): recognisable at 48 px; recognisable in silhouette; smiles; colours from tokens and no more than 4; matches the brief; culturally accurate (the K-Culture keys especially); no text or emoji; neutral people; tone fits next to the neighbouring words in the topic (so a 4-option question does not have one obviously "different" picture).

**Per-key briefs** (`<key>` is after `word:`; "ink" = `text.primary`; colours named by role; the brief says what, the author chooses coordinates):

| Family | Key: brief |
|---|---|
| food (9) | `food-apple`: red apple, leaf, highlight · `food-banana`: curved yellow banana, brown tips · `food-milk`: carton, blue band, drop · `food-bread`: golden loaf, three slashes · `food-ramyeon`: bowl, wavy noodles, steam, chopsticks · `food-water`: glass with a blue drop, highlight · `food-egg`: pale oval egg, highlight · `food-strawberry`: red heart-shaped berry, green cap, seed dots · `food-tteok`: three white rice-cake slices on a small plate |
| animal (11) | `animal-cat`: orange cat face, ears, whiskers · `animal-puppy`: tan puppy face, floppy ears, tongue out · `animal-rabbit`: white face, long ears with pink inside · `animal-bear`: brown bear face, round ears · `animal-bird`: small round bird on a branch, blue · `animal-fish`: blue fish, tail, fin, bubbles · `animal-duck`: yellow duck on blue wave · `animal-fox`: orange fox face, pointed ears, white cheeks · `animal-monkey`: brown monkey face, cream face patch · `animal-elephant`: gray face, trunk, ears · `animal-butterfly`: pink-purple wings, antennae |
| family (12) | `family-mom`: adult figure, long hair · `family-dad`: adult figure, short hair · `family-grandma`: adult figure, hair bun in gray · `family-grandpa`: adult figure, gray short hair, cane · `family-eonni`: older long-haired figure + smaller long-haired speaker (marker) · `family-nuna`: older long-haired figure + smaller short-haired speaker · `family-oppa`: older short-haired figure + smaller long-haired speaker · `family-hyeong`: older short-haired figure + smaller short-haired speaker · `family-dongsaeng`: larger figure + small figure (speaker is the larger) · `family-baby`: infant in a blanket · `family-family`: four figures in a row · `family-me`: one figure with a ring on the chest, hand pointing to it |
| school (11) | `school-school`: building, flag, door, clock-less · `school-teacher`: adult figure beside a board, pointer · `school-friend`: two figures holding hands · `school-pencil`: yellow pencil, pink eraser end · `school-bag`: backpack, pocket, straps · `school-notebook`: spiral notebook, plain cover · `school-eraser`: pink block eraser, wrapper band · `school-desk`: wooden desk, drawer · `school-chair`: chair (prototype) · `school-scissors`: scissors, two handles · `school-board`: green board, chalk marks as shapes, tray |
| nature (9) | `nature-sky`: sky-blue field, two clouds, no sun · `nature-sun`: yellow sun, rays, smile · `nature-star`: yellow star, smile, sparkles · `nature-tree`: green round crown, brown trunk · `nature-flower`: pink flower on a stem · `nature-rain`: gray-blue cloud, drops, small umbrella · `nature-snow`: snowflake and falling dots on pale blue · `nature-river`: blue winding stream, green banks · `nature-cloud`: cloud (prototype) |
| travel (12) | `travel-airplane` (prototype) · `travel-train`: train front, windows, headlight · `travel-bus` (prototype) · `travel-taxi`: yellow car, roof sign as a blank rounded rect · `travel-subway`: train front in an arched tunnel · `travel-car`: blue car, wheels · `travel-boat`: sailboat on blue wave · `travel-map`: folded map, dotted route, pin · `travel-passport`: blue booklet, circle emblem, no letters · `travel-ticket`: ticket with notch and dashed line · `travel-airport`: terminal with a tower and a small plane · `travel-hotel`: tall building, awning, bed-less |
| sport (12) | `sport-soccer` (prototype) · `sport-baseball`: white ball, red stitches · `sport-basketball`: orange ball, black lines · `sport-volleyball`: white ball, blue and yellow panels · `sport-tabletennis`: paddle and white ball · `sport-swimming`: swimmer head, goggles, waves · `sport-taekwondo`: figure in white uniform, belt, high kick · `sport-running`: figure running, shoes · `sport-jumprope`: figure mid-jump, rope arc · `sport-bicycle`: bicycle, side view · `sport-skiing`: skier, skis, poles · `sport-ball`: striped rubber playground ball |
| culture (7) | `culture-hangul`: abstract blocks of a circle, square and bar (alluding to jamo shapes, **no letters**) · `culture-hanok`: tiled curved roof, wooden pillars, door · `culture-bibimbap`: stone bowl, colourful toppings, egg · `culture-tteokbokki`: bowl, red-orange sauce, white rice-cake pieces · `culture-song`: two music notes and sound arcs · `culture-dance`: figure with raised arms and a fan or ribbon · `culture-drama`: TV screen with a play triangle |
| science (12) | `science-fire`: flame in three tones · `science-ice`: light-blue ice cube, shine · `science-stone`: gray rounded stone · `science-magnet`: horseshoe, red and blue ends · `science-earth`: blue globe, green continents · `science-space`: dark sky, stars, ringed planet · `science-robot`: boxy robot, antenna, screen face smiling · `science-seed`: seed with a green sprout · `science-rainbow`: six arcs (allowlisted 6 tones), two clouds · `science-shadow`: ball and its long gray shadow · `science-wind`: three swirls and a leaf · `science-light`: bulb, glow, rays |
| prop (4) | `prop-tangerine` · `prop-leaf` · `prop-grapes` · `prop-crow` (objects for the colour swatches; not vocabulary pictures) |

### 3.13 Behaviours (Given / When / Then)

1. **Given** the registry, **when** `vocab-keys.test.ts` runs, **then** every `word:*` visual in `content/vocab/*.json` resolves and every non-prop, non-reserved glyph is used once (for a family still in `AWAITING_ART`, §3.9: exactly its pinned number of visuals is missing).
2. **Given** a glyph with a hex colour `'#ff0000'` as a fill, **when** the tone test runs, **then** it fails (`isWordArtTone` is false); **given** `'feedback.danger'`, it fails.
3. **Given** `toRenderList(glyph, { mono: 'border.strong' })`, **then** every fill and stroke resolves to the `border.strong` value and shapes with opacity below 0.5 get 0.5.
4. **Given** the key `food-apple` at 48 px, **when** rendered, **then** the outline is 3 units of 100 (1.4 px) and the SVG has viewBox `0 0 100 100` (a golden `glyphToSvgString` test).
5. **Given** a vocabulary picture option with `decorative` unset and no label, **then** the caller's type check fails (`accessibilityLabel` is required unless `decorative`).
6. **Given** the source tree, **when** the import guard runs, **then** no file outside `src/word-art/` and `components/WordArt/` reads `colors.vocab`.
7. **Given** a total of word-art source above 120 KB raw, **then** `budget.test.ts` fails with the measured sizes.
8. **Given** the contact sheet, **when** a glyph is `review`, **then** it shows a "needs review" marker and the totals line counts it.
9. **Given** `COLOR_CONFUSION_PAIRS` and a token edit that makes two colours collapse differently, **then** the recomputation test fails until the constant is updated.

## 4. Out of scope

- Authoring the 99 hand glyphs themselves in the system PRs: PRs W-1a..W-1c ship the tokens, the system, the generators, the registry and **zero-to-few** sample glyphs (the 25 prototype glyphs may be ported as the first batch); the rest follow in batches (§6).
- New Heritage card art (F-CARD-S2-001 and siblings) and card illustration reviews.
- Animation of art; sticker packs; sharing.
- Raster or commissioned art (a later decision would change `PictureRef`, F-QUEST-002 §3.1).
- Dark mode or alternate palettes (the app has one palette).
- Accessible description of a picture beyond the gloss (e.g. "a red apple with a leaf"): v1.1 if testing with screen-reader users asks for it.
- Colour-blind *modes* in settings: the objects and outlines make the default accessible (W4).

## 5. Tests

| File | Level | Coverage focus |
|---|---|---|
| `design-system/src/word-art/__tests__/builders.test.ts` | unit, 100 % | each builder's output; one-decimal rounding; `face()` always smiles; `blob`/`curve` pass through the points; `poly` rounding; deterministic |
| `.../tones.test.ts` | unit, 100 % | `WORD_ART_TONES` excludes danger, overlay, inkScrim and `rarity.*`; `resolveTone` on every tone equals `colors`; unknown throws |
| `.../glyphs.test.ts` | unit | for **every registry glyph**: tones valid, at most `maxTones` fill tones, path grammar, coordinates in range, shape count limits, `sw` in {2,3} (generated 1.5 allowed), bbox 60-70 % (waivers listed), distinct data, no `text`/`image` kinds |
| `.../render.test.ts` | unit, 100 % | `toRenderList` defaults, `mono`, opacity floor; `glyphToSvgString` golden strings for 3 glyphs |
| `.../generated.test.ts` | unit, 100 % | `swatch` places the sticker in the lower right and keeps 9+ shapes; `count(n)` has n dots for 0..10 and 20, left-to-right; `bodyPart` anchors inside the viewBox; `figure` variants differ; the four sibling glyphs differ |
| `.../registry.test.ts` | unit | no duplicate keys; key grammar; family matches its source; deep freeze; every family has the planned count (food 9, animal 11, family 12, school 11, nature 9, travel 12, sport 12, culture 7, science 12, color 12, count 12, body 12, prop 4) — at most the plan until its batch lists it in `COMPLETE_FAMILIES`, exactly the plan after, and a family that reaches the plan must be listed; `getWordArt`, `wordArtKeyOf` |
| `.../color-science.test.ts` | unit | the Lab / Machado helpers on known reference colours; `COLOR_CONFUSION_PAIRS` matches the recomputed list; non-text contrast of the outline on canvas is at least 3:1 |
| `.../import-guard.test.ts` | integration (source scan) | `colors.vocab` / `'vocab.'` tones appear only under `src/word-art/` and `components/WordArt/` |
| `.../budget.test.ts` | integration | raw and gzip size limits (W7) |
| `.../vocab-keys.test.ts` | integration over `content/vocab` | §3.9 |
| `design-system/src/__tests__/tokens-parity.test.ts` (existing) | integration | stays green with the 12 new rows in `colors.v1.md` |
| `apps/web/src/app/design-preview/word-art/__tests__/page.test.tsx` | unit | the page renders one card per key and the totals line (server component rendered to a string, the pattern of the existing web tests) |

Coverage targets (CLAUDE.md §6): `packages/design-system` **85 %**; every `src/word-art/*.ts` is counted (only `src/components/**` is excluded, `vitest.config.ts:13`), so the pure code is expected near 100 %; the `WordArt.tsx` component and the web page are covered by the contact sheet and the e2e of F-VOC-003, not by unit lines. The glyph *data* files are exercised by `glyphs.test.ts` and `registry.test.ts` (every glyph is evaluated), so they count as covered.

## 6. Rollout and PR breakdown (dependency order)

| # | PR | Size | Depends on |
|---|---|---|---|
| W-1a | `feat(design-system)`: `colors.vocab.*` tokens + `design/tokens/colors.v1.md` rows (+ the candidate values' contrast and colour-vision numbers in the PR); `components/HeritageCardArt/card-ids.ts` extraction (`supportedCardIds`, re-exported); `exports["./word-art"]` stub | S | F-VOC-001 V-1 (key grammar) |
| W-1b | `feat(design-system)`: `word-art/{types,builders,tones,render,registry,color-science}.ts`, the import guard and budget tests, all pure tests; the 6 sample glyphs (or the 25 prototype glyphs if they exist) | M | W-1a |
| W-1c | `feat(design-system)`: generators (`color`, `count`, `body`, `figure`), `components/WordArt`, the 4 props, the brief `design/brief/illustrations/word-art.md`, generator tests | M | W-1b |
| W-2 | `feat(web)`: `/design-preview/word-art` contact sheet + page test + link from `/design-preview`; `apps/web/src/data/vocab-catalog.ts` is F-VOC-001 V-2b's | M | W-1c, F-VOC-001 V-2b |
| W-3 | `feat(design-system)`: batch A: Food (9) + Colors (12 generated) + Numbers (12 generated) + the props + the four colour-object glyphs (`animal-bear`, `animal-elephant`, `nature-cloud`, `nature-flower`, §3.12) | M | W-1c, W-2 |
| W-4 | `feat(design-system)`: batch B: Animals (the other 9) + Body (12 generated) | M | W-3 |
| W-5 | `feat(design-system)`: batch C: Family (12) + School (11) + Nature (the other 7) | M | W-4 |
| W-6 | `feat(design-system)`: batch D: Travel (12) + Sports (12) + K-Culture (7) + Science (12) | L | W-5 |
| W-7 | `refactor(mobile)`: `PictureArt.tsx` resolves `card:` and `word:` with the text-tile fallback (shared with F-QUEST-002 Q-3a; whichever lands first owns the file) | S | W-1c |

(Batches are `feat(design-system)` because they are TypeScript data with tests under `packages/design-system/src/word-art/`; the owner's approval of each batch is the review of that PR. The contact sheet is the design mock for the art, CLAUDE.md §5.)

A topic ships only when its art is `approved`; the picker shows a topic only when all 12 of its pictures resolve (F-VOC-003 §3.3). Rollback: a glyph is data; a bad batch is reverted by PR, and the item falls back to the text tile until fixed.

Estimated effort: system PR about 3 days; art batches about 20 hours of authoring plus the owner's review (the largest cost of the whole feature).

## 7. Dependencies

- **Upstream**: F-VOC-001 (key grammar and counts, `vocab-catalog.ts`); F-CARD-001 (illustration language); tokens (`tokens.ts`, `colors.v1.md`, token parity); F-PREV-001 (design preview).
- **Downstream**: F-VOC-003/004 (render pictures), F-QUEST-002 Pic-Word Match and Listen & Pick (`word:` refs), F-STORY-006 (a word-pack card could reuse a glyph), F-TCH-004 (lecture slides), F-VR-003.

## 8. Unverified assumptions and open items

1. **The prototype is not in the repo.** Its numbers (914 B per glyph expanded, 600 B source, 4.7 KB gzip for the core with generators) are measured on 25 + 19 glyphs; the 99-glyph extrapolation (about 85 KB raw, 20 KB gzip) has not been built. The budget test (W7) is the guard.
2. **The candidate hex values** of `colors.vocab` are the prototype's, not a design decision; the colour-vision numbers (§3.4) were computed with a simple Machado simulation and CIEDE2000 on those values, not with a calibrated device test.
3. **react-native-svg draw time and memory** for 12-48 glyphs on a low-end phone is unmeasured; the shape limits (32/48) and memoisation are the mitigations.
4. **Card art at 64 px** (13 words) is unverified, as F-QUEST-002 §9.4 already notes; the exit in §3.11 is the fallback.
5. **A neutral figure with long or short hair** as the only signal of the sibling speaker's side is a convention, not a verified recognition: the English gloss names the speaker too, and a native reviewer should confirm that the figures do not read as stereotyped.
6. **Whether the SVG `feColorMatrix` colour-vision filters** render identically in all three preview browsers is unchecked; the strip is a review aid only.
7. **Metro handling of a large TypeScript data module** (the glyph files) is assumed fine at about 60 KB; if build time or the bundle analyzer says otherwise, the per-topic lazy split of §3.8 applies.
8. **Moving `supportedCardIds`** to `card-ids.ts` assumes no consumer imports it from the `.tsx` path directly (`LibraryScreen.tsx:16` imports from the package index); a grep in PR W-1 confirms.
