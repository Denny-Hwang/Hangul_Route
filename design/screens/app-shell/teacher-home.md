# /teach/home: the teacher home (design mock v1, for A-5a)

Wireframe: `design/wireframes/shell/teacher-home.md` (Panels A, B) · spec §3.8 (teacher home) · mock: `mock/teacher-home.html`, `mock/teacher-home-states.html` · shots: `shots/teacher-home-375.png`, `-1280.png`, `-320-text200.png`, `teacher-home-states-375.png`, `-1280.png`

Today's `/teach/home` with the Family group removed (families live under Family). One reading column (`layout.maxWidth.reading`) inside the frame.

## Panel A (reports, notes and lessons on)

```
 Classes (h1)                         ( + New class )   -> /start?persona=teacher
 +-------------------------------------------------+
 | Saturday class                      ( Open -> ) |    name bold, status line "12 students"
 | 12 students                                      |
 |-------------------------------------------------|    ruled line, border.subtle
 | ( Class report )  ( Notes )                      |    each only when its flag is on
 +-------------------------------------------------+
 | Beginners B · 0 students ...                     |
 | Spring class (archived) · 9 students ( Open -> ) |    archived: surface.sunken, text.secondary, no links (D8)
 School (h2)
 | Riverside school · 4 classes        ( Open -> ) |
 ( Lessons )                                            browseEntryEnabled()
 Learning at home too? Set up a family space            or "Your family is under Family" (switch)
```

- Status lines and order are today's (`statusLine`, most recent first); "Hi, {name}" is dropped (README, D8).
- Class report → `/teach/space/report?id=`; Notes → `/teach/space/notes?id=`. A school row has no Class report or Notes.

## States

| State | Drawn |
|---|---|
| Flags off | rows with Open only; no ruled line |
| B · no teacher persona | one panel: h1 "You don't have a class yet.", **Set up a class** (primary) → `/start?persona=teacher`, **Go to Family** only with the family persona |
| Teacher persona only through archived spaces | the archived rows, **+ New class** as the primary, the cross-link |
| Spaces fetch failed | h1 and a panel "Can't reach the console right now." with Try again ("Showing the last list we loaded." when an older list is kept, as today); the frame shows no nav |

## Tokens

| Part | Tokens |
|---|---|
| h1 | `size.title` bold; + New class: secondary button `size.bodySm` (primary in the archived-only state) |
| Row | `surface.paper`, `borderWidth.thin` `border.subtle`, `radii.lg`, padding `spacing.md` `spacing.lg`; rows `spacing.sm` apart |
| Name / status | `size.body` bold / `size.bodySm` `text.secondary` |
| Link line | top `borderWidth.thin` `border.subtle`, padding-top `spacing.sm`, buttons `spacing.sm` apart |
| Archived row | `surface.sunken`; name `text.secondary`, "(archived)" `text.muted` |
| Group heading | `size.bodyLg` bold |

## Accessibility

Buttons and links are at least 64 x 64; Tab order is row by row (name's Open, then the row's links); at 320 with 200 % text the row's Open wraps under the name, never sideways (`teacher-home-320-text200.png`).
