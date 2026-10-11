# SectionTabs (component spec v1)

Spec: `docs/specs/F-STORY-004-story-shelf-home-library.md` §3.3 ("`SectionTabs`" paragraph), §3.12 and PR 4.5 in §6 · wireframe: `design/wireframes/library/stories.md` screens B and C (notation `(tab)`)
Code: `packages/design-system/src/components/SectionTabs/` (`SectionTabs.tsx` paint, `style.ts` pure `sectionTabStyle`, `types.ts`, `index.ts`)

## What it is

A wrapping row of pill tabs that switches between sections of one screen. First user: the Library (Cards / Story Time / Culture; F-VOC-003 later registers its own section). Switching is the caller's local state: the component neither navigates nor persists anything.

The design system has no copy: the caller passes localised labels and the row's accessible name.

## Props

| Prop | Type | Notes |
|---|---|---|
| `items` | `readonly { id: T; label: string }[]` | In display order; only the sections that are available |
| `value` | `T` | The selected id |
| `onChange` | `(id: T) => void` | Fires on every tap, also on the selected tab |
| `accessibilityLabel` | `string` | Name of the `tablist` ("Library sections") |
| `testID` | `string?` | Row id; each tab is `<testID>-<id>` |

## Anatomy

```
 ( Cards )  ( Story Time )  ( Culture )      <- one row; wraps at 320 dp or 200 % text
   ^ selected: filled, bold
```

## Tokens (no literals)

| Part | Selected | Not selected |
|---|---|---|
| Fill | `brand.primary` | `surface.paper` |
| Border | `brand.primary`, `borderWidth.base` | `border.strong`, `borderWidth.base` |
| Label | `text.onPrimary`, `weight.bold` | `text.primary`, `weight.semibold` |
| Shape | `radii.pill`, min height `touchTarget.min` (64), padding `spacing.xl` x `spacing.sm` | same |
| Label size | `typography.size.body` (18), `leading.normal` | same |
| Gap between tabs | `spacing.sm` | |

Pressed: the border turns `border.focus`, instantly (no scale or fade, so reduced motion needs nothing).

Contrast: `text.onPrimary` on `brand.primary` and `text.primary` on `surface.paper` are both >= 4.5:1 (pinned in `section-tabs-style.test.ts` and `contrast.test.ts`). The selected state is carried by fill and weight together and by `accessibilityState.selected`, never by hue alone.

## Accessibility

- The row is `accessibilityRole="tablist"` with the caller's name; each tab is `accessibilityRole="tab"` with `accessibilityState={{ selected }}` (`aria-selected` on the web).
- Every tab is >= 64 dp tall; the row wraps instead of scrolling sideways.
- Labels never truncate.

## Not this component

The Library's theme filter chips (~36 dp, audit UX-25) filter a grid; they are not tabs and are not replaced here.
