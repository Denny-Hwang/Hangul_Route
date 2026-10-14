# Writing games: Type Hangul, Trace a Word, Write Frame (design mocks v1)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md`, row **D-3** in the section 6 table: §3.7 (the three ways of writing in Stage 7, Write Frame, "My page", the free-entry data rule of Write Your Name q3), §3.14 (accessibility, 320 to tablet), OD-6 (nothing typed is kept), OD-10 (the in-app two-set keyboard only). This is the agent design pass the spec asks for before rows **G-3** (Type Hangul), **G-4** (Trace a Word) and **G-5** (Write Frame); the multi-agent review approves it (owner decision 2026-10-12, CLAUDE.md §5). Wireframe -> mock -> component order holds.
Wireframes: `design/wireframes/minigame/type-hangul.md`, `trace-word.md`, `write-frame.md`.

Built by:
- **G-3**: `HangulKeyboard` (design-system) and Type Hangul -> `keyboard.md`, `type-hangul.md`.
- **G-4**: Trace a Word -> `trace-word.md`.
- **G-5**: Write Frame, My page and the name round -> `write-frame.md`.

**Nothing here changes a string, a flag, a schema or a token.** The words drawn are drafts listed in each wireframe's "Draft strings" table; G-3, G-4 and G-5 add them to `packages/i18n` with their es and ko values in the same PR.

## What is here

| File | What it fixes |
|---|---|
| `keyboard.md` | the KS X 5002 keys, the two arrangements (split, standard) and how the width picks one, cell sizes per window class, key faces, Shift, Del, Space, accessibility |
| `type-hangul.md` | the Type Hangul screen at 320 x 568, 375, tablet and a landscape phone; the result panel (pass, near, far); prompt modes |
| `trace-word.md` | the Trace a Word screen: word strip, block canvas with the placed ghost, block by block, letter-by-letter fallback, two canvases on a tablet |
| `write-frame.md` | pick, write (type or trace), the finished sentence, two slots, My page, the name round (Blocks and Keyboard tabs) |
| `mock/` | static HTML on one stylesheet, `writing.css`: pages `type-hangul.html`, `trace-word.html`, `write-frame.html` (each fills the window); boards `keyboard.html`, `type-hangul-states.html`, `trace-word-states.html`, `write-frame-states.html` |
| `shots/` | the mocks rendered in Chromium: first screens at 320 x 568 and 375 x 667 at 2x, tablet and landscape pages and the boards at 1x; `-text200` is the browser text size at 200 % |

**The mock is a design reference, not shipped code.**

