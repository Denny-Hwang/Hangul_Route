# Console/Approvals — status chip, attention banner, review sheet, re-link pop-up, home and nav badges (wireframe v1)

Spec: `docs/specs/AMENDMENTS-GROWNUP-UX.md` sections 3 to 6 (rows GX-1, GX-2, GX-3) · F-TCH-001 §10.1 (re-link) · F-SPACE-002 §4.8 and `AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md` TV-D8 (moves)
Supersedes on these points: `console/roster.md` (the "[ 1 re-link request ]" chip), `console/relink-approval.md` ("Enter from" list), `console/class-transfer.md` (the roster chip and home badge)
Audience: **teacher** (class space), **school admin** per class; the family roster uses the same chip and banner (no default chip)

## Scenario (Given-When-Then)

Given: a teacher has a class page open on a phone while a student on a new tablet asks to re-link, and another teacher has sent a learner to this class
When: the next poll lands (10 s while a re-link is waiting)
Then: the teacher sees, without scrolling, a banner "2 requests need your OK", a pop-up for the new device, and an amber **Needs your OK** chip next to the student's name with Approve and Deny on the card; every other student shows **In class**

## Screen goal

"Never miss a request that needs the teacher, and answer it where it is shown, in one tap."

## Box diagram: class page, phone (360), something waiting

```
+--------------------------------------------+
| [< Back to Classes]                        |
| Sunday Class A                 12 students |  <- title row
|                                            |
| |! 2 requests need your OK                 |  <- banner: role=status, amber bar at the start
| |  1 new device · 1 class move             |
| |                     [[ REVIEW NOW ]]     |  -> review sheet
|                                            |
|  This week ...                             |  <- unchanged in GX-1/2 (order of GX-7 later)
|  [ Plan: Route · 26 wk ] [ ... pills ... ] |
|                                            |
|  Students                                  |
| +----------------------------------------+ |
| | (o) Jaehan  [ NEEDS YOUR OK ]  level   | |  <- action chip = button, amber; card border amber
| |     New device · 8 min left            | |  <- reason line
| |  [[ APPROVE ]]   [ Deny ]              | |  <- inline, api.decideRelink
| |  Last active Thu · 2 min this week ... | |
| +----------------------------------------+ |
| +----------------------------------------+ |
| | (o) Yuhan   (* In class)       level   | |  <- quiet chip, success-light, dot
| |  ...                                   | |
| +----------------------------------------+ |
| +----------------------------------------+ |
| | (o) Mina    ( New )            level   | |  <- info-light
| |     Hasn't opened the app yet          | |
| +----------------------------------------+ |
| +----------------------------------------+ |
| | (o) Suji    ( Move waiting )   level   | |  <- sunken, no action
| |     Waiting for: Evening Class D       | |
| +----------------------------------------+ |
+--------------------------------------------+
```

- Action cards first (newest request first), then the shipped order. The chip wraps under the name below 45em; it never truncates the name.
- A base-scope learner (TV-D3) has the shipped muted line "Words and more show once the family has read the update." under the header; it is never a chip.

## Box diagram: review sheet (phone: bottom sheet; from 45em: centred dialog)

```
+--------------------------------------------+
| Needs your OK                      [ Close ]|
|                                            |
| New devices                                |
|  (o) Jaehan · New device · 8 min left      |
|      [[ APPROVE ]]   [ Deny ]              |
|                                            |
| Asking to join this class                  |
|  (o) J.K. · Some reading · From Class B    |  <- initials only until accepted (T8)
|      [[ ACCEPT ]]    [ Not now ]           |  <- primary first, same order everywhere
|                                            |
| Moves out of this class                    |
|  (o) Suji · Class move: Evening Class D    |
|      [ Review ]                            |  -> shipped consent card inside the sheet
+--------------------------------------------+
```

## Box diagram: re-link pop-up (alertdialog, new request id only)

```
+--------------------------------------+
| New device request: Jaehan           |  <- focus here
| Approve only if Jaehan is with you   |  <- shipped relinkApproveHint
| or you expect this.                  |
| This request closes in 8 min.        |
|                                      |
| [[ APPROVE ]]  [ Deny ]  [ Later ]   |  <- Esc = Later
+--------------------------------------+
```

## Box diagram: teacher home row and nav (360)

```
+--------------------------------------------+
| Teacher                     [Aa] [Learner app >] |
| [ Classes (•) ] [ Lessons ] [ Lecture ] [ Billing ] |  <- dot; name "Classes, 2 need your OK"
|                                            |
| Classes                       [ + New class ] |
| +----------------------------------------+ |
| | Sunday Class A  [ 2 need your OK ]     | |  -> /teach/space?id=…#attention (sheet opens)
| | 12 students                  [ Open ] | |
| +----------------------------------------+ |
| | Beginners B                            | |  <- nothing waiting: no chip
| | 0 students                   [ Open ] | |
| +----------------------------------------+ |
+--------------------------------------------+
```

## Interaction points

- [[ REVIEW NOW ]] → the review sheet; focus moves to its title; Close / Esc returns focus to the button.
- Action chip [ NEEDS YOUR OK ] → the sheet, scrolled to that learner's item.
- [[ APPROVE ]] (card, sheet or pop-up) → `POST …/relink-requests/:rid/approve`; result line `console.relink.approved` for 5 s; chip turns to **In class**; counts drop at once.
- [ Deny ] → `…/deny`; result line `console.relink.denied`; chip turns to **In class**.
- [[ ACCEPT ]] / [ Not now ] → the shipped teacher-move or transfer decision (Not now on a transfer keeps its reason step); the item leaves; the learner appears on the roster after an accepted move.
- [ Review ] (move out) → the shipped consent card (Agree / Not now) inside the sheet.
- [ Later ] → closes the pop-up; the id is stored as shown for this tab session; chip and banner stay.
- Home chip → class page with `#attention`.

## Navigation graph

Enter from: `console/home` (row chip, nav dot) · `console/school-admin` (class link count) · a direct link · the pop-up (on the page itself)
Exit to: `console/relink-approval` (unchanged page, still reachable from More) · `console/class-transfer` (moves page) · `console/roster` (same page)

## States

- **nothing waiting**: no banner, no pop-up, every class learner shows **In class** (family: no chip); the home row has no chip; no nav dot.
- **waiting** (above).
- **expired while open**: the re-link chip and item vanish at the next poll; an Approve answering `409 expired` shows the shipped expired line on the card, then the chip turns to **In class**.
- **loading**: the roster's skeleton; chips render only after the lists arrive (no flash of **In class** before a waiting chip: the chip slot stays empty until the model is built).
- **error**: a list that fails adds nothing (never a guessed chip); a decision that fails keeps the item with the shipped "didn't go through" line and [ Try again ].
- **empty class**: the banner can still show incoming moves; the roster is empty.

## Data needs

- reads: `GET /:id/roster` (with `pending`, `incoming` once GX-W is deployed), `GET /:id/relink-requests`, `GET /:id/transfer-requests`, `GET /:id/class-moves`; home: `GET /api/spaces` (`attention` once GX-W is deployed)
- writes: the shipped relink approve / deny, class-move accept / decline, transfer approve / decline; `sessionStorage` `hr:console:relinkShown` (request ids)
- telemetry: none added

## Open questions

- None blocking. Owner choices with defaults: amendment section 15 (GX-OD-1 In class shown; GX-OD-4 no join approval; GX-OD-6 pop-up on).
