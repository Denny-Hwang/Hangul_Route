# /teach/space/transfers: the requests page, class variant (design mock v1, for T-6b)

Wireframe: `design/wireframes/console/class-transfer.md` screen 2 · spec 4.2 (views), 4.8, 4.9, 4.10, 4.13 · mock: `mock/requests.html`, `mock/requests-states.html` · shots: `shots/requests-375.png`, `-1280.png`, `-320-text200.png`, `-390-first.png`, `requests-states-375.png`, `-1280.png`

URL `/teach/space/transfers?id=<space id>` (`ROUTES.spaceTransfers(id)`); document title "Class moves - Hangul Route" (no learner, class or teacher name in the URL or the title, T14). One reading column (`layout.maxWidth.reading`) inside the adult frame (teacher persona, Classes current).

## Layout

```
 < Back to Sunday Class A                         text link, brand.secondaryDark
 Class moves (h1)
 Sunday Class A                                   space name, size.bodyLg, text.secondary
 [visually hidden polite live region]
 Leaving this class (h2)
 +--------------------------------------------------+
 | (chip) Jun          asked by the family · 1 day ago|
 |  v Family        said yes                        |  three steps: glyph + who + state word
 |  - This class    waiting                         |  one per row on phones; three boxes from 45em
 |  - New class     waiting                         |
 |  Jun's family asked to move to another class.    |
 |  (( Agree ))                       ( Not now )   |
 +--------------------------------------------------+
 | (chip) Mina   asked 2 days ago · 12 days left    |
 |  v Family said yes · v This class you said yes · - New class waiting
 |  Nothing changes until all three say yes.        |
 |                              Cancel request      |  quiet text-weight button
 +--------------------------------------------------+
 | (chip) Sam                                       |
 |  (check-circle) Everyone agreed. The move happens on Oct 14.
 |                              Cancel request      |
 +--------------------------------------------------+
 | A student moved to another class        Oct 3    |  history: one list, date only, no names
 | This request ended.                     Oct 1    |
 +--------------------------------------------------+
 Joining this class (h2)
 | (chip) M. K. (Some reading)                      |  rosterAlias always, level pill as on the roster
 |  The family has said yes.                        |
 |  (( Accept ))  ( Not now > )                     |  Not now opens two quiet reasons
 | (chip) M. K. (Some reading)                      |
 |  [|| Everyone has said yes. This class is full right now.]   amber nudge tint
 |  ( Try again )                                   |
```

## Cards

