# Console/Approvals — status chip, asking-to-join cards, attention banner, review sheet, re-link pop-up and bar, home and nav counts (wireframe v2)

Spec: `docs/specs/AMENDMENTS-GROWNUP-UX.md` sections 3 to 6 (rows GX-1, GX-2, GX-3; v3 after the second PR #917 review round) · F-TCH-001 §10.1 (re-link) · F-SPACE-002 §4.8 and `AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md` TV-D8 (moves)
Supersedes on these points: `console/roster.md` (the "[ 1 re-link request ]" chip), `console/relink-approval.md` ("Enter from" list), `console/class-transfer.md` (the roster chip and home badge)
Audience: **teacher** (class space), **school admin** per class; the family roster uses the same chip and banner (no default chip)

## Scenario (Given-When-Then)

Given: a teacher has a class page open on a phone while a student on a new tablet asks to re-link, another teacher has sent a learner to this class, and a family asked to move one of this class's students to another class
When: the next re-link read lands (every 20 s while the page is visible)
Then: the teacher sees a banner "3 requests need your OK", a pop-up for the new device, an **Asking to join this class** card with **Needs your OK** and Accept / Not now above the roster, and an amber **Needs your OK** chip next to each student a request is about, with its answer on the card; every other student shows **In class**

## Screen goal

"Never miss a request that needs the teacher, and answer it where it is shown: one tap for Deny, Accept and Not now; a new device is approved in the pop-up, next to the safety hint."

## Box diagram: class page, phone (360), something waiting (after GX-W)

```
+--------------------------------------------+
| [< Back to Classes]                        |
| Sunday Class A                  4 students |  <- title row
|                                            |
| |! 3 requests need your OK                 |  <- banner: role=status, amber bar at the start
| |  1 new device · 2 class moves            |     (text re-renders only when a count changes)
| |                     [[ REVIEW NOW ]]     |  -> review sheet
|                                            |
|  This week ...                             |  <- unchanged in GX-1/2 (order of GX-7 later)
|  [ Plan: Route · 26 wk ] [ More ]          |
|                                            |
|  Asking to join this class                 |  <- section 4.1; absent when nothing is incoming
| +----------------------------------------+ |
| | (o) J.K.  [ NEEDS YOUR OK ]    level   | |  <- initials only until accepted (T8); amber border
| |     From Class B                       | |
| |  [[ ACCEPT ]]   [ Not now ]            | |  <- primary first; shipped decisions
| +----------------------------------------+ |
|                                            |
|  Students                                  |
| +----------------------------------------+ |
| | (o) Jaehan  [ NEEDS YOUR OK ]  level   | |  <- action chip = button (pill-height, 64 px hit area), name
| |     New device · 8 min left            | |     "Needs your OK: New device · 8 min left"; tap opens the pop-up
| |  [[ APPROVE ]]   [ Deny ]              | |  <- Approve opens the pop-up (hint, platform, time; GX-D12); Deny one tap
| |  Practiced Thu · 2 min this week       | |
| +----------------------------------------+ |
| +----------------------------------------+ |
| | (o) Suji    [ NEEDS YOUR OK ]  level   | |  <- move_yours: a move out waits for this class;
| |     Moving to another class            | |     tap opens the sheet at this item ("Class move: {class}"
| |                                        | |     only when the destination name may be shown)
| |  [[ REVIEW ]]                          | |  -> the shipped consent card in the sheet
| +----------------------------------------+ |
| +----------------------------------------+ |
| | (o) Yuhan   (* In class)       level   | |  <- quiet chip, success-light, dot
| |  ...                                   | |
| +----------------------------------------+ |
| +----------------------------------------+ |
| | (o) Mina    ( New )            level   | |  <- info-light
| |     No practice shared yet             | |
| +----------------------------------------+ |
+--------------------------------------------+
```

- Action cards first, by soonest `expiresAt` (the re-link, closing in minutes, before the move); then the shipped order. A decided card keeps its place with its result line for 5 s, then re-sorts. The chip wraps under the name below 45em; it never truncates the name.
- Quiet states, never amber: **Move waiting** ("Waiting for: {class}") and **Waiting for a seat** on `surface.sunken`, **Moving {date}** on `feedback.infoLight`; no button.
- Before GX-W a family-started move out cannot be matched to a card (its source view has no `learnerId`): Suji then shows **In class**, and the move is counted in the banner and listed in the sheet's "Moves out of this class" by the view's own name. With GX-W she shows **Needs your OK** as above. One learner never shows two states.
- A base-scope learner (TV-D3) has the shipped muted line "Words and more show once the family has read the update." under the header; it is never a chip.

## Box diagram: review sheet (phone: bottom sheet; from 45em: centred dialog)

```
+--------------------------------------------+
| Needs your OK                      [ Close ]|
|                                            |  <- visually hidden polite region for result lines
| New devices                                |
|  (o) Jaehan · New device · 8 min left      |
|      [[ APPROVE ]]   [ Deny ]              |  <- Approve opens the pop-up (GX-D12)
|                                            |
| Asking to join this class                  |
|  (o) J.K. · Some reading · From Class B    |  <- initials only until accepted (T8)
|      [[ ACCEPT ]]    [ Not now ]           |  <- primary first, same order everywhere
|                                            |
| Moves out of this class                    |
|  (o) Suji · Moving to another class        |
|      [[ REVIEW ]]                          |  -> shipped consent card inside the sheet
+--------------------------------------------+
```

- After the last item clears: "Nothing is waiting." with focus on [ Close ]; the sheet never closes itself.

## Box diagram: re-link pop-up (alertdialog, new request id only)

```
+--------------------------------------+
| New device request: Jaehan           |  <- focus here
| iPhone or iPad · asked 2 min ago     |  <- platform and request time
| Approve only if this learner is with |  <- shipped relinkApproveHint
| you or you expect this device.       |
| This request closes in 8 min.        |
|                                      |
| [[ APPROVE ]]  [ Deny ]  [ Later ]   |  <- Esc = Later
+--------------------------------------+
```

## Box diagram: teacher home with the re-link bar and nav count (360)

```
+--------------------------------------------+
| Teacher                     [Aa] [Learner app >] |
| [ Classes (3) ] [ Lessons ] [ Lecture ] [ Billing ] |  <- number on screen (aria-hidden);
|                                            |     name "Classes, 3 need your OK"
| |! A new device needs your OK ·            |  <- re-link bar (section 5.5): every console page
| |  Sunday Class A                          |     but the class page, parent home, lecture, presenter
| |  8 min left               [[ REVIEW ]]   |  -> /teach/space?id=…#attention
|                                            |
| Classes                       [ + New class ] |
| +----------------------------------------+ |
| | Sunday Class A  [ 3 need your OK ]     | |  -> /teach/space?id=…#attention (sheet opens)
| | 4 students                   [ Open ] | |
| +----------------------------------------+ |
| | Beginners B                            | |  <- nothing waiting: no chip
| | 0 students                   [ Open ] | |
| +----------------------------------------+ |
+--------------------------------------------+
```

## Interaction points

- [[ REVIEW NOW ]] → the review sheet; focus moves to its title; Close / Esc returns focus to the button.
- Action chip [ NEEDS YOUR OK ] → a re-link: the pop-up for that request; a move out or an incoming card: the sheet, scrolled to that item.
- [[ APPROVE ]] on a card or in the sheet → opens the pop-up for that request (GX-D12). [[ APPROVE ]] in the pop-up → `POST …/relink-requests/:rid/approve`; result line `console.relink.approved` for 5 s; the chip falls to the learner's next state by priority (usually **In class**); counts drop at once.
- [ Deny ] (card, sheet or pop-up, one tap) → `…/deny`; result line `console.relink.denied`; the chip falls to the next state (usually **In class**).
- [[ ACCEPT ]] / [ Not now ] → the shipped teacher-move or transfer decision (Not now on a transfer keeps its reason step); the item leaves; the learner appears on the roster after an accepted move, usually as **In class** (a moved learner already shares a summary).
- [ Review ] (move out) → the shipped consent card (Agree / Not now) inside the sheet.
- [ Later ] → closes the pop-up; the id is stored as shown for this tab session; chip and banner stay. At 2 minutes left the pop-up opens once more for that request (never a third time).
- Home chip and re-link bar [[ REVIEW ]] → class page with `#attention`.

## Navigation graph

Enter from: `console/home` (row chip, nav count) · the re-link bar on any other console page · `console/school-admin` (class link count) · a direct link · the pop-up (on the page itself)
Exit to: `console/relink-approval` (unchanged page, still reachable from More) · `console/class-transfer` (moves page) · `console/roster` (same page)

## States

- **nothing waiting** (mock `states-{lc}`): no banner, no pop-up, no bar, no asking-to-join group, no nav count; a class learner shows **In class** unless a quiet state applies (**Waiting for a seat**, **Moving {date}**, **Move waiting**, **New**); family: no default chip; the home row has no chip. The review sheet's empty state ("Nothing is waiting.", focus on Close) is in `sheet-empty-{lc}`.
- **waiting** (above).
- **expired while open**: the re-link chip and item vanish at the next poll; an Approve answering `409 expired` shows the shipped expired line on the card, then the chip falls to the next state (usually **In class**).
- **loading**: the roster's skeleton; chips render only after the lists arrive (no flash of **In class** before a waiting chip: the chip slot stays empty until the model is built).
- **error**: a list that fails adds nothing (never a guessed chip); a decision that fails keeps the item with the shipped "didn't go through" line and [ Try again ].
- **empty class**: the banner and the asking-to-join cards can still show incoming moves; the roster is empty.

## Data needs

- reads: `GET /:id/roster` (with `pending`, `incoming` once GX-W is deployed), `GET /:id/relink-requests` (alone every 20 s while visible), `GET /:id/transfer-requests`, `GET /:id/class-moves`; home, nav and bar: `GET /api/spaces` (`spaces[].attention` once GX-W is deployed; a school admin's child classes from the school's `GET /:id/attention`; every 30 s while visible; without it the lists once on mount and on focus, no timer)
- writes: the shipped relink approve / deny, class-move accept / decline, transfer approve / decline; `sessionStorage` `hr:console:relinkShown` and `hr:console:relinkReminded` (request ids)
- telemetry: none added

## Open questions

- None blocking. Owner choices with defaults: amendment section 15 (GX-OD-1 In class shown; GX-OD-4 no join approval; GX-OD-6 pop-up on).
