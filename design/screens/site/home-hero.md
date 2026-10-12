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
| Section | padding `spacing.xl` top and bottom (phone); `spacing.xxxl` both (wide) |
| Lead | margin top `spacing.md`; `text.secondary` |
| Actions row | margin top `spacing.xl`, gap `spacing.md` |
| Start learning | the page's primary action, visually the largest: `brand.primary`, `text.onPrimary`, `radii.pill`, height `touchTarget.child`, padding inline `spacing.xxl`, `size.prompt` bold; hover `brand.primaryDark` |
| Grown-ups link | `brand.primaryDark` semibold, underline `borderWidth.thin` offset `spacing.xs`; hit area `touchTarget.min`; margin top `spacing.xs` |
| Facts | `size.caption`, `text.muted`, margin top `spacing.xs` |
| Art | `brand.primaryLight`, `radii.xxl`; `HoyaSvg pose="waving"` at 62 % of the box, raised by `spacing.xl` so the bubble never covers the face; `aria-hidden` |
| Bubble | inset `spacing.md`; padding `spacing.xs` x `spacing.md` (`spacing.sm` x `spacing.md` wide); `radii.pill`; `surface.paper`; `shadows.card`; text `landing.home.hero.bubble(FIRST_LETTER, romanization)`: "Annyeong! Let's meet ㄱ (g/k)." S-5 passes `FIRST_LETTER` together with its romanization, the letter's teaching sound value (`JAMO_SOUND_VALUES['ㄱ'][0]`, `packages/content-schema`), because taught Korean always shows its romanization (CLAUDE.md §1, spec §6). A no-break space in the message keeps the letter and its romanization together: at 375 px the bubble wraps after "meet" |

First screen at 320 x 568: header (81) + h1 (three lines) + lead (four lines) + Start learning end at 457 px; the grown-ups link is visible too.

## Blocks under the hero

Every block is a `<section>` with an `h2`, separated by a `borderWidth.thin` `border.subtle` top rule; padding block `spacing.lg` (phone) and `spacing.xxxl` (wide). The launch-news band is the exception (below). `h2` is `size.prompt` (phone) and `size.title` (wide), bold, leading tight, margin bottom `spacing.md`.

| Block | Look |
|---|---|
| Who is it for? (`#who`, `tabindex="-1"` so the in-page link moves focus to it) | three persona cards (`persona-card.md`); one column below 720 px, three columns from 720 px, gap `spacing.md` / `spacing.lg` |
| How it works | ordered list; number in a `spacing.xxl` circle (`brand.primaryLight`, `brand.primaryDark` bold, `aria-hidden`; the list itself numbers for screen readers); title bold, line `text.secondary`; three columns from 720 px |
| Promises | `h2` visually hidden (`landing.home.promises.label`); three title chips, not links: `surface.paper`, `borderWidth.base` `border.subtle`, `radii.pill`, padding `spacing.sm` x `spacing.lg`, semibold; section padding `spacing.lg` (phone) / `spacing.xl` (wide) |
| What does it cost? | one paragraph: the free line `landing.plans.free.stage1` ("Stage 1 is free.", the same in every state, F-ENT-003 OD-1), then the paid line from the `paidPlans` claim (`landing.plans.paid.coming` today, `landing.plans.paid.inApp` once paid plans are on sale); no price and no plan term |
| Get the launch news (`#news`) | a `brand.primary` band, as today's `#get` (`radii.xxl`, padding `spacing.lg` phone / `spacing.xxl` wide, centred, `text.onPrimary`), right after the cost section (no top margin; margin bottom `spacing.xl` / `spacing.xxxl`): `h2` "Get the launch news" (`size.prompt` / `size.title`, `text.onPrimary`), the one line, then the existing `WaitlistForm`, **not changed**: its field (`surface.paper`, no border, `radii.pill`, 48 px tall, placeholder "you@somewhere.com"), its button "Send me the invite" (`text.primary` fill, `text.inverse` label, `radii.pill`, 48 px tall) on one row from 720 px and on two rows on phones, and its consent line (`size.bodySm`, `leading.relaxed`, `text.onPrimary`, with the underlined "contact us" and "Privacy policy" links). The band is why the form's white consent and success lines stay readable. On the band the focus ring is `text.onPrimary` (`border.focus` is under 3:1 on `brand.primary`): a rule for the band in `globals.css`, not a change to the form (`shots/states-375.png`) |

No questions block on `/`. The footer follows (`header.md`).

The form's field, button and two consent links are under 64 x 64. They are today's controls with today's lines in `landing-touch-allowlist.json` (`input email`, `button submit`, `a mailto:hello@hangulroute.com`, one `a /privacy`); S-5 keeps those lines and adds none (spec §3.2). Making the form's controls 64 x 64 is a change to `WaitlistForm` that no S-PR owns; it stays an open item of F-I18N-001 §10.

## States

- Claims on: step 3 reads `landing.home.how.routeBody`; the cost line's paid sentence becomes `landing.plans.paid.inApp` ("Plans for families and classes are at app.hangulroute.com.") and the free sentence stays. No block grows by more than one line.
- Long words (`app.hangulroute.com`, an email) wrap (`overflow-wrap: anywhere` on the page body) so enlarged text never scrolls sideways.
