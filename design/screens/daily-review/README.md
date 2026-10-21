# Daily Review (design mock v1, row CM-D1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` row **CM-D1**: §4.4, §4.5 ("Never on a review screen"), §7.3, §7.4 (OD-6), §7.7, §14. This is the agent design pass the spec asks for before the UI rows; the multi-agent review approves it (owner decision 2026-10-12, CLAUDE.md §5). Wireframe -> mock -> component order holds.
Wireframe: `design/wireframes/reviews/daily-review.md` (supersedes the layout of `reviews/daily-test.md`).
Built by: **CM-14** (Daily Review, Keep going, mission slot 3).

This folder also holds the **one stylesheet** of the six CM-D1 mock folders, `mock/reviews.css`; the other five link it:

| Folder | Wireframe | Built by |
|---|---|---|
| `design/screens/daily-review/` | `reviews/daily-review.md` | CM-14 |
| `design/screens/keep-going/` | `reviews/keep-going.md` | CM-14 |
| `design/screens/cell-check/` | `reviews/cell-check.md` | CM-21 |
| `design/screens/stage-check/` | `reviews/stage-check.md` | CM-22 (cards CM-23) |
| `design/screens/mastery-ring/` | `journey/mastery-ring.md` | CM-20 |
| `design/screens/goal-ring-weekly-dots/` | `home/goal-ring-weekly-dots.md` | CM-17 |

**Nothing here changes a string, a flag, a schema or a token.** The words drawn are the proposed English copy of each wireframe's "Proposed copy" table; the implementation rows add them to `packages/i18n` with their es and ko values in the same PR.

## What is here

| File | What it shows |
|---|---|
| `mock/daily-review.html` | A (slot 3 card), A2 (review first), B (a Listen and pick round), B2 (a missed first try), C (result, and the 0-right result), D (All refreshed today), E (Stop for now?) |
| `mock/reviews.css` | the shared token block and parts |
| `shots/daily-review-320.png` | the page at 320 wide, 2x |
| `shots/daily-review-768.png` | the page at 768 wide, 1x (the reading column, options 4 across) |
| `shots/daily-review-320-text200.png` | 320 wide with the browser text at 200 % |

Open any file in a browser at 320 or 768 wide. Nothing is interactive. Monospace labels on the sunken background are board notes, not UI.

## How the mock is made

- **Tokens.** Every value in `mock/reviews.css` is a token of `packages/design-system/src/tokens.ts`, copied once as a custom property named after it (the token block of `design/screens/minigame-writing/mock/writing.css`, plus `colors.theme.*`, `colors.rarity.*`, `layout.breakpoint.regular`, `typography.tracking.*` and `shadows.raised`). Checked value by value against `tokens.ts` on this commit: 60 colour properties, every spacing and radius, no mismatch; every `var()` in the six pages resolves; no colour literal in any HTML file. Container queries use `600px` (`layout.breakpoint.regular`), because a custom property cannot be used in a container query. **No new token.**
- **Device frames.** Each panel is an inline-size container, so the same page drawn at 320 shows the compact class and at 768 the regular class.
- **Drawn parts.** Hoya (`idle`, `cheering`, `thinking`, `waving`) is a static port of the mock Hoya used in earlier passes; glyphs are `Icon/glyphs.ts` paths (`star`, `check`, `close`, `arrow-left`, `speaker`, `sparkle`, `plus`, `replay`, `pin`, `check-circle`, `card` and the five theme glyphs). The star row follows `StarRow` (`feedback.nudge` fill, `hoya.furDark` stroke). One **new glyph** is proposed: `rest` (a crescent outline, `home/goal-ring-weekly-dots.md`) for CM-17.
- **Words.** Korean is fixture content: 사과 sagwa, 배 bae, 밥 bap, 떡 tteok, 김밥 gimbap, 나무 namu, 꽃 kkot, 비 bi, 산 san. Romanization follows the converter's output; the only name drawn is a sample profile name, Mina.

