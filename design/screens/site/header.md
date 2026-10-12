# Site header and footer (design mock v1)

Wireframe: `design/wireframes/site/header-footer.md` · spec §3.2, §6 · strings `landing.nav.*`, `landing.footer.{guide, app}` and the existing footer links · mock: `mock/site.css` (`.site-header`, `.site-footer`) · shots: `shots/header-320.png`, `header-720.png`, `header-1280.png`, `header-320-text200.png`

## Phone, below 720 px (one row)

```
 16 |[HR] Hangul Route                 ( Sign in )| 16      81 px tall
      48 circle  bodyLg bold           pill, 64 high
```

- DOM order at every width: skip link, brand, Start learning, nav (Learners, Parents, Teachers), Sign in. Below 720 px Start learning and the nav are `display: none` (out of layout and Tab order).
- Sign in takes the free space with `margin-left: auto`; nothing uses `order`.
- Below 360 px the mark steps out (today's `hr-landing-logo-mark` rule) so the name and Sign in keep one row at 320 px.
- With enlarged text the row wraps (`flex-wrap: wrap`): Sign in drops to a second row, right-aligned. Never a third row, never a sideways scroll.
- Breakpoints are in em (720 px = 45em, 360 px = 22.5em, 960 px = 60em), so with 200 % browser text a 720 to 1,439 px window keeps this phone row instead of overflowing the wide one (`shots/header-720-text200.png`; README, "Enlarged text").

## Wide, 720 px and up (one row)

```
 [HR] Hangul Route  [[ Start learning ]]          Learners  Parents  Teachers  ( Sign in )
                                                            ^^^^^^^ current page: underline
```

- Start stays next to the brand; the nav takes the free space with `margin-left: auto`; Sign in follows it.
- 720 to 959 px: the brand shows the mark only; the name is visually hidden and stays the link's accessible name (`shots/header-720.png`).

## Legal variant (`/privacy`, `/terms`)

Brand only on phones; brand and the three persona links on wide screens. No Start learning, no Sign in (OD-14). The footer drops the App group.

## Tokens

| Part | Tokens |
|---|---|
| Bar | `surface.canvas`; bottom `borderWidth.thin` `border.subtle`; padding block `spacing.sm`; side gutter `layout.gutter.compact` (below 720), `.regular` (720 to 1119), `.wide` (1120 and up); content max `layout.maxWidth.full` |
| Item gap | `spacing.xs`; nav links `spacing.xxs` apart |
| Every link | hit area at least `touchTarget.min` x `touchTarget.min` (inline-flex, padding, not font size) |
| Brand | link padding-right `spacing.sm`, gap `spacing.sm`; mark `spacing.xxxl` circle (`radii.circle`), `brand.primary` with `text.inverse` `typography.weight.bold` `size.bodyLg`; name `size.bodyLg` bold `text.primary` |
| Start learning (wide) | `brand.primary`, `text.onPrimary`, `radii.pill`, padding inline `spacing.xl`, bold `size.body`; hover `brand.primaryDark` |
| Nav link | padding inline `spacing.md`, `text.secondary` semibold `size.body`; hover `text.primary` |
| Current page | `aria-current="page"`, `text.primary`, underline `borderWidth.thick` in `brand.primary`, offset `spacing.sm` (non-colour marker); visually hidden `landing.nav.current` after the label |
| Sign in | outline pill: `borderWidth.base` `border.strong`, `radii.pill`, padding inline `spacing.lg`, `text.primary` semibold; hover border `text.secondary` |
| Skip link | first Tab stop, off screen until focused; `surface.paper`, bold, `radii.md`, padding inline `spacing.lg`, at `spacing.sm` from the top left, `z.sticky` (`--z-sticky` in the mock) |
| Focus ring (every link) | `outline: borderWidth.thick solid border.focus`, offset `spacing.xxs` (`:focus-visible`) |

## Footer

```
 Hangul Route · Learn Hangul from zero, at any age.
 Guide            Company          <- phones: two columns
 Learners         About
 Parents          Privacy
 Teachers         Terms
 App              Contact
 Start learning
 Sign in
 (c) 2026 Hangul Route   [locale switcher once a second locale ships]
```

- Wide: three columns, Guide, App, Company (the same DOM order).
- Columns: `repeat(auto-fit, minmax(min(100%, 8rem), 1fr))`, so large text falls back to one column instead of scrolling sideways.

| Part | Tokens |
|---|---|
| Band | `surface.sunken`; padding top `spacing.xxl`, bottom `spacing.xl` |
| Tagline | `text.secondary`, brand name `text.primary` bold (`landing.brand.name`, `landing.meta.tagline`; S-3 sets the tagline equal to `landing.home.hero.title`, and a test ties them) |
| Group heading (`h2`) | `size.bodySm` bold `text.primary`; groups `spacing.lg` apart |
| Link | `touchTarget.min` tall, left-aligned, `text.secondary` `size.body`; hover `text.primary` underlined |
| Copyright | `size.caption` `text.muted`, margin top `spacing.lg` |

## Accessibility

- `header`, `nav` labelled `landing.nav.label` ("Main"), `main#content` (skip target), `footer`.
- Links to the app (Start learning, Sign in) are plain `<a>` in the same tab; persona links are `next/link` inside the site route group.
- Contrast: `text.secondary` and `text.primary` on `surface.canvas` and `surface.sunken`, `text.onPrimary` on `brand.primary` (token pairs already checked by `packages/design-system/src/contrast.ts`).
