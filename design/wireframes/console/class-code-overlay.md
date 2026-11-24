# Console/Class code overlay — show the code, not the class (wireframe v1)

Spec: `docs/specs/AMENDMENTS-CLASS-CODE-OVERLAY.md` (draft, row CO-0; work order WO-09 = WO-30 of `docs/roadmap/review-2026-11/`) · amends the class page order of `console/roster.md` ("Class page order (GX-7)", Panels K and L) and reuses its "Join link and QR code" (Panel J)
Code today: `apps/web/src/app/(console)/teach/space/page.tsx` (the code inside Invite students at `:740`, under the roster; "Revisit" letters on every card at `:685-691`, words at `:692`) · `components/console/ClassPageParts.tsx` (`ClassActionBar`, `InviteDisclosure`) · `components/console/JoinLinkParts.tsx` (`JoinLinkQr`)
Audience: **teacher** (presses the button); **the room** (reads the classroom screen: learners of any age, sometimes their families)
Mock: `design/screens/console/class-code-overlay.md`

## Scenario (Given-When-Then)

Given: a teacher's class page is on the classroom screen (a projector or a TV), the class has learners, and a learner walks in late with no code
When: the teacher presses **Show the code**
Then: the whole screen shows the class name, the code very large, one line on how to join, a QR code and when the code ends, and nothing else: no name, no initials, no progress, no tabs or counts; Escape or Close brings the class page back with focus on Show the code

Until OD-CO7 is answered, the teacher reaches Show the code on the class page, so if that page is already on the screen the room sees the roster until the button is pressed. OD-CO7 (a) puts the button on the teacher home (Panel F), which names no learner.

And, as a second defence, given the class page itself ends up on the screen: each card's letters and words to revisit are folded until the teacher opens that one card.

## Screen goal

"Let a room join the class from a shared screen without showing anything about any learner."

## Box diagram

Panel A — the class page's action bar, a class with learners (GX-7 Panel K with the new button)

```
+--------------------------------------------+
| [< Back to Classes]                        |
| Sunday Class A                             |
| 12 students                                |
| +----------------------------------------+ |
| | This week                              | |
| +----------------------------------------+ |
| [[ Plan: Week of Nov 23 ]]                 |  <- primary, unchanged
| [ Plan this term ] [ Lecture mode ]        |
| [ Class report ]  [ Show the code ]        |  <- NEW: secondary, in the bar, never under More
| [ More v ]                                 |
|  while something waits, after Show the code:|
|  [ 1 new device needs your OK ] (amber)    |
| Students                                   |
| ... cards (Panel D) ...                    |
| | Invite students · code SUN234       v  | |  <- unchanged: Copy, Regenerate, link, QR toggle
+--------------------------------------------+
```

- Order in the bar: the everyday buttons, then **Show the code**, then any waiting entry, then More.
- An empty class (Panel L): **[[ Plan this week ]] [ Plan this term ] [ Show the code ] [ More v ]**; Invite students still leads the page, open.
- No button when the class has no live code (none yet, ended, archived class, or a role that is sent no code); Invite students keeps **Create a code**.

Panel B — the overlay on a landscape window at least the regular width (laptop, projector, TV): two columns

```
+------------------------------------------------------------------------+
|                                                                        |
|   Sunday Class A                          +------------------------+   |  <- heading: the class name
|                                           |                        |   |
|   Class code                              |                        |   |  <- caption
|                                           |        [QR CODE]       |   |  <- no taller than the window leaves
|   S U N 2 3 4                             |                        |   |  <- the code: largest, one line,
|                                           |                        |   |     space between letters
|   expires in 18 days                      +------------------------+   |
|   Tap "Join a class" in Hangul Route       Scan it with the camera of  |  <- the QR's shipped caption, centred
|   and type this code.  <- OD-CO5 (yes)        a phone or tablet.       |
|                                                            [ Close ]   |  <- the one control, bottom corner
+------------------------------------------------------------------------+
   nothing else: no tabs, no counts, no roster
```

- Covers the whole window, opaque: nothing of the page shows round it or through it.
- Both columns centred in the height; the code and the whole QR fit the first screen on 16:9 and 4:3, and at 150 % and 200 % browser zoom (the window is then smaller in CSS px).
- Close at the bottom corner: in reach on a wall-mounted touch panel; Escape works from anywhere.

Panel C — the overlay on a phone or a narrow window: one column

```
+-----------------------------+
|                 [ Close ]   |
|       Sunday Class A        |
|         Class code          |
|        S U N 2 3 4          |  <- never wraps; shrinks to fit the column
|     expires in 18 days      |
|  (how-to-join line, OD-CO5) |  <- next to the code it talks about
|  +-----------------------+  |
|  |                       |  |
|  |       [QR CODE]       |  |
|  |                       |  |
|  +-----------------------+  |
|  Scan it with the camera of |
|  a phone or tablet.         |
+-----------------------------+
   scrolls up and down when it does not fit (large text); never sideways
```

Panel D — a class roster card, folded (the default) and open

```
+----------------------------------------+    +----------------------------------------+
| (o) Mina                  Some reading |    | (o) Mina                  Some reading |
| Practiced yesterday · 36 min this week |    | Practiced yesterday · 36 min this week |
| o o o ... On Stage 1 · Quests 7 / 15   |    | o o o ... On Stage 1 · Quests 7 / 15   |
| Words: 12 collected · 4 strong         |    | Words: 12 collected · 4 strong         |
| [ What to revisit                  v ] |    | [ What to revisit                  ^ ] |  <- a disclosure button
| Week of Nov 23: 2 of 3 done            |    |   Revisit: ㅂ · ㅅ                     |  <- body, mounted only when open
| [ See report ] [ Send a note ]         |    |   Words to revisit: 사과 sagwa (apple) |  <- OD-CO1
+----------------------------------------+    | Week of Nov 23: 2 of 3 done            |
                                              | [ See report ] [ Send a note ]         |
                                              +----------------------------------------+
```

