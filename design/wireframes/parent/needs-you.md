# Parent/Needs-you — the family's approvals first, a status and a class line on each child (wireframe v1)

Spec: `docs/specs/AMENDMENTS-GROWNUP-UX.md` section 7 (rows GX-4, GX-5, GX-11) · `AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md` TV-D5, TV-D10 · F-SPACE-002 §4.8 (family badge)
Revises: `design/screens/app-shell/parent-home.md` (order of the family block), `design/wireframes/console/class-transfer.md` (family entry point)
Audience: **parent / caregiver** on `/parent`

## Scenario (Given-When-Then)

Given: a parent opens `/parent` on a phone; one child's class move waits for the family's OK, another child is asking to continue on a new device, and a class-scope update is unread
When: the page loads (or the next quiet load lands)
Then: the first screen shows a **Needs you** strip with three rows, each with one button, above the children; each child card says which class the child is in and carries a chip for anything waiting

## Screen goal

"Show what only the family can answer, first, and let the parent answer it in one or two taps."

## Box diagram: parent home, phone (360)

```
+--------------------------------------------+
| Parent                [Aa] [Learner app >] |
| [ Home (•) ] [ Lessons ] [ Lecture ] [ Billing ] |  <- dot; name "Home, 3 to check"
|                                            |
| Kim family                                 |
|                                            |
| Needs you                                  |  <- role=region, amber bar per row
| |(o) A class move for Jun needs your OK.   |
| |    New class: Evening D · Ends in 9 days |
| |                         [[ REVIEW ]]     |  -> consent sheet (shipped) directly
| |(o) Mina wants to continue on a new device.|
| |    7 min left     [[ APPROVE ]] [ Deny ] |
| |(o) Read what Jun's teachers can see.     |
| |                         [[ READ AND OK ]]|  -> class-scope sheet
|                                            |
| [ Mina moved to a new class: Evening D. OK ] |  <- TV-D10 notice card, unchanged
|                                            |
| +----------------------------------------+ |
| | (o) Mina   ( New device asking )       | |  <- chip = button, runs the strip's action
| |     In: Sunday Class A                 | |  <- class line
| |     Practiced 4 of the last 7 days · 36 min | |  <- GX-11
| |     [■■■■□□□]                          | |  <- fill only
| |     Next: Meet the Letters 3           | |
| |  [ Report ] [ Learning Route ] [ Note ]| |
| +----------------------------------------+ |
| | (o) Jun    ( Move: your OK needed )   | |
| |     In 2 classes                       | |
| |     Sunday Class A · Saturday Class    | |
| |     A 5-minute quest is a good restart.| |
| +----------------------------------------+ |
| | (o) Sora                               | |
| |     Family only                        | |
| |     Not started yet. Open the app on   | |
| |     Sora's device. [ Open the app ... ]| |
| +----------------------------------------+ |
| [ Lecture mode card ]                      |  <- after the last child with 2+ learners (P3)
+--------------------------------------------+
```

## Box diagram: class-scope sheet

```
+--------------------------------------------+
| An update about Jun's classes     [ Close ]|
| (CLASS_SCOPE_TEXT lines, verbatim)         |
| What a teacher sees:                       |
|  - ... every item, always open ...         |
| Until you press OK, teachers see what they |
| saw before.                                |
|                              [[ OK ]]      |
+--------------------------------------------+
```

## Interaction points

- [[ REVIEW ]] → the shipped consent sheet for that transfer (Agree / Not now); on Agree the row leaves and the child chip turns to **Moving {date}** when a date is set.
- [[ APPROVE ]] / [ Deny ] → `POST /:familyId/relink-requests/:rid/approve|deny`; result line (family denial: "…will say "ask your grown-up".").
- [[ READ AND OK ]] → class-scope sheet; [[ OK ]] → `POST …/learners/:learnerId/class-scope`; the row and the chip leave.
- Child chip (action) → the same action as its strip row.
- Re-link pop-up (GX-5): when a quiet load finds a new re-link id, the alertdialog of `console/approvals.md` opens (Approve / Deny / Later).

## Navigation graph

Enter from: the nav Home tab (dot) · sign-in · the learner app's Grown-up area hand-off
Exit to: `console/class-transfer` (family transfers page) · `parent/learner-detail` (report) · `parent/learning-route` · `console/notes-hub`

## States

- **nothing waiting**: no strip, no dot; children start right under the heading.
- **waiting** (above); rows newest first.
- **loading**: the shipped skeleton; the strip renders only once its three reads answer (a failed read adds no row).
- **error**: a failed decision keeps the row with "didn't go through" and [ Try again ].
- **no children**: the shipped empty family state, plus the line "Each learner joins with this code on their own device." (GX-14).

## Data needs

- reads: `GET /:familyId/transfer-requests` (role `learner_side`, and `options[].classes` for the class line), `GET /:familyId/relink-requests`, `GET /:familyId/class-scope`, `GET /:familyId/class-moves` (notices), roster summaries (shipped)
- writes: shipped consent, relink decisions, class-scope acknowledgement, notice seen
- telemetry: none added

## Open questions

- GX-OD-3 (class-scope text in a sheet instead of an always-shown card): default yes, text unchanged.
