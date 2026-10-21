# GrownUpRow (component spec v1, OA-0b)

Spec: `docs/specs/AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` sections 6.1, 12, 14, CS-7 · wireframe `design/wireframes/profiles/who-is-using.md` (Panels A, C, D, E, H, J) · built by **OA-4a** (Grown-up area row) and **OA-4b** (Family, Teacher, School, Sign in as a grown-up)
Mock: `design/screens/profiles/mock/who-is-using.html` (boards 1 to 9, 14, 15) · shots `design/screens/profiles/shots/who-is-using-*.png`
Code (planned): `apps/mobile/src/components/GrownUpRow.tsx`; rows from `grownUpRows({ os, uses, online, marker, resetPending })` in `logic/profiles/who.ts`

## What it is

One grown-up use on the chooser, visibly secondary to the learner tiles: a row with a lock glyph, a generic label and a chevron. It opens the PIN screen for that use.

## Props

| Prop | Type | Notes |
|---|---|---|
| `use` | `'family' \| 'teacher' \| 'school' \| 'signin' \| 'area'` | label: `learner.who.use.*`, or the zone name (`caregiver.audience.*.zoneLabel`) for `area` |
| `locked` | `boolean` | false only on a self-only device without a PIN (marker `none`): no glyph, the row opens directly |
| `disabled` | `boolean` | offline (web) for every use but `area`; caption `learner.welcome.grownUps.needsInternet` |
| `caption` | `string?` | `learner.who.nopinCaption` on the `area` row while the marker is `nopin` |
| `onPress` | `() => void` | |

Never an account name, email, space name or count (CS-7).

## Anatomy and tokens

```
 +------------------------------------------+   min-height touchTarget.min (64), radii.md, surface.paper,
 | [lock 24]  Family                    [>] |   borderWidth.thin border.strong, padding spacing.sm spacing.md
 |            caption (optional)            |   label size.body semibold text.primary; caption size.bodySm text.secondary
 +------------------------------------------+   lock and chevron text.secondary (8.44:1)
```

- The list is one column on a phone and three columns from `layout.breakpoint.wide`, measured on the screen's width (a container query in the mock), gap `spacing.sm`.
- The section above it is headed **Grown-ups** (`learner.who.grownUps`, `size.body` bold `text.secondary`), divided from the tiles by a `borderWidth.thin` `border.subtle` rule.
- **Pending 24-hour wait** (OA-D21) is not a row: a `surface.sunken` box at the top of the section with `learner.who.resetPending(time)` (`text.primary`, 13.58:1) and a secondary **Cancel the wait** button (`learner.who.resetCancel`). Plain text read in order, not a live region.

## States

| State | Look |
|---|---|
| default | as above |
| pressed | `surface.sunken` |
| focus (web) | `borderWidth.thick` `border.focus` ring, offset `spacing.xxs` |
| disabled (offline) | `aria-disabled`, `surface.sunken`, `border.subtle`, label `text.muted` (5.07:1), caption "Needs the internet", no chevron |
| captioned (`nopin`) | the caption line under the label |
| unlocked (`none`) | no lock glyph |

## Accessibility

- Name: `a11y.who.grownUpRow(label)` ("Family, for grown-ups, needs the PIN"); the label alone where no PIN guards the row (marker `none`, and `nopin`, where no PIN exists yet, so the name never announces a PIN). The caption (Needs the internet, the `nopin` caption) is the row's description (`accessibilityHint`, `aria-describedby`), never joined into the name. Rows are buttons in order after Add a learner.
- A disabled row stays in the reading order and says why; it is never hidden while offline.
