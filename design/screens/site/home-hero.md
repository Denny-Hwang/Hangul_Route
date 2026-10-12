# Home hero and the blocks under it (design mock v1)

Wireframe: `design/wireframes/site/home.md` · spec §3.1, §3.3, §3.11 · strings `landing.home.*`, `landing.plans.*` (appendix B.1) · mock: `mock/home.html` · shots: `shots/home-320-first.png`, `home-375.png`, `home-720.png`, `home-1280.png`

## Hero (L0)

Phone (one column):

```
 H1  Learn Hangul from zero,        size.display (36), weight bold, leading tight
     at any age.
 Short, playful quests teach ...    size.body, leading relaxed, text.secondary, max 34em
 [[        Start learning        ]] full width, touchTarget.child (80) tall, size.prompt bold
 Parent or teacher? Find your page  text link, 64 tall hit area -> #who
 Runs in your browser · ...         size.caption, text.muted
          +-------------+
          |   HOYA      |           square, max 240 px, brand.primaryLight, radii.xxl
          | (bubble)    |           bubble: surface.paper pill, shadows.card, size.caption semibold
          +-------------+
```

Wide (720 px and up): two columns `1.4fr / 1fr`, gap `spacing.xxl`, vertically centred; h1 `size.hero` (48), lead `size.bodyLg`, the Start button keeps its content width, art square up to 360 px, bubble `size.bodySm`.

| Part | Tokens |
|---|---|
| Section | padding top `spacing.xl`, bottom `spacing.xxl` (phone); `spacing.xxxl` both (wide) |
| Lead | margin top `spacing.md`; `text.secondary` |
| Actions row | margin top `spacing.xl`, gap `spacing.md` |
| Start learning | the page's primary action, visually the largest: `brand.primary`, `text.onPrimary`, `radii.pill`, height `touchTarget.child`, padding inline `spacing.xxl`, `size.prompt` bold; hover `brand.primaryDark` |
| Grown-ups link | `brand.primaryDark` semibold, underline `borderWidth.thin` offset `spacing.xs`; hit area `touchTarget.min`; margin top `spacing.xs` |
| Facts | `size.caption`, `text.muted`, margin top `spacing.xs` |
| Art | `brand.primaryLight`, `radii.xxl`; `HoyaSvg pose="waving"` at 62 % of the box, raised by `spacing.xl` so the bubble never covers the face; `aria-hidden` |
| Bubble | inset `spacing.md`; padding `spacing.xs` x `spacing.md` (`spacing.sm` x `spacing.md` wide); `radii.pill`; `surface.paper`; `shadows.card`; text `landing.home.hero.bubble(FIRST_LETTER)` |

First screen at 320 x 568: header (81) + h1 (three lines) + lead (four lines) + Start learning end at 457 px; the grown-ups link is visible too.

## Blocks under the hero

Every block is a `<section>` with an `h2`, separated by a `borderWidth.thin` `border.subtle` top rule; padding block `spacing.xl` (phone) and `spacing.xxxl` (wide). `h2` is `size.prompt` (phone) and `size.title` (wide), bold, leading tight, margin bottom `spacing.md`.

| Block | Look |
|---|---|
| Who is it for? (`#who`, `tabindex="-1"` so the in-page link moves focus to it) | three persona cards (`persona-card.md`); one column below 720 px, three columns from 720 px, gap `spacing.md` / `spacing.lg` |
| How it works | ordered list; number in a `spacing.xxl` circle (`brand.primaryLight`, `brand.primaryDark` bold, `aria-hidden`; the list itself numbers for screen readers); title bold, line `text.secondary`; three columns from 720 px |
| Promises | `h2` visually hidden (`landing.home.promises.label`); three title chips, not links: `surface.paper`, `borderWidth.base` `border.subtle`, `radii.pill`, padding `spacing.sm` x `spacing.lg`, semibold; section padding `spacing.lg` (phone) / `spacing.xl` (wide) |
| What does it cost? | one line from the claims (`landing.plans.free.*` and, once paid plans are on sale, `landing.plans.paid.inApp`) |
| Get the launch news (`#news`) | title, one line, the existing `WaitlistForm` unchanged (field `touchTarget.min` tall, `borderWidth.base` `border.strong`, `radii.md`; Send is a primary button `touchTarget.min` tall) |

No questions block on `/`. The footer follows (`header.md`).

## States

- Claims on: step 3 reads `landing.home.how.routeBody`; the cost line follows `freePlan` / `paidPlans`. No block grows by more than one line.
- Long words (`app.hangulroute.com`, an email) wrap (`overflow-wrap: anywhere` on the page body) so enlarged text never scrolls sideways.