## Constants

Values that are not tokens. The rows write them as named constants, never bare literals.

| Where | Value | Derived from |
|---|---|---|
| Round dots | 8 dp dots, 4 dp gaps; 10 dots = 116 dp | `spacing.sm`, `spacing.xs`; 6 dots in experiment E2's short arm |
| Journey cell at 320 | 54 x 76 dp | `(320 - 2 x gutter.compact - 4 x spacing.xs) / 5`; `journeyCellLayout` minHeight (unchanged) |
| Corner band | 22 dp | `spacing.xxs` + the 20 dp count mark (`journeyCellMetrics`) |
| Cell at 768 | 112 dp square | `layout.columns.journeyCellMax` |
| Mastery track | 3 dp: a 2 dp theme band outside a 1 dp `border.shape` keyline | `borderWidth.thick` (the edge every cell already reserves), `borderWidth.thin` |
| `MASTERY_SEGMENTS` / `MASTERY_GAP` | 3 / 4 dp | §4.4 levels; `spacing.xs` |
| `GLOW_OPACITY` | 0.4 | the Ready to refresh halo over the theme token (decorative; the sparkle and the label carry the meaning) |
| Page-block ring | 48 dp | `spacing.xxxl` |
| Theme word size | 14 dp, fixed | `typography.size.caption` with `maxFontSizeMultiplier` 1, as the Journey grid's theme word, so mini cells never collide at 200 % text |
| Day dot | 24 dp | `spacing.xl` |
| Goal ring | 48 dp, 3 dp track | `spacing.xxxl`, `borderWidth.thick` |
| Stage card in the ceremony | 140 dp wide | about half of the 288 dp column at 320 (two cards and a gap fit one row) |

## Checks made on the shots (Chromium, Playwright 1.63)

- No sideways scroll at 320, at 768, or at 320 with 200 % text on any of the six pages (`scrollWidth` equals the viewport). Every folder has its `-320-text200.png` shot; long display words hyphenate (`hyphens: auto`) rather than overflow.
- Every drawn button, option, chip and cell is at least 48 x 48 (measured). Primary and full-width buttons, answer options, the close and back buttons, radio cards and segments are at least 64 tall (`touchTarget.min`; options 96). The small secondary buttons (`btn-sm`: Play again and Play on a quest row, See your prize and Stage Check on the Journey stage header) are 48 tall, the Stage 1 header pattern. Journey cells are 54 wide at 320.
- No red anywhere: a miss uses `feedback.nudge` / `nudgeLight` with a thicker border and a dot; `feedback.danger` is not in any page.
- No percentage, no "n of m", no "n / m", no timer, no emoji and no speaking UI in any drawn learner string of a review screen (searched in the six HTML files; the only hits are board notes, the reassurance "No timer." already shipped on the Hangul Check, and the unchanged Next lesson hero's "lesson 2 of 3" on Home, which is not a review screen).
- Contrast (non-text, WCAG 1.4.11): the mastery keyline `border.shape` is 4.55:1 on paper, 4.29:1 on canvas, 3.84:1 on sunken; the theme tokens alone are 1.86:1 (life) to 4.58:1 (rites) on paper, so they are never the only cue. Learned day dots are `brand.primary` (5.44:1 on paper); the goal arc is `brand.primary`; round dots are `brand.secondary` (5.20:1) on a `border.shape` outline.

## Screens

| Shot | Shows |
|---|---|
| `daily-review-320.png` | A, A2, B, B2, C, C (0 right), D, E |
| `daily-review-768.png` | the same in the reading column |
| `daily-review-320-text200.png` | 200 % text: rounds and results wrap, no sideways scroll |

## Review

The independent multi-agent design review (three reviewers: the §7.7 anti-shame checklist; visual and accessibility; spec fidelity and buildability) and what was changed for each finding are recorded in the PR body of row CM-D1.
