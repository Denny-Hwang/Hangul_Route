# ScreenHeader (component spec v1, DN-0)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` section 7.1 (and 3.6 for the Display control) · wireframe `design/wireframes/shell/screen-header.md` Panels A, B, D · rows **DN-2** (component), **DN-4** (every non-root screen)
Code: `packages/design-system/src/components/ScreenHeader/` (`ScreenHeader.tsx` paint, `style.ts` pure, `types.ts`, `slot.ts` the route-level slot, `index.ts`); the learner app's slot `apps/mobile/src/components/LearnerScreenHeader.tsx`
Mock: `mock/screen-header.html` (a board of the four cases) · shots `shots/screen-header-320.png`, `-375-text200.png`, `-1280.png`; in use: `design/components/ConfirmSheet/shots/confirm-sheet-375.png` (close variant), `design/screens/learner-shell/shots/*` (back and root)
Rules: `design/screens/app-shell/mock/display-nav.css` (`.screen-header`, `.sh-lead`, `.sh-title`, `.sh-trail`, `.sh-progress`)

## What it is

The one top row of every learner-app and All lessons screen. It carries the way back (top left, the same place on every screen), the screen's title, and at the top right the Display (Aa) control. The design system has no copy: the caller passes the localised labels.

## Props

| Prop | Type | Notes |
|---|---|---|
| `leading` | `'back' \| 'close' \| 'none'` | `back` for stack screens, `close` for modals and flows that ask before leaving, `none` for roots (Welcome, the four tabs, All lessons home, BrowseAccess); the variant per route lives in `SCREEN_HEADER_VARIANTS`, the exception list in `SCREEN_HEADER_EXCEPTIONS` (`PlacementInvite` and `FirstQuestPreview`, the end of first-run setup). `back` and `close` are drawn only when `navigation.canGoBack()`; a screen that cannot go back is a root or an exception |
| `leadingLabel` | `string` | `common.buttons.back` or `common.buttons.close` |
| `onLeading` | `() => void` | `navigation.goBack()` through the screen's `beforeRemove` guard |
| `title` | `string?` | the h1 (`accessibilityRole="header"`, `aria-level` 1); wraps to two lines, never truncates |
| `titleSize` | `'title' \| 'prompt'` | `prompt` for long content titles (a topic, a story) |
| `titleLang` | `string?` | the title's language when it is not the UI language |
| `titleInline` | `boolean?` | keep the title in the row between the controls at every width (the tabs, PinEntry), so a short window keeps its content height; otherwise it sits in the row from the regular width and on its own line under the controls on a phone |
| `middle` | `ReactNode?` | a flow's own middle part (a quest's step dots, a Trace game's round meter, the story reader's page dots from the regular width); replaces the title in the row |
| `displayLabel`, `displayA11y`, `onDisplay` | `string`, `string`, `() => void` | the Aa control: visible `common.display.button`, accessible name `common.display.a11y` ("Aa, Display: language and text size", which begins with the visible label, WCAG 2.5.3); hidden while a session clock runs (`displayHidden`) |
| `trailing` | `ReactNode?` | at most one more control after Aa (Home's Profile button, All lessons' Romanization button) |
| `onHeight` | `(height) => void` | the header's measured height, for a screen that budgets the rest of the window (PinEntry's pad) |

## Anatomy and tokens

```
[< Back]  Title that may wrap        ( Aa ) [extra]
 ^ leading (touchTarget.min)   ^ h1   ^ trailing, margin-left auto
```

| Part | Tokens |
|---|---|
| Row | flex, wraps only when the minimum widths cannot fit (200 % text, Largest at 320); `spacing.sm` gap; at least `touchTarget.min` tall; the trailing group keeps its size and wraps as a group; `spacing.xs` under the header (none when the title is in the row) |
| Leading | `arrow-left` (back) or `close` glyph 24 + label, `size.body` bold `text.primary`, transparent, `radii.pill`, `touchTarget.min` both ways; pulled `spacing.xs` into the gutter so the glyph lines up with the content edge |
| Title | `size.title` (or `size.prompt`) scaled by the heading half rule, bold, `leading.tight`, `overflow-wrap: anywhere` |
| Aa | `aa-btn`: paper, `borderWidth.base` `border.strong`, `radii.pill`, `size.bodyLg` bold, `touchTarget.min` square at least |
| Middle (quest) | step dots `spacing.md`, filled `brand.primary`, open `border.shape` |

## Accessibility

- The leading control is the first focus stop; its accessible name is its visible label. The Aa control's name begins with "Aa" (the render test asserts that `common.display.a11y` starts with `common.display.button` in every locale). The title is the screen's heading.
- No screen can forget it: the learner app and All lessons provide their header through `ScreenHeaderSlotContext`, and every `Screen` draws it first in its content, in every state (as built in DN-4, in place of DN-0's required `header` prop; AMENDMENTS-DISPLAY-NAV section 7.1). The route table (`SCREEN_HEADER_VARIANTS`, typed over every route name) picks the leading control; a screen passes only its own options (`Screen`'s `header`: title, middle, trailing, `displayHidden`, `drawnByScreen`).
- The browser and phone back do what the leading control does (web history bridge, section 7.2).
- At 320 with 200 % text and at Largest the title wraps and the controls keep 64 px (`screen-header-375-text200.png`).
