# WhoTile (component spec v1, OA-0b)

Spec: `docs/specs/AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` sections 6.1, 6.3, 14, OA-D9, OA-D17 · wireframe `design/wireframes/profiles/who-is-using.md` (Panels A, B, F, K) · built by **OA-4a** (tile, tint, Add a learner) and **OA-5** (locked)
Mock: `design/screens/profiles/mock/who-is-using.html` (boards 1, 5, 11, 14, 15), `who-is-using-largest.html` (board 16), `lengths.html` · shots `design/screens/profiles/shots/who-is-using-*.png`
Code (planned): `apps/mobile/src/components/WhoTile.tsx`, view model in `apps/mobile/src/logic/profiles/who.ts` (`tileTints`, `tileOrder`)

## What it is

One learner on the "Who is using this?" chooser: the learner's cub and name, nothing else. One tap opens that learner (or the PIN for a locked one). The **Add a learner** tile is its dashed variant.

## Props

| Prop | Type | Notes |
|---|---|---|
| `name` | `string` | the display name; wraps, never truncates (two lines and more) |
| `avatar` | `AvatarKind` | drawn by `ProfileAvatar` at 72 (the switcher size), idle pose, no ring |
| `tint` | `ThemeKey \| null` | from `tileTints(profiles)`: set only when two or more profiles share `avatar` |
| `locked` | `boolean` | lock badge and the caption `learner.who.lockedCaption` |
| `captionHidden` | `boolean` | the locks-unreadable state draws the badge without the caption (the screen's one line says it) |
| `onPress` | `() => void` | |
| `variant` | `'learner' \| 'add'` | `add`: dashed tile with `plus` and `learner.who.add` |

Never props: progress, stars, cards, level, streak, space, last played, time (CS-6). A snapshot test rejects those keys in the chooser tree.

## Anatomy and tokens

```
 +---------------------------+   radii.lg, borderWidth.thin border.subtle, surface.paper, shadows.card
 | plate        [lock badge] |   plate: surface.sunken, or colors.theme.<tint> when tinted; padding spacing.md
 |        ( cub 72 )         |   ProfileAvatar: paper circle, cub inside (the plate never touches the cub)
 +---------------------------+
 |          Mina             |   size.bodyLg bold text.primary on paper (never on the tint)
 |  A grown-up opens this    |   size.bodySm text.secondary (locked only)
 |  one.                     |
 +---------------------------+
```

- Whole tile is the touch target: at least `touchTarget.hero` (96) in both directions; measured 141 x 141 on a 360 phone (two columns) and 294 x 153 at Largest (one column). A 320 window (288 px inside the gutters) still holds two 8rem columns.
- Lock badge: a `spacing.xxl` (32) paper circle, `borderWidth.base` `text.primary` ring, the `lock` glyph 20 in `text.primary` (16.1:1), top right of the plate. The lock is the badge **and** the caption, never colour alone.
- **Tints** (`colors.theme`, never a stage, rarity, ranking or feedback colour), in this order by creation order inside the group that shares a cub: `letters`, `crafts`, `nature`, `rites`, `life`, then again from `letters`. Orange then blue first, because that pair stays apart for the common red-green colour-vision types (the blue-yellow axis). The tint fills the plate only; no text sits on it, so its contrast against paper (1.9 to 4.6) carries no reading and the name stays the tell. An untinted tile's plate is `surface.sunken`.
- Add a learner: `borderWidth.base` dashed `border.shape` (4.55:1 on paper, 4.29 on canvas), `surface.canvas`, a 48 paper circle with the `plus` glyph in `border.shape`, the label `size.body` semibold. Gated as today (`caregiver.audience.gated` adds "PIN required" to the accessible name).

## Grid

- `auto-fill` columns of at least `WHO_TILE_MIN` 8rem, from `layout.breakpoint.wide` 10rem (six per row at 1 120), gap `spacing.md`. Because the minimum is in rem, a larger text size takes columns away: at Largest, a 360 phone shows one column, so a name drops to one column before it would truncate (spec section 14).
- Order: creation order up to 12 profiles; from 13 (`CHOOSER_NAME_ORDER_FROM`), by name in the UI language's collation (`Intl.Collator(locale)`). Add a learner is always last.

## States

| State | Look |
|---|---|
| default | as above |
| pressed | `surface.inkScrim` over the tile; no scale, no motion |
| focus (web keyboard) | `borderWidth.thick` `border.focus` ring outside the tile, offset `spacing.xxs` |
| locked | badge and caption |
| locks unreadable | badge without caption on every tile; the screen shows `learner.who.locksUnread` |
| tinted | plate in the tint |
| add | dashed variant |

There is no disabled tile: a learner tile is always one tap.

## Accessibility

- Name: `a11y.who.tile(name)` ("Mina. Tap to start learning.") or `a11y.who.lockedTile(name)` ("Sora, locked. A grown-up PIN opens it."). The cub is decoration.
- The grid is one tab stop on the web with arrow-key roving, Home and End; Enter or Space picks (spec section 14). Native: each tile is a button in reading order.
- Reduced motion: no pose animation on tiles.
