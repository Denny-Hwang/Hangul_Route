# Parent/Needs-you — the family's approvals first, a status and a class line on each child (wireframe v2)

Spec: `docs/specs/AMENDMENTS-GROWNUP-UX.md` section 7 (rows GX-4, GX-5, GX-5b owner-blocked, GX-11; v2 after the PR #917 review) · `AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md` TV-D5, TV-D10 · F-SPACE-002 §4.8 (family badge)
Revises: `design/screens/app-shell/parent-home.md` (order of the family block), `design/wireframes/console/class-transfer.md` (family entry point)
Audience: **parent / caregiver** on `/parent`

## Scenario (Given-When-Then)

Given: a parent opens `/parent` on a phone; one child's class move waits for the family's OK, another child is asking to continue on a new device, and a class-scope update is unread
When: the page loads (or the next quiet load lands)
Then: the first screen shows a compact **Needs you** strip (the soonest-closing item in its own row, the other two folded into "2 more things need you · See all") and still the first child's name and week line; each child card says which class the child is in and carries a status chip (text) for anything waiting

## Screen goal

"Show what only the family can answer, first, and let the parent answer it in one or two taps."

## Box diagram: parent home, phone (360)

```
+--------------------------------------------+
| Parent                [Aa] [Learner app >] |
| [ Home (3) ] [ Lessons ] [ Lecture ] [ Billing ] |  <- number on screen; name "Home, 3 to check"
|                                            |
| Kim family                                 |
| Needs you                                  |  <- role=region; compact rows, amber bar per row
| |(o) Mina wants to continue on a new device.|  <- soonest-closing item keeps its row
| |    7 min left     [[ APPROVE ]] [ Deny ] |
| |2 more things need you     [[ SEE ALL ]]  |  <- fold rule: 3+ items; See all -> sheet of all items
|                                            |
| +----------------------------------------+ |
| | (o) Mina   (New device · needs your OK) | |  <- status chip = text (span), no amber card border
| |     In: Evening Class D                | |  <- class line (omitted when its read is skipped)
| |     Practiced 4 of the last 7 days · 36 min | |  <- GX-11; on the first screen at 360 x 740
| |     [■■□■■□□]                          | |  <- fill only
| |     Next: Meet the Letters 3           | |
| |  | Mina moved to a new class:        | | |  <- TV-D10 notice, now inside its child's card
| |  | Evening Class D.          [ OK ]  | | |
| |  [ Report ] [ Learning Route ]         | |
| +----------------------------------------+ |
| | (o) Jun    (Class move · needs your OK) | |
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

- With 1 or 2 items every item has its own compact row: "A class move for Jun needs your OK. · New class: Evening Class D · Ends in 9 days [[ REVIEW ]]", "Read what Jun's teachers can see. [[ READ AND OK ]]".
- Measured on the mock (Chromium, 360 x 740, three items and the notice): the first child's name starts at 516 px (en, es) / 495 px (ko); the week line ends at 638 / 659 / 582 px.

## Box diagram: class-scope sheet (proposed; owner-blocked on GX-OD-3, row GX-5b)

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
- [[ SEE ALL ]] → the items in the review-sheet frame (title "Needs you"), each with its own action.
- [[ APPROVE ]] / [ Deny ] → `POST /:familyId/relink-requests/:rid/approve|deny`; result line (family denial: "…will say "ask your grown-up".").
- [[ READ AND OK ]] → until the owner answers GX-OD-3, scrolls to and focuses the shipped class-scope card; with GX-5b, the class-scope sheet; [[ OK ]] → `POST …/learners/:learnerId/class-scope`; the row and the chip leave.
- Child chip → no action (a status span); the strip owns the buttons.
- Re-link pop-up (GX-5): when a quiet load finds a new re-link id, the alertdialog of `console/approvals.md` opens (Approve / Deny / Later).

## Navigation graph

Enter from: the nav Home tab (count) · the parent re-link bar on other parent pages · sign-in · the learner app's Grown-up area hand-off
Exit to: `console/class-transfer` (family transfers page) · `parent/learner-detail` (report) · `parent/learning-route` · `console/notes-hub`

## States

- **nothing waiting**: no strip, no nav count; children start right under the heading.
- **waiting** (above); rows by soonest expiry, then oldest first; 3+ items fold.
- **loading**: the shipped skeleton; the strip renders only once its three reads answer (a failed read adds no row).
- **error**: a failed decision keeps the row with "didn't go through" and [ Try again ].
- **no children**: the shipped empty family state, plus the line "Each learner joins with this code on their own device." (GX-14).

## Data needs

- reads: `GET /:familyId/transfer-requests` (role `learner_side`, and `options[].classes` for the class line; skipped while class moves are hidden or locked, then no class line), `GET /:familyId/relink-requests` (also every 20 s while visible), `GET /:familyId/class-scope`, `GET /:familyId/class-moves` (notices), roster summaries (shipped)
- writes: shipped consent, relink decisions, class-scope acknowledgement, notice seen
- telemetry: none added

## Open questions

- GX-OD-3 (class-scope text in a sheet instead of an always-shown card): owner-blocked, no default applied (a consent surface); the shipped card stays until the owner answers.
