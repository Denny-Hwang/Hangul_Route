# Icon: theme glyphs `hangul-tile`, `rice-bowl`, `lantern`, `leaf`, `spinning-top` (component spec v1)

Owner decision 2026-10-14: the Heritage Journey grid stops drawing the single letters L, F, H, N and P in its cells. Learners could not decode them. Each cell now shows its theme's glyph with the theme word under it (owner request 2026-10-14, "Cell word" below), and each column label shows the same glyph above the same word, so the link between them is easy to see.

Spec:
- the grid: F-STORY-005 §3.5 and §3.6 (cells and count marks);
- the plan marks: F-PLAN-002 / F-ENT-003 E3-5 (Next, In your plan, Not open yet);
- the owner decision above (this sheet).

Wireframe: `design/wireframes/journey/grid.md` (cell looks, updated for this sheet).

Code:
- `packages/design-system/src/components/Icon/glyphs.ts` and `types.ts`;
- tests in `Icon/__tests__/glyphs.test.ts` (block "theme glyphs");
- `apps/mobile/src/logic/journey.ts` (`themeGlyph`: theme key to glyph);
- `apps/mobile/src/components/JourneyGrid.tsx`.

Preview: `theme-glyphs-v1.png`, rendered from `theme-glyphs.html`. The HTML is generated from the shipped glyph data. The preview shows:
- the five glyphs at 20, 24, 29, 34, 48 and 96 dp, next to `pin`, `library`, `check-circle`, `journey`, `card` and `note`;
- the same glyphs in greyscale, in `text.muted`;
- the grid at 320 px and at 768 px, with every cell state: complete, start pin, count mark, Next, In your plan, coming later, and stories-only.

## What they are

| Theme (key) | Column | Glyph | Look |
|---|---|---|---|
| Letters & Books (`letters`) | Letters | `hangul-tile` | a rounded square tile with the syllable 가 inside: the giyeok, then the vowel a. It is a picture of a Hangul letter, never a romanized initial |
| Food & Daily Life (`life`) | Food | `rice-bowl` | a solid bowl with the mound of rice above its rim and a foot below |
| Holidays & Traditions (`rites`) | Holidays | `lantern` | a hanging lantern: a hook, a cap, the round body, a base and a tassel, symmetric on the centre line. It has no rib through the body, so it never reads as the letter phi |
| Nature & Animals (`nature`) | Nature | `leaf` | one leaf on the diagonal, with its vein and a short stem; the tip points up-left, away from the story count mark |
| Play & Crafts (`crafts`) | Play | `spinning-top` | a whip top (paengi): a solid flat top over a solid cone that ends in one point, with a clear gap between them. No stem or handle: a paengi is kept spinning with a whip |

All five follow the rules of the rest of the set:
- the 24 x 24 grid;
- round caps and joins;
- lines from 2 to 2.4 wide;
- solid filled parts;
- a visible gap of at least 0.5 between separate parts at 20 dp.

The glyph test checks these rules, and also checks that each glyph stays inside the box with its stroke caps.

## Why these shapes

- **Apart from the marks around them.**
  - `spinning-top` has a flat top, so it is not the round-headed `pin`, which marks the start cell.
  - `leaf` is an open diagonal shape, never a ring, so it is not the In your plan ring or `check-circle`.
  - `hangul-tile` is a square tile with a letter in it, not the wide `card`.
  - In greyscale at 20 dp all five still differ from each other by outline.
- **Mostly solid at cell size.** `rice-bowl`, `lantern` and `spinning-top` have solid parts, and `hangul-tile` and `leaf` are bold outlines. Each one holds inside the 40 dp ring at 24 dp, and inside the 48 dp ring on a tablet.

## Rules

- **Tokens only.**
  - Cell art: `text.primary`, the same ink the letter used.
  - Column header: `text.muted`, the header word's tint.
  - Sizes: cell glyph `spacing.lg + spacing.xs` (20), scaled by `useMediaSize` (24 on regular, 28 on wide), the same way as the ring around it. It was 24 (29, 34) until the cell word below took the room. Header glyph `spacing.lg + spacing.xs` (20).
- **Decorative.** The words carry the meaning:
  - Every cell's accessible label already names its theme in words (`a11y.journeyCell`, the theme title in the UI locale; en, es and ko exist).
  - The column header keeps its word under the glyph, and screen readers still read the word.
  - A glyph is never read on its own. Inside a cell, the cell's single accessible element groups it. In the header, the glyph sits in a view hidden from screen readers.
