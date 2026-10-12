# /parent: the family home (design mock v1, for A-5b)

Wireframe: `design/wireframes/shell/parent-home.md` (Panels A, A', B, C, D) · spec §3.8 (family home), §3.17 (anti-shame), §3.19 · mock: `mock/parent-home.html`, `mock/parent-home-states.html` · shots: `shots/parent-home-375-first.png`, `-320.png`, `-375.png`, `-1280.png`, `-320-text200.png`, `parent-home-states-375.png`, `-1280.png`

## Phone (Panel A, every sibling flag on)

```
 [frame: ( Family | Teacher )  (< Back to learning)]
 [ Home | Reports | Notes | Lessons | Billing ]
  Kim family                                  h2, size.title (h1 "Family home" visually hidden)
 +------------------------------------+
 | (o) Sam                             |     AvatarChip 28 + name, size.bodyLg bold (h3)
 | Last active today                   |     text.secondary, size.bodySm
 | Minutes, last 7 days: 42            |     a count: no bar, no target, no comparison
 | [[          See report          ]]  |     primary, full width
 | ( Send a note ) ( Learning Route )  |     secondary, side by side, wrap
 +------------------------------------+     whole first card visible at 375 x 667 (ends at 476)
 +------------------------------------+
 | (o) Mina   ...                      |     join order, never activity
 +------------------------------------+
 [ Lessons ] [ Plan the week ]                family actions: equal buttons in a grid
 [ Plan the term ] [ Family settings ]
 [ Add a learner ]
 Your classes are under Teacher              cross-link (switch); "Also teach a class? Set up a class" without the teacher persona
```

## Wide (Panel B)

Cards in two columns (`minmax(18rem, 1fr)`) and a 400 px side column (`layout.pane.master`) with the family actions and the cross-link, `spacing.xxl` apart. Tab order: card by card, then the side column.

## Card actions by flag

| Flag | Card |
|---|---|
| `reportsEnabled()` on | **See report** (primary) → `/parent/space/learner?id=&learner=` |
| off | **Open** (primary) → `/parent/space?id=` (the family roster) |
| `notesEnabled()` | **Send a note** → `/parent/space/notes?id=` |
| `learningRouteEnabled()` | **Learning Route** → `/parent/space/route?id=&learner=` |
| `browseEntryEnabled()` | **Lessons** first among the family actions (a button: the lesson browser window) |

With every flag off (today) a card is: chip, name, the two lines and **Open** (`parent-home-states`, A').

## States

| State | Drawn |
|---|---|
| C · family without learners | family heading, "No learner has joined yet.", the join panel (label "Family code", the code in `size.display` monospace, Copy), the line `On the learner's own device, open "Join a class" and enter this code.`, **Open the app on this device** (primary, at most 400 px), then the family actions and the cross-link |
| D · no family persona | one panel: h1 "You don't have a family space yet.", **Set up my family** (primary) → `/start?persona=parent`, **Go to Classes** only with the teacher persona. Nothing else on the page |
| Loading | the heading line and two card outlines in `surface.sunken`, no numbers, `aria-busy` |
| One family failed | that family's heading and a panel "Can't reach the console right now." with Try again; the other family renders |
| Two families | one section each, in creation order |

## Tokens

| Part | Tokens |
|---|---|
| Family heading | `size.title` bold `leading.tight` |
| Card | `surface.paper`, `borderWidth.thin` `border.subtle`, `radii.lg`, `shadows.card`, padding `spacing.lg`, parts `spacing.md` apart |
| Chip | `AvatarChip` (28, the cub's `furDark`, accessible name the cub name) |
| Facts | `text.secondary` `size.bodySm`, `spacing.xxs` apart |
| See report / Open | primary: `brand.primary` / `text.onPrimary`, `radii.pill`, `touchTarget.min`, `size.body` bold |
| Secondary actions | `surface.paper`, `borderWidth.thin` `border.strong`, `radii.pill`, `touchTarget.min`, `size.bodySm` bold |
| Join panel | `surface.paper`, `radii.lg`, padding `spacing.xl` `spacing.lg`; label `size.caption` semibold `text.muted`; code `family.mono` `size.display` bold, `tracking.wide` |
| Cross-link | text link `brand.secondaryDark`, `touchTarget.min` tall |
| No-family panel | `surface.paper` panel, h1 `size.prompt`, buttons `spacing.md` apart |

## Anti-shame and privacy

- Order is join order (`joinedAt`, then id) and never changes with activity; the minutes are labelled "last 7 days" and nothing marks more or fewer.
- No "best", "behind", ranking or class average; strings pass `banned-text.ts`.
- Links carry ids only (R-2); the name is on screen, never in a URL.
