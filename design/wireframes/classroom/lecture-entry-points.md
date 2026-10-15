# Classroom/Lecture-entry-points — where teachers and parents find Lecture mode (wireframe v1)

Spec: `docs/specs/AMENDMENTS-LECTURE-V2.md` section 3 (E1-E8), section 7 (child safety) · amends `shell/teacher-home.md` (Panel A), `shell/parent-home.md` (Panel A), `shell/adult-frame.md` (nav registry), `site/teachers.md`, `site/parents.md`
Audience: **teacher; parent or caregiver; a visitor on hangulroute.com**
Routes: `/teach/home`, `/parent`, every console page (nav), the learner app's grown-up area (after the gate), `hangulroute.com/teachers`, `/parents`
Mock: LV-0b (`design/screens/app-shell/` lecture card and nav; `design/screens/lecture-entry/learner-card.md`)

## Scenario (Given-When-Then)

Given: a teacher or a parent signs in, or a parent opens the grown-up area of the learner app on the family tablet
When: their home opens
Then: a Lecture mode card ("Teach on a big screen") is at the top, and the navigation has a Lecture mode item, so the feature is found without opening a class or a family first

## Screen goal

"Start lecture mode." (secondary: choose which class or family)

## Box diagram

Panel E1 — teacher home `/teach/home`, phone 375: the card above Classes

```
+-----------------------------------+
| [frame: Teacher · Back to learning]|
| Classes | Lessons | Lecture mode | Billing   <- E3 nav item
|-----------------------------------|
| +-------------------------------+ |
| | (presenter icon) Lecture mode | |  <- h2
| | Teach on a big screen         | |
| | Show a ready lesson on a      | |
| | projector or TV: big letters, | |
| | sounds and a few questions.   | |
| | Nobody's progress changes.    | |
| | Which class?                  | |  <- only with 2+ classes
| | (•Class 2B) ( Saturday class )| |  <- radio rows, most recent first
| | [[   START LECTURE MODE    ]] | |  -> /teach/space/lecture?id= (presets first)
| +-------------------------------+ |
|  Classes (heading)   [ + New class ]
|  ... (unchanged)                  |
+-----------------------------------+
```

- One class: no choice row. No class: the card says "No class needed: you can still show a lesson." and Start opens `/present` in a new tab.

Panel E2 — family home `/parent`, phone 375: the same card above the learner cards, family body line

```
+-----------------------------------+
| [frame: Family · Back to learning] |
| Home | Reports | Notes | Lessons | Lecture mode | Billing
|-----------------------------------|
|  Family name (heading)            |
| +-------------------------------+ |
| | (presenter icon) Lecture mode | |
| | Teach on a big screen         | |
| | Put a lesson on your TV and   | |
| | learn together at home. No    | |
| | setup needed.                 | |
| | [[   START LECTURE MODE    ]] | |  -> /parent/space/lecture?id= (presets first)
| +-------------------------------+ |
|  [learner card] ...               |  <- unchanged; first learner card still fits below at 375 x 667? (see Open questions)
+-----------------------------------+
```

Panel E1/E2 wide (1180): the card sits in the right-hand action column of the home (`parent-home.md` Panel B), first in that column; on the teacher home it spans the content column above Classes.

Panel E3 — the nav item (both personas): after Lessons, before Billing; highlighted on any `/…/space/lecture` page

```
| Home | Reports | Notes | Lessons | [Lecture mode] | Billing |
```

Panel E4 — space page action row (unchanged place, new name and weight)

```
| [[ Plan this week ]] [[ Lecture mode ]] [ Plan the term ] [ Relink requests ] ... |
```

Panel E5 — learner app, grown-up area (`ParentDashboardScreen`, after the gate; web only)

```
+-----------------------------------+
| Grown-ups (heading)               |
| [GrownUpHomeCard]                 |
| +-------------------------------+ |
| | Lecture mode                  | |
| | Show a lesson on a TV or big  | |
| | screen and learn together.    | |
| | Nobody's progress changes.    | |
| | ( Next lesson for Mina     >) | |  <- one row per learner on this device; name on this screen only
| | ( Next lesson for Jun      >) | |
| | [ Open lecture mode ]         | |  -> /present (presets home)
| +-------------------------------+ |
| [learner sections ... unchanged]  |
+-----------------------------------+
```

- A row opens `/present#d=<deck>` (the learner's next lesson; the deck holds quest ids only, no name). After the grown-up session lapses, a press asks for the PIN again (`gateOpensDirectlyNow`).

Panel E7 — site lines (claim lines, F-SITE-002 §3.9; no link to the app)

```
/teachers  See how the class is doing
           - ... (existing lines)
           - Lecture mode: teach from the front on a projector or TV, with ready-made lessons.
/parents   Follow along
           - ... (existing lines)
           - Lecture mode puts a lesson on your TV so you can learn together.
```

## Interaction points

- [[ Start lecture mode ]] → the space's lecture page (presets first, `classroom/lecture-presets.md` F); with no space → `/present` in a new tab.
- Class / family choice rows → select (radio group); Start uses the selection.
- Nav "Lecture mode" → the single composable space's lecture page; with zero or several → the persona home scrolled to the card (`#lecture-mode`), focus on the card heading.
- E5 rows → `/present#d=…` same tab; [ Open lecture mode ] → `/present` same tab.
- Nothing in E1-E7 is drawn while `lectureModeEnabled()` is off (kill switch); never a disabled control.

## Navigation graph

Enter from: sign-in router · persona switch · frame name · the learner app's grown-up gate (E5) · hangulroute.com persona pages (E7 is text only)
Exit to: `/teach/space/lecture?id=` · `/parent/space/lecture?id=` · `/present` · `/present#d=…` (lesson start screen)

## States

- **success**: Panels E1-E7.
- **no space** (teacher with no class, parent with no family): the card's no-space line; Start opens `/present`.
- **several spaces**: the choice row; the most recent first.
- **loading**: the card shows its title and line; Start waits for the spaces list (spinner in the button, no layout jump).
- **error** (spaces failed): the card stays with Start opening `/present`; the home's own error notice is unchanged.
- **flag off**: no card, no nav item, the space button hidden; the site lines hidden (claim off).
- **native app** (E5): the card is not drawn (the presenter is a web root).

## Data needs

- Console: the spaces list the homes already load (`listSpaces`; kind, role, id, name), `lectureModeEnabled()`.
- Learner app: profiles on this device (names for the grown-up screen only), `routeNext` per profile, the gate state.
- Site: `SITE_CLAIMS.lectureMode`.

## Open questions

- Family home at 375 x 667: with the card above them, the first learner card may no longer fit whole on the first screen (`parent-home.md` asks for it). The LV-0b mock measures it; if it does not fit, the card moves below the first learner card on narrow screens only (the nav item stays).