- **Nothing else changes.** The count mark, the start pin, the placed-out check, the Next triangle, the In your plan and Not open yet rings, and the complete, coming-later and stories-only looks keep their places and colours. A stories-only cell keeps the books glyph (`library`). A coming-later cell stays empty.
- **Nothing covers the glyph.** The corner marks (start pin top left, story count mark top right, placed-out check top right) sit in a 22 dp band at the top of the cell, and the glyph starts under it, at every width. This replaces the v1 rule that let the count mark cover up to 9 x 9 dp of the glyph at 320 px, and fixes the start pin covering the leaf's tip (the tip points up-left, into the pin's corner). On a placed-out cell the count mark moves to the top left (a cell is never both placed out and the start). `logic/journey-cell-layout.ts` holds the geometry; its unit test and the e2e spec check that no mark overlaps the glyph or the word.

## Cell word (owner request 2026-10-14)

Each cell shows its theme word under the glyph, so the cells read without the header row.

| Theme | en | es | ko |
|---|---|---|---|
| `letters` | Letters | Letras | 글자 |
| `life` | Food | Comida | 음식 |
| `rites` | Holiday | Fiestas | 명절 |
| `nature` | Nature | Campo | 자연 |
| `crafts` | Play | Juegos | 놀이 |

- **Strings:** `learner.journey.themeWord` in `packages/i18n` (en, es, ko). The column labels show the same word, so the header and the cells always match (before this, the header took the first word of the English theme title in every locale).
- **Short forms:** a 320 px cell is 54 dp wide (50 inside its border). "Holidays" (52 dp) and "Naturaleza" (66 dp) do not fit one line, so English uses "Holiday" and Spanish "Campo" (the countryside: animals, mountains, sky). The Korean words are the glossary theme names (`learner.weeklyPlan.setup.likes.themeNames`).
- **Spanish "Campo" (decision, 2026-10-14 review):** both reviews of #714 asked whether "Campo" reads as "nature and animals". The options that fit 50 dp were weighed: "Fauna" names the animals only, "Bosque" a forest only, and "Natura" is not standard Spanish; "Naturaleza" (66 dp) and "Animales" (58 dp) do not fit. "Campo" stays: "ir al campo" is the everyday way to say going out into nature, and the glyph (a leaf) and the cell's spoken label (the full theme name) carry the rest. The full name stays "Naturaleza" everywhere it has room (the weekly plan theme names). Reopen only with a word that fits the budget below.
- **Grid only:** these are width-limited short forms for the Journey grid's cells and column labels. Other surfaces with room keep their own wording: Home's "where" line and the grown-up All lessons filter use the first word of the localized theme title (`themeColumnLabel`), so "Holidays" there and "Holiday" in the grid is intended, not drift.
- **Budget:** one word whose estimated width at the caption size is at most 50 dp (`journey-theme-word-messages.test.ts`: Helvetica advance widths, which read about 1 to 2 dp wider than the drawn word, so wide letters such as m and w count as wide; a Hangul syllable is one em). The e2e spec measures one line and no clipping at 320, 768 and 1180 px in every locale. On native the word is also capped at one line (`numberOfLines` 1, clipped), so a font that draws wider than the web never wraps it into the border.
- **Type:** `typography.size.caption`, `weight.regular`, `tracking.tight`, line height `leading.tight`, `text.secondary` (at least 4.5:1 on paper, the complete tint and sunken). It keeps its size at large text (`maxFontSizeMultiplier` 1), like the count mark: it is decorative. **Accepted exception (WCAG 1.4.4):** the cell word does not grow with the OS text size, because a larger word cannot fit one line of a 54 dp cell. The same word in the column label above each column is a `Caption` that does grow with the OS text size, and the cell's spoken label names the theme, so no information is lost at large text. On the web, browser zoom scales the cell word with the whole page.
- **Accessibility:** hidden from screen readers. The cell's label already names the theme (`a11y.journeyCell`), so the theme is read once.
- **Layout:** the glyph box is the ring's size, so the In your plan and Not open yet rings go round the glyph and end above the word. At 320 px the cell grows taller than wide (54 x about 76 dp). On a portrait tablet (768 px, 112 dp cells) it stays square. A wide window always shows two panes, and the grid fills the 400 dp master pane, so its cells are 76 dp wide and, with the wide glyph and ring, about 88 dp tall. The smallest height reserves the selected border (`borderWidth.thick`), so selecting a cell in two panes never changes its size or pushes the word into its border (`journey-cell-layout.ts`, unit tested at all three sizes, selected and not).
- **Stories-only cells** show the books glyph with the theme word. Coming-later cells stay empty.
- **No lock, no price, no speaking glyph** in this set.

## Where else the letters were

The letters were drawn only by `JourneyGrid` (`themeCellInitial`). The grown-up All lessons grid (`HomeSections`, F-BROWSE-001) uses the same component, so it changes with it. A search of the web console and the public site found no L, F, H, N, P letters.
