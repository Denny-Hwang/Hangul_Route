# presenter v1

**Authoritative scale for the lecture presenter.** Mirrors `packages/design-system/src/tokens.ts` (`presenter` export, also part of the `tokens` aggregate). The presenter turns stage units into window pixels with `apps/mobile/src/logic/lecture/stage-scale.ts` (F-TCH-004 PR 4).
Drift detected by `.github/workflows/design-token-sync.yml` (the `presenter` export must exist) and pinned value by value in `packages/design-system/src/__tests__/tokens-parity.test.ts`. The colour pairs below are checked in `packages/design-system/src/__tests__/contrast.test.ts`.

Spec: `docs/specs/F-TCH-004-lecture-mode.md` §3.6 · Wireframe: `design/wireframes/classroom/lecture-presenter.md`

Last updated: 2026-10-11 · Version: v1

Rows are `presenter.<path>` so the parity test can compare them to the flattened export. A list value is written comma-separated, in order.

---

## Stage

A logical stage is 1280 units wide. Its logical height follows the window (`1280 * h / w`) and is clamped to the range below (about 4:3 up to about 2:1); outside it the stage letterboxes. One unit = window width / 1280, unless the height clamp binds, then window height / logical height.

| Token | Value | Meaning |
|---|---|---|
| `presenter.stage.width` | 1280 | logical stage width, units |
| `presenter.stage.minHeight` | 600 | shortest logical height (wide windows letterbox below this) |
| `presenter.stage.maxHeight` | 960 | tallest logical height (4:3; taller windows letterbox above this) |

## Type sizes (stage units)

Slides size text as `unit * n`, never with a CSS `transform: scale`. Nothing projected is smaller than `caption`, and `stageText(n) = max(typography.size.body, round(unit * n))` keeps every string at or above the 18 px body floor on small windows.

| Token | Value | Used for |
|---|---|---|
| `presenter.size.glyph` | 380 | the letter on a letter slide |
| `presenter.size.display` | 140 | a syllable, a vocabulary word, a quiz option in Korean |
| `presenter.size.title` | 80 | slide and deck titles |
| `presenter.size.prompt` | 56 | quiz prompts, the picker result, the timer numbers |
| `presenter.size.body` | 40 | romanization, gloss, story narration |
| `presenter.size.caption` | 28 | captions ("Simplified stroke guide"), the smallest projected text |

## Font, markers, controls

| Token | Value | Meaning |
|---|---|---|
| `presenter.font` | HR Presenter KR | family name of the bundled Hangul subset (Noto Sans KR Bold, SIL OFL 1.1; F-TCH-004 PR 3). Until it ships, the system Hangul font is used |
| `presenter.marker.shapes` | circle, triangle, square, star | quiz option markers for options 1, 2, 3, 4: every option has a shape and a number, so colour is never the only cue |
| `presenter.autoHideMs` | 3000 | the control bar hides after this many ms with no pointer, touch or key activity (a focused button keeps it visible) |
| `presenter.dimOpacity` | 0.8 | opacity of the non-correct quiz options after the reveal (§3.10). Every line of a dimmed option (Korean, romanization, gloss, shape marker) is `text.primary`, which stays at 8.4:1 on paper; `text.secondary` would fall to 4.9:1, so it is never dimmed |

## Projected colour pairs

The presenter adds **no colours**: it projects existing `colors.*` tokens on white paper (`surface.paper`, never the cream canvas, which washes out on a projector). The blank and pause overlays use the same paper ground. Every pair the presenter may draw is listed here. Text pairs must reach **7:1** (WCAG AAA; read from the back of a room through a projector); non-text cues must reach **3:1** (WCAG 1.4.11). A `text-dimmed` pair is drawn at `presenter.dimOpacity` and is checked as it lands (the foreground composited over the background) against the same 7:1. A new pair needs a row here first; the contrast test reads this table and fails if it cannot read a row.

| Kind | Foreground | Background | Where |
|---|---|---|---|
| text | `text.primary` | `surface.paper` | slide text, Korean glyphs, titles, quiz options at rest, the blank overlay's "Eyes on me" line, the pause overlay |
| text | `text.secondary` | `surface.paper` | romanization, gloss, captions on the stage |
| text | `text.primary` | `surface.sunken` | control bar labels, grid thumbnails, help overlay |
| text | `text.secondary` | `surface.sunken` | control bar status line (offline, voice, update) |
| text | `text.primary` | `feedback.successLight` | the revealed correct quiz option (Korean, romanization and gloss) |
| text | `text.primary` | `brand.secondaryLight` | `KoreanText` target chip on a slide |
| text | `text.onPrimary` | `brand.primaryDark` | the big [[ Start ]] button and other primary fills |
| text-dimmed | `text.primary` | `surface.paper` | the non-correct quiz options after the reveal, at `presenter.dimOpacity` (Korean, romanization, gloss and shape marker) |
| non-text | `text.primary` | `surface.paper` | quiz shape markers (circle, triangle, square, star) |
| non-text | `text.primary` | `feedback.successLight` | the shape marker of the revealed correct option |
| non-text | `feedback.success` | `surface.paper` | the correct option's border at the answer build |
| non-text | `feedback.success` | `feedback.successLight` | the check mark on the correct option |
| non-text | `brand.primary` | `surface.paper` | the class timer ring as it fills |
| non-text | `border.focus` | `surface.paper` | keyboard focus ring on the stage |
| non-text | `border.focus` | `surface.sunken` | keyboard focus ring on the control bar |
| non-text | `brand.primary` | `surface.sunken` | the timer ring fill against its unfilled track (the track is `surface.sunken`, a decorative ground; the m:ss numbers carry the time) |
| non-text | `brand.secondary` | `surface.paper` | `KoreanText` target chip border on a slide |
| non-text | `brand.secondaryDark` | `surface.paper` | `KoreanText` speaker icon on a slide |

Not projected, because they miss 7:1: `text.muted` on paper (6.0:1), a white label on `brand.primary` (5.4:1; use `brand.primaryDark`), `text.secondary` on `feedback.successLight` (6.9:1; the revealed option uses `text.primary` for every line), and `text.secondary` at `presenter.dimOpacity` on paper (4.9:1; a dimmed option uses `text.primary` for every line).

---

## Rules

1. **Stage units only.** Slide components size text and art as `unit * presenter.size.<x>` (or `stageText`), never a raw pixel number and never `* 1.4`-style ratios.
2. **Nothing projected below `caption`**, and nothing on screen below `typography.size.body`.
3. **No failure colour.** The quiz reveal gives the correct option the success border and check; the others only lose emphasis, drawn at `presenter.dimOpacity` with every line in `text.primary`. `feedback.danger` and a red X never appear on a projected slide (CLAUDE.md anti-shame rules; F-TCH-004 §3.10).
4. **Control bar targets** are `touchTarget.hero` (96) in real pixels, not stage units, with a visible text label.
5. **Only these numbers and pairs.** A new size, shape or colour pair needs a spec change, this table and `tokens.ts` in the same PR.

## Promotion path

`design/tokens/presenter.v1.md` → `packages/design-system/src/tokens.ts` (`presenter` export, in the `tokens` aggregate) → `apps/mobile/src/logic/lecture/stage-scale.ts` and the presenter slides consume it.
