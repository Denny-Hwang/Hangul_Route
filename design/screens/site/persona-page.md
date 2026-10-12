# Persona page frame, drawn on `/parents` (design mock v1)

Wireframes: `design/wireframes/site/parents.md` (drawn), `learners.md`, `teachers.md` (same parts) · spec §3.1 rules, §3.4 to §3.6, §3.11 · strings `landing.persona.*`, `landing.plans.*` (appendix B.2 to B.4) · mock: `mock/parents.html` · shots: `shots/parents-320-first.png`, `parents-375.png`, `parents-1280.png`

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

First screen at 320 x 568: header, h1, lead and the primary action (ends at 415 px); the secondary action is just below.

## Parts and tokens

| Part | Tokens |
|---|---|
| Page head | padding top `spacing.xl`, bottom `spacing.xxl` (phone); `spacing.xxxl` both (wide) |
| Primary action | as the home's Start learning: `brand.primary`, `text.onPrimary`, `radii.pill`, `touchTarget.child`, `size.prompt` bold. `/learners`: Start learning; `/parents`: Sign in as a parent; `/teachers`: Sign in as a teacher |
| Secondary action | `borderWidth.base` `brand.primary` outline, `brand.primary` text, transparent, `touchTarget.min`, `size.bodyLg` bold, `radii.pill`; hover `brand.primaryLight` fill. `/parents`: Start learning; `/teachers`: Try it as a learner |
| Actions row | margin top `spacing.xl`, gap `spacing.md`; buttons full width below 720 px |
| Section | as on the home (`home-hero.md`): `h2`, top rule, padding block `spacing.xl` / `spacing.xxxl` |
| In-page link ("What learners do") | `brand.primaryDark` semibold underlined, `touchTarget.min` hit area |
| Bullets | `spacing.sm` dot in `brand.primary` (decorative), text `leading.normal`, rows `spacing.sm` apart |
| Numbered steps (`/teachers` set-up, `/learners` quest) | as the home's How it works |
| Claim lines | one more paragraph or bullet in the same section, same style; no badge, no "new" marker |
| Fold (`details`) | `surface.paper`, `borderWidth.base` `border.subtle`, `radii.md`, folds `spacing.sm` apart; `summary` at least `touchTarget.min` tall, padding `spacing.sm` x `spacing.lg`, semibold, chevron of `borderWidth.base` strokes in `brand.primaryDark` (turns when open, no animation); answer padding `0 spacing.lg spacing.lg`, `text.secondary`, `leading.relaxed` |
| Questions heading | visually hidden `h2` so the heading order stays h1 then h2 |
| Closing block | `brand.primaryLight`, `radii.xl`, padding `spacing.xl` (phone) / `spacing.xxl` (wide), margin block `spacing.xxl` / `spacing.xxxl`; line `size.prompt` bold; wide: line left, action right; phone: action full width |

## `/learners` and `/teachers` with the same parts

- `/learners`: primary Start learning only (no secondary); sections What you learn first (line + three bullets), How a quest works (three numbered steps, the Hoya line with the small waving Hoya at `spacing.xxxl` beside it, fold "See the mini-games"), Collect Korean culture (line, six card tiles in a 3 x 2 grid on phones and one row of six on wide screens, fold "See all {n} Stage 1 cards"), Your Learning Route only with its claim; five folds; closing "Ready for your first letter?".
- `/teachers`: Set up in minutes (three numbered steps), Plan and assign (two bullets), See how the class is doing (base line, claim lines), Privacy for classes (two bullets), Plans; three folds; closing "Bring Hangul to your class this week.". Wide: two columns like `/parents`.

## Measured on the mock

`/parents` at 375 x 812: 2,541 px (budget 4,060, headroom 3,700). At 1280 x 800: 1,998 px (budget 3,200). Visible words with folds closed: 227 (budget 550).
