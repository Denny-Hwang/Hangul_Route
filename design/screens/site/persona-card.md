# Persona card (design mock v1)

Wireframe: `design/wireframes/site/home.md` (`#who`) · spec §3.3 block 2, §6 · strings `landing.home.who.items.{learners,parents,teachers}.{title, body}` · mock: `mock/home.html`, `mock/states.html` · shot: `shots/states-375.png`

## Anatomy

```
 +------------------------------------------------+
 | Parents and caregivers                     (>) |   title: size.bodyLg bold, leading tight
 | See what your learner practises, with a        |   line: size.body, text.secondary, leading normal
 | grown-up gate and no ads.                      |   chevron: spacing.xxl circle, aria-hidden
 +------------------------------------------------+
```

- The whole card is one `<a>` to its persona page (`next/link`, inside the site route group). Accessible name = title + line (the text content); the chevron is `aria-hidden`. No nested link or button.
- The cards sit in a `<ul>`, so a screen reader announces "list, 3 items".
- Wide: three equal columns, cards stretch to the tallest (`height: 100%`); text is top-aligned so the titles line up; the chevron stays vertically centred.

## Tokens

| Part | Tokens |
|---|---|
| Card | `surface.paper`, `borderWidth.base` `border.subtle`, `radii.lg`, `shadows.card`, padding `spacing.lg`, min height `touchTarget.child`, grid gap `spacing.md` |
| Title | `typography.size.bodyLg`, `weight.bold`, `leading.tight`, `text.primary` |
| Line | `size.body`, `leading.normal`, `text.secondary`, margin top `spacing.xs`; at most 90 characters (`length-budget.test.ts`) |
| Chevron | `spacing.xxl` circle (`radii.circle`), `brand.primaryLight` with a `brand.primaryDark` stroke icon of `spacing.lg` |

## States

| State | Change |
|---|---|
| Rest | as above |
| Hover | border `border.strong`; chevron fills `brand.primary` with `text.onPrimary` |
| Keyboard focus (`:focus-visible`) | `borderWidth.thick` `border.focus` outline around the whole card, offset `spacing.xxs` |
| Pressed (`:active`) | background `surface.sunken`, no shadow |

No motion; no colour carries meaning on its own (the chevron and the card outline mark it as a link).