| Card | Who sees it | Words | Actions |
|---|---|---|---|
| Source, this class must answer (family started) | source manager | "{Name}'s family asked to move to another class." (or "... to {Destination}." only when the family ticked `introduce`) | **Agree** (primary), **Not now** (plain, no menu) |
| Source, waiting for others | source manager | "Nothing changes until all three say yes." | **Cancel request** (quiet) |
| Source, this class started it, no family answer yet | source manager | "Waiting for the family." and "New class: {Destination}" (this class named it) | **Cancel request** |
| Both classes owned or taught by this account directly | that teacher | the family step stays separate | **Agree for both classes** |
| A school admin agreed for this class (cascade) | only the class whose own slot was filled `via: school_admin` | "Agreed by the school admin." | as the card's state |
| Approved, no room yet | source and family | "Waiting for room in the new class." in the room block | none (source); Cancel (family) |
| Scheduled | everyone who can see the request | "Everyone agreed. The move happens on {date}." | **Cancel request** (starter, caregivers, the learner's device) |
| Destination, family said yes | destination manager | initials, avatar, level pill; "The family has said yes."; "Coming from {Source}." first only with `introduce` | **Accept** (primary), **Not now** with reasons |
| Destination, approved, no room | destination manager | room block: `cap_class` "Everyone has said yes. This class is full right now." · `cap_school` "Everyone has said yes. The school is full right now." | **Try again** |
| History (30 days) | the page's space | source: "A student moved to another class" · destination: "A student joined this class" · any ending: "This request ended." | none |
| After a move into this class | destination manager, once | "Your class code may have been shared during the move. You can make a new one." | **New class code** (the existing regenerate flow with its confirm) |

- **Steps** are an `ol` labelled "Who has said yes" (`a11y`), each item a glyph (`check` in `feedback.successDark` for yes, `dash` in `text.muted` for waiting), the step name and the state word ("said yes", "you said yes", "waiting"). The state is in the word and the glyph shape, never in colour alone (check board). A `not_required` source step (the source was archived after the family agreed, 4.13) is **not drawn**: the family card then shows two steps (Family, the new class). The archived class's own page is read-only and shows the card without actions.
- **Destination step labels.** A destination card has no step list: the destination never learns whether the source agreed (TransferDestinationView carries this class's own state only). It reads "The family has said yes." until it answers, then the scheduled or room line.
- **No card names who said no** (anti-shame, 4.2 Views). Every ending is "This request ended." with a date. The deciding side keeps its own choice in its own history only (the destination's "No room"), which the page does not draw beyond the ended line in v1.
- **`cap_learner` at execution** (the learner already holds the class cap outside the source; rare: join caps it at 3) shows the room block as "Everyone has said yes. The move is waiting." with no Try again on the destination, because the destination cannot fix it; the learner side reads the family line of `family-page.md`.
- **Not now on the receiving class** is a disclosure button ("Not now" with a chevron, `aria-expanded`, accessible name "Not now, choose a reason" so it is not confused with the inner Not now; the visible words stay inside the name) that opens a group of two buttons, **Not now** and **No room** (group label "Choose an answer"). Not an ARIA menu: two buttons need no roving focus. Other cards have a plain **Not now**. No free text anywhere.
- **"Agreed by the school admin."** shows only on the card of the class whose own step the admin gave. The destination never learns the source's answer (D3), so the line never crosses from one class to the other. Follow-up for the backend (before T-6b): `classCommon` in `packages/backend/src/lib/transfer-views.ts` sets `agreedBySchoolAdmin` from either slot's `via` for both views; the source view should read `source.via` only and the destination view `destination.via` only.
- **Days left** ("12 days left") is plain meta text on the source teacher's cards only (`daysLeft`, spec 4.8); no learner, family or destination surface shows a countdown, and nothing changes colour as it shrinks.

## Order, refresh, announcements

Order within a refresh: waiting for this class first, then waiting for others, then scheduled, then the history list. The page refreshes every 30 s; it re-sorts only on reload or when focus is outside every card; a change is announced once through the visually hidden polite live region ("Class moves updated."), never by moving focus. That region is the page's only live region: room blocks and card lines are plain text (no `role="status"`), so a refresh never re-announces every blocked card; `role="status"` is kept for one-off confirmations only (Request sent, Moved). Nothing auto-dismisses: a finished card stays until the next manual refresh, then joins the history.

## Entry points (drawn on `requests-states.html`)

| Where | Zero waiting | N waiting for this space |
|---|---|---|
| Class roster, header button row (beside **Re-link requests**, before **Settings**) | **Class moves** (permanent) | **2 class moves waiting** (the same button, as the Re-link button does) |
| Family roster | **Class moves** (permanent) | **1 class move waiting** |
| Teacher home, class row link line | nothing | **2 class moves waiting** → this page |
| Teacher home, school row | nothing | one link per child class with a waiting move, **Saturday Class B: 2 class moves waiting**, each straight to that class's requests page (counts only, spec 4.8; from `TransferSchoolCountView`) |
| Family home, family actions | nothing | **1 class move waiting** → the family page |

"Waiting" counts requests where this space's own step is `waiting` (`pendingCount`). Every entry point renders only when `NEXT_PUBLIC_CLASS_TRANSFER` is set and hides for the session after the first `422 transfers_locked`.

## States

| State | Drawn |
|---|---|
| loading | two skeleton cards (`surface.sunken` lines), no text |
| empty | each group: "Nothing waiting." on `surface.sunken`; the page stays reachable |
| action failed | the card stays; "Didn't go through" (`role="alert"`) and **Try again** as the card's primary |
| ended meanwhile (409 `not_open` / `expired`) | the card becomes the history line "This request ended." |
| a teacher answer lost the race (409 `request_changed`) | the card stays open; "Something changed. Look again." (`role="alert"`) and **Refresh**, which re-reads the list and redraws the card |
| Try again found the request asked again (409 `consent_outdated` / `not_approved`) | the card returns to its waiting state: on the destination "You said yes. Nothing changes until everyone says yes."; on a source that also manages the destination, its steps with "Nothing changes until all three say yes." No reason is given |
| 401 | "Please sign in again." (existing key) and **Sign in again**, back to the same page |
| 403 | "You can no longer answer this class's moves." |
| locked or stale link | "Class moves aren't available yet." with **Back to the roster** |
| archived class | the page is read-only: no Agree, Accept or Cancel; history stays |

## Tokens

| Part | Tokens |
|---|---|
| h1 / space line | `size.title` bold / `size.bodyLg` semibold `text.secondary` |
| Group heading | `size.bodyLg` bold |
| Card | `surface.paper`, `borderWidth.thin` `border.subtle`, `radii.lg`, `shadows.card`, padding `spacing.lg`, gap `spacing.md` |
| Who line | avatar chip 28 px, `size.bodyLg` bold; alias with `tracking.wide` |
| Meta | `size.bodySm` `text.secondary` |
| Steps | rows `spacing.xxxl` min height, rules `border.subtle`; from 45em boxes with `radii.md`; yes word `feedback.successDark` semibold, waiting word `text.muted` |
| Room block | `feedback.nudgeLight` fill, `borderWidth.thick` `feedback.nudge` left bar (decoration), `pause` glyph and text in `text.primary`, `radii.md` |
| History | paper list, rows split by `border.subtle`; date `text.muted` `size.bodySm` |
| Buttons | `.btn` (64 px), primary `brand.primary`; Cancel request `btn-quiet` (`text.secondary`, no border) |

`feedback.danger` is not used on any move surface.

## Accessibility

Each card is an `article` labelled by its who line. Tab order follows the card order. All controls are at least 64 x 64 (measured on every mock at 320, 375, 768 and 1280). At 320 with 200 % text the head wraps, the steps stay one per row and nothing scrolls sideways (`requests-320-text200.png`).
