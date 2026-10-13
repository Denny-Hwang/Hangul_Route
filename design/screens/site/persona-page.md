# Persona page frame, drawn on `/parents` and `/learners` (design mock v1)

Wireframes: `design/wireframes/site/parents.md` and `learners.md` (drawn), `teachers.md` (same parts) · spec §3.1 rules, §3.4 to §3.6, §3.11 · strings `landing.persona.*`, `landing.plans.*` (appendix B.2 to B.4) · mock: `mock/parents.html`, `mock/learners.html` · shots: `shots/parents-320-first.png`, `parents-375.png`, `parents-1280.png`, `learners-320-first.png`, `learners-375.png`, `learners-1280.png`, `learners-320-text200.png`

## Frame

```
 header (current page marked on wide screens)
 H1  For parents and caregivers          size.display phone, size.hero wide
 lead                                    size.body phone, size.bodyLg wide, text.secondary
 [[ Sign in as a parent ]]               primary: touchTarget.child, size.prompt (full width on phones)
 [  Start learning      ]                secondary: outline, touchTarget.min (full width on phones)
 ---------------------------------------
 sections: h2 + at most three lines or four bullets (rule 2)
   phone: one column
   wide (parents, teachers): two columns, gap spacing.xxxl
         left  What they learn + Safe by design
         right Follow along + Plans
   wide (learners): the same sections in one column (cards and games folds need the width)
 ---------------------------------------
 folded questions (native details)
 closing block: one line + the primary action
 footer
```

First screen at 320 x 568: header, h1, lead and the primary action (ends at 415 px on `/parents`, 346 px on `/learners`); on `/parents` the secondary action is just below.

## Parts and tokens

| Part | Tokens |
|---|---|
| Page head | padding `spacing.xl` top and bottom (phone); `spacing.xxxl` both (wide) |
| Primary action | as the home's Start learning: `brand.primary`, `text.onPrimary`, `radii.pill`, `touchTarget.child`, `size.prompt` bold. `/learners`: Start learning; `/parents`: Sign in as a parent; `/teachers`: Sign in as a teacher |
| Secondary action | `borderWidth.base` `brand.primary` outline, `brand.primary` text, transparent, `touchTarget.min`, `size.bodyLg` bold, `radii.pill`; hover `brand.primaryLight` fill with a `brand.primaryDark` label (`brand.primary` on `brand.primaryLight` is below AA for normal text, `contrast.test.ts`). `/parents`: Start learning; `/teachers`: Try it as a learner |
| Actions row | margin top `spacing.xl`, gap `spacing.md`; buttons full width below 720 px |
| Section | as on the home (`home-hero.md`): `h2`, top rule, padding block `spacing.lg` (phone) / `spacing.xxxl` (wide) |
| In-page link ("What learners do") | `brand.primaryDark` semibold underlined, `touchTarget.min` hit area |
| Bullets | `spacing.sm` dot in `brand.primary` (decorative), text `leading.normal`, rows `spacing.sm` apart |
| Numbered steps (`/teachers` set-up, `/learners` quest) | as the home's How it works |
| Claim lines | one more paragraph or bullet in the same section, same style; no badge, no "new" marker |
| Fold (`details`) | `surface.paper`, `borderWidth.base` `border.subtle`, `radii.md`, folds `spacing.sm` apart; `summary` stays a block (older WebKit, iOS 14 and 15 Safari, does not reliably lay out a `summary` that is a grid or flex container) and holds one span with the question: that span is the grid, at least `touchTarget.min` tall, padding `spacing.sm` x `spacing.lg`, semibold, with the chevron (its `::after`, `borderWidth.base` strokes in `brand.primaryDark`, turns when open, no animation); answer padding `0 spacing.lg spacing.lg`, `text.secondary`, `leading.relaxed`. S-4a checks the fold in WebKit too |
| Plans heading | `landing.persona.plansTitle` ("Plans"); its lines are the free line, the `plans.paid.coming` line only while plans are coming, then `plans.managedInApp` (spec §3.5: the host is named once) |
| Questions heading | visually hidden `h2` (`landing.persona.faqTitle`, "Questions") so the heading order stays h1 then h2 |
| Closing block | a `section` labelled by its line (`aria-labelledby`, `landing.persona.closing.*`); `brand.primaryLight`, `radii.xl`, padding `spacing.xl` (phone) / `spacing.xxl` (wide), margin block `spacing.xxl` / `spacing.xxxl`; line `size.prompt` bold; wide: line left, action right; phone: action full width |

## `/learners` (`mock/learners.html`)

- Primary Start learning only (no secondary action).
- What you learn first: the line and three bullets (read, listen, write; no speaking line).
- How most quests work: three numbered steps (as the home's How it works, one line each; one column on phones, three on wide screens), then the Hoya line with the small waving Hoya (`spacing.xxxl` square, `aria-hidden`) beside it, then the fold "See the mini-games" (`MiniGamesGallery embedded` with `siteGames`: the list alone, game titles as h3, text in rem, columns `minmax(min(100%, 260px), 1fr)` so nothing passes the fold at 320 px).
- Collect Korean culture: the line, six card tiles, the fold "See all {n} Stage 1 cards" (`HeritageCardsPreview embedded`: the grid alone, no heading, body or Stage 2 line, text in rem). A tile is the card's Korean word (`size.prompt` bold, `lang="ko"`, never broken inside a word), its romanization (`size.caption`, `text.muted`) and its English gloss (`card.en`, `size.bodySm` semibold; never `card.title`, which for some cards is the romanization again, such as Bap): taught Korean always with its romanization and a gloss (CLAUDE.md §1). Tile: `surface.paper`, `borderWidth.base` `border.subtle`, `radii.lg`, `shadows.card`, padding `spacing.sm` (`spacing.md` wide). Grid: `repeat(auto-fit, minmax(min(100%, 5.5rem), 1fr))`, gap `spacing.sm`: three across at 320 and 375 px with default text, fewer as text grows (one column at 320 px with 200 % text, `shots/learners-320-text200.png`), never sideways; six across from 720 px, gap `spacing.md`.
- Your Learning Route only with its claim (one more section, same style); five folds; closing "Ready for your first letter?".
- One column at every width (the tiles and folds need the width).

## `/teachers` with the same parts

- Set up in minutes (three numbered steps), Plan and assign (two bullets), See how the class is doing (base line, claim lines), Privacy for classes (two bullets), Plans; three folds; closing "Bring Hangul to your class this week.". Wide: two columns like `/parents`.

## Measured on the mock

The README's table ("Measured on the mock") holds the current numbers for `/parents` and `/learners`: heights at 375 and 1280, words, first screen and the 200 % text header.