Panel E — a card with nothing to revisit (OD-CO2: the button is on every card with a summary), and a card with no summary

```
+----------------------------------------+    +----------------------------------------+
| (o) Jun                   Reads well   |    | (o) Suji                  New          |
| Practiced today · 52 min this week     |    | No practice shared yet                 |  <- no summary: no button
| o o o ... On Stage 2                   |    +----------------------------------------+
| [ What to revisit                  ^ ] |
|   Nothing to revisit yet.              |
+----------------------------------------+
```

Panel F — OD-CO7 (a), awaiting owner: Show the code on a teacher home class row (counts only, no learner)

```
+----------------------------------------------+
| Sunday Class A                     [ Open → ] |
| 4 students                                    |
| ---------------------------------------------- |
| [ Class report ] [ Notes ] [ Show the code ]  |  <- the same overlay, over the home
+----------------------------------------------+
```

## Interaction points

- [ Show the code ] → closes every open card, then opens the overlay (Panel B or C); focus goes to the overlay's heading; the page behind can no longer be reached by keyboard, pointer or screen reader, and does not scroll.
- Print (Ctrl+P / Cmd+P) while it is open → only the overlay prints.
- [ Close ] → closes the overlay; focus back on Show the code.
- Escape (from anywhere while it is open) → the same as Close.
- Tab / Shift+Tab inside the overlay → stays on Close (the only control).
- Browser back → leaves the class page, as it always has (no history entry for the overlay).
- [ What to revisit v ] on a card → opens that card's body only; again → closes it. The state is kept while the page stays open and forgotten on the next visit.
- No Copy, no Regenerate, no Create a code and no Show QR code toggle in the overlay; those stay in Invite students.

## Navigation graph

Enter from: `console/roster` (class page) · its Panel L (an empty class) · `shell/teacher-home` class row (only if OD-CO7 (a) is taken)
Exit to:    `console/roster` (Close, Escape; focus on Show the code) · whatever the browser back leads to (the page itself is left)
The cards' disclosure stays on `console/roster`.

## States

- **success**: Panels B and C with a live code.
- **empty class**: the same overlay; the button is in the bar of Panel L.
- **no live code** (none yet, ended, archived class, a role sent no code): no Show the code; Invite students shows **Create a code** or nothing, as today.
- **code replaced while open** (Regenerate in another tab at once; on another device within the 20 s re-read while open): the code and the QR change in place; the overlay stays.
- **code ends or the class goes while open** (the re-read returns no code, or the class is gone or not yours): the overlay closes by itself; focus goes to Show the code, or to the page head when the button is gone, or to the error panel when the page head is gone too.
- **a new device asks while open**: its pop-up does not open over the overlay; it opens after Close (a request that closes in its 10 minutes while the overlay stays up is missed; the learner asks again).
- **offline**: the overlay works (it draws from what the page already holds, the QR is drawn in the page).
- **covered or locked** (the tab hidden, the next input after 15 idle minutes, the learner chooser opened in another tab): the grown-up cover or lock screen shows no learner data; after the unlock the overlay opens again before the roster is drawn (a session flag holding the space id only).
- **printed**: the overlay only.
- **loading / error**: no overlay can open before the roster is read (the bar is not drawn yet); a failed read shows the page's error panel, as today, and no button.
- **card, folded** (default) / **open with lines** / **open with nothing** ("Nothing to revisit yet.") / **no summary** (no button): Panels D and E.

## Data needs

- reads (all already on the page, no new request): `roster.space.name`, `roster.space.kind`, `roster.space.archivedAt`, `roster.joinCode`, `roster.joinCodeExpiresAt` (`GET /api/spaces/:id/roster`; a code only for a manager and only while live); the join link from `rosterJoinLink` (`appUrl()` origin, the code alone in the fragment); the UI locale for the expiry words.
- never read by the overlay: `roster.learners` (names, avatars, levels, summaries), seats, plans, re-links, moves. The overlay gets a view built from the five fields above, never the roster.
- writes: none to the server. No telemetry. One session-only flag while the overlay is open (the space id, never a name), through the safe-storage wrapper, so an unlock reopens it; the cards' open state is page memory.

## Open questions

Owner decisions in the spec, §10. Decided 2026-11-23, as recommended: OD-CO1 (the fold takes "Words to revisit" too), OD-CO2 (the button on every card with a summary), OD-CO3 (no Open all), OD-CO4 (no browser full screen), OD-CO5 (the how-to-join line). Awaiting the owner (review 2026-11-23):

- OD-CO6 (re-opened): what stays on a folded card (level pill, starting spot, segments, quests, minutes, plan readout) — keep it, fold the level pill and starting spot too, or a presenting mode that hides every per-learner line (recommended: keep it if OD-CO7 is taken, presenting mode if not)
- OD-CO7 (new): Show the code on the teacher home (Panel F; recommended), a `#code` link to the class page, or the class page only
- OD-CO8 (new): with one synced learner the class's "together" lines and first-try line are that learner's; draw them only from 3 contributing learners (recommended), from 2, or keep them
- To check with a pilot class: whether 4:3 projectors in Hangul schools need the code larger than the stage scale gives (the spec's acceptance check §3.9 is on a real projector).
