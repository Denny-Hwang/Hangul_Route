# Who is using this? (screen spec, OA-0b)

Spec: AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 5.3, 6.1 to 6.3, 10.6, 12, 14, 17.1, 17.2 · wireframe `design/wireframes/profiles/who-is-using.md` (Panels A to K) · mocks `mock/who-is-using.html` (boards 1 to 15), `mock/who-is-using-largest.html` (board 16) · shots `shots/who-is-using-320.png`, `-1280.png`, `-320-text200.png`, `who-is-using-largest-*.png` · components `design/components/WhoTile/spec.md`, `design/components/GrownUpRow/spec.md` · rows OA-4a, OA-4b, OA-5

Audience: learners first (any age), grown-ups second. Route `WhoIsUsing`, root stack above `Main`, no Back, the Android hardware back swallowed.

## Anatomy (top to bottom)

1. `ScreenHeader` with only the Display (Aa) control.
2. Title **Who is using this?** (`learner.who.title`, `size.title` with the heading half rule, `text.primary`); focus starts here (`tabindex -1`, no ring).
3. Optional line under the title, one of: **Pick who is joining.** (`joinCaption`, `size.bodyLg` semibold; a held join code, board 7) or **Tap a name, then a grown-up enters the PIN.** (`locksUnread`, `text.secondary`; board 5).
4. **Learning** (`learner.who.learning`, `size.body` bold `text.secondary`) and the tile grid (`WhoTile`): learner tiles in creation order (by name from 13, board 15), then **Add a learner**.
5. A `borderWidth.thin` `border.subtle` rule, then **Grown-ups** (`learner.who.grownUps`): the pending-wait box when a wait runs (board 6), then the rows (`GrownUpRow`): known uses in the order Family, Teacher, School, then the Grown-up area (web); **Sign in as a grown-up** instead of the uses when none is known (board 3); native shows the Grown-up area only (board 2).

Screen: `surface.canvas`, side padding `layout.gutter`, `spacing.lg` between blocks; `layout.maxWidth.reading` on phones and `layout.maxWidth.full` on a wide window (the classroom board).

## Boards

| # | State | Notes |
|---|---|---|
| 1 | phone, web, uses Family and Teacher | Mina and Jun share the orange cub: tinted `letters`, `crafts`; Sora locked; Leo (class-scoped on this device, section 10.6) is a tile like any other |
| 2 | native | Grown-up area only |
| 3 | web, no known use | Sign in as a grown-up, Grown-up area |
| 4 | offline (web) | Family, Teacher and School disabled with Needs the internet; Grown-up area enabled |
| 5 | locks unreadable, PIN present | every tile badged, one line, no per-tile caption |
| 6 | Forgot PIN wait running | the pending box with Cancel the wait |
| 7 | held join code | caption Pick who is joining.; picking a learner opens Join prefilled |
| 8 | `nopin` | Grown-up area caption A grown-up sets a PIN here.; the row runs PIN setup first, so its name is the label alone |
| 9 | `none` (self-only, reached from Profile) | the zone name `Account & backup`, no lock glyph; Add a learner named without PIN required |
| 10 | over a quest after 30 min | the quest is held under; Mina continues it, any other pick saves it first |
| 11 | six profiles on one cub | the five tints, then they repeat |
| 12 | profile store unreadable | Hoya, the existing calm line, Try again; never wipes |
| 13 | Home | the Switch button between Display and Profile, 73 x 64 (D7) |
| 14 | states | tile default, pressed, focus, locked, Add; row default, pressed, focus, disabled, and Sign in as a grown-up disabled offline (web, no use known) |
| 15 | tablet 1180, 26 learners | by name, six per row, rows three across, School row |
| 16 | Largest text, 360 | one column; rows wrap their captions |

## Behaviour drawn

- Tile: `setActive`, Home within 300 ms. Locked tile: `PinEntry { next: 'LockedProfile' }`, titled with the learner's name (`pin-entry-v2.md` board 4). Rows: `PinEntry { next: 'GrownUpUse', use }` titled with the row label, or the Grown-up area as today. Add a learner: the gate, then create profile.
- Arriving here closes the grown-up session; nothing on the screen shows it.
- The active learner is focused first on a resume over a screen, never highlighted (no comparison).

## Accessibility

- Reading order: title, the optional line, Learning and its tiles in tile order, Add a learner, Grown-ups, the pending box, the rows. Tile names `a11y.who.tile(name)` / `lockedTile(name)`; row names `a11y.who.grownUpRow(label)`, or the label alone on `nopin` (entering runs PIN setup first, F-PROF-001 section 10, so the name does not promise a PIN check) and on `none` (it opens directly); the Add a learner tile is named as the shipped Profile add (`gatedA11y`): "PIN required" on a family device, `nopin` included, plain on `none` (board 9); a row's caption (Needs the internet, the `nopin` caption) is its description (`accessibilityHint`, `aria-describedby`), never joined into the name. The Home Switch is named `learner.who.switch` with `learner.who.title` as its hint.
- Web: the grid is one tab stop (roving `tabindex`: the first tile, or the active learner's on a resume, is `0`, every other tile `-1`) with arrow keys, Home and End; rows are buttons in order.
- The lock is a glyph and a caption (or the screen line), never colour alone; tints are never the only cue (the name is).
- No time limit; reduced motion: no pose animation.
