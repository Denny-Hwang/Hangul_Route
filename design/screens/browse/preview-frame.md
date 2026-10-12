# Preview strip, `PreviewFrame` (BR-6)

Wireframe: `design/wireframes/browse/preview-player.md` A, B; `preview-end.md` · Spec: F-BROWSE-001 §4.7, §7 · Mock: `mock/preview-player.html`, `mock/preview-end.html`, `mock/preview-states.html` · Shots: `shots/preview-player-375.png`, `-375-first.png`, `-1280.png`, `-320.png`, `-320-text200.png`, `shots/preview-end-375.png`

Shown only on lesson screens (the quest player, its games, the story reader, flashcards) and on the end screen. Never on home, the outline, the item page or Access.

## Layout

```
+----------------------------------------------+
| Preview. Nothing is saved.  [ Leave preview ] |   surface.sunken, border.strong rule below
+----------------------------------------------+
| the learner lesson, unchanged                 |
```

| Part | Look |
|---|---|
| Bar | full window width, above the lesson's own layout and safe area (it pushes the lesson down; it never overlays it). `surface.sunken`, `borderWidth.thin` `border.strong` rule below. Padding `spacing.xs` vertical and the layout gutter (16, 24, 32 by class) horizontal. Pinned while the lesson scrolls |
| Text | "Preview. Nothing is saved." Body (18) semibold `text.primary`. It takes the free width and wraps beside the button (two lines at 320) |
| Button | inside a lesson only: [ Leave preview ], `Button` ghost, compact padding (`spacing.xs` x `spacing.lg`), 64 tall, never shrinks. It opens the leave confirm (`preview-player.md`) |
| End screen | text only; the bar keeps `touchTarget.min` (64) as its height |

Heights measured on the mock: 73 at 375 and 1280, 82 at 320, 203 at 320 with 200 % text. The learner close control starts 4 below the bar at every size.

## Rules

- **Not dismissable.** No close on the strip itself.
- **Pair.** `text.primary` on `surface.sunken` (an existing pair), with the ghost `brand.primary` on sunken that `contrast.test.ts` pins (RouteMarkers D8). No new token.
- **Announcement.** A `status` region, announced once when a screen gains focus, not on every render (§7).
- **Never covers the lesson.** It is never over the lesson's close control, a game's targets or the "Quick check" dots, because it is outside their layout.
- **No motion.** It adds no animation (reduced motion needs nothing).
