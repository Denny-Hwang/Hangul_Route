# Learner app: the Classes & family card with moves (design mock v1, for T-7b)

Wireframe: `design/wireframes/console/class-transfer.md` screen 4 · spec 4.12 (row variants, Classes card), 4.2 guards 8, 10, 11 · code: `apps/mobile/src/components/SpacesCard.tsx` · mock: `mock/classes-card.html` · shots: `shots/classes-card-375.png`, `-1280.png`

The card is today's `SpacesCard` (title `caregiver.spaces.title`, rows with name, kind caption and **Leave**, then **Join a class**). Moves add at most one button per class row and at most one line or pending row under the rows. **Nothing new renders while the inbox says `transfersEnabled: false`.** The variant is chosen from the inbox and the device before any tap (below), so a PIN is never asked for a dead end.

## Choosing the variant

There are two questions, and they have different inputs.

**1. With an open request** (one per learner, 4.9), the request's own `learnerRoute` (inbox, computed per request by the server's `learnerRouteFor`) decides what the device may do with it. No class row shows **Move** while a request is open: the pending row is the only action.

| `learnerRoute` | Pending row action | Why |
|---|---|---|
| `caregiver` (b) | gated **Review** → the read-only sheet; its only action is the veto | the yes happens in the console; guard 11 keeps the veto on the device |
| `device` (c), learner consent reset | gated **Review** (primary) → `ApproveTransfer` | only a learner-started request can be `device` |
| `device` (c), any other state | gated **Review** → the read-only sheet with the veto | the learner side already said yes; nothing to answer |
| `none` | gated **Review** → the read-only sheet with the veto, and the line "This move can't be answered here." | nobody can say yes right now (a teacher-started request after `selfManaged` was set or the family left; a learner-side one with device consent off). Never a PIN prompt for setup |

**2. With no open request**, the inbox has no `learnerRoute`, so T-7a computes the Move rule on the device from what it already has (no new field):

```
device scope 'class'                                   -> (a)
!transferDeviceConsent                                 -> nothing (no Move, no line)
has a family membership && !selfManaged                -> (b): nothing until a request exists
otherwise, consent-gate.ts (spec 4.11, device rules):
  learnerType 'self' with selfConsentAcceptedAt        -> (c) Move (direct on a self-only device with no PIN)
  managed, PIN exists, pinCreatedAt absent or >= 24 h  -> (c) Move (gated)
  managed, PIN exists, pinCreatedAt < 24 h             -> (d') "Moves open one day after the PIN is set." (no button)
  managed, no PIN                                      -> (d) the PIN line and Set up PIN
```

"Has a family membership" reads the inbox memberships of kind `family`; the server decides the same thing from caregiver accounts (`hasCaregiverRoute`), so a race (a family made after the inbox was read) answers `409 caregiver_required`, whose line is in `app-sheets.md`.

## Variants and states

| Variant / state | Row buttons | Under the rows |
|---|---|---|
| (a) class tablet (`scope: 'class'`, inbox `transfers: []`) | **Leave** | "Use your grown-up's rescue code first." (once per card) |
| device consent off (launch state until G6), or (b) with nothing asked | **Leave** | nothing: the card reads as today |
| (b) a teacher asked | **Leave** | pending row "{Source} asked about a move." with gated **Review** (ghost), then "Ask the grown-up with the account to answer this in the console." |
| (c) nothing asked | **Move** (gated) on **every** class row, then **Leave** | nothing |
| (c) learner consent reset | **Leave** | "Asked: a move to {Destination}. Please check this again." with gated **Review** (primary) |
| (d) managed, no PIN | **Leave** | "A grown-up needs to set up a PIN first. Open Profile, then Grown-ups." and **Set up PIN** (`PinEntry`, `mode: 'setup'`) |
| (d') PIN made less than a day ago | **Leave** | "Moves open one day after the PIN is set." (no button) |
| learner-side request waiting for the classes (any route) | **Leave** | "Asked: a move to {Destination}. Waiting for the classes to answer." (one class left: "Waiting for the other class to answer.", spec 4.12) with gated **Review** (ghost) |
| approved, waiting for room (any route) | **Leave** | pending row holding the room block (`feedback.nudgeLight`, `pause` glyph, "Waiting for room in the new class.", as on the console) with gated **Review** |
| route `none` | **Leave** | "{Source} asked about a move. This move can't be answered here." (learner-side: "Asked: a move to {Destination}. ...") with gated **Review** |
| planned (cooling-off), any full-scope variant | **Leave** | "A move is planned for {date}." with gated **Cancel** |
| ended (while the inbox still lists it) | **Leave** | "This request ended." (one neutral line, no actor, no button) |
| offline | **Move** disabled | "This needs internet. Try again when you are online." as Move's description |
| after the move, class tablet of the old class (401 on the inbox) | none | "Join your new class again." (`role="status"`, a one-off) |

- **The veto in (b) and `none`.** Guard 11 lets the learner's full-scope device decline or cancel any open request. So every pending row keeps one gated **Review** opening the read-only sheet, whose only actions are the veto (**Not now** for a teacher-started request, **Cancel the request** for a learner-side one) and **Back** (`app-sheets.md`). No PIN is asked for a yes the device cannot give (spec 4.12 (b), amended with D8).
- **"Waiting for the family."** is not drawn in the app: the state the spec once named for it is route `none`, drawn above with its own line (D13).
- **Gate mark.** A button behind the grown-up gate carries the `lock` glyph (16 px, the label's colour) before its label, and its accessible name ends with "(PIN required)" (`caregiver.gated`). On a self-only device with no PIN the gate opens directly (`gate-route.ts`), so the glyph is not drawn.
- **Leave** keeps its confirm dialog; a failure now shows `caregiver.retry.offline` under the rows instead of nothing (the small `SpacesCard.tsx:36` fix).
- **Offline**: Move is disabled with the offline line as its description; nothing is queued.
- **Live regions.** Lines on the card are not live regions; only one-off results ("Join your new class again.", the moved line of `app-sheets.md`) use `role="status"`.

## Tokens

| Part | Tokens |
|---|---|
| Card | design-system `Card` (`surface.paper`, `radii.lg`, `shadows.card`, padding `spacing.lg`) |
| Row | name `Body` semibold, kind `Caption` `text.muted`; buttons `Button` ghost `sm` (64 px), `spacing.sm` apart |
| Quiet line | `size.bodySm` `text.secondary`, `leading.relaxed` |
| Pending row | `surface.sunken`, `radii.md`, padding `spacing.sm` `spacing.md`; Review primary (asks this device) or ghost (read-only, veto) |
| Room block in the pending row | as `requests-page.md`: `feedback.nudgeLight`, `borderWidth.thick` `feedback.nudge` bar (decoration), `pause` glyph and text `text.primary`; full row width |
| Lock glyph | `Icon name="lock"` 16, `brand.primary` on ghost, `text.onPrimary` on primary |

## Accessibility

Each Move button names its class ("Move from Sunday Class A (PIN required)"), like Leave does (`a11y.leaveSpace`); the disabled offline Move keeps the same name ("Move from Sunday Class A") with the offline line as its description. Every Review is named "Review the move" (plus "(PIN required)" when gated). All buttons are at least 64 x 64; rows wrap their buttons under the name when the width is short and never scroll sideways.