- **Tokens.** Every value in `mock/writing.css` is a token of `packages/design-system/src/tokens.ts`, copied once as a custom property named after it (the token block of the Learning Route pass, plus `layout.breakpoint`, `layout.compactHeight`, `layout.shortHeight`, `layout.mediaScale`, `shadows.raised` and `colors.vocab.green` / `.red` for the WordArt pictures). Checked value by value against `tokens.ts` on this commit (131 properties, no mismatch, no colour literal outside the token block). **No new token**: the keys use `surface.paper` (consonants), `surface.sunken` (vowels), `border.subtle`, and Shift on uses `brand.secondaryLight` with a `brand.secondaryDark` thick border.
- **Window classes.** Each device frame is a CSS size container; container queries stand in for the app's classes (`layout.breakpoint` 600 / 900, `layout.compactHeight` 640, `layout.shortHeight` 480), so a board shows a 320 phone and a tablet side by side.
- **Drawn parts.** Hoya (`idle`, `cheering`, `thinking`) is a static port of `Hoya.tsx`; the `thinking` pose (eyes up and right, the thought cloud, no cheek blush) is new to the mocks and follows the component exactly. The trace ghosts are the shipped skeletons of `apps/mobile/src/content/jamo-strokes.ts`, placed into block zones by a mock transform (the zones are a proposal for G-4's `placeBlockStrokes`, wireframe open question 1). The word-bank pictures are the shipped WordArt glyphs `food-bread`, `food-apple`, `food-tteok`, `food-ramyeon`, rendered from `word-art/model.ts` with their colours mapped back to tokens. Glyphs `speaker`, `check`, `check-circle` are `Icon/glyphs.ts` paths.
- **Two new glyphs** are proposed for G-3 (added to `Icon/glyphs.ts` with the glyph sheet test): `shift` (an outlined up arrow; filled when on) and `backspace` (a left-pointing key outline with a cross). Their paths are in `mock/type-hangul.html`.
- **Words.** Korean is fixture content from the spec's tables (호야, 이름, 한글, 김밥, 빵, 사과, 떡, 라면, 학교, 설날 and the Stage 7 frames); the cast name 호야 is the only name drawn (§3.7: screenshots never use a real name). Romanization follows the converter's output for each word and sentence; glosses are drafts.
- **Annotations.** Monospace labels and dashed boxes are design-board notes, not UI.

Open any file in a browser. Nothing is interactive.

## Constants

Values that are not tokens. G-3, G-4 and G-5 write them as named constants, never bare literals.

| Where | Value | Derived from |
|---|---|---|
| Keys in a row, standard / split | 10 / 5 | KS X 5002 row 1 has ten keys; a split half has five |
| Standard arrangement from | keyboard width >= 640 (window >= 688 in the reading column) | 10 x `touchTarget.min`; 688 = 640 + 2 x `layout.gutter.regular` |
| Cell height | 64 phone and short window; 77 regular; 90 wide | `touchTarget.min` x `layout.mediaScale`, at most `touchTarget.hero` |
| Split cell width cap | 96 | `touchTarget.hero` |
| Key face (glyph / hint) | 28 / 14 on a phone, 36 / 16 on a tablet, in dp | `typography.size.title` / `caption`, `display` / `bodySm`: a key face is media (F-LAYOUT-001 LD4), so it keeps its size at 200 % text |
| Key inset | 2 | `spacing.xxs`: the hit area is the whole cell, the drawn key sits inside it |
| Result panel height | the keyboard's height | so the field does not move when the panel replaces the keyboard |
| Trace canvas | 160 to 320 (448 on a tablet) | `TRACE_CANVAS_MIN`, `TRACE_CANVAS_MAX`, `TRACE_CANVAS_CEILING` (`logic/trace-layout.ts`, unchanged) |
| Ghost / ink stroke | opacity 0.12, width 18 / width 8 (viewBox 200) | the shipped values in `TraceStrokeGame.tsx` |
| Progress bar height | 12 | `Progress` default (`spacing.md`) |
| Font stack | the system stack | `typography.family.sans` is `'System'` |

## Screens

| Shot | Viewport | Shows |
|---|---|---|
| `shots/type-hangul-320-first.png` | 320 x 568, 2x | the whole screen on the first screen: compact row, answer row, split keyboard of 64 x 64 cells; budget 103 + 72 + 393 = 568 |
| `shots/type-hangul-375-first.png` | 375 x 667, 2x | from 640 tall: the round bar row, the prompt on its own line, cells 75 x 64 |
| `shots/type-hangul-320-text200.png` | 320 x 568, text 200 % | the prompt row grows and scrolls; field and keyboard stay; key faces keep their size |
| `shots/type-hangul-768.png`, `-1180.png` | tablet | standard keyboard in the reading column, Done and Skip under it |
| `shots/type-hangul-844x390.png` | landscape phone | the short arrangement: 68 + 66 + 256 = 390 |
| `shots/type-hangul-states.png` | board | T1 to T11: empty, typing, Shift on, pass, near miss, hear, picture, far, tablet portrait and landscape, short window |
| `shots/keyboard-board.png` | board | K1 to K7: split at 320 (and Shift on), 375, 600; standard at 768, 1180 and on a short 844 window |
| `shots/trace-word-320-first.png`, `-768.png` | page | block 1 of 호야 on a phone; two canvases on a tablet |
| `shots/trace-word-states.png` | board | W1 to W6: idle, block passed, retry, word done, letter-by-letter, tablet |
| `shots/write-frame-320.png`, `-768.png` | page | the pick phase (the phone page scrolls; Skip at the end) |
| `shots/write-frame-states.png` | board | F1 to F9: pick, type, near miss, finished sentence, trace, two slots, My page, the name round's two tabs |

## Checks made on the shots

- Every key's hit area is at least 64 x 64 at 320 (measured 64.0 in the mock); no key, button or tile is smaller than `touchTarget.min`.
- At 320 x 568 the answer row and the full keyboard are on the first screen with no scrolling, in every prompt mode (T1 to T8).
- No red anywhere: misses use `feedback.nudge` / `nudgeLight` and Hoya `thinking`; a marked block also has a thicker border and a dot, so it does not rely on colour.
- `silent/ng` (the longest key face) fits the 60-wide key at 320.
